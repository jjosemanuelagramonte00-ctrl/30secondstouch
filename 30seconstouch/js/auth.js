import { auth, db } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const guestButtons = document.getElementById("guestButtons");
const userPanel = document.getElementById("userPanel");
const userName = document.getElementById("userName");
const userPhoto = document.getElementById("userPhoto");
const navUserCoins = document.getElementById("navUserCoins");

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/**
 * ❌ SOLUCIÓN A LA BANDERA MUNDO: Sistema de detección reforzado por IP + Zona Horaria Local.
 */
async function obtenerPaisAutomatico() {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (response.ok) {
      const data = await response.json();
      if (data.country_code) return data.country_code.toUpperCase();
    }
  } catch (error) {
    console.warn("Fallo en API de IP, recurriendo a detección interna del navegador...");
  }

  // Resguardo inteligente por zona horaria si la API falla o es bloqueada
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      if (tz.includes("Buenos_Aires") || tz.includes("Cordoba") || tz.includes("Salta")) return "AR";
      if (tz.includes("Mexico")) return "MX";
      if (tz.includes("Bogota")) return "CO";
      if (tz.includes("Santiago")) return "CL";
      if (tz.includes("Lima")) return "PE";
      if (tz.includes("Madrid")) return "ES";
      if (tz.includes("Caracas")) return "VE";
    }
  } catch (e) { /* Silenciar error */ }

  return "AR"; // Resguardo global definitivo seguro
}

function showGuestStatsMessage(isGuest) {
  const statsContainer = document.querySelector(".stats");
  if (!statsContainer) return;

  if (isGuest) {
    statsContainer.innerHTML = `
      <div style="grid-column: span 4; text-align: center; padding: 20px 0; color: var(--text-muted); font-weight: 600; letter-spacing: 1px;">
        🔒 INICIA SESIÓN PARA VER Y GUARDAR TUS ESTADÍSTICAS
      </div>
    `;
  } else {
    statsContainer.innerHTML = `
      <div>
        <p class="stat-label">MEJOR PUNTUACIÓN</p>
        <p class="stat-value" id="bestScoreStat">0</p>
      </div>
      <div>
        <p class="stat-label">CHANCES HOY</p>
        <p class="stat-value" id="chancesTodayStat">3</p>
      </div>
      <div>
        <p class="stat-label">CLICKS TOTALES</p>
        <p class="stat-value" id="totalClicksStat">0</p>
      </div>
      <div>
        <p class="stat-label">PRECISIÓN</p>
        <p class="stat-value" id="accuracyStat">0%</p>
      </div>
    `;
  }
}

async function verificarRecompensaDiaria(userRef, data) {
  const todayStr = new Date().toISOString().split("T")[0];
  const ultimaFechaRecompensa = data.ultimaFechaMonedaDiaria || "";
  
  if (ultimaFechaRecompensa !== todayStr) {
    const currentCoins = data.coins !== undefined ? data.coins : 0;
    const newCoinsBalance = currentCoins + 5;
    
    await updateDoc(userRef, {
      coins: newCoinsBalance,
      ultimaFechaMonedaDiaria: todayStr
    });
    
    if (navUserCoins) navUserCoins.textContent = newCoinsBalance;
    console.log("¡Recompensa diaria otorgada!");
  }
}

async function loadStats(uid) {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const bestScore = document.getElementById("bestScoreStat");
    const totalClicks = document.getElementById("totalClicksStat");
    const accuracyStat = document.getElementById("accuracyStat");
    const chancesTodayStat = document.getElementById("chancesTodayStat");

    if (navUserCoins) navUserCoins.textContent = data.coins !== undefined ? data.coins : 0;
    if (bestScore) bestScore.textContent = data.bestScore || 0;
    if (totalClicks) totalClicks.textContent = data.totalClicks || 0;
    if (userName && data.username) userName.textContent = data.username;

    let currentChances = data.intentosDiarios !== undefined ? data.intentosDiarios : 3;
    const lastPlayedDateStr = data.ultimaPartidaFecha ? data.ultimaPartidaFecha.split("T")[0] : "";
    const todayStr = new Date().toISOString().split("T")[0];

    if (lastPlayedDateStr !== todayStr && data.ultimaPartidaFecha) {
        currentChances = 3;
        await updateDoc(userRef, { intentosDiarios: 3, ultimaPartidaFecha: new Date().toISOString() });
    }

    if (chancesTodayStat) chancesTodayStat.textContent = currentChances;

    const playBtn = document.querySelector(".btn-play");
    if (playBtn) {
        if (currentChances > 0) {
            playBtn.innerHTML = `JUGAR AHORA ⚡`;
            playBtn.style.background = "linear-gradient(180deg, var(--orange-soft), var(--orange))";
        } else {
            playBtn.innerHTML = `🎬 VER ANUNCIO (+3 INTENTOS)`;
            playBtn.style.background = "linear-gradient(180deg, #44332a, #2a1e17)";
        }
    }

    if (accuracyStat) {
      let globalAccuracy = 100;
      if (data.accuracy !== undefined) {
        globalAccuracy = data.accuracy;
      } else if (data.totalClicksRegistered && data.totalClicksRegistered > 0) {
        globalAccuracy = Math.round(((data.totalClicksWithSuccess || 0) / data.totalClicksRegistered) * 100);
      }
      accuracyStat.textContent = globalAccuracy + "%";
    }

    await verificarRecompensaDiaria(userRef, data);

  } catch (error) {
    console.error("Error cargando estadísticas:", error);
  }
}

async function googleLogin() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    const paisDetectado = await obtenerPaisAutomatico();

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photo: user.photoURL,
        bestScore: 0,
        gamesPlayed: 0,
        totalClicks: 0,
        totalClicksWithSuccess: 0,
        totalClicksRegistered: 0,
        accuracy: 100,
        intentosDiarios: 3,
        coins: 0, 
        countryCode: paisDetectado, 
        ultimaFechaMonedaDiaria: "",
        ultimaPartidaFecha: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    } else {
      const datosExistentes = userSnap.data();
      const camposActualizar = {
        name: user.displayName,
        photo: user.photoURL
      };
      
      // Si la cuenta vieja tenía "Mundo" o no tenía countryCode, la re-forzamos a su país real
      if (!datosExistentes.countryCode || datosExistentes.countryCode === "Mundo") {
        camposActualizar.countryCode = paisDetectado;
      }

      await setDoc(userRef, camposActualizar, { merge: true });
    }

  } catch (error) {
    console.error("Error en Login:", error);
  }
}

if (loginBtn) loginBtn.addEventListener("click", googleLogin);
if (registerBtn) registerBtn.addEventListener("click", googleLogin);
if (logoutBtn) logoutBtn.addEventListener("click", () => signOut(auth).catch(console.error));

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.body.classList.remove("guest");
    document.body.classList.add("logged");
    if (guestButtons) guestButtons.style.display = "none";
    if (userPanel) userPanel.style.display = "flex";

    let firstName = user.displayName ? user.displayName.split(" ")[0] : "Jugador";
    if (userName) userName.textContent = firstName;
    if (userPhoto && user.photoURL) userPhoto.src = user.photoURL;

    showGuestStatsMessage(false);
    loadStats(user.uid);
  } else {
    document.body.classList.remove("logged");
    document.body.classList.add("guest");
    if (guestButtons) guestButtons.style.display = "flex";
    if (userPanel) userPanel.style.display = "none";
    showGuestStatsMessage(true);
    
    if (navUserCoins) navUserCoins.textContent = "0";
    const playBtn = document.querySelector(".btn-play");
    if (playBtn) {
        playBtn.innerHTML = `JUGAR AHORA ⚡`;
        playBtn.style.background = "linear-gradient(180deg, var(--orange-soft), var(--orange))";
    }
  }
});

// CONTROL INTERACTIVO DEL MENÚ DESPLEGABLE MÓVIL
const dropdownTrigger = document.getElementById("dropdownTrigger");
const dropdownMenu = document.getElementById("dropdownMenu");

if (dropdownTrigger && dropdownMenu) {
    dropdownTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle("active");
    });
    document.addEventListener("click", () => {
        dropdownMenu.classList.remove("active");
    });
}
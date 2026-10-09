import { auth, db } from "./firebase.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Elementos del DOM
const dayBadge = document.getElementById("dayBadge");
const challengeCard = document.getElementById("challengeCard");
const challengeIcon = document.getElementById("challengeIcon");
const challengeTitle = document.getElementById("challengeTitle");
const challengeDesc = document.getElementById("challengeDesc");
const gameZone = document.getElementById("gameZone");
const gameTimer = document.getElementById("gameTimer");
const gameClicks = document.getElementById("gameClicks");
const targetClicks = document.getElementById("targetClicks");
const challengeTarget = document.getElementById("challengeTarget");
const actionArea = document.getElementById("actionArea");
const btnStartChallenge = document.getElementById("btnStartChallenge");
const lockCard = document.getElementById("lockCard");
const cooldownTimer = document.getElementById("cooldownTimer");

// Estado del Jugador
let userChallengeDay = 1;
let currentChallenge = null;
let clicks = 0;
let timeLeft = 0;
let gameInterval = null;
let isPlaying = false;

// BANCO DE 50 DESAFÍOS MAESTROS
const CHALLENGES_BANK = [
  // Semana 1: Calentamiento y Velocidad Inicial
  { day: 1, type: "speed", target: 45, time: 10, icon: "⚡", title: "RÁFAGA INICIAL", desc: "Completa 45 toques en un lapso de 10 segundos para calibrar tus dedos." },
  { day: 2, type: "precision", target: 30, time: 8, icon: "🎯", title: "BLANCO EN MOVIMIENTO", desc: "El objetivo cambiará de posición con cada toque. Haz 30 clics en 8 segundos." },
  { day: 3, type: "endurance", target: 120, time: 25, icon: "🔋", title: "MARATÓN DE RESISTENCIA", desc: "Mantén un ritmo constante. Logra 120 toques en 25 segundos." },
  { day: 4, type: "sudden_death", target: 25, time: 7, icon: "💀", title: "MUERTE SÚBITA V1", desc: "No puedes errar. Si tocas fuera del círculo, tus clics vuelven a 0. ¡Haz 25 en 7s!" },
  { day: 5, type: "blind", target: 35, time: 8, icon: "🙈", title: "INSTINTO CIEGO", desc: "Los contadores están ocultos. Cuenta mentalmente y alcanza 35 clics en 8 segundos." },
  { day: 6, type: "speed", target: 55, time: 10, icon: "🔥", title: "FIEBRE DEL CLIC", desc: "El ritmo sube. Necesitas 55 toques en tan solo 10 segundos." },
  { day: 7, type: "precision", target: 40, time: 10, icon: "👾", title: "INVASIÓN EN LA PANTALLA", desc: "El círculo se mueve de forma errática. Captúralo 40 veces en 10 segundos." },

  // Semana 2: Ajuste de Dificultad e Hitos
  { day: 8, type: "endurance", target: 150, time: 30, icon: "🏋️", title: "SOPORTE CARDIOVASCULAR", desc: "Consigue 150 toques en un cronómetro de 30 segundos continuos." },
  { day: 9, type: "sudden_death", target: 40, time: 10, icon: "⚠️", title: "CAMPO MINADO", desc: "Cualquier toque en falso reinicia el marcador. Completa 40 clics en 10 segundos." },
  { day: 10, type: "blind", target: 50, time: 10, icon: "🔮", title: "MÁXIMA CONCENTRACIÓN", desc: "Pantalla limpia. Consigue 50 clics exactos o más en 10 segundos sin ver la métrica." },
  { day: 11, type: "speed", target: 70, time: 12, icon: "🚀", title: "VELOCIDAD DE ESCAPE", desc: "Destruye el mouse o la pantalla: 70 toques en 12 segundos." },
  { day: 12, type: "precision", target: 35, time: 8, icon: "🔎", title: "MICRO-OBJETIVOS", desc: "El círculo se reduce a la mitad de su tamaño original. 35 toques en 8 segundos." },
  { day: 13, type: "endurance", target: 100, time: 15, icon: "⏳", title: "CONTRA EL RELOJ", desc: "100 toques en 15 segundos. Exige reflejos perfectos." },
  { day: 14, type: "sudden_death", target: 50, time: 12, icon: "🧨", title: "DEDO DE ACERO", desc: "Ningún error permitido. Logra 50 clics perfectos en 12 segundos." },

  // Semana 3: Desafíos Complejos e Híbridos
  { day: 15, type: "blind", target: 60, time: 12, icon: "🌌", title: "VACÍO ESPACIAL", desc: "Logra 60 toques en 12 segundos guiándote solo por tu memoria rítmica." },
  { day: 16, type: "speed", target: 80, time: 13, icon: "⚡", title: "HIPER-MARCHA", desc: "Exige el máximo de tu mano: 80 clics en 13 segundos." },
  { day: 17, type: "precision", target: 50, time: 11, icon: "🛰️", title: "ÓRBITA INESTABLE", desc: "El círculo salta de esquina a esquina en cada clic. Logra 50 en 11s." },
  { day: 18, type: "endurance", target: 180, time: 35, icon: "🏃", title: "RESISTENCIA CYBERPUNK", desc: "Sostén el fuego cruzado: 180 clics en un extenso bloque de 35 segundos." },
  { day: 19, type: "sudden_death", target: 55, time: 11, icon: "☣️", title: "CERO TOLERANCIA", desc: "Presión absoluta. 55 clics en 11 segundos sin una sola falla externa." },
  { day: 20, type: "blind", target: 75, time: 15, icon: "🕳️", title: "ECLIPSE TOTAL", desc: "Consigue 75 toques en 15 segundos con la interfaz en negro absoluto." },
  { day: 21, type: "speed", target: 90, time: 15, icon: "👑", title: "EL REY DEL CLIC", desc: "Un hito legendario: 90 toques en 15 segundos para coronar la tercera semana." },

  // Días 22 a 50: Escalada de Élite para Jugadores Hardcore
  { day: 22, type: "precision", target: 55, time: 12, icon: "🎯", title: "CAZADOR DE FANTASMAS", desc: "Círculo diminuto y saltarín. Consigue 55 clics en 12 segundos." },
  { day: 23, type: "endurance", target: 200, time: 40, icon: "♾️", title: "SÍNDROME DE TÚNEL CARPIANO", desc: "Una prueba brutal de 40 segundos para alcanzar los 200 toques perfectos." },
  { day: 24, type: "sudden_death", target: 60, time: 12, icon: "🛑", title: "ALERTA ROJA", desc: "60 toques en 12 segundos. Un error y vuelves al inicio." },
  { day: 25, type: "blind", target: 80, time: 15, icon: "🕶️", title: "OPERACIÓN EN LA OSCURIDAD", desc: "Registra 80 clics en 15 segundos a ciegas. Confía en tu velocidad." },
  { day: 26, type: "speed", target: 100, time: 16, icon: "⚡", title: "EL CENTENARIO", desc: "Alcanza los tres dígitos: 100 clics en 16 segundos netos." },
  { day: 27, type: "precision", target: 60, time: 12, icon: "🌀", title: "VÓRTICE DIGITAL", desc: "El círculo cambia de posición y se encoge. Haz 60 toques en 12s." },
  { day: 28, type: "endurance", target: 120, time: 18, icon: "⏱️", title: "CORRE O PIERDE", desc: "Asalto rápido y demoledor: 120 clics en 18 segundos." },
  { day: 29, type: "sudden_death", target: 70, time: 13, icon: "💀", title: "JUICIO FINAL", desc: "Crucial y estresante: 70 clics sin fallos en 13 segundos." },
  { day: 30, type: "blind", target: 90, time: 16, icon: "🌑", title: "MEDITACIÓN DE COMBATE", desc: "Logra 90 clics en 16 segundos sin displays numéricos activos." },
  { day: 31, type: "speed", target: 110, time: 18, icon: "💥", title: "SUPERNOVA", desc: "Haz crujir tus dedos para meter 110 toques en 18 segundos." },
  { day: 32, type: "precision", target: 65, time: 13, icon: "🔮", title: "ILUSIÓN ÓPTICA", desc: "Movimiento veloz del blanco. Anota 65 toques en 13 segundos." },
  { day: 33, type: "endurance", target: 220, time: 42, icon: "🏔️", title: "LA MONTAÑA", desc: "Consigue mantener la velocidad para sumar 220 clics en 42s." },
  { day: 34, type: "sudden_death", target: 75, time: 14, icon: "❌", title: "HILO DEL DESTINO", desc: "75 toques en 14 segundos. Si erras, se destruye tu progreso." },
  { day: 35, type: "blind", target: 100, time: 16, icon: "🧘", title: "NIRVANA DEL RITMO", desc: "Llegar a los 100 clics en 16 segundos sin marcadores visuales." },
  { day: 36, type: "speed", target: 120, time: 19, icon: "☄️", title: "LLUVIA DE METEOROS", desc: "Impacto masivo: 120 clicks en 19 segundos." },
  { day: 37, type: "precision", target: 70, time: 14, icon: "🎯", title: "FRANCOTIRADOR", desc: "Objetivo hiper-reducido moviéndose al extremo. 70 clics en 14s." },
  { day: 38, type: "endurance", target: 250, time: 45, icon: "🏟️", title: "COLISEO ROMANO", desc: "Racha de maratón: 250 toques en 45 segundos de resistencia." },
  { day: 39, type: "sudden_death", target: 80, time: 15, icon: "🏴‍☠️", title: "SIN ESCAPATORIA", desc: "80 toques, 15 segundos, cero fallos. No apto para cardíacos." },
  { day: 40, type: "blind", target: 110, time: 18, icon: "🎭", title: "SINFONÍA OCULTA", desc: "Produce 110 golpes exactos en 18 segundos con la interfaz invisible." },
  { day: 41, type: "speed", target: 130, time: 20, icon: "🚀", title: "HIPERVELOCIDAD LUZ", desc: "Acelera a fondo: 130 clics en 20 segundos planos." },
  { day: 42, type: "precision", target: 75, time: 14, icon: "🌌", title: "NEBULOSA", desc: "El blanco cambia de lugar en microsegundos. Suma 75 en 14s." },
  { day: 43, type: "endurance", target: 150, time: 22, icon: "⏳", title: "ÚLTIMO ALIENTO", desc: "150 clics en 22 segundos. Mantén la cadencia viva." },
  { day: 44, type: "sudden_death", target: 85, time: 15, icon: "🚨", title: "CÓDIGO CRÍTICO", desc: "85 toques en 15 segundos sin salirte de la circunferencia." },
  { day: 45, type: "blind", target: 120, time: 20, icon: "👁️‍🗨️", title: "MIND CONTROL", desc: "Sumar 120 toques en 20 segundos sin indicadores." },
  { day: 46, type: "speed", target: 140, time: 21, icon: "🌋", title: "ERUPCIÓN VOLCÁNICA", desc: "Frenesí puro: 140 toques en 21 segundos." },
  { day: 47, type: "precision", target: 80, time: 15, icon: "⚔️", title: "FILO EXTREMO", desc: "Blanco diminuto y errático. Cázalo 80 veces en 15 segundos." },
  { day: 48, type: "endurance", target: 300, time: 50, icon: "🏆", title: "TITÁN DE LA SAGA", desc: "El reto definitivo de constancia: 300 clics en 50 segundos." },
  { day: 49, type: "sudden_death", target: 100, time: 16, icon: "☢️", title: "PULSACIONES NUCLEARES", desc: "¡100 clics perfectos en 16 segundos sin cometer errores!" },
  { day: 50, type: "speed", target: 150, time: 22, icon: "👑", title: "DIOS DEL TOUCH", desc: "El Olimpo de los jugadores: Registra 150 clics en 22 segundos para vencer el juego." }
];

/* ===================================================
   AUTENTICACIÓN Y GESTIÓN DE TIEMPO FIRESTORE
=================================================== */
auth.onAuthStateChanged(async (user) => {
  if (user) {
    await checkChallengeStatus(user.uid);
  } else {
    alert("Inicia sesión para jugar el modo desafío.");
    window.location.href = "index.html";
  }
});

async function checkChallengeStatus(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  
  if (snap.exists()) {
    const data = snap.data();
    userChallengeDay = data.currentChallengeDay || 1;
    const lastCompletedStr = data.lastChallengeCompletedDate; // Formato YYYY-MM-DD

    // Obtener fecha local de hoy en formato YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];

    if (lastCompletedStr === todayStr) {
      // Ya lo completó hoy -> Bloquear pantalla
      showLockScreen();
    } else {
      // Puede jugar -> Cargar desafío correspondiente
      loadChallenge(userChallengeDay);
    }
  } else {
    // Si es nuevo en el modo, inicializar los campos
    await setDoc(userRef, { currentChallengeDay: 1, lastChallengeCompletedDate: "" }, { merge: true });
    loadChallenge(1);
  }
}

function loadChallenge(dayNumber) {
  // Si superó los 50, volvemos a empezar en modo infinito o bucle
  const index = (dayNumber - 1) % CHALLENGES_BANK.length;
  currentChallenge = CHALLENGES_BANK[index];

  if (dayBadge) dayBadge.textContent = `DÍA ${currentChallenge.day}`;
  if (challengeIcon) challengeIcon.textContent = currentChallenge.icon;
  if (challengeTitle) challengeTitle.textContent = currentChallenge.title;
  if (challengeDesc) challengeDesc.textContent = currentChallenge.desc;

  // Ajustes de variables
  clicks = 0;
  timeLeft = currentChallenge.time;
  if (gameTimer) gameTimer.textContent = timeLeft.toFixed(2);
  if (gameClicks) gameClicks.textContent = "0";
  if (targetClicks) targetClicks.textContent = currentChallenge.target;

  // Modificadores de CSS según mecánica
  if (currentChallenge.type === "precision" || currentChallenge.type === "blind") {
    challengeTarget.style.width = "45px";
    challengeTarget.style.height = "45px";
  } else {
    challengeTarget.style.width = "70px";
    challengeTarget.style.height = "70px";
  }

  // Ocultar métricas si es ciego
  if (currentChallenge.type === "blind") {
    document.getElementById("clickMetric").style.visibility = "hidden";
    gameTimer.parentElement.style.visibility = "hidden";
  } else {
    document.getElementById("clickMetric").style.visibility = "visible";
    gameTimer.parentElement.style.visibility = "visible";
  }

  // Resetear posición central original
  challengeTarget.style.top = "50%";
  challengeTarget.style.left = "50%";
  challengeTarget.style.transform = "translate(-50%, -50%)";
}

/* ===================================================
   EJECUCIÓN DEL JUEGO
=================================================== */
if (btnStartChallenge) {
  btnStartChallenge.addEventListener("click", () => {
    if (isPlaying) return;
    startChallengeGame();
  });
}

function startChallengeGame() {
  isPlaying = true;
  clicks = 0;
  timeLeft = currentChallenge.time;
  if (gameClicks) gameClicks.textContent = "0";
  
  btnStartChallenge.classList.add("hidden");
  gameZone.classList.remove("hidden");

  // Añadir eventos a la zona para la mecánica "Sudden Death"
  if (currentChallenge.type === "sudden_death") {
    document.querySelector(".play-field").addEventListener("pointerdown", handleMissedClick);
  }

  gameInterval = setInterval(() => {
    timeLeft -= 0.01;
    if (timeLeft <= 0) {
      timeLeft = 0;
      clearInterval(gameInterval);
      endChallengeGame();
    }
    if (gameTimer) gameTimer.textContent = timeLeft.toFixed(2);
  }, 10);
}

if (challengeTarget) {
  challengeTarget.addEventListener("pointerdown", (e) => {
    e.stopPropagation(); // Evita penalización de muerte súbita
    if (!isPlaying) return;

    clicks++;
    if (gameClicks) gameClicks.textContent = clicks;

    // Animación de feedback de toque
    challengeTarget.style.transform = "translate(-50%, -50%) scale(0.85)";
    setTimeout(() => {
      challengeTarget.style.transform = "translate(-50%, -50%) scale(1)";
    }, 40);

    // Lógica para mecánicas específicas
    if (currentChallenge.type === "precision") {
      moveTargetRandomly();
    }
  });
}

function handleMissedClick() {
  if (!isPlaying) return;
  clicks = 0; // Castigo de Muerte Súbita
  if (gameClicks) gameClicks.textContent = "0";
}

function moveTargetRandomly() {
  const field = document.querySelector(".play-field");
  const maxW = field.clientWidth - 60;
  const maxH = field.clientHeight - 60;
  
  const randomX = Math.floor(Math.random() * maxW) + 30;
  const randomY = Math.floor(Math.random() * maxH) + 30;

  challengeTarget.style.top = `${randomY}px`;
  challengeTarget.style.left = `${randomX}px`;
  challengeTarget.style.transform = "none"; 
}

/* ===================================================
   FIN DEL DESAFÍO Y GUARDADO EN EMULADORES DE HORAS
=================================================== */
async function endChallengeGame() {
  isPlaying = false;
  gameZone.classList.add("hidden");
  btnStartChallenge.classList.remove("hidden");

  // Remover penalizador si existía
  document.querySelector(".play-field").removeEventListener("pointerdown", handleMissedClick);

  if (clicks >= currentChallenge.target) {
    alert(`¡RETO COMPLETADO! 🎉 Lograste ${clicks} de los ${currentChallenge.target} requeridos.`);
    await saveProgressToFirebase();
  } else {
    alert(`Fallaste. Lograste ${clicks}/${currentChallenge.target}. ¡Vuelve a intentarlo!`);
    loadChallenge(userChallengeDay);
  }
}

async function saveProgressToFirebase() {
  const user = auth.currentUser;
  if (!user) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const userRef = doc(db, "users", user.uid);

  try {
    await updateDoc(userRef, {
      currentChallengeDay: userChallengeDay + 1,
      lastChallengeCompletedDate: todayStr
    });
    
    // Cambiar inmediatamente a la interfaz de bloqueo diario
    showLockScreen();
  } catch (err) {
    console.error("Error guardando el desafío diario:", err);
  }
}

/* ===================================================
   PANTALLA DE CONTROL DE COOLDOWN Y BLOQUEO
=================================================== */
function showLockScreen() {
  challengeCard.classList.add("hidden");
  lockCard.classList.remove("hidden");
  startCooldownTimer();
}

function startCooldownTimer() {
  function updateTimer() {
    const now = new Date();
    // Calcular cuánto tiempo falta exactamente para la medianoche (00:00:00 del próximo día)
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);

    const diff = midnight - now;

    if (diff <= 0) {
      window.location.reload(); // Reiniciar para habilitar el nuevo reto
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (cooldownTimer) {
      cooldownTimer.textContent = 
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  updateTimer();
  setInterval(updateTimer, 1000);
}
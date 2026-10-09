import { auth, db } from "./firebase.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const playBtn = document.querySelector(".btn-play");
const touchLabel = document.querySelector(".touch-label");
const circle = document.querySelector(".circle");
const gamePanel = document.querySelector(".game-panel");
const timer = document.querySelector(".timer");
const gameOverScreen = document.getElementById("gameOverScreen");
const finalScore = document.getElementById("finalScore");
const scoreCounter = document.getElementById("scoreCounter");
const clickCounter = document.getElementById("clickCounter");
const exitGameBtn = document.getElementById("exitGameBtn");
const shareScoreBtn = document.getElementById("shareScoreBtn");

// Elementos de la pantalla de bloqueo completo
const fullscreenOverlay = document.getElementById("fullscreenOverlay");
const forceFullscreenBtn = document.getElementById("forceFullscreenBtn");

let clicks = 0;
let totalAttempts = 0;
let gameRunning = false;
let isStarting = false; 
let interval = null;

// ESTADO DE BENEFICIOS ACTIVOS PARA LA PARTIDA EN CURSO
let premiumActivo = false;
let shieldActive = false;
let consumiblesActivosPartida = { size: false, freeze: false, shield: false };

// DATOS PARA LA IMAGEN DE "COMPARTIR RESULTADO"
let nombreJugadorActual = "Jugador Anónimo";
let ultimoResultado = { score: 0, precision: 0 };

// VARIABLES PARA COSMÉTICOS ACTIVOS
let itemMascotaEquipada = null;
let itemEfectoEquipado = null;
let itemTemaEquipado = null;
let animacionMascotaId = null;

// Diccionario estático auxiliar para customizar el círculo según la Skin/Tema
const THEME_SKIN_DATABASE = {
    "neon_cyan": { color1: "#00f0ff", color2: "#70f7ff", boxGlow: "0 0 40px #00f0ff", content: "" },
    "neon_pink": { color1: "#ff007f", color2: "#ff66b2", boxGlow: "0 0 40px #ff007f", content: "" },
    "neon_matrix": { color1: "#00ff33", color2: "#99ffaa", boxGlow: "0 0 40px #00ff33", content: "" },
    "skin_sun": { color1: "#ffcc00", color2: "#ff3300", boxGlow: "0 0 60px #ff6600", content: "☀️" },
    "skin_diamond": { color1: "#aaddff", color2: "#ffffff", boxGlow: "0 0 50px #aaddff", content: "💎" },
    "skin_vortex": { color1: "#660099", color2: "#330066", boxGlow: "0 0 40px #9900ff", content: "🌀" }
};

// 1. Escuchar autenticación y cargar cosméticos activos al inicio
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log("Cargando perfil estético para el juego...");
        await refreshChancesVisuals(user.uid);
        await cargarCosmeticosEquipados(user.uid);
    } else {
        quitarMascotaDelDOM();
        resetearEstilosCirculoAOrigen();
    }
});

/* ===================================================
   MOTOR VISUAL DE COSMÉTICOS Y EFECTOS EN JUEGO
=================================================== */
async function cargarCosmeticosEquipados(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return;

        const data = snap.data();
        itemMascotaEquipada = data.equippedPet || null;
        itemEfectoEquipado = data.equippedFx || null;
        itemTemaEquipado = data.equippedTheme || null;
        
        // A) Aplicar el tema visual de color modificando variables del CSS
        if (itemTemaEquipado && THEME_SKIN_DATABASE[itemTemaEquipado]) {
            const skin = THEME_SKIN_DATABASE[itemTemaEquipado];
            document.documentElement.style.setProperty('--orange', skin.color1);
            document.documentElement.style.setProperty('--orange-soft', skin.color2);
            document.documentElement.style.setProperty('--panel-border', skin.color1 + "40");
            
            // Personalizar el aspecto interno de la pelota objetivo
            if (circle) {
                circle.style.background = `radial-gradient(circle at 35% 30%, ${skin.color2}, ${skin.color1} 60%, #000)`;
                circle.style.boxShadow = `${skin.boxGlow}, inset 0 -20px 40px rgba(0,0,0,0.4)`;
                circle.textContent = skin.content;
                circle.style.display = "flex";
                circle.style.alignItems = "center";
                circle.style.justifyContent = "center";
                circle.style.fontSize = "48px";
            }
        } else {
            resetearEstilosCirculoAOrigen();
        }

        // B) Desplegar acompañante vivo
        inicializarMascotaVisual();
    } catch (e) {
        console.error("Error cargando cosméticos en partida:", e);
    }
}

function resetearEstilosCirculoAOrigen() {
    document.documentElement.style.setProperty('--orange', '#ff6a1f');
    document.documentElement.style.setProperty('--orange-soft', '#ff8a3d');
    document.documentElement.style.setProperty('--panel-border', 'rgba(255, 106, 31, 0.25)');
    if (circle) {
        circle.style.background = `radial-gradient(circle at 35% 30%, var(--orange-soft), var(--orange) 60%, #c64a10)`;
        circle.style.boxShadow = `0 0 80px var(--orange), inset 0 -20px 40px rgba(0,0,0,0.3)`;
        circle.textContent = "";
    }
}

function inicializarMascotaVisual() {
    quitarMascotaDelDOM();
    if (!itemMascotaEquipada || itemMascotaEquipada === "none") return;

    const petDiv = document.createElement("div");
    petDiv.id = "pet-companion";
    
    if (itemMascotaEquipada === "pet_neko") petDiv.textContent = "🐱‍👤";
    if (itemMascotaEquipada === "pet_ufo") petDiv.textContent = "🛸";
    if (itemMascotaEquipada === "pet_phoenix") petDiv.textContent = "🔥";
    if (itemMascotaEquipada === "pet_dragon") petDiv.textContent = "🐉";
    if (itemMascotaEquipada === "pet_fox") petDiv.textContent = "🦊";

    petDiv.style.position = "absolute";
    petDiv.style.fontSize = "42px";
    petDiv.style.zIndex = "999";
    petDiv.style.pointerEvents = "none";
    petDiv.style.userSelect = "none";
    
    gamePanel.appendChild(petDiv);

    function actualizarPosicionMascota() {
        if (!circle || !document.getElementById("pet-companion")) return;
        
        // Calcular centro relativo respecto al panel basándose en su posición estática nativa
        const circleLeft = circle.offsetLeft;
        const circleTop = circle.offsetTop;
        const circleWidth = circle.offsetWidth;
        const circleHeight = circle.offsetHeight;

        const centroX = circleLeft + circleWidth / 2;
        const centroY = circleTop + circleHeight / 2;
        
        const tiempo = Date.now() * 0.003; 
        const radio = 110; // Distancia orbital fija
        
        const posX = centroX + Math.cos(tiempo) * radio - 21; 
        const posY = centroY + Math.sin(tiempo) * radio - 21;
        
        petDiv.style.left = `${posX}px`;
        petDiv.style.top = `${posY}px`;
        
        animacionMascotaId = requestAnimationFrame(actualizarPosicionMascota);
    }
    actualizarPosicionMascota();
}

function quitarMascotaDelDOM() {
    if (animacionMascotaId) cancelAnimationFrame(animacionMascotaId);
    const viejaMascota = document.getElementById("pet-companion");
    if (viejaMascota) viejaMascota.remove();
}

function ejecutarEfectoDeImpacto(x, y) {
    if (!itemEfectoEquipado || itemEfectoEquipado === "none") return;

    // EFECTO: Lluvia de Billetes 
    if (itemEfectoEquipado === "fx_money") {
        for (let i = 0; i < 6; i++) {
            const billete = document.createElement("div");
            billete.textContent = "💵";
            billete.style.position = "fixed"; 
            billete.style.left = `${x}px`;
            billete.style.top = `${y}px`;
            billete.style.fontSize = "24px";
            billete.style.zIndex = "10000";
            billete.style.pointerEvents = "none";
            billete.style.transition = "all 0.6s cubic-bezier(0.1, 0.8, 0.3, 1)";
            
            document.body.appendChild(billete);

            const destX = (Math.random() * 160 - 80);
            const destY = (Math.random() * -120 - 40); 
            const rotacion = (Math.random() * 360);

            setTimeout(() => {
                billete.style.transform = `translate(${destX}px, ${destY}px) rotate(${rotacion}deg)`;
                billete.style.opacity = "0";
            }, 10);

            setTimeout(() => billete.remove(), 650);
        }
    }
    
    // EFECTO: Micro Explosión
    if (itemEfectoEquipado === "fx_explosion") {
        for (let i = 0; i < 8; i++) {
            const particula = document.createElement("div");
            particula.style.position = "fixed";
            particula.style.left = `${x}px`;
            particula.style.top = `${y}px`;
            particula.style.width = "10px";
            particula.style.height = "10px";
            particula.style.background = "var(--orange, #ff5722)";
            particula.style.borderRadius = "50%";
            particula.style.zIndex = "10000";
            particula.style.pointerEvents = "none";
            particula.style.transition = "all 0.4s ease-out";

            document.body.appendChild(particula);

            const destX = (Math.random() * 100 - 50);
            const destY = (Math.random() * 100 - 50);

            setTimeout(() => {
                particula.style.transform = `translate(${destX}px, ${destY}px) scale(0)`;
            }, 10);

            setTimeout(() => particula.remove(), 450);
        }
    }

    // EFECTO: Rayo de Voltaje
    if (itemEfectoEquipado === "fx_lightning") {
        for (let i = 0; i < 5; i++) {
            const rayo = document.createElement("div");
            rayo.textContent = "⚡";
            rayo.style.position = "fixed";
            rayo.style.left = `${x}px`;
            rayo.style.top = `${y}px`;
            rayo.style.fontSize = "22px";
            rayo.style.zIndex = "10000";
            rayo.style.pointerEvents = "none";
            rayo.style.textShadow = "0 0 10px #fff700, 0 0 20px #ffea00";
            rayo.style.transition = "all 0.35s ease-out";

            document.body.appendChild(rayo);

            const angulo = Math.random() * Math.PI * 2;
            const distancia = 70 + Math.random() * 60;
            const destX = Math.cos(angulo) * distancia;
            const destY = Math.sin(angulo) * distancia;

            setTimeout(() => {
                rayo.style.transform = `translate(${destX}px, ${destY}px) scale(0.4) rotate(${Math.random() * 180}deg)`;
                rayo.style.opacity = "0";
            }, 10);

            setTimeout(() => rayo.remove(), 400);
        }
    }

    // EFECTO: Polvo de Estrellas
    if (itemEfectoEquipado === "fx_stars") {
        for (let i = 0; i < 7; i++) {
            const estrella = document.createElement("div");
            estrella.textContent = Math.random() > 0.5 ? "✨" : "⭐";
            estrella.style.position = "fixed";
            estrella.style.left = `${x}px`;
            estrella.style.top = `${y}px`;
            estrella.style.fontSize = `${12 + Math.random() * 10}px`;
            estrella.style.zIndex = "10000";
            estrella.style.pointerEvents = "none";
            estrella.style.transition = "all 0.7s ease-out";

            document.body.appendChild(estrella);

            const destX = (Math.random() * 140 - 70);
            const destY = (Math.random() * -100 - 30);

            setTimeout(() => {
                estrella.style.transform = `translate(${destX}px, ${destY}px) rotate(${Math.random() * 360}deg)`;
                estrella.style.opacity = "0";
            }, 10);

            setTimeout(() => estrella.remove(), 720);
        }
    }
}

/* ===================================================
   CONTROL VISUAL DE CHANCES DIRECTO
=================================================== */
async function refreshChancesVisuals(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return;

        const data = snap.data();
        let currentChances = data.intentosDiarios !== undefined ? data.intentosDiarios : 0;

        const chancesTodayStat = document.getElementById("chancesTodayStat");
        if (chancesTodayStat) chancesTodayStat.textContent = currentChances;

        const navUserCoins = document.getElementById("navUserCoins");
        if (navUserCoins) navUserCoins.textContent = data.coins !== undefined ? data.coins : 0;

        if (playBtn) {
            if (currentChances > 0) {
                playBtn.innerHTML = `JUGAR AHORA ⚡`;
                playBtn.style.background = "linear-gradient(180deg, var(--orange-soft), var(--orange))";
            } else {
                playBtn.innerHTML = `🎬 VER ANUNCIO (+3 INTENTOS)`;
                playBtn.style.background = "linear-gradient(180deg, #44332a, #2a1e17)";
            }
        }
    } catch (err) {
        console.error("Error al actualizar la interfaz de intentos:", err);
    }
}

/* ===================================================
   DETECTOR AUTOMÁTICO Y OBLIGATORIO DE FULLSCREEN
=================================================== */
function checkFullscreenStatus() {
    if (!fullscreenOverlay) return;
    
    if (document.fullscreenElement) { 
        fullscreenOverlay.classList.add("hidden"); 
    } else { 
        fullscreenOverlay.classList.remove("hidden"); 
        if (gameRunning) backToMenu(); 
    }
}

if (forceFullscreenBtn) { 
    forceFullscreenBtn.addEventListener("click", (e) => { 
        e.preventDefault();
        e.stopPropagation();
        
        document.documentElement.requestFullscreen()
            .then(() => {
                checkFullscreenStatus();
            })
            .catch(err => { 
                console.error("Error al activar fullscreen:", err);
                alert("Por favor, presiona la tecla F11 de tu teclado.");
            }); 
    }); 
}

document.addEventListener("fullscreenchange", checkFullscreenStatus);

/* ===================================================
   GUARDADO DE DATOS Y GESTIÓN DE CHANCES Y MONEDAS
=================================================== */
async function saveGameData(score, attempts, esPremium) {
    const user = auth.currentUser;
    if (!user) return; 

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;

        const data = userSnap.data();
        
        const recordActual = data.bestScore || 0;
        const bestScore = Math.max(score, recordActual);
        
        const newTotalSuccess = (data.totalClicksWithSuccess || 0) + score;
        const newTotalRegistered = (data.totalClicksRegistered || 0) + attempts;
        const globalAccuracy = newTotalRegistered > 0 ? Math.round((newTotalSuccess / newTotalRegistered) * 100) : 0;
        
        let currentChances = data.intentosDiarios !== undefined ? data.intentosDiarios : 3;
        // El Paso Premium da intentos ilimitados: no se descuenta
        if (!esPremium && currentChances > 0) currentChances--;

        let monedasActuales = data.coins !== undefined ? data.coins : 0;
        let monedasRecompensa = 1; 

        if (score > recordActual) {
            monedasRecompensa += 25; 
            console.log("🔥 Récord superado: +26 monedas.");
        } else {
            console.log("🪙 Partida completada: +1 moneda.");
        }

        // El Paso Premium duplica las monedas ganadas
        if (esPremium) monedasRecompensa *= 2;

        let nuevoBalanceMonedas = monedasActuales + monedasRecompensa;

        await updateDoc(userRef, {
            bestScore,
            gamesPlayed: (data.gamesPlayed || 0) + 1,
            totalClicks: (data.totalClicks || 0) + score,
            totalClicksWithSuccess: newTotalSuccess,
            totalClicksRegistered: newTotalRegistered,
            accuracy: globalAccuracy,
            intentosDiarios: currentChances,
            coins: nuevoBalanceMonedas, 
            ultimaPartidaFecha: new Date().toISOString()
        });

        await refreshChancesVisuals(user.uid);

    } catch (error) {
        console.error("Error al guardar datos de partida:", error);
    }
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/* ===================================================
   CONSUMIBLES COMPRADOS EN LA TIENDA (SE APLICAN SOLOS)
=================================================== */
async function prepararYConsumirConsumibles(userRef, data) {
    const consumibles = data.consumibles || {};
    const resultado = { size: false, freeze: false, shield: false };
    const actualizaciones = {};

    if ((consumibles.consumable_size || 0) > 0) {
        resultado.size = true;
        actualizaciones["consumibles.consumable_size"] = consumibles.consumable_size - 1;
    }
    if ((consumibles.consumable_freeze || 0) > 0) {
        resultado.freeze = true;
        actualizaciones["consumibles.consumable_freeze"] = consumibles.consumable_freeze - 1;
    }
    if ((consumibles.consumable_shield || 0) > 0) {
        resultado.shield = true;
        actualizaciones["consumibles.consumable_shield"] = consumibles.consumable_shield - 1;
    }

    if (Object.keys(actualizaciones).length > 0) {
        try {
            await updateDoc(userRef, actualizaciones);
        } catch (e) {
            console.error("Error al consumir ítems comprados:", e);
        }
    }
    return resultado;
}

function mostrarToastGenerico(mensaje) {
    const toast = document.createElement("div");
    toast.style.cssText = "position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:99999; background:var(--panel, #15100c); border:1px solid var(--orange, #ff6a1f); border-radius:8px; padding:10px 18px; color:var(--text, #f5ede6); font-family:var(--ui, sans-serif); font-size:13px; text-align:center; box-shadow:0 6px 20px rgba(0,0,0,0.5); max-width:90vw;";
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

/* ===================================================
   GENERAR Y COMPARTIR IMAGEN DEL RESULTADO
=================================================== */
async function generarImagenResultado() {
    if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (e) { /* seguimos igual */ }
    }

    const W = 1080;
    const H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Fondo base
    ctx.fillStyle = "#0a0705";
    ctx.fillRect(0, 0, W, H);

    // Resplandor radial central (mismo tono que el círculo del juego)
    const glow = ctx.createRadialGradient(W / 2, H * 0.44, 60, W / 2, H * 0.44, 700);
    glow.addColorStop(0, "rgba(255, 106, 31, 0.35)");
    glow.addColorStop(1, "rgba(255, 106, 31, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Grilla sutil de fondo, como en el juego
    ctx.strokeStyle = "rgba(255, 106, 31, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    ctx.textAlign = "center";

    // Logo "30 SECONDS TOUCH"
    ctx.fillStyle = "#ff6a1f";
    ctx.shadowColor = "#ff6a1f";
    ctx.shadowBlur = 20;
    ctx.font = "700 64px 'Press Start 2P', monospace";
    ctx.fillText("30", W / 2, 130);

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 22px 'Press Start 2P', monospace";
    ctx.fillText("SECONDS TOUCH", W / 2, 178);

    // Círculo decorativo (idéntico en espíritu al del juego) detrás del puntaje
    const circleY = H * 0.46;
    const circleGrad = ctx.createRadialGradient(W / 2 - 70, circleY - 70, 20, W / 2, circleY, 340);
    circleGrad.addColorStop(0, "#ff8a3d");
    circleGrad.addColorStop(0.6, "#ff6a1f");
    circleGrad.addColorStop(1, "#c64a10");
    ctx.fillStyle = circleGrad;
    ctx.shadowColor = "#ff6a1f";
    ctx.shadowBlur = 90;
    ctx.beginPath();
    ctx.arc(W / 2, circleY, 320, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Etiqueta
    ctx.fillStyle = "rgba(10, 7, 5, 0.75)";
    ctx.font = "600 24px 'Rajdhani', sans-serif";
    ctx.fillText("PUNTUACIÓN LOGRADA", W / 2, circleY - 110);

    // Puntaje grande, con tamaño adaptado a la cantidad de dígitos
    const scoreStr = String(ultimoResultado.score);
    let scoreFontSize = 190;
    if (scoreStr.length >= 4) scoreFontSize = 150;
    if (scoreStr.length >= 5) scoreFontSize = 115;
    ctx.fillStyle = "#0a0705";
    ctx.font = `700 ${scoreFontSize}px 'Press Start 2P', monospace`;
    ctx.fillText(scoreStr, W / 2, circleY + 45);

    // Precisión y nombre del jugador, debajo del círculo
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 38px 'Rajdhani', sans-serif";
    ctx.fillText(`PRECISIÓN: ${ultimoResultado.precision}%`, W / 2, circleY + 400);

    ctx.fillStyle = "#ff8a3d";
    ctx.font = "700 34px 'Rajdhani', sans-serif";
    ctx.fillText(nombreJugadorActual.toUpperCase(), W / 2, circleY + 450);

    // Pie con llamado a la acción y el dominio real desde donde se está jugando
    ctx.fillStyle = "#8a7a6e";
    ctx.font = "600 26px 'Rajdhani', sans-serif";
    ctx.fillText("¿PODÉS SUPERARME?", W / 2, H - 130);

    ctx.fillStyle = "#ff6a1f";
    ctx.font = "700 30px 'Rajdhani', sans-serif";
    const host = window.location.host || "30secondstouch";
    ctx.fillText(host, W / 2, H - 85);

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/png");
    });
}

async function compartirResultado() {
    if (!shareScoreBtn) return;
    const textoOriginal = shareScoreBtn.textContent;
    shareScoreBtn.disabled = true;
    shareScoreBtn.textContent = "GENERANDO...";

    try {
        const blob = await generarImagenResultado();
        if (!blob) throw new Error("No se pudo generar la imagen del resultado");

        const archivo = new File([blob], "30secondstouch-resultado.png", { type: "image/png" });
        const textoCompartir = `¡Hice ${ultimoResultado.score} puntos en 30 Seconds Touch! ¿Podés superarme?`;

        if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
            await navigator.share({
                files: [archivo],
                title: "30 Seconds Touch",
                text: textoCompartir
            });
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "30secondstouch-resultado.png";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 3000);
            mostrarToastGenerico("📥 Imagen descargada. ¡Compartila donde quieras!");
        }
    } catch (err) {
        if (err && err.name === "AbortError") {
            // El usuario cerró el panel de compartir nativo: no es un error real
        } else {
            console.error("Error al compartir el resultado:", err);
            mostrarToastGenerico("⚠️ No se pudo generar la imagen. Probá de nuevo.");
        }
    } finally {
        shareScoreBtn.disabled = false;
        shareScoreBtn.textContent = textoOriginal;
    }
}

if (shareScoreBtn) {
    shareScoreBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        compartirResultado();
    });
}

function mostrarToastConsumibles(activos) {
    const nombres = [];
    if (activos.size) nombres.push("🧪 Poción de Fósforo: +10% tamaño del círculo");
    if (activos.freeze) nombres.push("⏱️ Congelador Temporal: +2 segundos");
    if (activos.shield) nombres.push("🛡️ Escudo de Combo: tu primer fallo no cuenta");
    if (nombres.length === 0) return;

    const toast = document.createElement("div");
    toast.style.cssText = "position:fixed; top:16px; left:50%; transform:translateX(-50%); z-index:99999; background:var(--panel, #15100c); border:1px solid var(--orange, #ff6a1f); border-radius:8px; padding:10px 18px; color:var(--text, #f5ede6); font-family:var(--ui, sans-serif); font-size:13px; text-align:center; box-shadow:0 6px 20px rgba(0,0,0,0.5); max-width:90vw;";
    toast.innerHTML = `<strong style="color:var(--orange, #ff6a1f);">CONSUMIBLE${nombres.length > 1 ? "S" : ""} ACTIVO${nombres.length > 1 ? "S" : ""}</strong><br>${nombres.join("<br>")}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3800);
}

/* ===================================================
   LÓGICA DEL MOTOR DE JUEGO (CONTROL DE TIEMPO)
=================================================== */
async function startGame() {
    if (gameRunning || isStarting || !document.body.classList.contains("playing")) {
        if (!document.body.classList.contains("playing")) {
            document.body.classList.add("playing");
        } else {
            return;
        }
    }

    const user = auth.currentUser;
    premiumActivo = false;
    consumiblesActivosPartida = { size: false, freeze: false, shield: false };
    nombreJugadorActual = "Jugador Anónimo";

    if (user) {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const data = snap.data();
            premiumActivo = (data.itemsComprados || []).includes("premium_pass");
            nombreJugadorActual = data.username || data.name || "Jugador Anónimo";

            if (!premiumActivo && (data.intentosDiarios || 0) <= 0) {
                verAnuncioRecompensado(user.uid);
                return;
            }

            consumiblesActivosPartida = await prepararYConsumirConsumibles(userRef, data);
        }
    }

    isStarting = true;
    if (gameOverScreen) gameOverScreen.classList.remove("show");

    clearInterval(interval);
    interval = null;
    clicks = 0;
    totalAttempts = 0;
    shieldActive = consumiblesActivosPartida.shield;

    if (circle) circle.classList.toggle("size-boost", consumiblesActivosPartida.size);
    mostrarToastConsumibles(consumiblesActivosPartida);

    if (scoreCounter) scoreCounter.textContent = "0";
    if (clickCounter) clickCounter.textContent = "0";

    const bestScoreStatHud = document.getElementById("bestScoreStatHud");
    const mainBestScore = document.getElementById("bestScoreStat");
    if (bestScoreStatHud && mainBestScore) {
        bestScoreStatHud.textContent = mainBestScore.textContent;
    }

    timer.textContent = "3"; await wait(1000);
    if (!document.body.classList.contains("playing")) { isStarting = false; return; }
    timer.textContent = "2"; await wait(1000);
    if (!document.body.classList.contains("playing")) { isStarting = false; return; }
    timer.textContent = "1"; await wait(1000);
    if (!document.body.classList.contains("playing")) { isStarting = false; return; }
    
    timer.textContent = "¡YA!"; await wait(500);
    if (!document.body.classList.contains("playing")) { isStarting = false; return; }

    isStarting = false;
    runGame();
}

function runGame() {
    let time = consumiblesActivosPartida.freeze ? 32 : 30;
    gameRunning = true;

    const readyLabel = document.querySelector(".ready");
    if (readyLabel) readyLabel.textContent = "TIEMPO";

    timer.textContent = time.toFixed(2);

    interval = setInterval(() => {
        time -= 0.01;
        if (time < 0) time = 0;
        timer.textContent = time.toFixed(2);

        if (time <= 0) {
            endGame();
        }
    }, 10);
}

async function endGame() {
    clearInterval(interval);
    interval = null;
    gameRunning = false;
    isStarting = false;
    shieldActive = false;
    if (circle) circle.classList.remove("size-boost");

    const matchAccuracy = totalAttempts > 0 ? Math.round((clicks / totalAttempts) * 100) : 0;
    ultimoResultado = { score: clicks, precision: matchAccuracy };
    
    finalScore.innerHTML = `
        ${clicks}
        <br>
        <small style="font-size: 16px; color: #fff; display: block; margin-top: 10px; font-family: var(--ui);">
            PRECISIÓN: ${matchAccuracy}%
        </small>
    `;
    
    if (gameOverScreen) gameOverScreen.classList.add("show");
    await saveGameData(clicks, totalAttempts, premiumActivo);
}

function backToMenu() {
    clearInterval(interval);
    interval = null;
    gameRunning = false;
    isStarting = false;
    shieldActive = false;
    if (circle) circle.classList.remove("size-boost");
    clicks = 0;
    totalAttempts = 0;

    document.body.classList.remove("playing");
    if (gameOverScreen) gameOverScreen.classList.remove("show");
    timer.textContent = "30.00";

    const readyLabel = document.querySelector(".ready");
    if (readyLabel) readyLabel.textContent = "¿LISTO?";

    if (scoreCounter) scoreCounter.textContent = "0";
    if (clickCounter) clickCounter.textContent = "0";
}

/* ===================================================
   SIMULADOR DE ANUNCIOS H5 RECOMPENSADOS
=================================================== */
async function verAnuncioRecompensado(uid) {
    const adContainer = document.createElement("div");
    adContainer.style = "position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; font-family:sans-serif;";
    adContainer.innerHTML = `
        <div style="text-align:center; padding:30px; border:1px solid var(--orange); background:var(--panel); border-radius:12px; max-width:400px;">
            <div style="font-size:40px; margin-bottom:15px;">🎬</div>
            <h3 style="font-family:'Press Start 2P', monospace; font-size:12px; color:var(--orange); margin-bottom:15px;">REPRODUCIENDO ANUNCIO</h3>
            <p style="font-size:14px; color:#b8a89c; line-height:1.6; margin-bottom:20px;">Espera <span id="adCountdown" style="color:white; font-weight:bold;">5</span> segundos para recibir tus 3 chances...</p>
            <div style="width:100%; background:#2a1e17; height:6px; border-radius:3px; overflow:hidden;">
                <div id="adBar" style="width:0%; background:var(--orange); height:100%; transition: width 5s linear;"></div>
            </div>
        </div>
    `;
    document.body.appendChild(adContainer);

    setTimeout(() => {
        const adBar = document.getElementById("adBar");
        if(adBar) adBar.style.width = "100%";
    }, 50);

    let adTimeLeft = 5;
    const adInterval = setInterval(async () => {
        adTimeLeft--;
        const countEl = document.getElementById("adCountdown");
        if(countEl) countEl.textContent = adTimeLeft;

        if (adTimeLeft <= 0) {
            clearInterval(adInterval);
            document.body.removeChild(adContainer);

            try {
                const userRef = doc(db, "users", uid);
                await updateDoc(userRef, { intentosDiarios: 3 });
                await refreshChancesVisuals(uid);
                alert("¡Anuncio completado! Se te han otorgado 3 intentos extras.");
            } catch (err) {
                console.error("Error al inyectar recompensas de anuncio:", err);
            }
        }
    }, 1000);
}

/* ===================================================
   DISPARADORES DE EVENTOS Y ENTRADA DE CLICS
=================================================== */
if (gamePanel) {
    gamePanel.addEventListener("pointerdown", () => {
        if (gameRunning) {
            if (shieldActive) {
                // El escudo absorbe este primer fallo: no cuenta como intento
                shieldActive = false;
                return;
            }
            totalAttempts++;
        }
    });
}

if (circle) {
    circle.addEventListener("pointerdown", (e) => {
        if (!gameRunning) return;
        e.stopPropagation(); 
        clicks++;
        totalAttempts++;
        if (scoreCounter) scoreCounter.textContent = clicks;
        if (clickCounter) clickCounter.textContent = clicks;
        
        // DISPARAR EL EFECTO VISUAL COMPRADO EN LA POSICIÓN DEL CLIC
        ejecutarEfectoDeImpacto(e.clientX, e.clientY);
    });
}

if (playBtn) playBtn.addEventListener("click", startGame);
if (touchLabel) touchLabel.addEventListener("click", startGame);

if (gameOverScreen) {
    gameOverScreen.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (gameOverScreen.classList.contains("show")) {
            startGame();
        }
    });
}

document.addEventListener("keydown", (e) => { 
    if (e.key === "Escape") backToMenu(); 
});

if (exitGameBtn) exitGameBtn.addEventListener("click", backToMenu);

checkFullscreenStatus();
import { auth, db } from "./firebase.js";
import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    onSnapshot, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Contenedores Principales
const pvpMenu = document.getElementById("pvpMenu");
const btnPvpLocal = document.getElementById("btnPvpLocal");
const btnPvpOnline = document.getElementById("btnPvpOnline");
const pvpModeSelection = document.getElementById("pvpModeSelection");
const btnModeClassic = document.getElementById("btnModeClassic");
const btnModeMatch = document.getElementById("btnModeMatch");
const btnBackToConnection = document.getElementById("btnBackToConnection");
const onlineSetupPanel = document.getElementById("onlineSetupPanel");
const pvpArena = document.getElementById("pvpArena");
const pvpTimer = document.getElementById("pvpTimer");
const timerLabel = document.getElementById("timerLabel");

// Elementos de Marcador de Fútbol (Modo Partido)
const footballScoreboard = document.getElementById("footballScoreboard");
const goalsP1Display = document.getElementById("goalsP1");
const goalsP2Display = document.getElementById("goalsP2");
const finalGoalsP1 = document.getElementById("finalGoalsP1");
const finalGoalsP2 = document.getElementById("finalGoalsP2");

// Panel de Conexión Online
const btnCreateRoom = document.getElementById("btnCreateRoom");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const generatedCode = document.getElementById("generatedCode");
const inputRoomCode = document.getElementById("inputRoomCode");
const btnJoinRoom = document.getElementById("btnJoinRoom");
const lobbyStatus = document.getElementById("lobbyStatus");
const btnReadyOnline = document.getElementById("btnReadyOnline");
const btnBackToPvpMenu = document.getElementById("btnBackToPvpMenu");

// Elementos de la Arena de Juego
const circleP1 = document.getElementById("circleP1");
const scoreP1 = document.getElementById("scoreP1");
const overlayP1 = document.getElementById("overlayP1");
const circleP2 = document.getElementById("circleP2");
const scoreP2 = document.getElementById("scoreP2");
const overlayP2 = document.getElementById("overlayP2");
const tagP2 = document.getElementById("tagP2");

// Pantalla Final de Game Over
const pvpGameOver = document.getElementById("pvpGameOver");
const pvpWinnerDeclaration = document.getElementById("pvpWinnerDeclaration");
const finalScoreP1 = document.getElementById("finalScoreP1");
const finalScoreP2 = document.getElementById("finalScoreP2");
const finalLabelP2 = document.getElementById("finalLabelP2");
const btnExitPvp = document.getElementById("btnExitPvp");

// Variables de Control de Estado Global
let pvpMode = null;       // "local" o "online"
let gameplayMode = null;  // "classic" o "match"
let role = null;          // "P1" o "P2"
let currentRoomId = null;
let unsubscribeRoom = null;

// Marcadores de Rendimiento y Juego
let clicksP1 = 0;
let clicksP2 = 0;
let goalsP1 = 0;
let goalsP2 = 0;
let lastIntervalSeconds = 0; // Para rastrear los bloques de 10s en Modo Partido
let isExtraTime = false;    // Indica si estamos en Prórroga

let p1Ready = false;
let p2Ready = false;
let pvpGameRunning = false;
let pvpIsStarting = false;
let pvpInterval = null;

let lastGameOverClick = 0;
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const msgP1Default = isTouchDevice ? "TOCA DOS VECES PARA EL LISTO" : "PRESIONA LA TECLA 'A' PARA EL LISTO";
const msgP2Default = isTouchDevice ? "TOCA DOS VECES PARA EL LISTO" : "PRESIONA LA TECLA 'P' PARA EL LISTO";

/* ===================================================
   1. CONTROL DE NAVEGACIÓN INTERMEDIA
=================================================== */
if (btnPvpLocal) {
    btnPvpLocal.addEventListener("click", () => {
        pvpMode = "local";
        pvpMenu.classList.add("hidden");
        pvpModeSelection.classList.remove("hidden"); // Va a la selección de modo de juego
    });
}

if (btnPvpOnline) {
    btnPvpOnline.addEventListener("click", () => {
        pvpMode = "online";
        pvpMenu.classList.add("hidden");
        pvpModeSelection.classList.remove("hidden"); // Va a la selección de modo de juego
    });
}

if (btnBackToConnection) {
    btnBackToConnection.addEventListener("click", () => {
        pvpModeSelection.classList.add("hidden");
        pvpMenu.classList.remove("hidden");
    });
}

// Selección del modo de juego definitivo
if (btnModeClassic) {
    btnModeClassic.addEventListener("click", () => {
        gameplayMode = "classic";
        goToNextSetupStep();
    });
}

if (btnModeMatch) {
    btnModeMatch.addEventListener("click", () => {
        gameplayMode = "match";
        goToNextSetupStep();
    });
}

function goToNextSetupStep() {
    pvpModeSelection.classList.add("hidden");
    if (pvpMode === "local") {
        pvpArena.classList.remove("hidden");
        btnReadyOnline.classList.add("hidden");
        tagP2.textContent = "JUGADOR 2";
        configureArenaVisuals();
        resetArenaLocal();
    } else {
        onlineSetupPanel.classList.remove("hidden");
    }
}

function configureArenaVisuals() {
    if (gameplayMode === "match") {
        footballScoreboard.classList.remove("hidden");
        pvpTimer.textContent = "90.00";
        timerLabel.textContent = "PARTIDO";
    } else {
        footballScoreboard.classList.add("hidden");
        pvpTimer.textContent = "30.00";
        timerLabel.textContent = "TIEMPO";
    }
}

if (btnBackToPvpMenu) {
    btnBackToPvpMenu.addEventListener("click", async () => {
        await cleanOnlineStructures();
        onlineSetupPanel.classList.add("hidden");
        pvpMenu.classList.remove("hidden");
    });
}

/* ===================================================
   2. MOTOR MULTIJUGADOR ONLINE (FIREBASE)
=================================================== */
function generateRandomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

if (btnCreateRoom) {
    btnCreateRoom.addEventListener("click", async () => {
        const user = auth.currentUser;
        const p1Name = user?.displayName ? user.displayName.split(" ")[0] : "Creador";
        
        currentRoomId = generateRandomCode();
        role = "P1";

        try {
            const roomRef = doc(db, "rooms", currentRoomId);
            await setDoc(roomRef, {
                roomId: currentRoomId,
                gameplayMode: gameplayMode, // Se guarda el modo seleccionado por el Host
                p1Name: p1Name,
                p2Name: "",
                clicksP1: 0,
                clicksP2: 0,
                goalsP1: 0,
                goalsP2: 0,
                p1Ready: false,
                p2Ready: false,
                gameRunning: false,
                isStarting: false,
                rematchP1: false,
                rematchP2: false
            });

            if (generatedCode) generatedCode.textContent = currentRoomId;
            if (roomCodeDisplay) roomCodeDisplay.classList.remove("hidden");
            if (lobbyStatus) lobbyStatus.classList.remove("hidden");
            
            listenToRoomChanges();
        } catch (err) {
            console.error("Error al crear sala:", err);
        }
    });
}

if (btnJoinRoom) {
    btnJoinRoom.addEventListener("click", async () => {
        const code = inputRoomCode.value.trim();
        if (code.length !== 6) return alert("Código inválido.");

        const user = auth.currentUser;
        const p2Name = user?.displayName ? user.displayName.split(" ")[0] : "Invitado";

        try {
            const roomRef = doc(db, "rooms", code);
            const snap = await getDoc(roomRef);

            if (!snap.exists()) return alert("La sala no existe.");
            if (snap.data().p2Name !== "") return alert("Sala llena.");

            currentRoomId = code;
            role = "P2";
            gameplayMode = snap.data().gameplayMode; // El invitado hereda el modo del Host

            await updateDoc(roomRef, { p2Name: p2Name });
            onlineSetupPanel.classList.add("hidden");
            pvpArena.classList.remove("hidden");
            
            configureArenaVisuals();
            listenToRoomChanges();
        } catch (err) {
            console.error("Error al unirse:", err);
        }
    });
}

function listenToRoomChanges() {
    if (!currentRoomId) return;

    const roomRef = doc(db, "rooms", currentRoomId);
    unsubscribeRoom = onSnapshot(roomRef, async (docSnap) => {
        if (!docSnap.exists()) {
            alert("Partida finalizada. Volviendo al menú.");
            window.location.href = "pvp.html";
            return;
        }

        const data = docSnap.data();

        if (data.p2Name !== "" && pvpArena.classList.contains("hidden")) {
            onlineSetupPanel.classList.add("hidden");
            pvpArena.classList.remove("hidden");
            configureArenaVisuals();
        }

        if (tagP2) tagP2.textContent = data.p2Name ? data.p2Name.toUpperCase() : "ESPERANDO...";
        if (finalLabelP2) finalLabelP2.textContent = data.p2Name ? data.p2Name.toUpperCase() : "JUGADOR 2";

        // Sincronizar en tiempo real los goles si estamos en modo Partido
        if (gameplayMode === "match") {
            goalsP1 = data.goalsP1;
            goalsP2 = data.goalsP2;
            if (goalsP1Display) goalsP1Display.textContent = goalsP1;
            if (goalsP2Display) goalsP2Display.textContent = goalsP2;
        }

        // Actualizar marcadores de clics en tiempo de ejecución
        if (pvpGameRunning) {
            if (role === "P2") {
                clicksP1 = data.clicksP1;
                if (scoreP1) scoreP1.textContent = clicksP1;
            }
            if (role === "P1") {
                clicksP2 = data.clicksP2;
                if (scoreP2) scoreP2.textContent = clicksP2;
            }
        }

        // Gestión unificada de botón Listo/Revancha
        if (btnReadyOnline) {
            if (data.gameRunning) {
                btnReadyOnline.classList.add("hidden"); 
            } else if (pvpGameOver.classList.contains("hidden")) {
                btnReadyOnline.classList.remove("hidden");
                let count = (data.p1Ready ? 1 : 0) + (data.p2Ready ? 1 : 0);
                btnReadyOnline.textContent = `¡ESTOY LISTO! (${count}/2)`;
            } else {
                btnReadyOnline.classList.remove("hidden");
                let rematchCount = (data.rematchP1 ? 1 : 0) + (data.rematchP2 ? 1 : 0);
                btnReadyOnline.textContent = `VOLVER A JUGAR (${rematchCount}/2)`;
            }
        }

        // Sincronizar Cortinas de Estado Listo
        if (!data.gameRunning && !data.isStarting) {
            const myMsg = "PRESIONA 'ESTOY LISTO' ABAJO";
            if (role === "P1") {
                overlayP1.classList.toggle("ready-active", data.p1Ready);
                overlayP1.querySelector(".overlay-msg").textContent = data.p1Ready ? "¡PREPARADO!" : myMsg;
                overlayP2.classList.toggle("ready-active", data.p2Ready);
                overlayP2.querySelector(".overlay-msg").textContent = data.p2Ready ? "¡RIVAL LISTO!" : "ESPERANDO AL RIVAL...";
            } else {
                overlayP2.classList.toggle("ready-active", data.p2Ready);
                overlayP2.querySelector(".overlay-msg").textContent = data.p2Ready ? "¡PREPARADO!" : myMsg;
                overlayP1.classList.toggle("ready-active", data.p1Ready);
                overlayP1.querySelector(".overlay-msg").textContent = data.p1Ready ? "¡RIVAL LISTO!" : "ESPERANDO AL RIVAL...";
            }
        }

        if (data.isStarting && !pvpIsStarting && !pvpGameRunning) {
            startOnlineCountdown();
        }

        if (data.rematchP1 && data.rematchP2) {
            resetArenaOnlineLocalState();
        }
    });
}

if (btnReadyOnline) {
    btnReadyOnline.addEventListener("click", async () => {
        if (!currentRoomId) return;
        const roomRef = doc(db, "rooms", currentRoomId);
        const snap = await getDoc(roomRef);
        const data = snap.data();

        if (!pvpGameOver.classList.contains("hidden")) {
            if (role === "P1") await updateDoc(roomRef, { rematchP1: true });
            if (role === "P2") await updateDoc(roomRef, { rematchP2: true });
            return;
        }

        if (role === "P1") {
            const next = !data.p1Ready;
            await updateDoc(roomRef, { p1Ready: next });
            if (next && data.p2Ready) await updateDoc(roomRef, { isStarting: true });
        } else {
            const next = !data.p2Ready;
            await updateDoc(roomRef, { p2Ready: next });
            if (next && data.p1Ready) await updateDoc(roomRef, { isStarting: true });
        }
    });
}

/* ===================================================
   3. CAPTURA DE EVENTOS DE CLICS (PC / MÓVIL)
=================================================== */
function toggleReadyLocalP1() {
    if (pvpGameRunning || pvpIsStarting) return;
    p1Ready = !p1Ready;
    overlayP1.classList.toggle("ready-active", p1Ready);
    overlayP1.querySelector(".overlay-msg").textContent = p1Ready ? "¡PREPARADO!" : msgP1Default;
    checkPlayersReadyLocal();
}

function toggleReadyLocalP2() {
    if (pvpGameRunning || pvpIsStarting) return;
    p2Ready = !p2Ready;
    overlayP2.classList.toggle("ready-active", p2Ready);
    overlayP2.querySelector(".overlay-msg").textContent = p2Ready ? "¡PREPARADO!" : msgP2Default;
    checkPlayersReadyLocal();
}

document.addEventListener("keydown", async (e) => {
    const key = e.key.toLowerCase();
    if (pvpMode === "local") {
        if (!pvpGameRunning && !pvpIsStarting) {
            if (key === "a") toggleReadyLocalP1();
            if (key === "p") toggleReadyLocalP2();
            if (!pvpGameOver.classList.contains("hidden") && (key === " " || key === "enter")) resetArenaLocal();
            return;
        }
        if (pvpGameRunning) {
            if (key === "a") registerLocalClickP1();
            if (key === "p") registerLocalClickP2();
        }
    } else if (pvpMode === "online" && pvpGameRunning) {
        if (key === "a" || key === "p" || key === " ") registerOnlineClick();
    }
});

if (circleP1) {
    circleP1.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        if (!pvpGameRunning) return;
        if (pvpMode === "local") registerLocalClickP1();
        if (pvpMode === "online" && role === "P1") registerOnlineClick();
    });
}

if (circleP2) {
    circleP2.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        if (!pvpMode === "local" && role !== "P2") return;
        if (!pvpGameRunning) return;
        if (pvpMode === "local") registerLocalClickP2();
        if (pvpMode === "online" && role === "P2") registerOnlineClick();
    });
}

function registerLocalClickP1() { clicksP1++; if (scoreP1) scoreP1.textContent = clicksP1; triggerPressAnimation(circleP1); }
function registerLocalClickP2() { clicksP2++; if (scoreP2) scoreP2.textContent = clicksP2; triggerPressAnimation(circleP2); }

async function registerOnlineClick() {
    if (role === "P1") {
        clicksP1++; if (scoreP1) scoreP1.textContent = clicksP1; triggerPressAnimation(circleP1);
        await updateDoc(doc(db, "rooms", currentRoomId), { clicksP1: clicksP1 });
    } else {
        clicksP2++; if (scoreP2) scoreP2.textContent = clicksP2; triggerPressAnimation(circleP2);
        await updateDoc(doc(db, "rooms", currentRoomId), { clicksP2: clicksP2 });
    }
}

function triggerPressAnimation(el) { el.style.transform = "scale(0.92)"; setTimeout(() => el.style.transform = "none", 50); }

/* ===================================================
   4. RELOJ MAESTRO Y CUENTAS ATRÁS (CON ITERACIÓN DE GOLES)
=================================================== */
function checkPlayersReadyLocal() { if (p1Ready && p2Ready && !pvpIsStarting && !pvpGameRunning) startLocalCountdown(); }
const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function startLocalCountdown() {
    pvpIsStarting = true;
    const m1 = overlayP1.querySelector(".overlay-msg"), m2 = overlayP2.querySelector(".overlay-msg");
    m1.textContent = "3"; m2.textContent = "3"; await wait(1000);
    m1.textContent = "2"; m2.textContent = "2"; await wait(1000);
    m1.textContent = "1"; m2.textContent = "1"; await wait(1000);
    m1.textContent = "¡FIGHT!"; m2.textContent = "¡FIGHT!"; await wait(400);
    overlayP1.classList.add("hidden"); overlayP2.classList.add("hidden");
    pvpIsStarting = false; runPvpTimerEngine();
}

async function startOnlineCountdown() {
    pvpIsStarting = true;
    overlayP1.classList.remove("hidden"); overlayP2.classList.remove("hidden");
    const m1 = overlayP1.querySelector(".overlay-msg"), m2 = overlayP2.querySelector(".overlay-msg");
    m1.textContent = "3"; m2.textContent = "3"; await wait(1000);
    m1.textContent = "2"; m2.textContent = "2"; await wait(1000);
    m1.textContent = "1"; m2.textContent = "1"; await wait(1000);
    m1.textContent = "¡FIGHT!"; m2.textContent = "¡FIGHT!"; await wait(400);
    overlayP1.classList.add("hidden"); overlayP2.classList.add("hidden");
    pvpIsStarting = false;
    
    if (role === "P1") {
        await updateDoc(doc(db, "rooms", currentRoomId), { gameRunning: true, isStarting: false });
    }
    runPvpTimerEngine();
}

function runPvpTimerEngine() {
    let timeLeft = gameplayMode === "match" ? 90 : 30;
    lastIntervalSeconds = timeLeft;
    isExtraTime = false;
    pvpGameRunning = true;
    pvpTimer.textContent = timeLeft.toFixed(2);

    pvpInterval = setInterval(async () => {
        timeLeft -= 0.01;
        if (timeLeft < 0) timeLeft = 0;
        pvpTimer.textContent = timeLeft.toFixed(2);

        // LÓGICA MODO PARTIDO: Cada 10 segundos evalúa gol
        if (gameplayMode === "match" && pvpGameRunning) {
            // Evaluamos si pasaron 10 segundos enteros (ej. de 90 a 80, de 80 a 70...)
            if (lastIntervalSeconds - timeLeft >= 10.00) {
                lastIntervalSeconds = Math.floor(timeLeft); // Sincroniza la marca de tiempo entero
                await processGoalCheck();
            }
        }

        if (timeLeft <= 0) {
            clearInterval(pvpInterval);
            pvpInterval = null;

            // Al finalizar el tiempo reglamentario (90s)... ¿hay empate en modo partido?
            if (gameplayMode === "match" && goalsP1 === goalsP2) {
                triggerExtraTime();
            } else {
                pvpGameRunning = false;
                endMatchAndDeclareWinner();
            }
        }
    }, 10);
}

// Comprobación y cálculo de Goles cada 10s
async function processGoalCheck() {
    if (pvpMode === "online") {
        // Solo el host calcula los goles para evitar duplicación y conflicto de escrituras
        if (role === "P1") {
            const roomRef = doc(db, "rooms", currentRoomId);
            const snap = await getDoc(roomRef);
            if (snap.exists()) {
                const curData = snap.data();
                let rClicksP1 = curData.clicksP1;
                let rClicksP2 = curData.clicksP2;
                let newGoalsP1 = curData.goalsP1;
                let newGoalsP2 = curData.goalsP2;

                if (rClicksP1 > rClicksP2) newGoalsP1++;
                else if (rClicksP2 > rClicksP1) newGoalsP2++;

                await updateDoc(roomRef, {
                    goalsP1: newGoalsP1,
                    goalsP2: newGoalsP2,
                    clicksP1: 0, // Reset de clics para el próximo round de 10s
                    clicksP2: 0
                });
            }
        }
        // En Local u Online el reset visual de los clics se ejecuta limpiamente
        clicksP1 = 0; clicksP2 = 0;
        if (scoreP1) scoreP1.textContent = "0";
        if (scoreP2) scoreP2.textContent = "0";
    } else {
        // Local Mode
        if (clicksP1 > clicksP2) goalsP1++;
        else if (clicksP2 > clicksP1) goalsP2++;

        if (goalsP1Display) goalsP1Display.textContent = goalsP1;
        if (goalsP2Display) goalsP2Display.textContent = goalsP2;

        clicksP1 = 0; clicksP2 = 0;
        if (scoreP1) scoreP1.textContent = "0";
        if (scoreP2) scoreP2.textContent = "0";
    }
}

// PRÓRROGA / MUERTE SÚBITA (10 segundos adicionales)
function triggerExtraTime() {
    isExtraTime = true;
    timerLabel.textContent = "PRÓRROGA";
    let extraTimeLeft = 10;
    lastIntervalSeconds = extraTimeLeft;
    pvpGameRunning = true;

    pvpInterval = setInterval(async () => {
        extraTimeLeft -= 0.01;
        if (extraTimeLeft < 0) extraTimeLeft = 0;
        pvpTimer.textContent = extraTimeLeft.toFixed(2);

        // Durante la prórroga, si alguien saca ventaja al finalizar los 10 segundos o al meter gol
        if (lastIntervalSeconds - extraTimeLeft >= 10.00) {
            clearInterval(pvpInterval);
            pvpInterval = null;
            pvpGameRunning = false;
            
            // Evalúa el último round de la prórroga
            await processGoalCheck();
            endMatchAndDeclareWinner();
        }
    }, 10);
}

/* ===================================================
   5. FIN DE JUEGO Y DECLARACIÓN DE GANADORES
=================================================== */
async function endMatchAndDeclareWinner() {
    let finalP1 = clicksP1;
    let finalP2 = clicksP2;

    if (pvpMode === "online" && currentRoomId) {
        if (role === "P1") await updateDoc(doc(db, "rooms", currentRoomId), { gameRunning: false });
        const snap = await getDoc(doc(db, "rooms", currentRoomId));
        if (snap.exists()) {
            finalP1 = snap.data().clicksP1;
            finalP2 = snap.data().clicksP2;
            goalsP1 = snap.data().goalsP1;
            goalsP2 = snap.data().goalsP2;
        }
    }

    // Definición de ganadores basada en el Modo de Juego elegido
    if (gameplayMode === "match") {
        finalGoalsP1.classList.remove("hidden");
        finalGoalsP2.classList.remove("hidden");
        finalGoalsP1.textContent = `${goalsP1} Goles`;
        finalGoalsP2.textContent = `${goalsP2} Goles`;

        if (goalsP1 > goalsP2) {
            pvpWinnerDeclaration.textContent = "🏆 ¡EL LOCAL DOMINÓ EL PARTIDO!";
            pvpWinnerDeclaration.style.color = "#00f3ff";
        } else if (goalsP2 > goalsP1) {
            pvpWinnerDeclaration.textContent = "🏆 ¡EL VISITANTE SE LLEVA LOS 3 PUNTOS!";
            pvpWinnerDeclaration.style.color = "#ff007b";
        } else {
            pvpWinnerDeclaration.textContent = "🤝 ¡EMPATE EN EL TABLERO!";
            pvpWinnerDeclaration.style.color = "#fff";
        }
    } else {
        finalGoalsP1.classList.add("hidden");
        finalGoalsP2.classList.add("hidden");

        if (finalP1 > finalP2) {
            pvpWinnerDeclaration.textContent = "🏆 ¡EL JUGADOR 1 DOMINÓ!";
            pvpWinnerDeclaration.style.color = "#00f3ff";
        } else if (finalP2 > finalP1) {
            pvpWinnerDeclaration.textContent = "🏆 ¡EL JUGADOR 2 DOMINÓ!";
            pvpWinnerDeclaration.style.color = "#ff007b";
        } else {
            pvpWinnerDeclaration.textContent = "🤝 ¡EMPATE ABSOLUTO!";
            pvpWinnerDeclaration.style.color = "#fff";
        }
    }

    if (finalScoreP1) finalScoreP1.textContent = `${finalP1} Clics en Round`;
    if (finalScoreP2) finalScoreP2.textContent = `${finalP2} Clics en Round`;

    const hint = pvpGameOver.querySelector(".reset-hint");
    if (hint) {
        hint.textContent = pvpMode === "local" 
            ? (isTouchDevice ? "Doble clic para revancha local" : "Presiona ESPACIO para revancha")
            : "Presiona el botón unificado de abajo para acordar la Revancha";
    }

    // Mudanza dinámica del botón unificado para evitar z-index lock
    if (pvpMode === "online" && btnReadyOnline) {
        const gameoverCard = pvpGameOver.querySelector(".gameover-card");
        if (gameoverCard) {
            gameoverCard.insertBefore(btnReadyOnline, btnExitPvp);
            btnReadyOnline.classList.remove("hidden");
            btnReadyOnline.style.margin = "20px auto";
            btnReadyOnline.style.width = "85%";
            
            if (currentRoomId) {
                const roomSnap = await getDoc(doc(db, "rooms", currentRoomId));
                if (roomSnap.exists()) {
                    const rData = roomSnap.data();
                    let rematchCount = (rData.rematchP1 ? 1 : 0) + (rData.rematchP2 ? 1 : 0);
                    btnReadyOnline.textContent = `VOLVER A JUGAR (${rematchCount}/2)`;
                }
            }
        }
    }

    if (pvpGameOver) pvpGameOver.classList.remove("hidden");
}

/* ===================================================
   6. REINICIOS Y LIMPIEZAS SIMULTÁNEAS
=================================================== */
function resetArenaLocal() {
    clicksP1 = 0; clicksP2 = 0; goalsP1 = 0; goalsP2 = 0;
    p1Ready = false; p2Ready = false;
    
    if (scoreP1) scoreP1.textContent = "0";
    if (scoreP2) scoreP2.textContent = "0";
    if (goalsP1Display) goalsP1Display.textContent = "0";
    if (goalsP2Display) goalsP2Display.textContent = "0";
    
    if (gameplayMode === "match") {
        pvpTimer.textContent = "90.00";
        timerLabel.textContent = "PARTIDO";
    } else {
        pvpTimer.textContent = "30.00";
        timerLabel.textContent = "TIEMPO";
    }

    overlayP1.classList.remove("hidden", "ready-active");
    overlayP1.querySelector(".overlay-msg").textContent = msgP1Default;
    overlayP2.classList.remove("hidden", "ready-active");
    overlayP2.querySelector(".overlay-msg").textContent = msgP2Default;
    pvpGameOver.classList.add("hidden");
}

async function resetArenaOnlineLocalState() {
    clicksP1 = 0; clicksP2 = 0; goalsP1 = 0; goalsP2 = 0;
    if (scoreP1) scoreP1.textContent = "0";
    if (scoreP2) scoreP2.textContent = "0";
    if (goalsP1Display) goalsP1Display.textContent = "0";
    if (goalsP2Display) goalsP2Display.textContent = "0";
    
    if (gameplayMode === "match") {
        pvpTimer.textContent = "90.00";
        timerLabel.textContent = "PARTIDO";
    } else {
        pvpTimer.textContent = "30.00";
        timerLabel.textContent = "TIEMPO";
    }
    
    pvpGameOver.classList.add("hidden");

    if (btnReadyOnline) {
        const arenaCore = document.querySelector(".arena-core");
        if (arenaCore) {
            arenaCore.appendChild(btnReadyOnline);
            btnReadyOnline.style.margin = "0";
            btnReadyOnline.style.width = "100%";
            btnReadyOnline.textContent = "¡ESTOY LISTO! (0/2)";
        }
    }

    if (role === "P1") {
        await updateDoc(doc(db, "rooms", currentRoomId), {
            clicksP1: 0, clicksP2: 0,
            goalsP1: 0, goalsP2: 0,
            p1Ready: false, p2Ready: false,
            isStarting: false, gameRunning: false,
            rematchP1: false, rematchP2: false
        });
    }
}

if (pvpGameOver) {
    pvpGameOver.addEventListener("click", () => {
        if (pvpMode !== "local") return;
        const now = Date.now();
        if (now - lastGameOverClick < 300) resetArenaLocal();
        lastGameOverClick = now;
    });
}

async function cleanOnlineStructures() {
    if (unsubscribeRoom) unsubscribeRoom();
    if (currentRoomId && role === "P1") {
        try {
            await deleteDoc(doc(db, "rooms", currentRoomId));
        } catch(e){}
    }
    currentRoomId = null; role = null; pvpMode = null; gameplayMode = null;
}

if (btnExitPvp) {
    btnExitPvp.addEventListener("click", async () => {
        await cleanOnlineStructures();
        window.location.href = "index.html";
    });
}
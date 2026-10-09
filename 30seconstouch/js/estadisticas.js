import { auth, db } from "./firebase.js";
import { 
    doc, 
    getDoc, 
    collection, 
    query, 
    where, 
    getDocs,
    orderBy,
    limit 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const userNameDisplay = document.getElementById("userNameDisplay");
const statPvpWins = document.getElementById("statPvpWins");
const statGlobalRank = document.getElementById("statGlobalRank");
const statGroupPos = document.getElementById("statGroupPos");
const statChallengeDay = document.getElementById("statChallengeDay");
const statBestScore = document.getElementById("statBestScore");
const statCoins = document.getElementById("statCoins");

auth.onAuthStateChanged(async (user) => {
    if (user) {
        await cargarEstadisticas(user.uid);
    } else {
        window.location.href = "index.html";
    }
});

async function cargarEstadisticas(uid) {
    // 1. Obtener datos básicos del usuario
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const data = userSnap.data();
        userNameDisplay.textContent = `ID AGENTE: ${data.username || data.name || "USUARIO_DESCONOCIDO"}`;
        statBestScore.textContent = data.bestScore || 0;
        statChallengeDay.textContent = data.currentChallengeDay || 1;
        if (statCoins) statCoins.textContent = data.coins !== undefined ? data.coins : 0;

        // Posición real dentro del grupo (si el jugador pertenece a uno)
        if (data.groupId) {
            await cargarPosicionGrupo(data.groupId, uid);
        } else {
            statGroupPos.textContent = "--/--";
            const groupNameEl = document.getElementById("groupName");
            if (groupNameEl) groupNameEl.textContent = "SIN GRUPO ACTIVO";
        }
    } else {
        userNameDisplay.textContent = "ID AGENTE: USUARIO_DESCONOCIDO";
    }

    // 2. Contar Victorias Reales en PVP
    try {
        const q = query(collection(db, "pvpStats"), where("winnerId", "==", uid));
        const winsSnap = await getDocs(q);
        statPvpWins.textContent = winsSnap.size;
    } catch (e) {
        console.error("Error cargando victorias:", e);
    }

    // 3. Calcular Rango Mundial (Ranking por Victorias o por BestScore)
    // Hacemos una consulta rápida a los top 100 para ver dónde encaja el usuario
    try {
        const qRank = query(collection(db, "users"), orderBy("bestScore", "desc"), limit(100));
        const rankSnap = await getDocs(qRank);
        let pos = 1;
        let found = false;
        
        rankSnap.forEach((doc) => {
            if (doc.id === uid) {
                statGlobalRank.textContent = `#${pos}`;
                found = true;
            }
            pos++;
        });

        if (!found) statGlobalRank.textContent = "TOP 100+";
    } catch (e) {
        console.error("Error cargando ranking:", e);
    }
}
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { generarEmojiBandera, suscribirseARankingCombinado } from "./ranking-common.js";

const rankingList = document.getElementById("rankingList");
const worldRecordScore = document.getElementById("worldRecordScore");
const worldRecordName = document.getElementById("worldRecordName");
const worldRecordDate = document.getElementById("worldRecordDate");

let currentUid = null;
let ultimaListaCombinada = [];

// Escuchar cambios de autenticación para saber quién es el usuario actual
onAuthStateChanged(auth, (user) => {
    currentUid = user ? user.uid : null;
    // Forzar redibujado del ranking cuando alguien entra o sale para actualizar los "(TÚ)"
    if (ultimaListaCombinada.length) {
        renderRanking(ultimaListaCombinada);
    }
});

function initRanking() {
    if (!rankingList) return;
    suscribirseARankingCombinado((listaCombinada) => {
        ultimaListaCombinada = listaCombinada;
        renderRanking(listaCombinada);
    });
}

function renderRanking(listaJugadores) {
    rankingList.innerHTML = ""; // Limpiar lista anterior

    let usuarioEncontradoEnTop10 = false;
    let posicionUsuarioActual = 0;
    let datosUsuarioActual = null;

    const limiteTop = Math.min(listaJugadores.length, 10);

    for (let i = 0; i < limiteTop; i++) {
        const jugador = listaJugadores[i];
        const posicion = i + 1;
        const score = jugador.bestScore || 0;

        let originalName = jugador.username || jugador.name || "Jugador Anónimo";
        let pais = jugador.countryCode ? jugador.countryCode.toUpperCase() : "";

        let nombreConPais = pais ? `${originalName} (${pais})` : originalName;
        let bandera = generarEmojiBandera(pais);

        let esElUsuarioActual = (currentUid && jugador.uid === currentUid);

        if (esElUsuarioActual) {
            usuarioEncontradoEnTop10 = true;
            posicionUsuarioActual = posicion;
            nombreConPais += ` <span style="color: var(--orange); font-size: 11px; font-weight: bold;">(TÚ)</span>`;
        }

        const li = document.createElement("li");
        if (esElUsuarioActual) {
            li.style.background = "rgba(255, 106, 31, 0.1)";
            li.style.borderRadius = "6px";
            li.style.padding = "6px 8px";
        }

        li.innerHTML = `
            <span class="pos">${posicion}</span>
            <span class="flag">${esElUsuarioActual ? "🔥" : bandera}</span>
            <span class="name">${nombreConPais}</span>
            <span class="score">${score.toLocaleString()}</span>
        `;

        if (posicion === 1) {
            if (worldRecordScore) worldRecordScore.textContent = score.toLocaleString();
            if (worldRecordName) worldRecordName.textContent = nombreConPais.replace(/<[^>]*>/g, '');
            if (worldRecordDate) {
                const dateObj = jugador.lastPlayed ? new Date(jugador.lastPlayed) : new Date();
                worldRecordDate.textContent = `Logrado el ${dateObj.toLocaleDateString()}`;
            }
        }

        rankingList.appendChild(li);
    }

    // ¿Quedaste fuera del Top 10?
    if (currentUid && !usuarioEncontradoEnTop10) {
        for (let i = 0; i < listaJugadores.length; i++) {
            if (listaJugadores[i].uid === currentUid) {
                posicionUsuarioActual = i + 1;
                datosUsuarioActual = listaJugadores[i];
                break;
            }
        }

        if (posicionUsuarioActual > 10) {
            const divisor = document.createElement("li");
            divisor.style.justifyContent = "center";
            divisor.style.color = "var(--text-muted)";
            divisor.style.fontSize = "12px";
            divisor.style.borderTop = "1px dashed var(--panel-border)";
            divisor.style.margin = "8px 0";
            divisor.textContent = "• • • • • • • • • • • • • •";
            rankingList.appendChild(divisor);

            const liUsuarioFuera = document.createElement("li");
            liUsuarioFuera.style.background = "rgba(255, 106, 31, 0.08)";
            liUsuarioFuera.style.borderRadius = "6px";
            liUsuarioFuera.style.padding = "6px 8px";

            let userPais = datosUsuarioActual.countryCode ? datosUsuarioActual.countryCode.toUpperCase() : "";
            let userNombre = datosUsuarioActual.username || datosUsuarioActual.name || "Jugador";
            let userNombreConPais = userPais ? `${userNombre} (${userPais})` : userNombre;

            liUsuarioFuera.innerHTML = `
                <span class="pos" style="color: var(--text-dim);">${posicionUsuarioActual}</span>
                <span class="flag">🔥</span>
                <span class="name">${userNombreConPais} <span style="color: var(--orange); font-size: 11px; font-weight: bold;">(TÚ)</span></span>
                <span class="score">${(datosUsuarioActual.bestScore || 0).toLocaleString()}</span>
            `;
            rankingList.appendChild(liUsuarioFuera);
        }
    }
}

initRanking();

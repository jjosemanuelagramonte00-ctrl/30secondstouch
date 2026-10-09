// ===================================================
// MÓDULO COMPARTIDO DE RANKING
// Usado por index.html (Top 10) y pocisiones.html (ranking completo)
// ===================================================
import { db } from "./firebase.js";
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Jugadores de relleno con nombres y puntajes lógicos/localizados.
// Se muestran SOLO mientras haya menos de 30 cuentas reales registradas.
// A medida que se registran jugadores de verdad, van desapareciendo de a uno,
// hasta que a partir de las 30 cuentas reales el ranking es 100% real.
export const BOTS_FICTICIOS = [
    { name: "Mateo Benítez", bestScore: 224, uid: "bot1", countryCode: "AR" },
    { name: "Thiago Silva", bestScore: 213, uid: "bot2", countryCode: "BR" },
    { name: "Sofía Rodríguez", bestScore: 201, uid: "bot3", countryCode: "MX" },
    { name: "Santiago Gómez", bestScore: 192, uid: "bot4", countryCode: "CO" },
    { name: "Valentina Acuña", bestScore: 184, uid: "bot5", countryCode: "CL" },
    { name: "Lucas Flores", bestScore: 176, uid: "bot6", countryCode: "PE" },
    { name: "Alejandro Muñoz", bestScore: 168, uid: "bot7", countryCode: "ES" },
    { name: "Camila Morales", bestScore: 159, uid: "bot8", countryCode: "VE" },
    { name: "Nicolás González", bestScore: 151, uid: "bot9", countryCode: "AR" },
    { name: "Isabella Rossi", bestScore: 144, uid: "bot10", countryCode: "IT" },
    { name: "Julián Torres", bestScore: 137, uid: "bot11", countryCode: "UY" },
    { name: "Martina Sosa", bestScore: 130, uid: "bot12", countryCode: "AR" },
    { name: "Diego Ramírez", bestScore: 124, uid: "bot13", countryCode: "MX" },
    { name: "Fernanda Castro", bestScore: 118, uid: "bot14", countryCode: "CO" },
    { name: "Emiliano Vidal", bestScore: 112, uid: "bot15", countryCode: "CL" },
    { name: "Renata Duarte", bestScore: 106, uid: "bot16", countryCode: "PY" },
    { name: "Bruno Almeida", bestScore: 101, uid: "bot17", countryCode: "BR" },
    { name: "Lucía Herrera", bestScore: 96, uid: "bot18", countryCode: "EC" },
    { name: "Tomás Ibáñez", bestScore: 91, uid: "bot19", countryCode: "AR" },
    { name: "Paula Navarro", bestScore: 86, uid: "bot20", countryCode: "ES" },
    { name: "Gabriel Reyes", bestScore: 81, uid: "bot21", countryCode: "PE" },
    { name: "Antonella Ferrari", bestScore: 76, uid: "bot22", countryCode: "IT" },
    { name: "Joaquín Molina", bestScore: 71, uid: "bot23", countryCode: "AR" },
    { name: "Daniela Paredes", bestScore: 67, uid: "bot24", countryCode: "BO" },
    { name: "Iker Fernández", bestScore: 63, uid: "bot25", countryCode: "ES" },
    { name: "Catalina Rojas", bestScore: 59, uid: "bot26", countryCode: "CL" },
    { name: "Mateo Cabrera", bestScore: 55, uid: "bot27", countryCode: "UY" },
    { name: "Victoria Núñez", bestScore: 51, uid: "bot28", countryCode: "AR" },
    { name: "Samuel Ortiz", bestScore: 47, uid: "bot29", countryCode: "CO" },
    { name: "Agustina Vega", bestScore: 43, uid: "bot30", countryCode: "MX" }
];

export function generarEmojiBandera(codigoPais) {
    if (!codigoPais) return "🌐";
    const codePoints = codigoPais
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    try {
        return String.fromCodePoint(...codePoints);
    } catch {
        return "🌐";
    }
}

/**
 * Combina jugadores reales con bots de relleno.
 * Mientras haya menos de 30 cuentas reales, se completa hasta 30 con bots.
 * A partir de 30 cuentas reales, no se agrega ningún bot.
 */
export function combinarConBots(jugadoresReales) {
    const cantidadReal = jugadoresReales.length;
    let combinados = [...jugadoresReales];

    if (cantidadReal < 30) {
        const faltantes = 30 - cantidadReal;
        combinados = combinados.concat(BOTS_FICTICIOS.slice(0, faltantes));
    }

    combinados.sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0));
    return combinados;
}

/**
 * Se suscribe en tiempo real a los usuarios reales de Firestore y devuelve,
 * por callback, la lista ya combinada con bots según la regla de arriba.
 * callback(listaCombinada, cantidadJugadoresReales)
 */
export function suscribirseARankingCombinado(callback) {
    const q = query(collection(db, "users"), orderBy("bestScore", "desc"));
    return onSnapshot(q, (snapshot) => {
        const reales = [];
        snapshot.forEach((docSnap) => reales.push(docSnap.data()));
        callback(combinarConBots(reales), reales.length);
    }, (error) => {
        console.error("Error al obtener el ranking global:", error);
        callback(combinarConBots([]), 0);
    });
}

/**
 * Agrega puntajes por país (guerra de países), usando la MISMA lista combinada
 * (reales + bots de relleno) para que el panel nunca se muestre vacío al principio.
 */
export function calcularRankingPorPaises(listaCombinada) {
    const paises = {};
    listaCombinada.forEach((jugador) => {
        const code = (jugador.countryCode || "").toUpperCase();
        if (!code) return;
        if (!paises[code]) paises[code] = { code, totalScore: 0, jugadores: 0 };
        paises[code].totalScore += (jugador.bestScore || 0);
        paises[code].jugadores += 1;
    });
    return Object.values(paises).sort((a, b) => b.totalScore - a.totalScore);
}

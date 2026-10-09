import { db } from "./firebase.js";
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const newsFeed = document.getElementById("newsFeed");

// 1. Definir la consulta
const newsRef = collection(db, "news");
const q = query(newsRef, orderBy("timestamp", "desc"));

console.log("Iniciando escucha de noticias...");

onSnapshot(q, (snapshot) => {
    console.log("Noticias recibidas de Firebase. Cantidad:", snapshot.size);
    newsFeed.innerHTML = ""; // Limpiar visual

    if (snapshot.empty) {
        newsFeed.innerHTML = "<div class='news-item'><h3>SIN NOVEDADES</h3><p>Actualmente no hay comunicados oficiales. Vuelve pronto.</p></div>";
        return;
    }

    snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Formateo seguro de fecha
        const fecha = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleDateString() : "Fecha indefinida";
        
        const item = document.createElement("div");
        item.className = "news-item";
        item.innerHTML = `
            <div class="news-date">${fecha}</div>
            <div class="news-title">${data.title || "SIN TÍTULO"}</div>
            <div class="news-body-text">${data.message || "..."}</div>
        `;
        newsFeed.appendChild(item);
    });
}, (error) => {
    console.error("Error crítico de Firestore:", error);
    newsFeed.innerHTML = "<div class='news-item'><h3>ERROR DE CONEXIÓN</h3><p>No se pudieron cargar las noticias. Revisa la consola (F12).</p></div>";
});
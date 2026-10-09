import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Elemento HTML donde se muestra el balance de monedas
const userCoinsEl = document.getElementById("userCoins");

// --- TABLA DE RECOMPENSAS PARA LAS CAJAS SORPRESA ---
// Cuando un usuario abra una caja, el sistema elegirá un objeto al azar de esta lista
const poolCajas = {
    "box_bronze": [
        { id: "consumable_chances", tipo: "consumable", nombre: "🔋 +5 Intentos Diarios" },
        { id: "neon_cyan", tipo: "theme", nombre: "🎨 Tema Cyber Cian" },
        { id: "consumable_shield", tipo: "consumable", nombre: "🛡️ Escudo de Combo" }
    ],
    "box_silver": [
        { id: "fx_explosion", tipo: "fx", nombre: "💥 Efecto Micro Explosión" },
        { id: "neon_pink", tipo: "theme", nombre: "🎨 Tema Tokyo Pink" },
        { id: "consumable_freeze", tipo: "consumable", nombre: "⏱️ Congelador Temporal" }
    ],
    "box_contraband": [
        { id: "fx_lightning", tipo: "fx", nombre: "⚡ Efecto Rayo de Voltaje" },
        { id: "skin_sun", tipo: "theme", nombre: "🔴 Skin NúcleO Solar" },
        { id: "pet_fox", tipo: "pet", nombre: "🦊 Mascota Zorro Cibernético" }
    ],
    "box_mystic": [
        { id: "pet_ufo", tipo: "pet", nombre: "🛸 Mini OVNI Compañero" },
        { id: "fx_money", tipo: "fx", nombre: "💵 Lluvia de Billetes" },
        { id: "pet_dragon", tipo: "pet", nombre: "🐉 Dragón de Megabits" }
    ]
};

// 1. Escuchar el estado de autenticación del usuario
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Usuario detectado en la tienda:", user.displayName);
        await cargarMonedasYVerificarItems(user.uid);
    } else {
        console.log("Invitado en la tienda.");
        if (userCoinsEl) userCoinsEl.textContent = "0";
        configurarTiendaInvitado();
    }
});

// 2. Cargar las monedas desde Firestore y actualizar la interfaz
async function cargarMonedasYVerificarItems(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const snap = await getDoc(userRef);
        
        if (!snap.exists()) return;

        const data = snap.data();
        
        // Mostrar las monedas reales del usuario
        const monedasActuales = data.coins !== undefined ? data.coins : 0;
        if (userCoinsEl) userCoinsEl.textContent = monedasActuales;

        // Obtener la lista de artículos que el usuario YA compró
        const itemsComprados = data.itemsComprados || [];

        // Capturar todos los botones que tengan la clase específica de nuestra tienda
        const botonesCompra = document.querySelectorAll(".btn-shop-action");
        
        botonesCompra.forEach((boton) => {
            // LEER LOS DATOS DIRECTAMENTE DEL HTML NUEVO
            const itemId = boton.getAttribute("data-id");
            const itemType = boton.getAttribute("data-type");
            const precio = parseInt(boton.getAttribute("data-price"), 10) || 0;

            // Si el ítem ya fue comprado y NO es una caja ni un consumible, lo deshabilitamos
            if (itemsComprados.includes(itemId) && itemType !== "box" && itemType !== "consumable") {
                boton.textContent = "ADQUIRIDO";
                boton.disabled = true;
            } else {
                boton.disabled = false;
                // Asignar el evento de compra pasando sus datos reales y el tipo
                boton.onclick = () => ejecutarCompra(uid, itemId, precio, itemType);
            }
        });

    } catch (error) {
        console.error("Error al cargar los datos de Firestore en la tienda:", error);
    }
}

// 3. Procesar la compra, restar las monedas y guardar en la base de datos
async function ejecutarCompra(uid, itemId, costo, itemType) {
    if (costo === 0) return;

    // Mensaje personalizado si es una caja o un artículo normal
    const mensajeConfirmar = itemType === "box" 
        ? `¿Quieres abrir esta caja sorpresa por 🪙 ${costo} monedas?`
        : `¿Quieres comprar este artículo por 🪙 ${costo} monedas?`;

    if (confirm(mensajeConfirmar)) {
        try {
            const userRef = doc(db, "users", uid);
            const snap = await getDoc(userRef);
            
            if (!snap.exists()) return;

            const data = snap.data();
            let monedasActuales = data.coins !== undefined ? data.coins : 0;
            let itemsComprados = data.itemsComprados || [];

            // Verificar si le alcanza el dinero
            if (monedasActuales < costo) {
                alert("❌ No tienes suficientes monedas. ¡Sigue jugando para ganar más!");
                return;
            }

            // Descontar el dinero base de la compra
            let nuevoSaldo = monedasActuales - costo;
            let actualizaciones = { coins: nuevoSaldo };

            // --- LÓGICA LOGÍSTICA SEGÚN EL TIPO DE ARTÍCULO ---
            if (itemType === "box") {
                // Sacar un premio aleatorio de la lista correspondiente
                const premiosDisponibles = poolCajas[itemId];
                const premioGanado = premiosDisponibles[Math.floor(Math.random() * premiosDisponibles.length)];
                
                alert(`🎁 ¡Abriendo caja sorpresa!...\n\n🎉 ¡TE TOCÓ: ${premioGanado.nombre}!`);

                // Si tocó consumible o cosmético, guardarlo en la cuenta si no lo tenía
                if (premioGanado.tipo === "consumable") {
                    if (premioGanado.id === "consumable_chances") {
                        actualizaciones.intentosDiarios = (data.intentosDiarios !== undefined ? data.intentosDiarios : 3) + 5;
                    } else {
                        // Guardar consumible genérico en un mapa de inventario
                        let consumibles = data.consumibles || {};
                        consumibles[premioGanado.id] = (consumibles[premioGanado.id] || 0) + 1;
                        actualizaciones.consumibles = consumibles;
                    }
                } else {
                    // Si es un cosmético permanente ganado por caja, se añade a sus pertenencias
                    if (!itemsComprados.includes(premioGanado.id)) {
                        itemsComprados.push(premioGanado.id);
                    }
                }
            } 
            else if (itemType === "consumable") {
                // Si compra de manera directa la recarga de chances
                if (itemId === "consumable_chances") {
                    actualizaciones.intentosDiarios = (data.intentosDiarios !== undefined ? data.intentosDiarios : 3) + 5;
                    alert("🔋 ¡Chances añadidas! Se sumaron +5 intentos diarios a tu perfil.");
                } else {
                    // Guardar otros consumibles comprados directamente
                    let consumibles = data.consumibles || {};
                    consumibles[itemId] = (consumibles[itemId] || 0) + 1;
                    actualizaciones.consumibles = consumibles;
                    alert("✨ Consumible guardado en tu inventario de partida.");
                }
            } 
            else {
                // Si es un artículo de cosmética normal permanente (Skin, Mascota, FX o Pase)
                itemsComprados.push(itemId);
                alert("✨ ¡Compra realizada con éxito! El artículo se guardó en tu usuario.");
            }

            // Actualizar la lista de ítems permanentes de la cuenta
            actualizaciones.itemsComprados = itemsComprados;

            // Guardar de forma unificada en Firestore
            await updateDoc(userRef, actualizaciones);

            // Recargar la tienda para actualizar el contador visual y bloquear los botones comprados
            await cargarMonedasYVerificarItems(uid);

        } catch (error) {
            console.error("Error al procesar la transacción:", error);
            alert("Hubo un error al conectar con el servidor de compra.");
        }
    }
}

// 4. Bloquear interacciones si es un usuario invitado (sin sesión)
function configurarTiendaInvitado() {
    const botonesCompra = document.querySelectorAll(".btn-shop-action");
    botonesCompra.forEach(boton => {
        boton.onclick = () => {
            alert("🔒 Debes iniciar sesión para poder comprar artículos en el Bazar.");
        };
    });
}
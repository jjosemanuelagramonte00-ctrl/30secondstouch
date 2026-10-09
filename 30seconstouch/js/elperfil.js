import { db, auth } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { collection, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { crearGrupo, unirseAGrupo, obtenerGrupo } from './grupos.js';

const ITEM_DATABASE = {
    "premium_pass": { title: "PASO PREMIUM", icon: "⚡", desc: "Acceso ilimitado sin anuncios y multiplicador x2 de monedas." },
    "neon_cyan": { title: "TEMA CYBER CIAN", icon: "🔴", desc: "Acentos naranja por un cian brillante.", color: "#00ffff", glow: "rgba(0, 255, 255, 0.4)" },
    "neon_pink": { title: "TOQUE TOKYO PINK", icon: "🔴", desc: "Estilo retro synthwave con tonos rosa neón.", color: "#ff007f", glow: "rgba(255, 0, 127, 0.4)" },
    "neon_matrix": { title: "MATRIX CODE", icon: "🔴", desc: "Estilo terminal de hacker clásico de los 90s.", color: "#00ff33", glow: "rgba(0, 255, 51, 0.4)" },
    "skin_sun": { title: "NÚCLEO SOLAR", icon: "☀️", desc: "El círculo se convierte en un sol radiante." },
    "skin_diamond": { title: "CRISTAL DIAMANTE", icon: "💎", desc: "Transforma el objetivo en un diamante brillante." },
    "skin_vortex": { title: "VÓRTICE COSMICO", icon: "🌀", desc: "Un agujero negro animado que gira lentamente." },
    "pet_neko": { title: "NEKO-BOT CLIC", icon: "🐱‍👤", desc: "Un gatito holográfico que reacciona a tus rachas." },
    "pet_ufo": { title: "MINI OVNI COMPAÑERO", icon: "🛸", desc: "Vuela alrededor de la pantalla absorbiendo fallos." },
    "pet_phoenix": { title: "ESPÍRITU PHOENIX", icon: "🔥", desc: "Deja una estela de fuego al tocar la pantalla." },
    "pet_fox": { title: "ZORRO CIBERNÉTICO", icon: "🦊", desc: "Anima tus combos desde las esquinas del display." },
    "pet_dragon": { title: "DRAGÓN DE MEGABITS", icon: "🐉", desc: "Acompañante legendario del entorno arcade." },
    "fx_explosion": { title: "MICRO EXPLOSIÓN", icon: "💥", desc: "Cada clic genera una onda expansiva pixelada." },
    "fx_money": { title: "LLUVIA DE BILLETES", icon: "💵", desc: "Desata ráfagas de dinero con cada click exitoso." },
    "fx_lightning": { title: "RAYO DE VOLTAJE", icon: "⚡", desc: "Pequeños relámpagos estallan desde cada toque." },
    "fx_stars": { title: "POLVO DE ESTRELLAS", icon: "✨", desc: "Deja un rastro brillante de purpurina arcade flotando en el aire." },
    "consumable_size": { title: "POCIÓN DE FÓSFORO", icon: "🧪", desc: "Vuelve el círculo un 10% más grande en tu próxima partida." },
    "consumable_freeze": { title: "CONGELADOR TEMPORAL", icon: "⏱️", desc: "Añade +2 segundos extra al reloj en tu próxima partida." },
    "consumable_shield": { title: "ESCUDO DE COMBO", icon: "🛡️", desc: "Tu primer clic fallado en la próxima partida no contará." }
};

let currentUserData = null;
let currentFilter = 'all';

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await cargarDatosPerfil(user.uid);
    } else {
        window.location.href = "index.html";
    }
});

async function cargarDatosPerfil(uid) {
    try {
        const listaUsuariosRef = collection(db, "users");
        const userRef = doc(listaUsuariosRef, uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            currentUserData = userSnap.data();
            
            if (!currentUserData.itemsComprados) currentUserData.itemsComprados = [];
            if (!currentUserData.consumibles) currentUserData.consumibles = {};
            if (!currentUserData.equippedTheme) currentUserData.equippedTheme = "default";
            if (!currentUserData.equippedPet) currentUserData.equippedPet = "none";
            if (!currentUserData.equippedFx) currentUserData.equippedFx = "none";

            document.getElementById("profileCardName").innerText = currentUserData.username || currentUserData.name || "PILOTO ARCADE";
            document.getElementById("profileCardEmail").innerText = auth.currentUser.email || "Sin Email";
            document.getElementById("profileCoins").innerText = `🪙 ${currentUserData.coins !== undefined ? currentUserData.coins : 0}`;
            document.getElementById("profileHighScore").innerText = `${currentUserData.bestScore || 0} PTS`;
            
            if (currentUserData.photo) {
                document.getElementById("profileCardPhoto").src = currentUserData.photo;
            } else {
                document.getElementById("profileCardPhoto").src = `https://ui-avatars.com/api/?name=${currentUserData.name || 'User'}&background=ff5500&color=fff`;
            }
            
            if (currentUserData.itemsComprados.includes('premium_pass')) {
                const premiumTag = document.getElementById("profilePremiumTag");
                if (premiumTag) premiumTag.style.display = "block";
            }

            aplicarTemaColor(currentUserData.equippedTheme);
            renderizarInventario();
            precargarModalConfiguracion();
        }
    } catch (error) {
        console.error("Error cargando perfil:", error);
    }
}

function renderizarInventario() {
    const grid = document.getElementById("inventoryGrid");
    if (!grid) return;
    
    grid.innerHTML = "";
    const itemsComprados = currentUserData.itemsComprados || []; 
    const consumibles = currentUserData.consumibles || {};
    const consumiblesPendientes = Object.entries(consumibles).filter(([id, cant]) => cant > 0 && ITEM_DATABASE[id]);

    if (itemsComprados.length === 0 && consumiblesPendientes.length === 0) {
        grid.innerHTML = `<div class="no-items-msg">No tenés ningún artículo comprado aún.</div>`;
        return;
    }

    // Consumibles pendientes: se aplican solos al empezar tu próxima partida
    if (currentFilter === 'all' || currentFilter === 'consumable') {
        consumiblesPendientes.forEach(([itemId, cantidad]) => {
            const itemStatic = ITEM_DATABASE[itemId];
            const itemHTML = `
                <div class="inventory-item" data-type="consumable">
                    <div>
                        <div class="item-header-inv">
                            <div class="item-icon-inv">${itemStatic.icon}</div>
                            <div class="item-title-inv">
                                <h4>${itemStatic.title} x${cantidad}</h4>
                                <span class="item-type-tag">CONSUMIBLE</span>
                            </div>
                        </div>
                        <p>${itemStatic.desc}</p>
                    </div>
                    <button class="btn-equip equipped" style="background:#11aa44; border-color:#22cc55; color:#fff; cursor:default;">SE USA AL JUGAR</button>
                </div>
            `;
            grid.insertAdjacentHTML('beforeend', itemHTML);
        });
    }

    itemsComprados.forEach(itemId => {
        const cleanId = itemId.trim();
        const itemStatic = ITEM_DATABASE[cleanId];
        if (!itemStatic) return; 

        let type = 'consumable';
        if (cleanId.startsWith('neon') || cleanId.startsWith('skin')) type = 'theme';
        if (cleanId.startsWith('pet')) type = 'pet';
        if (cleanId.startsWith('fx')) type = 'fx';
        if (cleanId.startsWith('item_store')) type = 'item';

        if (currentFilter !== 'all' && currentFilter !== type) return;

        let isEquipped = false;
        if (type === 'theme') isEquipped = (currentUserData.equippedTheme === cleanId);
        if (type === 'pet') isEquipped = (currentUserData.equippedPet === cleanId);
        if (type === 'fx') isEquipped = (currentUserData.equippedFx === cleanId);

        // Los consumibles de mejora pasiva siempre están activos una vez comprados
        const esEquipable = (type === 'theme' || type === 'pet' || type === 'fx');

        const itemHTML = `
            <div class="inventory-item" data-type="${type}">
                <div>
                    <div class="item-header-inv">
                        <div class="item-icon-inv">${itemStatic.icon}</div>
                        <div class="item-title-inv">
                            <h4>${itemStatic.title}</h4>
                            <span class="item-type-tag">${type.toUpperCase()}</span>
                        </div>
                    </div>
                    <p>${itemStatic.desc}</p>
                </div>
                ${esEquipable ? `
                    <button class="btn-equip ${isEquipped ? 'equipped' : ''}" data-id="${cleanId}" data-kind="${type}">
                        ${isEquipped ? 'EQUIPADO' : 'EQUIPAR'}
                    </button>
                ` : `
                    <button class="btn-equip equipped" style="background:#11aa44; border-color:#22cc55; color:#fff; cursor:default;">ACTIVO PASIVO</button>
                `}
            </div>
        `;
        grid.insertAdjacentHTML('beforeend', itemHTML);
    });

    añadirEventosBotones();
}

function aplicarTemaColor(themeId) {
    const root = document.documentElement;
    const item = ITEM_DATABASE[themeId];
    if (item && item.color) {
        root.style.setProperty('--theme-accent', item.color);
        root.style.setProperty('--theme-glow', item.glow);
    } else {
        root.style.setProperty('--theme-accent', '#ff5500');
        root.style.setProperty('--theme-glow', 'rgba(255, 85, 0, 0.3)');
    }
}

function añadirEventosBotones() {
    document.querySelectorAll('.btn-equip[data-kind]').forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });

    document.querySelectorAll('.btn-equip[data-kind]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const itemId = e.target.getAttribute('data-id');
            const kind = e.target.getAttribute('data-kind');
            const yaEquipado = e.target.classList.contains('equipped');
            if (!itemId || !kind) return;

            try {
                const userRef = doc(db, "users", auth.currentUser.uid);
                const updates = {};

                if (kind === 'theme') {
                    const nuevoValor = yaEquipado ? "default" : itemId;
                    currentUserData.equippedTheme = nuevoValor;
                    updates.equippedTheme = nuevoValor;
                    aplicarTemaColor(nuevoValor);
                } else if (kind === 'pet') {
                    const nuevoValor = yaEquipado ? "none" : itemId;
                    currentUserData.equippedPet = nuevoValor;
                    updates.equippedPet = nuevoValor;
                } else if (kind === 'fx') {
                    const nuevoValor = yaEquipado ? "none" : itemId;
                    currentUserData.equippedFx = nuevoValor;
                    updates.equippedFx = nuevoValor;
                }

                await updateDoc(userRef, updates);
                renderizarInventario(); 
            } catch (err) {
                console.error("Error al gestionar equipamiento:", err);
            }
        });
    });
}

document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', (e) => {
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) activeTab.classList.remove('active');
        e.target.classList.add('active');
        currentFilter = e.target.getAttribute('data-target');
        renderizarInventario();
    });
});

/* ===================================================
   MODAL DE CONFIGURACIÓN (SE ABRE AL TOCAR LA FOTO)
   Cambiar nombre de usuario, crear/unirse a un grupo, cerrar sesión.
=================================================== */
const avatarWrapper = document.querySelector('.profile-avatar-wrapper');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const usernameInput = document.getElementById('usernameInput');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');
const settingsFeedback = document.getElementById('settingsFeedback');
const groupInfoBox = document.getElementById('groupInfoBox');
const groupFormBox = document.getElementById('groupFormBox');
const groupNameInput = document.getElementById('groupNameInput');
const groupCodeInput = document.getElementById('groupCodeInput');
const createGroupBtn = document.getElementById('createGroupBtn');
const joinGroupBtn = document.getElementById('joinGroupBtn');
const settingsLogoutBtn = document.getElementById('settingsLogoutBtn');

function abrirModalConfiguracion() {
    if (!settingsModal) return;
    if (usernameInput) usernameInput.value = currentUserData.username || currentUserData.name || "";
    if (settingsFeedback) settingsFeedback.textContent = "";
    pintarSeccionGrupo();
    settingsModal.classList.add('show');
}

function cerrarModalConfiguracion() {
    if (settingsModal) settingsModal.classList.remove('show');
}

function pintarSeccionGrupo() {
    if (!groupInfoBox || !groupFormBox) return;
    if (currentUserData.groupId) {
        groupFormBox.style.display = "none";
        groupInfoBox.style.display = "block";
        groupInfoBox.innerHTML = `
            <p style="margin:0 0 4px;">Grupo actual: <strong style="color:var(--theme-accent, var(--orange));">${currentUserData.groupName || "SIN NOMBRE"}</strong></p>
            <p style="margin:0; font-size:12px; color:var(--text-muted);">Código para invitar amigos: <strong>${currentUserData.groupId}</strong></p>
        `;
    } else {
        groupInfoBox.style.display = "none";
        groupFormBox.style.display = "block";
    }
}

if (avatarWrapper) {
    avatarWrapper.style.cursor = "pointer";
    avatarWrapper.title = "Tocá para editar tu perfil";
    avatarWrapper.addEventListener('click', abrirModalConfiguracion);
}

if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', cerrarModalConfiguracion);
if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) cerrarModalConfiguracion();
    });
}

if (saveUsernameBtn) {
    saveUsernameBtn.addEventListener('click', async () => {
        const nuevoNombre = (usernameInput.value || "").trim();

        if (nuevoNombre.length < 3 || nuevoNombre.length > 18) {
            settingsFeedback.textContent = "El nombre debe tener entre 3 y 18 caracteres.";
            settingsFeedback.style.color = "#ff5555";
            return;
        }
        if (!/^[a-zA-Z0-9_ÁÉÍÓÚáéíóúñÑ\s]+$/.test(nuevoNombre)) {
            settingsFeedback.textContent = "Solo letras, números y espacios.";
            settingsFeedback.style.color = "#ff5555";
            return;
        }

        try {
            saveUsernameBtn.disabled = true;
            saveUsernameBtn.textContent = "GUARDANDO...";
            await updateDoc(doc(db, "users", auth.currentUser.uid), { username: nuevoNombre });
            currentUserData.username = nuevoNombre;
            document.getElementById("profileCardName").innerText = nuevoNombre;
            const navName = document.getElementById("userName");
            if (navName) navName.textContent = nuevoNombre;
            settingsFeedback.textContent = "¡Nombre actualizado con éxito!";
            settingsFeedback.style.color = "#39ff14";
        } catch (err) {
            console.error("Error al actualizar el nombre:", err);
            settingsFeedback.textContent = "Ocurrió un error, probá de nuevo.";
            settingsFeedback.style.color = "#ff5555";
        } finally {
            saveUsernameBtn.disabled = false;
            saveUsernameBtn.textContent = "GUARDAR NOMBRE";
        }
    });
}

if (createGroupBtn) {
    createGroupBtn.addEventListener('click', async () => {
        const nombre = (groupNameInput.value || "").trim();
        if (nombre.length < 3) {
            settingsFeedback.textContent = "Ponele un nombre de al menos 3 caracteres al grupo.";
            settingsFeedback.style.color = "#ff5555";
            return;
        }
        try {
            createGroupBtn.disabled = true;
            const code = await crearGrupo(nombre, auth.currentUser.uid);
            currentUserData.groupId = code;
            currentUserData.groupName = nombre;
            settingsFeedback.textContent = `¡Grupo creado! Código: ${code}`;
            settingsFeedback.style.color = "#39ff14";
            pintarSeccionGrupo();
        } catch (err) {
            console.error("Error al crear grupo:", err);
            settingsFeedback.textContent = "No se pudo crear el grupo.";
            settingsFeedback.style.color = "#ff5555";
        } finally {
            createGroupBtn.disabled = false;
        }
    });
}

if (joinGroupBtn) {
    joinGroupBtn.addEventListener('click', async () => {
        const code = (groupCodeInput.value || "").trim();
        if (code.length < 4) {
            settingsFeedback.textContent = "Ingresá un código de grupo válido.";
            settingsFeedback.style.color = "#ff5555";
            return;
        }
        try {
            joinGroupBtn.disabled = true;
            const info = await obtenerGrupo(code);
            if (!info) {
                settingsFeedback.textContent = "No existe ningún grupo con ese código.";
                settingsFeedback.style.color = "#ff5555";
                return;
            }
            const exito = await unirseAGrupo(code, auth.currentUser.uid);
            if (exito) {
                currentUserData.groupId = code;
                currentUserData.groupName = info.name || "";
                settingsFeedback.textContent = `¡Te uniste a "${info.name}"!`;
                settingsFeedback.style.color = "#39ff14";
                pintarSeccionGrupo();
            }
        } catch (err) {
            console.error("Error al unirse al grupo:", err);
            settingsFeedback.textContent = "No se pudo unir al grupo.";
            settingsFeedback.style.color = "#ff5555";
        } finally {
            joinGroupBtn.disabled = false;
        }
    });
}

if (settingsLogoutBtn) {
    settingsLogoutBtn.addEventListener('click', () => {
        signOut(auth).catch(console.error);
    });
}

function precargarModalConfiguracion() {
    // Nada que precargar por adelantado; los campos se completan al abrir el modal.
}

/* ===== Botón visible de cambiar nombre + generador de nombres creativos ===== */
const editNameBtn = document.getElementById('editNameBtn');
if (editNameBtn) editNameBtn.addEventListener('click', () => {
    abrirModalConfiguracion();
    setTimeout(() => { if (usernameInput) usernameInput.focus(); }, 100);
});
const randomNameBtn = document.getElementById('randomNameBtn');
if (randomNameBtn) randomNameBtn.addEventListener('click', () => {
    const A = ["Rayo","Turbo","Ninja","Fantasma","Pixel","Cosmico","Furia","Neon","Mega","Sonic","Hielo","Dedo"];
    const B = ["Veloz","Toque","Dragon","Tigre","Lobo","Clicker","Pulpo","Cohete","Zorro","Crack"];
    const pick = (l) => l[Math.floor(Math.random() * l.length)];
    usernameInput.value = pick(A) + pick(B) + Math.floor(Math.random() * 90 + 10);
});

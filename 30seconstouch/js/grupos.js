import { db } from "./firebase.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Generar código aleatorio de 6 dígitos
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// CREAR GRUPO
export async function crearGrupo(nombreGrupo, userId) {
    const code = generateCode();
    await setDoc(doc(db, "groups", code), {
        name: nombreGrupo,
        members: [userId],
        totalScore: 0,
        createdAt: new Date()
    });
    // Actualizar al usuario con su nuevo grupo
    await updateDoc(doc(db, "users", userId), { groupId: code, groupName: nombreGrupo });
    return code;
}

// UNIRSE A GRUPO
export async function unirseAGrupo(code, userId) {
    const groupRef = doc(db, "groups", code);
    const snap = await getDoc(groupRef);

    if (snap.exists()) {
        await updateDoc(groupRef, { members: arrayUnion(userId) });
        await updateDoc(doc(db, "users", userId), { groupId: code, groupName: snap.data().name || "" });
        return true;
    }
    return false;
}

// OBTENER DATOS DE UN GRUPO (para mostrar posición real dentro del grupo)
export async function obtenerGrupo(code) {
    const snap = await getDoc(doc(db, "groups", code));
    return snap.exists() ? snap.data() : null;
}
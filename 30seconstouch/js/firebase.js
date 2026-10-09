import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// CONFIGURACIÓN FIREBASE

const firebaseConfig = {
  apiKey: "AIzaSyDdUyC9vOabZiYBzR5IGqMe2m5IsZkFsPI",
  authDomain: "seconstouch.firebaseapp.com",
  projectId: "seconstouch",
  storageBucket: "seconstouch.firebasestorage.app",
  messagingSenderId: "1079836139171",
  appId: "1:1079836139171:web:1b5aa5a4842de837302916",
  measurementId: "G-3QB808653Q"
};

// INICIALIZAR FIREBASE

const app = initializeApp(firebaseConfig);

// AUTH

const auth = getAuth(app);

// FIRESTORE

const db = getFirestore(app);

// EXPORTAR

export {
  app,
  auth,
  db
};
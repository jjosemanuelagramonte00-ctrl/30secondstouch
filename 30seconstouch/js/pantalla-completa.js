// js/pantalla-completa.js

// 1. Guardamos el estado ANTES de que la página cambie
window.addEventListener('beforeunload', () => {
    if (document.fullscreenElement) {
        // Si estaba en F11 al hacer clic en un enlace, lo guardamos en la memoria temporal
        sessionStorage.setItem('modoArcade', 'activado');
    } else {
        sessionStorage.setItem('modoArcade', 'desactivado');
    }
});

// 2. Al cargar la nueva página, verificamos si veníamos de F11
document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('modoArcade') === 'activado') {
        
        // Creamos la función que reactiva el F11
        const reactivarF11 = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log("Esperando interacción para F11...", err);
                });
            }
            // Una vez que hace clic y entra, nos dejamos de entrometer
            document.removeEventListener('click', reactivarF11);
        };
        
        // Escuchamos el PRIMER clic en cualquier parte de la nueva página
        document.addEventListener('click', reactivarF11);
    }
});
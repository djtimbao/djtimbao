/**
 * • Ruta: src/js/components/Loader.js
 * • Que es: Clase controladora de la interfaz de carga global.
 * • Responsabilidades:
 *   1. Construir e inyectar el DOM del Loader utilizando el SVG centralizado.
 *   2. Exponer métodos públicos (show, hide) para ser reutilizado en cualquier proceso asíncrono del sitio.
 */

import { ASSETS } from '../config/assets.js';

export class GlobalLoader {
    constructor() {
        this.buildUI();
    }

    buildUI() {
        this.loader = document.createElement('div');
        this.loader.className = 'fixed inset-0 z-[9999] bg-[#e3bb3e] flex items-center justify-center transition-transform duration-700 ease-in-out';
        
        this.loader.innerHTML = `
            <svg viewBox="0 0 1876.19 856.22" class="w-64 md:w-96 absolute logo-scale origin-center">
                <path d="${ASSETS.LOGO_PATH}" class="fill-black opacity-10"></path>
                <path d="${ASSETS.LOGO_PATH}" class="fill-black logo-fill"></path>
            </svg>
        `;
        document.body.appendChild(this.loader);
    }

    show() {
        // Reinicia la animación y muestra la capa
        this.loader.style.transform = 'translateY(0)';
    }

    hide() {
        // Desliza la capa hacia arriba
        this.loader.style.transform = 'translateY(-100%)';
    }
}
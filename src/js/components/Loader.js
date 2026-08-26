/**
 * • Ruta: src/js/components/Loader.js
 * • Que es: Clase controladora de la interfaz de carga global.
 * • Responsabilidades:
 *   1. Construir e inyectar el DOM del Loader utilizando el SVG centralizado y su fondo tramado.
 *   2. Exponer métodos públicos (show, hide) para ser reutilizado en cualquier proceso asíncrono del sitio.
 */

import { ASSETS } from '../config/assets.js';

export class GlobalLoader {
    constructor() {
        this.buildUI();
    }

    buildUI() {
        this.loader = document.createElement('div');
        this.loader.className = 'fixed inset-0 z-[9999] bg-[#e3bb3e] flex items-center justify-center transition-transform duration-700 ease-in-out overflow-hidden';
        
        this.loader.innerHTML = `
            <!-- Capa 0: Tramado Vectorial de Fondo -->
            <svg class="absolute inset-0 w-full h-full pointer-events-none opacity-10">
                <defs>
                    <!-- Patrón del monograma corto -->
                    <pattern id="loader-djt-pattern" width="180" height="180" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
                        <!-- Variación 1: Monograma base -->
                        <path d="${ASSETS.LOGO_SHORT_PATH}" transform="translate(15, 20) scale(0.045)" class="fill-black"></path>
                        <!-- Variación 2: Monograma desplazado y ligeramente rotado -->
                        <path d="${ASSETS.LOGO_SHORT_PATH}" transform="translate(105, 110) scale(0.038) rotate(6)" class="fill-black"></path>
                    </pattern>

                    <!-- Degradado radial para la máscara: Centro negro (oculta trama), bordes blancos (muestra trama) -->
                    <radialGradient id="center-mask-gradient" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="black" />
                        <stop offset="20%" stop-color="black" />
                        <stop offset="45%" stop-color="white" />
                    </radialGradient>

                    <!-- Máscara SVG aplicada al fondo -->
                    <mask id="pattern-center-cutout">
                        <rect width="100%" height="100%" fill="url(#center-mask-gradient)" />
                    </mask>
                </defs>
                <rect width="100%" height="100%" fill="url(#loader-djt-pattern)" mask="url(#pattern-center-cutout)"></rect>
            </svg>

            <!-- Capa 1: Logo Principal Central Animado -->
            <svg viewBox="0 0 1876.19 856.22" class="w-64 md:w-96 relative z-10 logo-scale origin-center">
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
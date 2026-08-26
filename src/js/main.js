/**
 * • La ruta: src/js/main.js
 * • Que es: Motor principal de interacciones de la interfaz de usuario, orquestador de módulos.
 * • Responsabilidades:
 *   1. Importar e inicializar componentes globales (Loader, Cursor, Hero).
 *   2. Controlar la lógica de inicialización en el evento load de la ventana.
 *   3. Ejecutar el bucle principal de renderizado (requestAnimationFrame) para físicas nativas.
 */

import { GlobalLoader } from './components/Loader.js';
import { HeroParallax } from './components/Hero.js';

class TimbaoEngine {
    constructor() {
        // Añadimos scale y targetScale para la animación nativa del hover
        this.cursor = { x: 0, y: 0, targetX: 0, targetY: 0, scale: 1, targetScale: 1 };
        // Instanciamos nuestro servicio global
        this.globalLoader = new GlobalLoader();
        this.hero = new HeroParallax(); // Instanciamos el Hero
        this.init();
    }

    init() {
        this.buildCursor();
        this.bindEvents();
        this.render();
        this.handleInitialLoad();
    }

    buildCursor() {
        this.cursorEl = document.createElement('div');
        // Añadimos 'will-change-transform' para que la GPU se prepare, y quitamos las transiciones CSS
        this.cursorEl.className = 'fixed top-0 left-0 w-4 h-4 bg-[#e3bb3e] rounded-full pointer-events-none z-[9998] mix-blend-difference hidden md:block will-change-transform';
        document.body.appendChild(this.cursorEl);
    }

    bindEvents() {
        window.addEventListener('mousemove', (e) => {
            this.cursor.targetX = e.clientX;
            this.cursor.targetY = e.clientY;
        });

        // Usamos closest() para asegurar que detecte el hover incluso si hay elementos dentro del botón/enlace
        document.body.addEventListener('mouseover', (e) => {
            if (e.target.closest('a') || e.target.closest('button')) {
                this.cursor.targetScale = 3; // Crece 3 veces su tamaño
            }
        });
        
        document.body.addEventListener('mouseout', (e) => {
            if (e.target.closest('a') || e.target.closest('button')) {
                this.cursor.targetScale = 1; // Vuelve a la normalidad
            }
        });
    }

    handleInitialLoad() {
        window.addEventListener('load', () => {
            // Utilizamos el método público de nuestro módulo centralizado
            setTimeout(() => {
                this.globalLoader.hide();
                // Justo cuando el loader sube, disparamos el revelado del Hero
                this.hero.triggerReveal();
            }, 1800);
        });
    }

    render() {
        // Interpolación para posición (Velocidad ágil)
        this.cursor.x += (this.cursor.targetX - this.cursor.x) * 0.25;
        this.cursor.y += (this.cursor.targetY - this.cursor.y) * 0.25;
        
        // Interpolación para escala (Suavidad)
        this.cursor.scale += (this.cursor.targetScale - this.cursor.scale) * 0.15;

        // Inyectamos todo directamente al transform (0 conflictos con CSS)
        this.cursorEl.style.transform = `translate(${this.cursor.x}px, ${this.cursor.y}px) translate(-50%, -50%) scale(${this.cursor.scale})`;

        // Le pasamos las coordenadas suavizadas al Hero para el Parallax
        this.hero.render(this.cursor.x, this.cursor.y);

        requestAnimationFrame(() => this.render());
    }
}

document.addEventListener('DOMContentLoaded', () => new TimbaoEngine());
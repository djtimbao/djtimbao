/**
 * • La ruta: src/js/main.js
 * • Que es: Motor principal de interacciones de la interfaz de usuario, orquestador de módulos.
 * • Responsabilidades:
 *   1. Importar e inicializar componentes globales (Loader, Cursor, Hero, GlobeViewer).
 *   2. Controlar la lógica de inicialización en el evento load de la ventana.
 *   3. Ejecutar el bucle principal de renderizado (requestAnimationFrame) para físicas nativas.
 */

import { GlobalLoader } from './components/Loader.js';
import { HeroParallax } from './components/Hero.js';
import { GlobeViewer } from './components/Globe.js';
import { EVENTS_DATA } from './config/events.js';

class TimbaoEngine {
    constructor() {
        // Añadimos scale y targetScale para la animación nativa del hover
        this.cursor = { x: 0, y: 0, targetX: 0, targetY: 0, scale: 1, targetScale: 1 };
        this.globalLoader = new GlobalLoader();
        this.hero = new HeroParallax();
        this.init();
    }

    init() {
        this.buildCursor();
        this.renderEvents();
        this.globe = new GlobeViewer('globe-container');
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

    renderEvents() {
        const leftContainer = document.getElementById('events-left');
        const rightContainer = document.getElementById('events-right');
        
        // CONFIGURACIÓN DE LA CURVATURA MATEMÁTICA
        const curveSettings = {
            rotationIntensity: 6.5, // Grados de inclinación (Ajusta si quieres más o menos rotación)
            depthIntensity: 14,     // Fuerza de la curva (Hace el paréntesis más profundo)
            basePush: 70            // Distancia general hacia el centro del globo
        };
        
        // COLUMNA IZQUIERDA (Ahora renderiza VENEZUELA, ESPAÑA, etc.)
        if (leftContainer && typeof EVENTS_DATA !== 'undefined') {
            // Inyectamos la data de la columna derecha
            const dataLeft = EVENTS_DATA.rightColumn; 
            const midLeft = (dataLeft.length - 1) / 2;
            
            leftContainer.innerHTML = dataLeft.map((item, i) => {
                const offset = i - midLeft;
                const rotate = offset * -curveSettings.rotationIntensity; 
                // Sumamos la distancia para crear la curva cóncava '<' que abraza la esfera
                const distance = Math.pow(Math.abs(offset), 1.6) * curveSettings.depthIntensity;
                const transX = curveSettings.basePush + distance; 
                
                return `
                <a href="${item.url}" target="_blank" rel="noopener noreferrer" 
                   class="group block transition-all duration-300 hover:scale-[1.05] origin-right"
                   style="transform: rotate(${rotate}deg) translateX(${transX}px);">
                    <div class="text-sm md:text-[15px] font-bold text-zinc-300 group-hover:text-[#e3bb3e] transition-colors text-right">
                        <span class="text-zinc-500 font-medium">${item.years} |</span> ${item.event} <span class="text-[#e3bb3e]">:${item.country}</span>
                    </div>
                    <div class="text-xs text-zinc-500 italic text-right">
                        ${item.role} | ${item.location}
                    </div>
                </a>
            `}).join('');
        }

        // COLUMNA DERECHA (Ahora renderiza ARGENTINA, CHILE, etc.)
        if (rightContainer && typeof EVENTS_DATA !== 'undefined') {
            // Inyectamos la data de la columna izquierda
            const dataRight = EVENTS_DATA.leftColumn; 
            const midRight = (dataRight.length - 1) / 2;
            
            rightContainer.innerHTML = dataRight.map((item, i) => {
                const offset = i - midRight;
                const rotate = offset * curveSettings.rotationIntensity; 
                // Restamos la distancia para crear la curva cóncava '>' que abraza la esfera
                const distance = Math.pow(Math.abs(offset), 1.6) * curveSettings.depthIntensity;
                const transX = -curveSettings.basePush - distance; 
                
                return `
                <a href="${item.url}" target="_blank" rel="noopener noreferrer" 
                   class="group block transition-all duration-300 hover:scale-[1.05] origin-left"
                   style="transform: rotate(${rotate}deg) translateX(${transX}px);">
                    <div class="text-sm md:text-[15px] font-bold text-zinc-300 group-hover:text-[#e3bb3e] transition-colors text-left">
                        <span class="text-[#e3bb3e]">${item.country}:</span> ${item.event} <span class="text-zinc-500 font-medium">| ${item.years}</span>
                    </div>
                    <div class="text-xs text-zinc-500 italic text-left">
                        ${item.role} | ${item.location}
                    </div>
                </a>
            `}).join('');
        }
    }

    bindEvents() {
        window.addEventListener('mousemove', (e) => {
            this.cursor.targetX = e.clientX;
            this.cursor.targetY = e.clientY;
        });

        // Usamos closest() para asegurar que detecte el hover incluso si hay elementos dentro del botón/enlace
        document.body.addEventListener('mouseover', (e) => {
            if (e.target.closest('a') || e.target.closest('button') || e.target.closest('#globe-container')) {
                this.cursor.targetScale = 2.5;
            }
        });
        
        document.body.addEventListener('mouseout', (e) => {
            if (e.target.closest('a') || e.target.closest('button') || e.target.closest('#globe-container')) {
                this.cursor.targetScale = 1;
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
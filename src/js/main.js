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
import { OdometerEffect } from './components/Odometer.js';

class TimbaoEngine {
    constructor() {
        // Añadimos scale y targetScale para la animación nativa del hover
        this.cursor = { x: 0, y: 0, targetX: 0, targetY: 0, scale: 1, targetScale: 1 };
        // Motor de inercia para la progresión del scroll
        this.scrollProgress = 0; 
        this.globalLoader = new GlobalLoader();
        this.hero = new HeroParallax();
        this.init();
    }

    init() {
        this.buildCursor();
        this.renderEvents();
        this.globe = new GlobeViewer('globe-container');
        this.odometer = new OdometerEffect('experience-years');
        this.setupScrollAnimations();
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

    setupScrollAnimations() {
        // Observador nativo para animaciones on-scroll (Block Reveal y Odómetro)
        const trayectoriaSec = document.getElementById('trayectoria');
        if (!trayectoriaSec) return;

        const observer = new IntersectionObserver((entries, observerInstance) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // 1. Disparar animaciones CSS de Block Reveal para textos
                    entry.target.classList.add('is-revealed');
                    
                    // 2. Transición suave de entrada (de abajo hacia arriba) para el Odómetro
                    const odometerContainer = document.getElementById('odometer-container');
                    if (odometerContainer) {
                        odometerContainer.classList.remove('opacity-0', 'translate-y-10');
                        odometerContainer.classList.add('opacity-100', 'translate-y-0');
                    }

                    // 3. Activar el estado de caos temporal en el Odómetro
                    if (this.odometer) {
                        this.odometer.triggerEntrance();
                    }

                    // 4. One-shot: Desconectar para no consumir recursos (sin animación de salida)
                    observerInstance.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 }); // Umbral de 20% de visibilidad requerida

        observer.observe(trayectoriaSec);
    }

    renderEvents() {
        const leftContainer = document.getElementById('events-left');
        const rightContainer = document.getElementById('events-right');
        
        // COLUMNA IZQUIERDA (VENEZUELA, ESPAÑA, etc.)
        if (leftContainer && typeof EVENTS_DATA !== 'undefined') {
            const dataLeft = EVENTS_DATA.rightColumn; 
            const midLeft = (dataLeft.length - 1) / 2;
            
            leftContainer.innerHTML = dataLeft.map((item, i) => {
                const offset = i - midLeft;
                return `
                <a href="${item.url}" target="_blank" rel="noopener noreferrer" 
                   class="event-card group block transition-colors duration-300 py-1 px-2 rounded-md hover:bg-zinc-900/40 opacity-0 will-change-transform origin-right"
                   data-offset="${offset}" data-side="left">
                    <div class="text-sm md:text-[15px] font-bold text-zinc-300 group-hover:text-[#e3bb3e] transition-colors text-center lg:text-right">
                        <span class="text-zinc-500 font-medium">${item.years} |</span> ${item.event} <span class="text-[#e3bb3e]">:${item.country}</span>
                    </div>
                    <div class="text-xs text-zinc-500 italic text-center lg:text-right mt-0.5">
                        ${item.role} | ${item.location}
                    </div>
                </a>
            `}).join('');
        }

        // COLUMNA DERECHA (ARGENTINA, CHILE, etc.)
        if (rightContainer && typeof EVENTS_DATA !== 'undefined') {
            const dataRight = EVENTS_DATA.leftColumn; 
            const midRight = (dataRight.length - 1) / 2;
            
            rightContainer.innerHTML = dataRight.map((item, i) => {
                const offset = i - midRight;
                return `
                <a href="${item.url}" target="_blank" rel="noopener noreferrer" 
                   class="event-card group block transition-colors duration-300 py-1 px-2 rounded-md hover:bg-zinc-900/40 opacity-0 will-change-transform origin-left"
                   data-offset="${offset}" data-side="right">
                    <div class="text-sm md:text-[15px] font-bold text-zinc-300 group-hover:text-[#e3bb3e] transition-colors text-center lg:text-left">
                        <span class="text-[#e3bb3e]">${item.country}:</span> ${item.event} <span class="text-zinc-500 font-medium">| ${item.years}</span>
                    </div>
                    <div class="text-xs text-zinc-500 italic text-center lg:text-left mt-0.5">
                        ${item.role} | ${item.location}
                    </div>
                </a>
            `}).join('');
        }

        // Guardar referencias y asignar eventos de hover (separado del renderizado 3D para evitar lag)
        this.eventNodes = document.querySelectorAll('.event-card');
        this.eventNodes.forEach(node => {
            node.addEventListener('mouseenter', () => node.dataset.hover = 'true');
            node.addEventListener('mouseleave', () => node.dataset.hover = 'false');
        });
    }

    bindEvents() {
        window.addEventListener('mousemove', (e) => {
            this.cursor.targetX = e.clientX;
            this.cursor.targetY = e.clientY;
        });

        // Usamos closest() para asegurar que detecte el hover incluso si hay elementos dentro del botón/enlace
        document.body.addEventListener('mouseover', (e) => {
            if (e.target.closest('a') || e.target.closest('button') || e.target.closest('#globe-container') || e.target.closest('#experience-years')) {
                this.cursor.targetScale = 2.5;
            }
        });
        
        document.body.addEventListener('mouseout', (e) => {
            if (e.target.closest('a') || e.target.closest('button') || e.target.closest('#globe-container') || e.target.closest('#experience-years')) {
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
        // --- 1. LÓGICA DE CURSOR HERO ---
        if (window.innerWidth >= 768) {
            // Interpolación para posición (Velocidad ágil)
            this.cursor.x += (this.cursor.targetX - this.cursor.x) * 0.25;
            this.cursor.y += (this.cursor.targetY - this.cursor.y) * 0.25;
            
            // Interpolación para escala (Suavidad)
            this.cursor.scale += (this.cursor.targetScale - this.cursor.scale) * 0.15;

            // Inyectamos todo directamente al transform (0 conflictos con CSS)
            this.cursorEl.style.transform = `translate(${this.cursor.x}px, ${this.cursor.y}px) translate(-50%, -50%) scale(${this.cursor.scale})`;

            // Le pasamos las coordenadas suavizadas al Hero para el Parallax
            this.hero.render(this.cursor.x, this.cursor.y);
        }

        // --- 2. LÓGICA MAGNÉTICA Y ONDA DOPPLER DE EVENTOS ---
        const eventsSec = document.getElementById('events');
        if (eventsSec) {
            const rect = eventsSec.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const sectionCenter = rect.top + rect.height / 2;
            const viewCenter = windowHeight / 2;

            // Progreso de visibilidad (0 = Fuera de pantalla, 1 = Centro exacto)
            const distance = Math.abs(sectionCenter - viewCenter);
            let rawProgress = 1 - (distance / (windowHeight * 0.75)); 
            rawProgress = Math.max(0, Math.min(1, rawProgress));

            // Aplicar inercia para evitar tirones (Damping)
            this.scrollProgress += (rawProgress - this.scrollProgress) * 0.08;

            // FASE 1 (0.0 -> 0.5): Implosión Espacial (Zoom de Globo y Opacidad)
            const globeProgress = Math.min(this.scrollProgress / 0.5, 1);
            if (this.globe) {
                this.globe.updateScroll(globeProgress);
            }

            // Glow: Sincronizado a escala y expulsa el "Pulso" Doppler
            const glowContainer = document.getElementById('globe-container');
            if (glowContainer) {
                const pulse = Math.sin(globeProgress * Math.PI) * 0.15;
                const glowScale = 0.3 + (0.7 * globeProgress) + pulse;
                glowContainer.style.setProperty('--glow-scale', glowScale);
                glowContainer.style.setProperty('--glow-op', globeProgress);
            }

            // FASE 2 (0.5 -> 1.0): Onda Expansiva de Textos
            const textProgress = Math.max(0, (this.scrollProgress - 0.5) / 0.5);
            const isDesktop = window.innerWidth >= 1024;
            
            // CONFIGURACIÓN DE LA CURVATURA MATEMÁTICA
            const curveSettings = {
                rotationIntensity: 4, // Grados de inclinación (Ajusta si quieres más o menos rotación)
                depthIntensity: 14,     // Fuerza de la curva (Hace el paréntesis más profundo)
                basePush: 35            // Distancia general hacia el centro del globo
            };

            // Animación coreografiada
            if (this.eventNodes) {
                this.eventNodes.forEach(node => {
                    const offset = parseFloat(node.dataset.offset);
                    const side = node.dataset.side;
                    // Mantenemos el hover tailwind vivo interpolándolo por JS
                    const hoverScale = node.dataset.hover === 'true' ? 1.03 : 1; 
                    
                    node.style.opacity = textProgress;

                    if (isDesktop) {
                        // Desplazamiento desde el Ecuador (0) hacia los polos (offset real) guiado por textProgress
                        const currentOffset = offset * textProgress;
                        let rotate = 0;
                        let transX = 0;

                        if (side === 'left') {
                            rotate = currentOffset * -curveSettings.rotationIntensity;
                            const distance = Math.pow(Math.abs(currentOffset), 1.6) * curveSettings.depthIntensity;
                            transX = curveSettings.basePush + distance;
                        } else {
                            rotate = currentOffset * curveSettings.rotationIntensity;
                            const distance = Math.pow(Math.abs(currentOffset), 1.6) * curveSettings.depthIntensity;
                            transX = -curveSettings.basePush - distance;
                        }

                        node.style.transform = `rotate(${rotate}deg) translateX(${transX}px) scale(${hoverScale})`;
                    } else {
                        // En móviles: Caída suave vertical hacia su punto de origen sin desbordamiento
                        const transY = (1 - textProgress) * 40;
                        node.style.transform = `translateY(${transY}px) scale(${hoverScale})`;
                    }
                });
            }
        }

        requestAnimationFrame(() => this.render());
    }
}

document.addEventListener('DOMContentLoaded', () => new TimbaoEngine());
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
import { UPCOMING_GIGS } from './config/gigs.js';
import { OdometerEffect } from './components/Odometer.js';
import { ASSETS } from './config/assets.js';

class TimbaoEngine {
    constructor() {
        // Añadimos scale y targetScale para la animación nativa del hover
        this.cursor = { x: 0, y: 0, targetX: 0, targetY: 0, scale: 1, targetScale: 1 };
        // Motor de inercia para la progresión del scroll
        this.scrollProgress = 0; 
        
        // Estado del motor matemático para el Carrusel Marquee 3D Infinito
        this.gigsState = {
            position: 0,
            speed: -1.5,
            targetSpeed: -1.5,
            baseSpeed: -1.5,
            isHovered: false,
            wrapWidth: 0
        };

        this.globalLoader = new GlobalLoader();
        this.hero = new HeroParallax();
        this.init();
    }

    init() {
        this.buildCursor();
        this.renderEvents();
        this.renderGigs();
        this.globe = new GlobeViewer('globe-container');
        this.odometer = new OdometerEffect('experience-years');
        this.setupScrollAnimations();
        this.setupPlatformsAccordion();
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

    setupPlatformsAccordion() {
        // Observador nativo y motor flexbox fluido para el acordeón
        const platformsSec = document.getElementById('plataformas');
        const accordion = document.getElementById('platforms-accordion');
        const panels = document.querySelectorAll('.platform-panel');

        // Inyección dinámica de multimedia desde R2
        const ytMusicVideo = document.getElementById('ytmusic-video');
        if (ytMusicVideo) {
            ytMusicVideo.src = ASSETS.YT_MUSIC_VIDEO;
        }
        
        const youtubeVideo = document.getElementById('youtube-video');
        if (youtubeVideo) {
            youtubeVideo.src = ASSETS.YT_VIDEO;
        }
        
        const spotifyVideo = document.getElementById('spotify-video');
        if (spotifyVideo) {
            spotifyVideo.src = ASSETS.SPOTIFY_VIDEO;
        }

        if (!platformsSec || !accordion || panels.length === 0) return;

        // 2. Motor dinámico de expansión por Flex-Grow (Hover/Tap)
        panels.forEach(panel => {
            const activatePanel = () => {
                // Restaurar paneles y pausar videos ocultos, silenciando el error del DOM (AbortError)
                panels.forEach(p => {
                    p.classList.remove('is-active', 'flex-[5]');
                    const v = p.querySelector('.platform-video');
                    if (v && !v.paused) {
                        const pausePromise = v.pause();
                        if (pausePromise !== undefined) pausePromise.catch(() => {});
                    }
                });
                
                // Activar panel actual y reproducir su video
                panel.classList.add('is-active', 'flex-[5]');
                const activeVideo = panel.querySelector('.platform-video');
                if (activeVideo) {
                    const playPromise = activeVideo.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(() => { /* Ignoramos silenciosamente el AbortError si el usuario mueve rápido el cursor */ });
                    }
                }
            };

            panel.addEventListener('mouseenter', activatePanel);
            // Soporte robusto para pantallas táctiles sin delay
            panel.addEventListener('touchstart', activatePanel, { passive: true });

            // Escuchador de clics para navegar usando los data-url nativos
            panel.addEventListener('click', () => {
                const url = panel.getAttribute('data-url');
                if (url) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            });
        });

        // 3. Restaurar equidad (33% para cada uno) y detener videos al quitar el cursor
        accordion.addEventListener('mouseleave', () => {
            panels.forEach(p => {
                p.classList.remove('is-active', 'flex-[5]');
                const video = p.querySelector('.platform-video');
                if (video) video.pause();
            });
        });
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
                    class="event-card group block transition-colors duration-300 py-1 px-2 rounded-md hover:bg-zinc-900/40 opacity-0 will-change-transform origin-right select-none [-webkit-touch-callout:none]"
                    data-offset="${offset}" data-side="left"
                    data-countryid="${item.countryId}" data-lat="${item.lat}" data-lng="${item.lng}">
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
                   data-offset="${offset}" data-side="right"
                   data-countryid="${item.countryId}" data-lat="${item.lat}" data-lng="${item.lng}">
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
            node.addEventListener('mouseenter', () => {
                node.dataset.hover = 'true';
                
                if (this.globe) {
                    const countryId = node.dataset.countryid;
                    const lat = parseFloat(node.dataset.lat);
                    const lng = parseFloat(node.dataset.lng);
                    
                    if (countryId) this.globe.highlightCountry(countryId);
                    if (!isNaN(lat) && !isNaN(lng)) this.globe.focusOnLocation(lat, lng);
                }
            });
            
            node.addEventListener('mouseleave', () => {
                node.dataset.hover = 'false';
                
                if (this.globe) {
                    this.globe.resetHighlight();
                }
            });
        });
    }

    renderGigs() {
        const track = document.getElementById('gigs-track');
        if (!track || typeof UPCOMING_GIGS === 'undefined') return;

        // Inyección multiplicada (4 veces) del array para garantizar un Seamless Loop en resoluciones amplias
        const duplicatedGigs = [...UPCOMING_GIGS, ...UPCOMING_GIGS, ...UPCOMING_GIGS, ...UPCOMING_GIGS];

        track.innerHTML = duplicatedGigs.map((gig) => `
            <div class="gig-card group relative snap-center shrink-0 w-[70vw] sm:w-[320px] md:w-[380px] h-[450px] md:h-[550px] flex items-center justify-center [perspective:1200px]">
                <article class="gig-card-inner relative w-full h-full rounded-3xl overflow-hidden transition-colors duration-75 ease-out will-change-transform border border-white/5 bg-zinc-900">
                    <img src="${gig.flyerUrl}" alt="${gig.title}" loading="lazy" class="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none" />
                    
                    <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/20 z-10 transition-opacity duration-500 opacity-80 group-[.is-active]:opacity-100 pointer-events-none"></div>
                    <div class="absolute inset-0 bg-black/60 z-10 transition-opacity duration-500 group-[.is-active]:opacity-0 pointer-events-none"></div>
                    
                    <div class="absolute bottom-0 inset-x-0 p-6 md:p-8 bg-black/30 backdrop-blur-md border-t border-white/10 z-20 flex flex-col gap-2 translate-y-12 opacity-0 group-[.is-active]:translate-y-0 group-[.is-active]:opacity-100 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]">
                        <div>
                            <span class="text-[#e3bb3e] text-xs md:text-sm font-bold tracking-widest uppercase">${gig.date} • ${gig.time}</span>
                            <h3 class="text-xl md:text-3xl font-black text-white uppercase mt-1 leading-none tracking-tighter drop-shadow-lg">${gig.title}</h3>
                            <p class="text-zinc-300 text-xs md:text-sm mt-2 uppercase tracking-widest flex items-center gap-2">
                                <svg class="w-3 h-3 md:w-4 md:h-4 fill-current text-[#e3bb3e]" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                                ${gig.location}
                            </p>
                        </div>
                        <div class="flex items-center gap-3 mt-4">
                            <a href="${gig.actionUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 bg-[#e3bb3e] hover:bg-yellow-500 text-black text-center py-3 md:py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(227,187,62,0.3)]">${gig.actionText}</a>
                            <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(gig.title)}&location=${encodeURIComponent(gig.location)}&details=Evento+con+DJ+Timbao" target="_blank" rel="noopener noreferrer" title="Agendar en Calendario" class="w-11 h-11 md:w-14 md:h-14 shrink-0 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all hover:scale-[1.05] backdrop-blur-sm border border-white/5">
                                <svg class="w-5 h-5 md:w-6 md:h-6 fill-current" viewBox="0 0 24 24"><path d="M19 4h-2V2h-2v2H9V2H7v2H5c-1.103 0-2 .897-2 2v14c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/></svg>
                            </a>
                        </div>
                    </div>
                </article>
            </div>
        `).join('');

        this.gigCards = document.querySelectorAll('.gig-card');
        this.gigsTrack = track;

        // Físicas individuales de deformación en Hover (Tilt & Zoom 3D)
        this.gigCards.forEach(card => {
            card._scale = 1;
            card._rotateY = 0;
            card._rotateX = 0;
            card._translateZ = 0;
            
            card.addEventListener('mouseenter', () => {
                this.gigsState.isHovered = true;
                card.dataset.hovered = 'true';
            });
            
            card.addEventListener('mouseleave', () => {
                this.gigsState.isHovered = false;
                card.dataset.hovered = 'false';
                card._targetRotateYHover = 0;
                card._targetRotateXHover = 0;
            });
            
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                card._targetRotateYHover = (x / (rect.width / 2)) * 15; 
                card._targetRotateXHover = -(y / (rect.height / 2)) * 15; 
            });
        });
    }

    bindEvents() {
        window.addEventListener('mousemove', (e) => {
            this.cursor.targetX = e.clientX;
            this.cursor.targetY = e.clientY;
        });

        // Usamos closest() para asegurar que detecte el hover en todos los componentes interactivos
        document.body.addEventListener('mouseover', (e) => {
            if (e.target.closest('a') || e.target.closest('button') || e.target.closest('#globe-container') || e.target.closest('#experience-years') || e.target.closest('.gig-card') || e.target.closest('.platform-panel')) {
                this.cursor.targetScale = 2.5;
            }
        });
        
        document.body.addEventListener('mouseout', (e) => {
            if (e.target.closest('a') || e.target.closest('button') || e.target.closest('#globe-container') || e.target.closest('#experience-years') || e.target.closest('.gig-card') || e.target.closest('.platform-panel')) {
                this.cursor.targetScale = 1;
            }
        });

        // Eventos que modifican la velocidad del Marquee basado en Scroll (Mouse)
        window.addEventListener('wheel', (e) => {
            const delta = Math.sign(e.deltaY);
            if (delta > 0) { // Hacia abajo -> Impulso a la izquierda
                this.gigsState.baseSpeed = -1.5;
                this.gigsState.targetSpeed = -25;
            } else if (delta < 0) { // Hacia arriba -> Impulso a la derecha
                this.gigsState.baseSpeed = 1.5;
                this.gigsState.targetSpeed = 25;
            }
        }, { passive: true });

        // Soporte táctil (Mobile) para inercia de Swipe
        let lastTouchY = 0;
        window.addEventListener('touchstart', (e) => { lastTouchY = e.touches[0].clientY; }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            const currentY = e.touches[0].clientY;
            const deltaY = lastTouchY - currentY;
            if (Math.abs(deltaY) > 5) {
                const delta = Math.sign(deltaY);
                if (delta > 0) {
                    this.gigsState.baseSpeed = -1.5;
                    this.gigsState.targetSpeed = -25;
                } else if (delta < 0) {
                    this.gigsState.baseSpeed = 1.5;
                    this.gigsState.targetSpeed = 25;
                }
                lastTouchY = currentY;
            }
        }, { passive: true });
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

        // --- 2. LÓGICA DE TRACK HORIZONTAL (Efecto Serpiente) Y ONDA DOPPLER ---
        const trackSec = document.getElementById('horizontal-scroll-track');
        if (trackSec) {
            const rect = trackSec.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            
            // Calculamos el scroll total disponible (400vh totales - 100vh cámara = 300vh scrolleables)
            const maxScroll = rect.height - windowHeight;
            
            // Progreso general recalculado para 3 fases: 0.0 al 3.0
            let rawProgress = 0;
            if (rect.top <= 0) {
                rawProgress = (-rect.top / (maxScroll / 3));
            }
            rawProgress = Math.max(0, Math.min(3, rawProgress));

            // Aplicar inercia para evitar tirones (Damping)
            this.scrollProgress += (rawProgress - this.scrollProgress) * 0.08;

            // -----------------------------------------------------------
            // SEGMENTO 1 (Progreso 0.0 a 1.0): Freno de Salida (Esfera y Textos)
            // -----------------------------------------------------------
            // Al usar Math.min(this.scrollProgress, 1), el progreso se bloquea en 1.0 
            // cuando seguimos bajando, eliminando la animación de salida.
            const segment1Progress = Math.min(this.scrollProgress, 1);

            // FASE 1 (0.0 -> 0.5): Implosión Espacial (Zoom de Globo y Opacidad)
            const globeProgress = Math.min(segment1Progress / 0.5, 1);
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
            const textProgress = Math.max(0, (segment1Progress - 0.5) / 0.5);
            const isDesktop = window.innerWidth >= 1024;
            
            // CONFIGURACIÓN DE LA CURVATURA MATEMÁTICA
            const curveSettings = {
                rotationIntensity: 4, // Grados de inclinación (Ajusta si quieres más o menos rotación)
                depthIntensity: 14,   // Fuerza de la curva (Hace el paréntesis más profundo)
                basePush: 60          // Distancia general hacia el centro del globo
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

            // -----------------------------------------------------------
            // SEGMENTO 2 (Progreso 1.0 a 2.0): Movimiento Horizontal
            // -----------------------------------------------------------
            // Se bloquea en 1.0 para que el desplazamiento termine y pase a la Fase 3 de anclaje
            const segment2Progress = Math.max(0, Math.min(this.scrollProgress - 1, 1));
            const horizontalStrip = document.getElementById('horizontal-strip');
            
            if (horizontalStrip) {
                // Desplazamiento horizontal. -50% mueve 100vw de la cinta de 200vw.
                horizontalStrip.style.transform = `translate3d(${-segment2Progress * 50}%, 0, 0)`;
            }
        }

        // --- 3. LÓGICA MARQUEE INFINITO Y TARJETAS 3D ---
        if (this.gigsTrack && this.gigCards && typeof UPCOMING_GIGS !== 'undefined') {
            // Calculamos con precisión el ancho de un bloque original para efectuar el teletransporte perfecto
            if (this.gigsState.wrapWidth === 0 && this.gigCards.length > UPCOMING_GIGS.length) {
                const card0 = this.gigCards[0];
                const cardN = this.gigCards[UPCOMING_GIGS.length];
                if (card0 && cardN) {
                    this.gigsState.wrapWidth = cardN.offsetLeft - card0.offsetLeft;
                }
            }

            // Aceleración y fricción matemática del Marquee
            this.gigsState.targetSpeed += (this.gigsState.baseSpeed - this.gigsState.targetSpeed) * 0.05;
            
            // Forzamos el freno en Hover
            let currentTargetSpeed = this.gigsState.isHovered ? 0 : this.gigsState.targetSpeed;
            this.gigsState.speed += (currentTargetSpeed - this.gigsState.speed) * 0.1;

            this.gigsState.position += this.gigsState.speed;

            // Bucle Infinito Inquebrantable
            if (this.gigsState.wrapWidth > 0) {
                if (this.gigsState.position <= -this.gigsState.wrapWidth) {
                    this.gigsState.position += this.gigsState.wrapWidth;
                } else if (this.gigsState.position >= 0) {
                    this.gigsState.position -= this.gigsState.wrapWidth;
                }
            }

            // Aplicamos desplazamiento en la GPU
            this.gigsTrack.style.transform = `translate3d(${this.gigsState.position}px, 0, 0)`;

            // Cálculos 3D para cada tarjeta individual
            const viewportCenter = window.innerWidth / 2;
            
            this.gigCards.forEach(card => {
                const rect = card.getBoundingClientRect();
                const cardCenter = rect.left + rect.width / 2;
                
                const distance = (cardCenter - viewportCenter) / (window.innerWidth / 2);
                const clampedDistance = Math.max(-1, Math.min(1, distance));
                
                let targetScale, targetRotateY, targetRotateX, targetZ;
                
                if (card.dataset.hovered === 'true') {
                    // Tarjeta capturada por el ratón vuela hacia adelante
                    targetScale = 1.15;
                    targetRotateY = card._targetRotateYHover || 0;
                    targetRotateX = card._targetRotateXHover || 0;
                    targetZ = 50; 
                    card.style.zIndex = 50;
                    card.classList.add('is-active');
                } else {
                    // Tarjetas en estado de rotación natural por la pista
                    targetScale = 1 - Math.abs(clampedDistance) * 0.2; 
                    targetRotateY = clampedDistance * -45;
                    targetRotateX = 0;
                    targetZ = 0;
                    card.style.zIndex = 1;
                    
                    if (Math.abs(distance) < 0.3) {
                        card.classList.add('is-active');
                    } else {
                        card.classList.remove('is-active');
                    }
                }
                
                // Interpolación matemática fluida
                card._scale += (targetScale - card._scale) * 0.1;
                card._rotateY += (targetRotateY - card._rotateY) * 0.1;
                card._rotateX += (targetRotateX - card._rotateX) * 0.1;
                card._translateZ += (targetZ - card._translateZ) * 0.1;
                
                const inner = card.querySelector('.gig-card-inner');
                if (inner) {
                    inner.style.transform = `translateZ(${card._translateZ}px) rotateX(${card._rotateX}deg) rotateY(${card._rotateY}deg) scale(${card._scale})`;
                }
            });
        }

        requestAnimationFrame(() => this.render());
    }
}

document.addEventListener('DOMContentLoaded', () => new TimbaoEngine());
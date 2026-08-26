/**
 * • La ruta: src/js/components/Hero.js
 * • Que es: Controlador de físicas e interacciones del Hero Section.
 * • Responsabilidades:
 *   1. Ejecutar las animaciones de revelado escalonado (stagger) sincronizadas con el Loader.
 *   2. Calcular el efecto parallax magnético evaluando la posición del cursor vs. el centro del viewport.
 *   3. Aplicar transformaciones 3D aceleradas por hardware a la tipografía y al fondo multimedia.
 */

export class HeroParallax {
    constructor() {
        // Vinculamos los nuevos elementos del DOM
        this.mediaBackground = document.getElementById('hero-media');
        this.title = document.querySelector('.hero-title');
        this.subtitle = document.querySelector('.hero-subtitle');
        this.scrollIndicator = document.querySelector('.hero-scroll');
        
        // Calculamos el centro de la pantalla
        this.centerX = window.innerWidth / 2;
        this.centerY = window.innerHeight / 2;

        this.bindEvents();
    }

    bindEvents() {
        // Recalcular si el usuario redimensiona la ventana
        window.addEventListener('resize', () => {
            this.centerX = window.innerWidth / 2;
            this.centerY = window.innerHeight / 2;
        });
    }

    // Se dispara cuando el Loader amarillo termina de subir
    triggerReveal() {
        if(this.title) this.title.classList.add('reveal-text');
        
        // Retraso de 150ms para el subtítulo (Efecto escalonado)
        setTimeout(() => {
            if(this.subtitle) this.subtitle.classList.add('reveal-text');
        }, 150);

        // Retraso para mostrar el indicador de scroll suavemente
        setTimeout(() => {
            if(this.scrollIndicator) this.scrollIndicator.style.opacity = '1';
        }, 800);
    }

    // Se ejecuta 60 veces por segundo renderizado por main.js
    render(cursorX, cursorY) {
        // Desactivamos el parallax en móviles (pantallas < 768px) para ahorrar batería
        if(window.innerWidth < 768) return;

        // Ecuación matemática: valor entre -1 y 1 dependiendo de dónde esté el cursor
        const moveX = (cursorX - this.centerX) / this.centerX;
        const moveY = (cursorY - this.centerY) / this.centerY;

        // Físicas del fondo: Movimiento sutil y fluido para dar profundidad sin marear
        if(this.mediaBackground) {
            this.mediaBackground.style.transform = `scale(1.1) translate3d(${moveX * 15}px, ${moveY * 15}px, 0)`;
        }
        
        // Físicas del texto: Movimiento inverso más pronunciado
        if(this.title) {
            this.title.style.transform = `translate3d(${moveX * -30}px, ${moveY * -30}px, 0)`;
        }
        if(this.subtitle) {
            this.subtitle.style.transform = `translate3d(${moveX * -15}px, ${moveY * -15}px, 0)`;
        }
    }
}
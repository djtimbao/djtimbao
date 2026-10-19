/**
 * • Ruta: src/js/components/Navbar.js
 * • Qué es: Controlador lógico del "Dynamic Floating Navbar" (Glassmorphism & FAB).
 * • Responsabilidades:
 *   1. Observar la sección Hero mediante IntersectionObserver para máximo rendimiento (60 FPS).
 *   2. Alternar las clases .is-scrolled y .is-expanded para gatillar las físicas CSS.
 *   3. Gestionar interacciones de usuario (Abrir menú, anclaje de clics y auto-cierre).
 */

export class Navbar {
    constructor() {
        this.navWrapper = document.getElementById('nav-wrapper');
        this.heroSection = document.getElementById('hero');
        this.logoBtn = document.getElementById('nav-logo-btn');
        this.navLinks = document.querySelectorAll('.nav-links a');

        // Fail-Fast: Abortar silenciosamente si no existen los elementos (ej. en subpáginas)
        if (!this.navWrapper || !this.logoBtn) return;

        this.init();
    }

    init() {
        this.setupObserver();
        this.bindEvents();
    }

    setupObserver() {
        // Observador Nativo: Costo Cero en procesamiento CPU
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // isIntersecting es false cuando el Hero sale completamente de la pantalla
                if (!entry.isIntersecting) {
                    this.navWrapper.classList.add('is-scrolled'); // Comprime a la derecha
                } else {
                    this.navWrapper.classList.remove('is-scrolled'); // Expande al centro
                    this.navWrapper.classList.remove('is-expanded'); // Limpia estado de apertura
                }
            });
        }, {
            // Se dispara cuando casi todo el Hero ha desaparecido de la vista superior
            threshold: 0.15 
        });

        if (this.heroSection) {
            observer.observe(this.heroSection);
        }
    }

    bindEvents() {
        // 1. Interacción Híbrida (Desktop Hover)
        this.navWrapper.addEventListener('mouseenter', () => {
            // Se despliega solo si estamos en PC (>= 1024px)
            if (window.innerWidth >= 1024) {
                this.navWrapper.classList.add('is-expanded');
            }
        });

        this.navWrapper.addEventListener('mouseleave', () => {
            if (window.innerWidth >= 1024) {
                this.navWrapper.classList.remove('is-expanded');
            }
        });

        // 2. Interacción Táctil (Mobile Click) y Fallback
        this.logoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.navWrapper.classList.toggle('is-expanded');
        });

        // 3. Seleccionamos los enlaces de la nueva estructura del Dropdown
        const dropLinks = document.querySelectorAll('.nav-link');

        // UX Premium: Cerrar el menú automáticamente al hacer clic en cualquier enlace
        dropLinks.forEach(link => {
            link.addEventListener('click', () => {
                this.navWrapper.classList.remove('is-expanded');
            });
        });

        // 4. Cierre contextual: Clics fuera del menú
        document.addEventListener('click', (e) => {
            if (this.navWrapper.classList.contains('is-expanded')) {
                if (!this.navWrapper.contains(e.target)) {
                    this.navWrapper.classList.remove('is-expanded');
                }
            }
        });
    }
}
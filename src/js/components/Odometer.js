/**
 * • La ruta: src/js/components/Odometer.js
 * • Que es: Controlador del efecto visual de alteración numérica (Odometer) por interacción.
 * • Responsabilidades:
 *   1. Calcular de forma dinámica la experiencia (Año actual - 2004) asegurando "mantenimiento cero".
 *   2. Iniciar un bucle hiperrápido de números aleatorios en hover.
 *   3. Aplicar un algoritmo de fricción/desaceleración al perder el foco, frenando gradualmente hasta anclar el valor real.
 */

export class OdometerEffect {
    constructor(elementId = 'experience-years', startYear = 2004) {
        this.el = document.getElementById(elementId);
        if (!this.el) return;

        // Cálculo dinámico del número real
        this.finalNumber = new Date().getFullYear() - startYear;
        
        // Estado de la animación
        this.isHovering = false;
        this.isEntering = false;
        this.animating = false;
        
        // Controladores de tiempo y fricción
        this.currentDelay = 1; // Frecuencia de cambio (1 = cada frame)
        this.delayCounter = 0;

        this.init();
    }

    init() {
        // Establecer un valor neutro inicial antes de ser revelado
        this.el.textContent = '00';
        this.bindEvents();
    }

    // Metodo Disparado por Intersection Observer en main.js
    triggerEntrance() {
        this.isEntering = true;
        this.currentDelay = 2; // Arranca hiperrápido
        
        if (!this.animating) {
            this.loop();
        }

        // Mantenemos el caos 2 segundos, luego soltamos para que actúe el algoritmo de fricción
        setTimeout(() => {
            this.isEntering = false;
        }, 2000);
    }

    bindEvents() {
        // Al entrar el mouse: inicia el caos numérico
        this.el.addEventListener('mouseenter', () => {
            if (this.isEntering) return; // Blindaje: No interrumpir la animación de entrada si el mouse se cruza
            this.isHovering = true;
            this.currentDelay = 2; // Velocidad muy alta (cambia cada 2 frames)
            
            // Si la animación no estaba corriendo, la disparamos
            if (!this.animating) {
                this.loop();
            }
        });

        // Al salir el mouse: comienza la desaceleración
        this.el.addEventListener('mouseleave', () => {
            this.isHovering = false;
        });
    }

    loop() {
        this.animating = true;
        this.delayCounter++;

        // Controlamos cuándo actualizar el DOM basándonos en la "fricción" actual
        if (this.delayCounter >= this.currentDelay) {
            this.delayCounter = 0;

            // Continúa el caos si está en hover O si está ejecutando la coreografía de entrada
            if (this.isHovering || this.isEntering) {
                // Modo Caos: Renderizamos un número aleatorio de dos dígitos (10 al 99)
                this.el.textContent = this.getRandomNumber();
            } else {
                // Modo Freno: Multiplicamos el delay, haciendo que tarde más en actualizarse
                this.currentDelay *= 1.25; // Factor de fricción exponencial

                if (this.currentDelay > 20) {
                    // Cuando es lo suficientemente lento, anclamos el valor real y detenemos la recursividad
                    this.el.textContent = this.finalNumber;
                    this.animating = false;
                    return; 
                } else {
                    // Mientras frena, seguimos inyectando números aleatorios
                    this.el.textContent = this.getRandomNumber();
                }
            }
        }

        // Llamada recursiva acoplada al refresco de la pantalla (60 FPS)
        requestAnimationFrame(() => this.loop());
    }

    getRandomNumber() {
        return Math.floor(Math.random() * 90) + 10;
    }
}
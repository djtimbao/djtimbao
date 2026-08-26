/**
 * • La ruta: src/js/components/Globe.js
 * • Que es: Controlador 3D WebGL del Globo Terráqueo interactivo.
 * • Responsabilidades:
 *   1. Generar la geometría esférica, texturas de relieve (bump maps) y países destacados en #e3bb3e.
 *   2. Gestionar la interacción de rotación 360° mediante arrastre con inercia (damping).
 *   3. Optimizar el ciclo de renderizado ejecutándolo solo cuando la sección es visible en el viewport.
 */

import * as THREE from 'https://esm.sh/three@0.160.0';

export class GlobeViewer {
    constructor(containerId = 'globe-container') {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        this.rotation = { x: 0.2, y: -1.2 };
        this.targetRotation = { x: 0.2, y: -1.2 };
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.isVisible = false;

        this.init();
    }

    init() {
        const width = this.container.clientWidth || 450;
        const height = this.container.clientHeight || 450;

        // Escena y Cámara
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.z = 2.8;

        // Renderizador WebGL
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Iluminación para Alto Relieve
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
        dirLight.position.set(3, 4, 3);
        this.scene.add(dirLight);

        const backLight = new THREE.DirectionalLight(0xe3bb3e, 0.4);
        backLight.position.set(-3, -2, -2);
        this.scene.add(backLight);

        this.createGlobeMesh();
        this.bindEvents();
        this.setupIntersectionObserver();
        this.animate();
    }

    generateGlobeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // Base océano / continente blanco
        ctx.fillStyle = '#f4f4f5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Mapa de continentes base (Gris claro)
        ctx.fillStyle = '#e4e4e7';
        ctx.strokeStyle = '#d4d4d8';
        ctx.lineWidth = 2;

        // Coordenadas aproximadas de continentes y países clave en proyección equirectangular
        const countries = [
            // América del Norte (USA destacado)
            { name: 'USA', color: '#e3bb3e', points: [[200, 250], [550, 230], [580, 360], [380, 400], [220, 320]] },
            // Cuba
            { name: 'CUBA', color: '#e3bb3e', points: [[480, 420], [530, 425], [520, 440], [475, 435]] },
            // Colombia y Venezuela
            { name: 'COLOMBIA_VENEZUELA', color: '#e3bb3e', points: [[480, 470], [600, 460], [580, 540], [490, 530]] },
            // Ecuador y Perú
            { name: 'ECUADOR_PERU', color: '#e3bb3e', points: [[470, 530], [530, 540], [540, 650], [480, 610]] },
            // Chile, Argentina, Uruguay
            { name: 'CONO_SUR', color: '#e3bb3e', points: [[520, 650], [600, 640], [600, 850], [520, 880]] },
            // España
            { name: 'ESPANA', color: '#e3bb3e', points: [[960, 290], [1020, 295], [1000, 350], [950, 340]] }
        ];

        // Dibujar continentes generales
        const genericLand = [
            [[1000, 200], [1700, 180], [1600, 480], [1150, 420]], // Eurasia
            [[1020, 370], [1280, 400], [1220, 700], [1060, 650]], // África
            [[1450, 650], [1700, 640], [1650, 800], [1480, 780]]  // Oceanía
        ];

        genericLand.forEach(land => {
            ctx.beginPath();
            ctx.moveTo(land[0][0], land[0][1]);
            for (let i = 1; i < land.length; i++) ctx.lineTo(land[i][0], land[i][1]);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });

        // Dibujar y resaltar países visitados con #e3bb3e
        countries.forEach(c => {
            ctx.fillStyle = c.color;
            ctx.beginPath();
            ctx.moveTo(c.points[0][0], c.points[0][1]);
            for (let i = 1; i < c.points.length; i++) ctx.lineTo(c.points[i][0], c.points[i][1]);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();
        });

        return new THREE.CanvasTexture(canvas);
    }

    createGlobeMesh() {
        const geometry = new THREE.SphereGeometry(1, 64, 64);
        const texture = this.generateGlobeTexture();

        const material = new THREE.MeshStandardMaterial({
            map: texture,
            bumpMap: texture,
            bumpScale: 0.04,
            roughness: 0.65,
            metalness: 0.1
        });

        this.globe = new THREE.Mesh(geometry, material);
        this.scene.add(this.globe);
    }

    bindEvents() {
        const onDown = (clientX, clientY) => {
            this.isDragging = true;
            this.previousMousePosition = { x: clientX, y: clientY };
        };

        const onMove = (clientX, clientY) => {
            if (!this.isDragging) return;
            const deltaX = clientX - this.previousMousePosition.x;
            const deltaY = clientY - this.previousMousePosition.y;

            this.targetRotation.y += deltaX * 0.007;
            this.targetRotation.x += deltaY * 0.007;

            // Limitar inclinación vertical para evitar giros descontrolados
            this.targetRotation.x = Math.max(-0.8, Math.min(0.8, this.targetRotation.x));

            this.previousMousePosition = { x: clientX, y: clientY };
        };

        const onUp = () => { this.isDragging = false; };

        // Eventos de Mouse
        this.container.addEventListener('mousedown', (e) => onDown(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', onUp);

        // Eventos Táctiles (Móviles)
        this.container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        window.addEventListener('touchend', onUp);

        // Responsive Resize
        window.addEventListener('resize', () => {
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        });
    }

    setupIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                this.isVisible = entry.isIntersecting;
            });
        }, { threshold: 0.1 });

        observer.observe(this.container);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (!this.isVisible) return;

        // Rotación continua lenta en reposo
        if (!this.isDragging) {
            this.targetRotation.y += 0.0015;
        }

        // Interpolación inercial (Damping)
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * 0.08;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * 0.08;

        if (this.globe) {
            this.globe.rotation.x = this.rotation.x;
            this.globe.rotation.y = this.rotation.y;
        }

        this.renderer.render(this.scene, this.camera);
    }
}
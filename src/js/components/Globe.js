/**
 * • La ruta: src/js/components/Globe.js
 * • Que es: Controlador 3D WebGL del Globo Terráqueo interactivo.
 * • Responsabilidades:
 *   1. Generar la geometría esférica con material base para evitar esferas invisibles.
 *   2. Cargar texturas remotas con crossOrigin 'anonymous' y manejo de estado asíncrono.
 *   3. Gestionar la interacción de rotación 360° mediante arrastre con inercia (damping).
 *   4. Optimizar el ciclo de renderizado ejecutándolo solo cuando la sección es visible en el viewport.
 */

import * as THREE from 'https://esm.sh/three@0.160.0';
import { ASSETS } from '../config/assets.js';

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

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        
        // 1. AUMENTAMOS LA DISTANCIA DE LA CÁMARA PARA EVITAR CORTES (de 2.8 a 3.6)
        this.camera.position.z = 3.6; 

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
        this.scene.add(ambientLight);

        // Luz principal para marcar el relieve
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(5, 3, 5);
        this.scene.add(dirLight);

        this.createGlobeMesh();
        this.bindEvents();
        this.setupIntersectionObserver();
        this.animate();
    }

    createGlobeMesh() {
        const geometry = new THREE.SphereGeometry(1, 64, 64);
        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin('anonymous');

        const material = new THREE.MeshStandardMaterial({
            color: 0xf4f4f5,
            bumpScale: 0.05, 
            roughness: 0.7,
            metalness: 0.1,
            transparent: true // Permite que los océanos blancos/grises se fundan mejor
        });

        // Cargamos tu textura de alta compresión desde Cloudflare R2
        textureLoader.load(
            ASSETS.GLOBE_TEXTURE,
            (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                material.map = texture;
                // Utilizamos la misma imagen como mapa de rugosidad/relieve para ahorrar peticiones
                material.bumpMap = texture;
                material.needsUpdate = true;
            },
            undefined,
            (error) => {
                console.error('🔥 Error cargando la textura desde R2:', error);
            }
        );

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
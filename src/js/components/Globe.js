/**
 * • La ruta: src/js/components/Globe.js
 * • Que es: Controlador 3D WebGL del Globo Terráqueo interactivo.
 * • Responsabilidades:
 *   1. Generar la geometría esférica combinando una textura dinámica (SVG).
 *   2. Manejar la inyección asíncrona del SVG en un Canvas de memoria para iluminar países específicos.
 *   3. Gestionar la interacción de rotación 360°, foco por coordenadas (Lat/Lng) y efecto "Tornado".
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
        this.isFocused = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.isVisible = false;

        // Variables para el motor de Textura SVG Dinámica
        this.svgDoc = null;
        this.mapTexture = null;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        // Resolución Retina 2K para el mapa equirectangular
        this.canvas.width = 2048; 
        this.canvas.height = 1024;
        
        this.activeCountryEl = null;
        this.originalFill = null;

        this.init();
    }

    init() {
        const width = this.container.clientWidth || 450;
        const height = this.container.clientHeight || 450;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.z = 6.0;

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
        this.loadSVGMap(); 

        this.bindEvents();
        this.setupIntersectionObserver();
        
        this.updateScroll(0);
        this.animate();
    }

    createGlobeMesh() {
        const geometry = new THREE.SphereGeometry(1, 64, 64);
        
        this.mapTexture = new THREE.CanvasTexture(this.canvas);
        this.mapTexture.colorSpace = THREE.SRGBColorSpace;

        this.material = new THREE.MeshStandardMaterial({
            color: 0xf4f4f5,
            map: this.mapTexture, 
            roughness: 0.85, // Ajustado para potenciar el look Flat UI
            metalness: 0.05,
            transparent: true
        });

        this.globe = new THREE.Mesh(geometry, this.material);
        this.scene.add(this.globe);
    }

    // --- MOTOR SVG & CANVAS ---
    async loadSVGMap() {
        try {
            const response = await fetch(ASSETS.GLOBE_SVG_MAP);
            const svgText = await response.text();
            this.svgDoc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
            this.updateCanvasTexture();
        } catch (error) {
            console.error('🔥 Error parseando el mapa SVG:', error);
        }
    }

    updateCanvasTexture() {
        if (!this.svgDoc) return;
        
        // Serializamos el DOM virtual a un Blob nativo
        const svgString = new XMLSerializer().serializeToString(this.svgDoc);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const img = new Image();
        img.onload = () => {
            // Dibujamos el SVG modificado en el lienzo oculto y avisamos a la GPU
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
            this.mapTexture.needsUpdate = true;
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }

    highlightCountry(countryId) {
        if (!this.svgDoc) return;
        
        // Limpiamos focos anteriores silenciosamente
        this.resetHighlight(false); 
        
        const el = this.svgDoc.getElementById(countryId);
        if (el) {
            this.activeCountryEl = el;
            // Guardamos el color original (#e3bb3e) que definiste en Illustrator
            this.originalFill = el.getAttribute('fill') || ''; 
            // Inyectamos el nuevo color naranja de forma dinámica
            el.setAttribute('fill', '#e26118'); 
            this.updateCanvasTexture();
        }
    }

    resetHighlight(updateTexture = true) {
        if (this.activeCountryEl) {
            if (this.originalFill) {
                this.activeCountryEl.setAttribute('fill', this.originalFill);
            } else {
                this.activeCountryEl.removeAttribute('fill');
            }
            this.activeCountryEl = null;
            if (updateTexture) this.updateCanvasTexture();
        }
        this.isFocused = false;
    }

    // --- TRIGONOMETRÍA ESFÉRICA ---
    focusOnLocation(lat, lng) {
        this.isFocused = true;
        // Convertimos Latitud y Longitud a radianes de Euler para el motor Three.js
        this.targetRotation.x = lat * (Math.PI / 180);
        // Desplazamiento estándar (-90deg) para ajustar el mapa equirectangular a la cámara frontal
        this.targetRotation.y = -lng * (Math.PI / 180) - (Math.PI / 2);
    }

    updateScroll(progress) {
        if (!this.globe) return;
        
        const scale = 0.3 + (0.7 * progress);
        this.globe.scale.set(scale, scale, scale);
        
        this.camera.position.z = 6.0 - (2.4 * progress);
        this.material.opacity = progress;

        // EFECTO TORNADO: Aceleración extrema que decae al llegar a progress = 1.0
        if (progress < 1.0) {
            const tornadoIntensity = Math.pow(1.0 - progress, 3);
            this.targetRotation.y += tornadoIntensity * 0.5;
        }
    }

    bindEvents() {
        const onDown = (clientX, clientY) => {
            this.isDragging = true;
            this.isFocused = false; // Rompemos el foco de la UI si el usuario arrastra manualmente
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

        // Si no lo estamos arrastrando ni el ratón está haciendo foco en un evento, gira suavemente
        if (!this.isDragging && !this.isFocused) {
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
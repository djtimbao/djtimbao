/**
 * • La ruta: src/js/pedidosApp.js
 * • Que es: Controlador Frontend de la aplicación Mobile-First de "Pedidos" Multi-Evento.
 * • Responsabilidades:
 * 1. Gestionar autenticación (JWT) con Google Identity Services.
 * 2. Enrutamiento Inteligente (Lobby de fiestas vs. Interfaz de pedidos).
 * 3. Conectar con el backend Serverless exigiendo y enviando el evento_id.
 */

import { ICONS } from './config/assets.js';

class PedidosApp {
    constructor() {
        this.token = sessionStorage.getItem('djtimbao_jwt') || null;
        this.isAdmin = false; 

        // Parámetros de Ruta (Routing)
        const urlParams = new URLSearchParams(window.location.search);
        this.activeEventId = urlParams.get('evento_id') || null;

        // Caché de Eventos para el Lobby
        this.gigsCache = [];

        // Nodos Principales de Vistas
        this.authSection = document.getElementById('auth-section');
        this.lobbySection = document.getElementById('lobby-section');
        this.appSection = document.getElementById('app-section');
        
        // Elementos del Lobby
        this.lobbyContainer = document.getElementById('lobby-events-container');
        this.btnBackLobby = document.getElementById('btn-back-lobby');
        
        // UI del Evento Activo en Pedidos
        this.activeEventTitle = document.getElementById('active-event-title');
        this.activeEventFlyer = document.getElementById('active-event-flyer');

        // Nodos del Formulario
        this.form = document.getElementById('request-form');
        this.urlInput = document.getElementById('song-url');
        this.submitBtn = document.getElementById('submit-btn');
        this.formMessage = document.getElementById('form-message');
        
        // Elementos del Modo Dual (Tabs)
        this.tabLink = document.getElementById('tab-link');
        this.tabManual = document.getElementById('tab-manual');
        this.modeLink = document.getElementById('mode-link');
        this.modeManual = document.getElementById('mode-manual');
        this.titleInput = document.getElementById('song-title');
        this.artistInput = document.getElementById('song-artist');
        this.currentMode = 'manual';
        
        // Listas
        this.queueList = document.getElementById('queue-list');
        this.historyList = document.getElementById('history-list');

        // Plantillas
        this.tplPending = document.getElementById('tpl-song-pending');
        this.tplPlayed = document.getElementById('tpl-song-played');

        this.init();
    }

    init() {
        const headerLogo = document.getElementById('header-logo');
        if (headerLogo && typeof ICONS !== 'undefined' && ICONS.djTimbaoLogo) {
            headerLogo.innerHTML = ICONS.djTimbaoLogo;
        }

        window.appHandleGoogleLogin = this.handleAuthResponse.bind(this);
        this.bindEvents();
        this.tabManual.click(); // Por defecto manual
        
        // MOTOR DE ENRUTAMIENTO: Evalúa el estado del JWT y de la URL
        this.routeView();
    }

    // ==========================================
    // ENRUTAMIENTO Y VISTAS
    // ==========================================
    routeView() {
        // Regla 1: Sin token, todos al Auth.
        if (!this.token) {
            this.showView(this.authSection);
            return;
        }

        // Regla 2: Con token, pero SIN evento elegido en la URL -> Mostrar Lobby
        if (!this.activeEventId) {
            this.showView(this.lobbySection);
            this.loadLobby();
            return;
        }

        // Regla 3: Con token Y con evento elegido -> Mostrar App de pedidos
        this.showView(this.appSection);
        this.fetchQueue();
    }

    showView(viewNode) {
        [this.authSection, this.lobbySection, this.appSection].forEach(node => {
            node.classList.add('hidden');
            node.classList.remove('flex');
        });
        viewNode.classList.remove('hidden');
        viewNode.classList.add('flex');
    }

    // ==========================================
    // 1. AUTENTICACIÓN
    // ==========================================
    handleAuthResponse(response) {
        if (response.credential) {
            this.token = response.credential;
            sessionStorage.setItem('djtimbao_jwt', this.token);
            
            // Re-evaluar la ruta (Irá al Lobby si no hay URL parametrizada)
            this.routeView(); 
        }
    }

    // 4. Agregar método de limpieza (Llamar a este método si fetch devuelve 401)
    logout() {
        this.token = null;
        sessionStorage.removeItem('djtimbao_jwt');
        this.activeEventId = null;
        // Limpiamos la URL silenciosamente
        window.history.replaceState({}, '', window.location.pathname);
        this.routeView();
        this.showMessage('Tu sesión expiró. Vuelve a iniciar sesión.', 'error');
    }

    // ==========================================
    // 2. CONEXIÓN CON CLOUDFLARE D1 (API)
    // ==========================================
    
    // CARGAR EL LOBBY DE FIESTAS
    async loadLobby() {
        try {
            this.lobbyContainer.innerHTML = '<p class="text-xs text-center text-zinc-500 py-4">Buscando fiestas activas...</p>';
            
            // Consumimos el endpoint público que tú ya creaste en gigs.js
            const res = await fetch('/api/gigs');
            const data = await res.json();

            if (data.success && data.data.length > 0) {
                this.gigsCache = data.data; // Guardamos en RAM local
                
                this.lobbyContainer.innerHTML = data.data.map(gig => `
                    <button type="button" class="btn-select-event w-full flex items-center gap-4 bg-zinc-900 border border-zinc-800 p-3 rounded-xl hover:border-[#e3bb3e] active:scale-95 transition-all text-left group" data-id="${gig.id}">
                        <img src="${gig.flyerUrl}" class="w-14 h-14 object-cover rounded shadow-md bg-black">
                        <div class="flex-1 min-w-0">
                            <span class="text-[9px] text-[#e3bb3e] font-bold uppercase tracking-widest">${gig.date}</span>
                            <h3 class="text-sm font-black text-white truncate group-hover:text-[#e3bb3e] transition-colors">${gig.title}</h3>
                            <p class="text-[10px] text-zinc-400 mt-0.5 truncate">${gig.location}</p>
                        </div>
                        <div class="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-[#e3bb3e] group-hover:text-black transition-colors text-zinc-400">
                            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M5 3l3.057-3 11.943 12-11.943 12-3.057-3 9-9z"/></svg>
                        </div>
                    </button>
                `).join('');

                // Inyectar eventos de navegación
                const eventBtns = this.lobbyContainer.querySelectorAll('.btn-select-event');
                eventBtns.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const selectedId = e.currentTarget.dataset.id;
                        this.enterEvent(selectedId);
                    });
                });

            } else {
                this.lobbyContainer.innerHTML = '<p class="text-xs text-center text-zinc-500 py-4">No hay próximos eventos disponibles.</p>';
            }
        } catch (error) {
            this.lobbyContainer.innerHTML = '<p class="text-xs text-center text-red-400 py-4">Error conectando al servidor.</p>';
        }
    }

    // NAVEGAR HACIA UN EVENTO (SPA Router Costo Cero)
    enterEvent(id) {
        this.activeEventId = id;
        
        // Modificar URL sin recargar para que si el usuario comparte el link, los demás entren directo
        const newUrl = `${window.location.pathname}?evento_id=${id}`;
        window.history.pushState({ path: newUrl }, '', newUrl);

        // Decorar la cabecera del Pedido con los datos del evento actual
        const gigData = this.gigsCache.find(g => g.id.toString() === id.toString());
        if (gigData) {
            this.activeEventTitle.textContent = gigData.title;
            this.activeEventFlyer.src = gigData.flyerUrl;
        }

        // Renderizar la vista
        this.routeView();
    }

    // CARGAR CANCIONES ESPECÍFICAS DE ESTE EVENTO
    async fetchQueue() {
        if(!this.activeEventId) return;

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

            // Enviamos el ID por parámetro URL para filtrar en Base de Datos D1
            const response = await fetch(`/api/requests?evento_id=${this.activeEventId}`, { headers });
            
            if (response.status === 401) {
                this.logout();
                return; // Abortamos la ejecución instantáneamente
            }
            
            // FAIL-SAFE: Proteger contra respuestas HTML (Errores 500/502 de Cloudflare)
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("El servidor devolvió un formato no válido. Posible error de entorno.");
            }

            const data = await response.json();

            if (data.success) {
                this.isAdmin = data.isAdmin === true || data.data.some(s => s.solicitante_nombre !== undefined);
                this.renderAllSongs(data.data);
            }
        } catch (error) {
            console.error('Error cargando la lista:', error);
            this.queueList.innerHTML = '<p class="text-xs text-red-400 italic">Error de conexión. Estamos trabajando para solucionarlo.</p>';
        }
    }

    async submitSong(payload) {
        try {
            this.setLoadingState(true);
            
            // Inyectamos obligatoriamente el ID del evento al payload
            payload.evento_id = this.activeEventId;

            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.status === 401) {
                this.logout();
                return; // Cortamos la ejecución aquí
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const rawErrorText = await response.text();
                console.error("🔥 [CRÍTICO] El servidor colapsó y no devolvió JSON. Respuesta cruda del servidor:");
                console.error(rawErrorText);
                throw new Error("Respuesta no estructurada del servidor.");
            }

            const data = await response.json();

            if (response.ok && data.success) {
                this.showMessage('¡Canción agregada a la cola!', 'success');
                // Limpiar inputs dependiendo del modo
                this.urlInput.value = '';
                this.titleInput.value = '';
                this.artistInput.value = '';
                this.fetchQueue(); 
            } else {
                this.showMessage(data.error || 'Ocurrió un error al enviar el tema.', 'error');
            }
        } catch (error) {
            console.error('Error Frontend:', error);
            this.showMessage('Error de comunicación con el servidor. Intenta de nuevo.', 'error');
        } finally {
            this.setLoadingState(false);
        }
    }

    // ==========================================
    // 3. EVENTOS DEL FORMULARIO Y UI
    // ==========================================
    bindEvents() {
        // Botón Volver al Lobby
        this.btnBackLobby.addEventListener('click', () => {
            this.activeEventId = null;
            window.history.pushState({ path: window.location.pathname }, '', window.location.pathname);
            this.routeView();
        });

        // Manejo del historial del navegador (botón atrás físico del celular)
        window.addEventListener('popstate', () => {
            const urlParams = new URLSearchParams(window.location.search);
            this.activeEventId = urlParams.get('evento_id') || null;
            this.routeView();
        });

        // Alternar a modo Link
        this.tabLink.addEventListener('click', () => {
            this.currentMode = 'link';
            this.tabLink.classList.replace('text-zinc-500', 'text-white');
            this.tabLink.classList.replace('hover:text-zinc-300', 'bg-zinc-800');
            this.tabLink.classList.add('shadow-sm', 'pointer-events-none');
            
            this.tabManual.classList.replace('text-white', 'text-zinc-500');
            this.tabManual.classList.replace('bg-zinc-800', 'hover:text-zinc-300');
            this.tabManual.classList.remove('shadow-sm', 'pointer-events-none');
            
            this.modeLink.classList.remove('hidden');
            this.modeLink.classList.add('flex');
            this.modeManual.classList.add('hidden');
            this.modeManual.classList.remove('flex');
        });

        // Alternar a modo Manual
        this.tabManual.addEventListener('click', () => {
            this.currentMode = 'manual';
            this.tabManual.classList.replace('text-zinc-500', 'text-white');
            this.tabManual.classList.replace('hover:text-zinc-300', 'bg-zinc-800');
            this.tabManual.classList.add('shadow-sm', 'pointer-events-none');
            
            this.tabLink.classList.replace('text-white', 'text-zinc-500');
            this.tabLink.classList.replace('bg-zinc-800', 'hover:text-zinc-300');
            this.tabLink.classList.remove('shadow-sm', 'pointer-events-none');
            
            this.modeManual.classList.remove('hidden');
            this.modeManual.classList.add('flex');
            this.modeLink.classList.add('hidden');
            this.modeLink.classList.remove('flex');
        });

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!this.token) {
                this.showMessage('Debes iniciar sesión para pedir un tema.', 'error');
                return;
            }

            // Evitar envíos huérfanos sin evento_id
            if (!this.activeEventId) {
                this.showMessage('Debe seleccionar una fiesta primero.', 'error');
                return;
            }

            let payload = {};

            if (this.currentMode === 'link') {
                const url = this.urlInput.value.trim();
                if (!url) {
                    this.showMessage('Por favor, pega un enlace válido.', 'warning');
                    return;
                }

                // --- 🛡️ INICIO VALIDACIÓN ANTI-PLAYLISTS ---
                const urlLower = url.toLowerCase();
                const isSpotify = urlLower.includes('spotify.com');
                
                // Si es Spotify, OBLIGAMOS a que sea un "track". Rechazamos "album" o "playlist"
                if (isSpotify && !urlLower.includes('/track/')) {
                    this.showMessage('Por favor, envía el enlace de una sola canción, no de álbumes ni playlists.', 'warning');
                    return;
                }

                // Si es YouTube, BLOQUEAMOS el parámetro "list=" o la ruta "/playlist"
                if (!isSpotify && (urlLower.includes('list=') || urlLower.includes('/playlist'))) {
                    this.showMessage('Por favor, envía el enlace de una sola canción, no de álbumes ni playlists.', 'warning');
                    return;
                }
                // --- 🛡️ FIN VALIDACIÓN ANTI-PLAYLISTS ---

                payload = { url: url };
            } else {
                const titulo = this.titleInput.value.trim();
                const artista = this.artistInput.value.trim();
                
                if (!titulo) {
                    this.showMessage('Por favor, escribe el título de la canción.', 'warning');
                    return;
                }
                
                payload = { mode: 'manual', titulo: titulo, artista: artista };
            }

            this.setLoadingState(true);
            this.submitSong(payload);
        });
    }

    // ==========================================
    // 4. UTILIDADES DE INTERFAZ & RENDERIZADO
    // ==========================================
    
    // Formateador nativo para convertir horas UTC0 a la zona horaria del usuario
    formatTime(sqlTimestamp) {
        if (!sqlTimestamp) return '';
        // SQLite guarda 'YYYY-MM-DD HH:MM:SS'. Lo pasamos a formato ISO estricto UTC agregando la 'T' y la 'Z'
        const isoString = sqlTimestamp.replace(' ', 'T') + 'Z';
        const date = new Date(isoString);
        
        if (isNaN(date)) return '';
        
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes} Hrs`;
    }

    setLoadingState(isLoading) {
        this.submitBtn.disabled = isLoading;
        this.submitBtn.innerHTML = isLoading 
            ? '<svg class="animate-spin h-4 w-4 text-black" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>'
            : 'Pedir Tema';
        this.submitBtn.classList.toggle('opacity-75', isLoading);
    }

    showMessage(text, type = 'error') {
        this.formMessage.textContent = text;
        this.formMessage.className = 'text-xs mt-1 font-medium block text-center'; 
        
        if (type === 'error') this.formMessage.classList.add('text-red-400');
        if (type === 'success') this.formMessage.classList.add('text-green-400');
        if (type === 'warning') this.formMessage.classList.add('text-[#e3bb3e]');
        
        // Auto-ocultar después de 5 segundos
        setTimeout(() => this.formMessage.classList.add('hidden'), 5000);
    }

    renderAllSongs(songs) {
        // Limpiamos las listas antes de inyectar
        this.queueList.innerHTML = '';
        this.historyList.innerHTML = '';

        if (songs.length === 0) {
            this.queueList.innerHTML = '<p class="text-xs text-zinc-500 italic">La cola está vacía. ¡Sé el primero en pedir!</p>';
            return;
        }

        songs.forEach(song => this.renderSong(song));
    }

    renderSong(song) {
        const isPlayed = song.estado === 'reproducida';
        const template = isPlayed ? this.tplPlayed : this.tplPending;
        const clone = template.content.cloneNode(true);

        clone.querySelector('.tpl-title').textContent = song.titulo;
        
        const artistNode = clone.querySelector('.tpl-artist');
        if (artistNode) artistNode.textContent = song.artista || 'Artista Desconocido';
        
        const img = clone.querySelector('.tpl-img');
        if (img) img.src = song.miniatura || '/img/djt-logo.jpg';
        
        // Inyección de la hora de Solicitud (Visible solo para administradores)
        const timeReqNode = clone.querySelector('.tpl-time-request');
        if (timeReqNode && song.hora_solicitud) {
            timeReqNode.textContent = this.formatTime(song.hora_solicitud);
            if (this.isAdmin) {
                timeReqNode.classList.remove('hidden');
            }
        }

        if (!isPlayed) {
            clone.querySelector('.tpl-platform').textContent = song.plataforma;
            clone.querySelector('.tpl-link').href = song.url_original;
            this.queueList.appendChild(clone);
        } else {
            // Inyección de la hora de Reproducción (En "Ya Sonaron")
            const timePlayedNode = clone.querySelector('.tpl-time-played');
            if (timePlayedNode && song.hora_reproduccion) {
                timePlayedNode.textContent = `Sonó a las ${this.formatTime(song.hora_reproduccion)}`;
            }
            this.historyList.appendChild(clone);
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => new PedidosApp());
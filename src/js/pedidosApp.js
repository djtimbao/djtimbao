/**
 * • La ruta: src/js/pedidosApp.js
 * • Que es: Controlador Frontend de la aplicación Mobile-First de "Pedidos".
 * • Responsabilidades:
 *   1. Gestionar el estado de autenticación (JWT) con Google Identity Services.
 *   2. Orquestar la UI (Mostrar/Ocultar formularios y listas).
 *   3. Conectar con el backend Serverless para leer/escribir canciones (Fetch API).
 */

class PedidosApp {
    constructor() {
        // 1. Leer la memoria del navegador al instanciar la clase
        this.token = sessionStorage.getItem('djtimbao_jwt') || null;
        
        // Elementos del DOM
        this.authSection = document.getElementById('auth-section');
        this.appSection = document.getElementById('app-section');
        this.form = document.getElementById('request-form');
        this.urlInput = document.getElementById('song-url');
        this.submitBtn = document.getElementById('submit-btn');
        this.formMessage = document.getElementById('form-message');
        
        this.queueList = document.getElementById('queue-list');
        this.historyList = document.getElementById('history-list');

        // Plantillas
        this.tplPending = document.getElementById('tpl-song-pending');
        this.tplPlayed = document.getElementById('tpl-song-played');

        this.init();
    }

    init() {
        window.appHandleGoogleLogin = this.handleAuthResponse.bind(this);
        this.bindEvents();
        
        // 2. Restaurar la interfaz automáticamente si ya existe un token en memoria
        if (this.token) {
            this.authSection.classList.add('hidden');
            this.appSection.classList.remove('hidden');
            this.appSection.classList.add('flex');
        }
        
        this.fetchQueue(); 
    }

    // ==========================================
    // 1. AUTENTICACIÓN
    // ==========================================
    handleAuthResponse(response) {
        if (response.credential) {
            this.token = response.credential;
            
            // 3. Escribir el token en la memoria de la pestaña actual
            sessionStorage.setItem('djtimbao_jwt', this.token);
            
            this.authSection.classList.add('hidden');
            this.appSection.classList.remove('hidden');
            this.appSection.classList.add('flex');
            this.showMessage('Sesión iniciada. Pide tu tema.', 'success');
            
            // Refrescar la lista de canciones ahora que estamos autenticados
            this.fetchQueue();
        }
    }

    // 4. Agregar método de limpieza (Llamar a este método si fetch devuelve 401)
    logout() {
        this.token = null;
        sessionStorage.removeItem('djtimbao_jwt');
        this.appSection.classList.add('hidden');
        this.appSection.classList.remove('flex');
        this.authSection.classList.remove('hidden');
        this.showMessage('Tu sesión expiró. Vuelve a iniciar sesión.', 'error');
    }

    // ==========================================
    // 2. CONEXIÓN CON CLOUDFLARE D1 (API)
    // ==========================================
    async fetchQueue() {
        try {
            // Hacemos GET. Si el usuario está logueado, mandamos el token (para ver nombres si es Admin)
            const headers = { 'Content-Type': 'application/json' };
            if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

            const response = await fetch('/api/requests', { headers });
            
            // FAIL-SAFE: Proteger contra respuestas HTML (Errores 500/502 de Cloudflare)
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("El servidor devolvió un formato no válido. Posible error de entorno.");
            }

            const data = await response.json();

            if (data.success) {
                this.renderAllSongs(data.data);
            }
        } catch (error) {
            console.error('Error cargando la lista:', error);
            this.queueList.innerHTML = '<p class="text-xs text-red-400 italic">Error de conexión. Estamos trabajando para solucionarlo.</p>';
        }
    }

    async submitSong(url) {
        try {
            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ url: url })
            });
            
            const contentType = response.headers.get("content-type");

            // FAIL-SAFE MODIFICADO: Capturar el error HTML de Cloudflare
            if (!contentType || !contentType.includes("application/json")) {
                const rawErrorText = await response.text();
                console.error("🔥 [CRÍTICO] El servidor colapsó y no devolvió JSON. Respuesta cruda del servidor:");
                console.error(rawErrorText);
                throw new Error("Respuesta no estructurada del servidor.");
            }

            const data = await response.json();
            if (response.ok && data.success) {
                this.showMessage('¡Canción agregada a la cola!', 'success');
                this.urlInput.value = '';
                this.fetchQueue(); 
            } else {
                this.showMessage(data.error || 'Ocurrió un error al enviar el tema.', 'error');
            }
        } catch (error) {
            console.error('🚨 [FRONTEND CATCH] El código frontend falló por:', error);
            this.showMessage('Error de comunicación con el servidor. Intenta de nuevo.', 'error');
        } finally {
            this.setLoadingState(false);
        }
    }

    // ==========================================
    // 3. EVENTOS DEL FORMULARIO
    // ==========================================
    bindEvents() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!this.token) {
                this.showMessage('Debes iniciar sesión para pedir un tema.', 'error');
                return;
            }

            const url = this.urlInput.value.trim();
            if (!url) return;

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

            this.setLoadingState(true);
            this.submitSong(url);
        });
    }

    // ==========================================
    // 4. UTILIDADES DE INTERFAZ & RENDERIZADO
    // ==========================================
    setLoadingState(isLoading) {
        this.submitBtn.disabled = isLoading;
        this.submitBtn.innerHTML = isLoading 
            ? '<svg class="animate-spin h-4 w-4 text-black" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>'
            : 'Pedir';
        this.submitBtn.classList.toggle('opacity-75', isLoading);
    }

    showMessage(text, type = 'error') {
        this.formMessage.textContent = text;
        this.formMessage.className = 'text-xs mt-1 font-medium block'; // Reset clases
        
        if (type === 'error') this.formMessage.classList.add('text-red-400');
        if (type === 'success') this.formMessage.classList.add('text-green-400');
        
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
        
        // 🚀 NUEVA INYECCIÓN DEL ARTISTA
        const artistNode = clone.querySelector('.tpl-artist');
        if (artistNode) artistNode.textContent = song.artista || 'Artista Desconocido';
        
        const img = clone.querySelector('.tpl-img');
        if (img) img.src = song.miniatura || 'https://via.placeholder.com/150/09090b/e3bb3e?text=Audio';
        
        if (!isPlayed) {
            clone.querySelector('.tpl-platform').textContent = song.plataforma;
            clone.querySelector('.tpl-link').href = song.url_original;
            this.queueList.appendChild(clone);
        } else {
            this.historyList.appendChild(clone);
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => new PedidosApp());
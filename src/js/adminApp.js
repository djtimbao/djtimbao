/**
 * • La ruta: src/js/adminApp.js
 * • Que es: Controlador Frontend del Panel de Administración (DJ Panel).
 * • Responsabilidades:
 * 1. Validar autenticación de Google y verificar acceso de nivel Admin.
 * 2. Interfaz de Pedidos Live: Marcar como reproducida, separar historial o limpiar base de datos.
 * 3. Interfaz de Eventos (CRUD): Crear, listar, editar y eliminar próximos eventos.
 */

class AdminApp {
    constructor() {
        this.token = sessionStorage.getItem('djtimbao_admin_jwt') || null;

        // Nodos del DOM
        this.authSection = document.getElementById('auth-section');
        this.appSection = document.getElementById('app-section');
        this.authError = document.getElementById('auth-error');
        this.logoutBtn = document.getElementById('logout-btn');

        // Tabs y Vistas
        this.tabPedidos = document.getElementById('tab-pedidos');
        this.tabEventos = document.getElementById('tab-eventos');
        this.viewPedidos = document.getElementById('view-pedidos');
        this.viewEventos = document.getElementById('view-eventos');

        // Listas Pedidos y Controles
        this.queueList = document.getElementById('admin-queue-list');
        this.historyList = document.getElementById('admin-history-list');
        this.refreshPedidosBtn = document.getElementById('refresh-pedidos');
        this.clearPedidosBtn = document.getElementById('clear-pedidos');

        // Formulario y Lista de Eventos
        this.eventosList = document.getElementById('admin-eventos-list');
        this.eventoForm = document.getElementById('evento-form');
        this.evIdInput = document.getElementById('ev-id');
        this.btnCancelEv = document.getElementById('btn-cancel-ev');
        this.btnSubmitEv = document.getElementById('btn-submit-ev');

        this.init();
    }

    init() {
        window.adminHandleGoogleLogin = this.handleAuthResponse.bind(this);
        this.bindEvents();

        // Auto-login si hay token
        if (this.token) {
            this.showApp();
            this.fetchPedidos();
        }
    }

    // ==========================================
    // AUTENTICACIÓN
    // ==========================================
    handleAuthResponse(response) {
        if (response.credential) {
            this.token = response.credential;
            sessionStorage.setItem('djtimbao_admin_jwt', this.token);
            
            // Validamos contra la API para ver si tiene rol de ADMIN
            this.fetchPedidos(); 
        }
    }

    logout() {
        this.token = null;
        sessionStorage.removeItem('djtimbao_admin_jwt');
        this.appSection.classList.add('hidden');
        this.appSection.classList.remove('flex');
        this.authSection.classList.remove('hidden');
        this.authError.classList.add('hidden');
    }

    showApp() {
        this.authSection.classList.add('hidden');
        this.appSection.classList.remove('hidden');
        this.appSection.classList.add('flex');
    }

    handleApiError(res, defaultMsg) {
        if (res.status === 401 || res.status === 403) {
            this.logout();
            this.authError.textContent = 'Acceso Denegado. Tu cuenta no es de Administrador.';
            this.authError.classList.remove('hidden');
            return true;
        }
        return false;
    }

    // ==========================================
    // UI Y EVENTOS GENERALES
    // ==========================================
    bindEvents() {
        this.logoutBtn.addEventListener('click', () => this.logout());
        this.refreshPedidosBtn.addEventListener('click', () => this.fetchPedidos());
        this.clearPedidosBtn.addEventListener('click', () => this.clearPedidos());

        // Control de Tabs
        this.tabPedidos.addEventListener('click', () => {
            this.activateTab(this.tabPedidos, this.tabEventos);
            this.viewPedidos.classList.remove('hidden');
            this.viewPedidos.classList.add('flex');
            this.viewEventos.classList.add('hidden');
            this.viewEventos.classList.remove('flex');
            this.fetchPedidos();
        });

        this.tabEventos.addEventListener('click', () => {
            this.activateTab(this.tabEventos, this.tabPedidos);
            this.viewEventos.classList.remove('hidden');
            this.viewEventos.classList.add('flex');
            this.viewPedidos.classList.add('hidden');
            this.viewPedidos.classList.remove('flex');
            this.fetchEventos();
        });

        // Formulario de Eventos - Enrutador Inteligente (POST o PUT)
        this.eventoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEvento();
        });

        // Botón Cancelar Edición
        this.btnCancelEv.addEventListener('click', () => this.resetFormularioEventos());
    }

    activateTab(active, inactive) {
        active.className = 'flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-lg bg-[#e3bb3e] text-black transition-all';
        inactive.className = 'flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-lg bg-zinc-900 text-zinc-500 border border-zinc-800 transition-all';
    }

    // ==========================================
    // MÓDULO: PEDIDOS LIVE
    // ==========================================
    async fetchPedidos() {
        try {
            const res = await fetch('/api/requests', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (this.handleApiError(res)) return;
            const data = await res.json();
            
            if (data.success && data.isAdmin) {
                this.showApp();
                
                // Filtros estructurados para separar la cola del historial
                const pendientes = data.data.filter(s => s.estado === 'pendiente');
                const reproducidas = data.data.filter(s => s.estado === 'reproducida');
                
                this.renderPedidos(pendientes, this.queueList, true);
                this.renderPedidos(reproducidas, this.historyList, false);
            } else {
                this.handleApiError({ status: 403 }); // Forzar logout si llega aquí sin isAdmin
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    renderPedidos(songs, container, isPending) {
        container.innerHTML = '';
        if (songs.length === 0) {
            container.innerHTML = `<p class="text-xs text-zinc-500 py-2 text-center">${isPending ? 'Pista limpia. Nadie ha pedido nada aún.' : 'Aún no has reproducido ninguna canción.'}</p>`;
            return;
        }

        songs.forEach(song => {
            const li = document.createElement('li');
            li.className = `flex flex-col gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-xl ${!isPending ? 'opacity-50 grayscale' : ''}`;
            
            li.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${song.miniatura || '/img/djt-logo.jpg'}" class="w-12 h-12 rounded object-cover">
                    <div class="flex-1 min-w-0">
                        <h3 class="text-sm font-bold text-white truncate">${song.titulo}</h3>
                        <p class="text-[10px] text-zinc-400 truncate">${song.artista || 'Desconocido'}</p>
                        <p class="text-[9px] text-[#e3bb3e] mt-0.5">Pedido por: ${song.solicitante_nombre || 'Anónimo'}</p>
                    </div>
                </div>
                ${isPending ? `
                <div class="flex gap-2">
                    <a href="${song.url_original}" target="_blank" class="flex-1 py-2 bg-zinc-800 text-white text-[10px] font-bold uppercase tracking-wider text-center rounded">Pre-escucha</a>
                    <button data-id="${song.id}" class="btn-play flex-1 py-2 bg-[#e3bb3e] text-black text-[10px] font-black uppercase tracking-wider rounded active:scale-95">Ya Sonó</button>
                </div>` : ''}
            `;
            
            if(isPending) {
                li.querySelector('.btn-play').addEventListener('click', (e) => {
                    this.updatePedidoEstado(e.target.dataset.id, 'reproducida');
                });
            }

            container.appendChild(li);
        });
    }

    async updatePedidoEstado(id, estado) {
        try {
            const res = await fetch('/api/requests', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ id, estado })
            });

            if (!this.handleApiError(res)) {
                this.fetchPedidos(); // Refrescar listas tras cambiar estado
            }
        } catch (error) {
            console.error('Error actualizando pedido:', error);
        }
    }

    async clearPedidos() {
        if(!confirm('¿Estás seguro de que deseas eliminar TODAS las canciones de la base de datos? Esto vaciará la cola y el historial.')) return;

        try {
            const res = await fetch('/api/requests', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            if (!this.handleApiError(res)) {
                this.queueList.innerHTML = '';
                this.historyList.innerHTML = '';
                this.fetchPedidos();
            }
        } catch (error) {
            console.error('Error limpiando pedidos:', error);
        }
    }

    // ==========================================
    // MÓDULO: GESTIÓN DE EVENTOS (GIGS)
    // ==========================================
    async fetchEventos() {
        try {
            const res = await fetch('/api/gigs'); // GET es público
            const data = await res.json();
            
            if (data.success) {
                this.renderEventos(data.data);
            }
        } catch (error) {
            console.error('Error fetching eventos:', error);
        }
    }

    renderEventos(eventos) {
        this.eventosList.innerHTML = '';
        if (eventos.length === 0) {
            this.eventosList.innerHTML = '<p class="text-xs text-zinc-500 text-center py-4">No hay eventos próximos.</p>';
            return;
        }

        eventos.forEach(ev => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-lg hover:border-zinc-700 transition-colors cursor-pointer group';
            
            // Inyectamos el objeto JSON seguro escapando comillas simples
            const evString = JSON.stringify(ev).replace(/'/g, "&#39;");

            li.innerHTML = `
                <div class="flex-1 min-w-0 pr-3 btn-edit-ev" data-event='${evString}'>
                    <h3 class="text-xs font-bold text-white truncate group-hover:text-[#e3bb3e] transition-colors">${ev.title}</h3>
                    <p class="text-[10px] text-zinc-400 mt-0.5">${ev.date} | ${ev.location}</p>
                </div>
                <button data-id="${ev.id}" class="btn-delete-ev shrink-0 w-8 h-8 flex items-center justify-center bg-zinc-950 text-red-400 rounded hover:bg-red-500 hover:text-white transition-colors border border-zinc-800 relative z-10">
                    <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M3 6v18h18V6H3zm5 14c0 .552-.448 1-1 1s-1-.448-1-1V10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1V10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1V10c0-.552.448-1 1-1s1 .448 1 1v10zm4-18v2H2V2h5.711c.9 0 1.631-1.099 1.631-2h5.315c0 .901.73 2 1.631 2H22z"/></svg>
                </button>
            `;

            // Modo Edición: Cargar datos en el form al hacer clic
            li.querySelector('.btn-edit-ev').addEventListener('click', (e) => {
                const eventData = JSON.parse(e.currentTarget.dataset.event);
                this.loadEventoIntoForm(eventData);
            });

            // Borrado del evento
            li.querySelector('.btn-delete-ev').addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar que dispare la edición accidentalmente
                if(confirm('¿Seguro que deseas eliminar esta fecha y destruir su imagen en R2?')) {
                    this.deleteEvento(e.currentTarget.dataset.id);
                }
            });

            this.eventosList.appendChild(li);
        });
    }

    loadEventoIntoForm(ev) {
        this.evIdInput.value = ev.id;
        document.getElementById('ev-title').value = ev.title;
        document.getElementById('ev-date').value = ev.date;
        document.getElementById('ev-time').value = ev.time;
        document.getElementById('ev-location').value = ev.location;
        document.getElementById('ev-action').value = ev.actionUrl;
        
        // Cambios Visuales UI
        this.btnSubmitEv.textContent = 'Actualizar Evento';
        this.btnSubmitEv.className = 'flex-[2] bg-[#e3bb3e] text-black font-black uppercase text-xs tracking-wider p-3 rounded active:scale-95 transition-transform';
        this.btnCancelEv.classList.remove('hidden');
        
        // El flyer ya existe, no obligamos a subir uno nuevo
        document.getElementById('ev-flyer').removeAttribute('required');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    resetFormularioEventos() {
        this.eventoForm.reset();
        this.evIdInput.value = '';
        
        // Restaurar estado visual inicial (Modo Creación)
        this.btnSubmitEv.textContent = 'Publicar Evento';
        this.btnSubmitEv.className = 'flex-[2] bg-white text-black font-black uppercase text-xs tracking-wider p-3 rounded active:scale-95 transition-transform';
        this.btnCancelEv.classList.add('hidden');
        document.getElementById('ev-flyer').setAttribute('required', 'true');
    }

    async saveEvento() {
        const fileInput = document.getElementById('ev-flyer');
        const file = fileInput.files[0];
        const isEditing = this.evIdInput.value !== '';

        // Usamos FormData para el soporte binario nativo (Files)
        const formData = new FormData();
        if (isEditing) formData.append('id', this.evIdInput.value);
        
        formData.append('title', document.getElementById('ev-title').value);
        formData.append('date', document.getElementById('ev-date').value);
        formData.append('time', document.getElementById('ev-time').value);
        formData.append('location', document.getElementById('ev-location').value);
        formData.append('actionUrl', document.getElementById('ev-action').value);
        formData.append('actionText', '+ Info');
        
        if (file) formData.append('flyerImage', file);

        try {
            const res = await fetch('/api/gigs', {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: formData 
            });

            if (!this.handleApiError(res)) {
                this.resetFormularioEventos();
                this.fetchEventos(); 
                alert(isEditing ? 'Fecha actualizada con éxito.' : 'Fecha publicada con éxito.');
            }
        } catch (error) {
            console.error('Error guardando evento:', error);
            alert('Hubo un error de conexión al procesar el evento.');
        }
    }

    async deleteEvento(id) {
        try {
            const res = await fetch('/api/gigs', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify({ id })
            });

            if (!this.handleApiError(res)) {
                // Si el evento eliminado estaba siendo editado, limpiamos el formulario por seguridad
                if(this.evIdInput.value === id) this.resetFormularioEventos();
                this.fetchEventos(); 
            }
        } catch (error) {
            console.error('Error eliminando evento:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new AdminApp());
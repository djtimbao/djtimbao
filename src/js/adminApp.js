/**
 * • La ruta: src/js/adminApp.js
 * • Que es: Controlador Frontend del Panel de Administración (DJ Panel).
 * • Responsabilidades:
 * 1. Validar autenticación de Google y verificar acceso de nivel Admin.
 * 2. Interfaz de Pedidos Live: Marcar como reproducida o eliminar.
 * 3. Interfaz de Eventos (CRUD): Crear, listar y eliminar próximos eventos.
 */

class AdminApp {
    constructor() {
        this.token = sessionStorage.getItem('djtimbao_admin_jwt') || null;

        // Nodos del DOM
        this.authSection = document.getElementById('auth-section');
        this.appSection = document.getElementById('app-section');
        this.authError = document.getElementById('auth-error');
        this.logoutBtn = document.getElementById('logout-btn');

        // Tabs
        this.tabPedidos = document.getElementById('tab-pedidos');
        this.tabEventos = document.getElementById('tab-eventos');
        this.viewPedidos = document.getElementById('view-pedidos');
        this.viewEventos = document.getElementById('view-eventos');

        // Listas
        this.queueList = document.getElementById('admin-queue-list');
        this.eventosList = document.getElementById('admin-eventos-list');
        
        // Formularios
        this.refreshPedidosBtn = document.getElementById('refresh-pedidos');
        this.eventoForm = document.getElementById('evento-form');

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

        // Formulario de Eventos
        this.eventoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createEvento();
        });
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
                this.renderPedidos(data.data.filter(s => s.estado === 'pendiente'));
            } else {
                this.handleApiError({ status: 403 }); // Forzar logout si llega aquí sin isAdmin
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    renderPedidos(songs) {
        this.queueList.innerHTML = '';
        if (songs.length === 0) {
            this.queueList.innerHTML = '<p class="text-xs text-zinc-500 text-center py-4">Pista limpia. Nadie ha pedido nada aún.</p>';
            return;
        }

        songs.forEach(song => {
            const li = document.createElement('li');
            li.className = 'flex flex-col gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-xl';
            
            li.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${song.miniatura || '/img/djt-logo.jpg'}" class="w-12 h-12 rounded object-cover">
                    <div class="flex-1 min-w-0">
                        <h3 class="text-sm font-bold text-white truncate">${song.titulo}</h3>
                        <p class="text-[10px] text-zinc-400 truncate">${song.artista || 'Desconocido'}</p>
                        <p class="text-[9px] text-[#e3bb3e] mt-0.5">Pedido por: ${song.solicitante_nombre || 'Anónimo'}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <a href="${song.url_original}" target="_blank" class="flex-1 py-2 bg-zinc-800 text-white text-[10px] font-bold uppercase tracking-wider text-center rounded">Pre-escucha</a>
                    <button data-id="${song.id}" class="btn-play flex-1 py-2 bg-[#e3bb3e] text-black text-[10px] font-black uppercase tracking-wider rounded active:scale-95">Ya Sonó</button>
                </div>
            `;
            
            li.querySelector('.btn-play').addEventListener('click', (e) => {
                this.updatePedidoEstado(e.target.dataset.id, 'reproducida');
            });

            this.queueList.appendChild(li);
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
                this.fetchPedidos(); // Refrescar lista tras cambiar estado
            }
        } catch (error) {
            console.error('Error actualizando pedido:', error);
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
            li.className = 'flex items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-lg';
            
            li.innerHTML = `
                <div class="flex-1 min-w-0 pr-3">
                    <h3 class="text-xs font-bold text-white truncate">${ev.title}</h3>
                    <p class="text-[10px] text-zinc-400 mt-0.5">${ev.date} | ${ev.location}</p>
                </div>
                <button data-id="${ev.id}" class="btn-delete-ev w-8 h-8 flex items-center justify-center bg-red-400/10 text-red-400 rounded hover:bg-red-400 hover:text-white transition-colors">
                    <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M3 6v18h18V6H3zm5 14c0 .552-.448 1-1 1s-1-.448-1-1V10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1V10c0-.552.448-1 1-1s1 .448 1 1v10zm5 0c0 .552-.448 1-1 1s-1-.448-1-1V10c0-.552.448-1 1-1s1 .448 1 1v10zm4-18v2H2V2h5.711c.9 0 1.631-1.099 1.631-2h5.315c0 .901.73 2 1.631 2H22z"/></svg>
                </button>
            `;

            li.querySelector('.btn-delete-ev').addEventListener('click', (e) => {
                if(confirm('¿Seguro que deseas eliminar esta fecha?')) {
                    this.deleteEvento(e.currentTarget.dataset.id);
                }
            });

            this.eventosList.appendChild(li);
        });
    }

    async createEvento() {
        const payload = {
            title: document.getElementById('ev-title').value,
            date: document.getElementById('ev-date').value,
            time: document.getElementById('ev-time').value,
            location: document.getElementById('ev-location').value,
            flyerUrl: document.getElementById('ev-flyer').value,
            actionUrl: document.getElementById('ev-action').value,
            actionText: '+ Info'
        };

        try {
            const res = await fetch('/api/gigs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token}` },
                body: JSON.stringify(payload)
            });

            if (!this.handleApiError(res)) {
                this.eventoForm.reset(); // Limpiamos el form
                this.fetchEventos(); // Actualizamos lista
                alert('Fecha publicada con éxito.');
            }
        } catch (error) {
            console.error('Error creando evento:', error);
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
                this.fetchEventos(); // Refrescar lista tras eliminar
            }
        } catch (error) {
            console.error('Error eliminando evento:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new AdminApp());
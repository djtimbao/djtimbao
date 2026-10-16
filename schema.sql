-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    google_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    foto TEXT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Solicitudes de canciones
CREATE TABLE IF NOT EXISTS solicitudes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id TEXT NOT NULL,
    evento_id INTEGER NOT NULL,
    plataforma TEXT CHECK(plataforma IN ('youtube', 'spotify', 'ytmusic')) NOT NULL,
    url_original TEXT NOT NULL,
    titulo TEXT NOT NULL,
    artista TEXT DEFAULT 'Desconocido',
    miniatura TEXT,
    huella_unica TEXT,
    estado TEXT CHECK(estado IN ('pendiente', 'reproducida')) DEFAULT 'pendiente', -- 'pendiente', 'reproducida', 'en_reproduccion'
    orden INTEGER DEFAULT 0,
    fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
    hora_reproduccion DATETIME, -- UTC0
    FOREIGN KEY (usuario_id) REFERENCES usuarios(google_id) ON DELETE CASCADE,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE -- Borrado en cascada si el Admin elimina el evento
);

-- Índice compuesto para acelerar búsquedas masivas por evento + estado
CREATE INDEX IF NOT EXISTS idx_solicitudes_evento_estado ON solicitudes(evento_id, estado);

-- Tabla de Próximas Fechas (Gigs)
CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    flyerUrl TEXT NOT NULL,
    actionUrl TEXT NOT NULL,
    actionText TEXT DEFAULT '+ Info',
    orden INTEGER DEFAULT 0,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);
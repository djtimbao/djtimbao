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
    plataforma TEXT CHECK(plataforma IN ('youtube', 'spotify', 'ytmusic')) NOT NULL,
    url_original TEXT NOT NULL,
    titulo TEXT NOT NULL,
    artista TEXT DEFAULT 'Desconocido',
    miniatura TEXT,
    huella_unica TEXT,
    estado TEXT CHECK(estado IN ('pendiente', 'reproducida')) DEFAULT 'pendiente', -- 'pendiente', 'reproducida', 'en_reproduccion'
    orden INTEGER DEFAULT 0,
    fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(google_id) ON DELETE CASCADE
);

-- Índice para optimizar el filtrado de la cola activa en tiempo real
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes(estado);
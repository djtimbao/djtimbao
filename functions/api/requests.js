// Ruta: functions/api/requests.js
// Responsabilidades:
// 1. GET: Devolver la cola de reproducción y el historial (ocultando datos sensibles al público).
// 2. POST: Recibir nuevas solicitudes, validar duplicados e insertar en Cloudflare D1.

import { getDB } from '../_shared/db.js';
import { extractMetadata } from '../_shared/metadata.js';

// ============================================================================
// [GET] /api/requests - Obtener la lista de canciones
// ============================================================================
export async function onRequestGet(context) {
    try {
        const db = getDB(context.env);
        const user = context.data.user;

        // Extraemos las solicitudes ordenadas. 
        const { results } = await db.prepare(`
            SELECT s.id, s.plataforma, s.url_original, s.titulo, s.miniatura, s.estado, 
                   u.nombre as solicitante_nombre, u.foto as solicitante_foto
            FROM solicitudes s
            LEFT JOIN usuarios u ON s.usuario_id = u.google_id
            ORDER BY 
                CASE WHEN s.estado = 'pendiente' THEN 0 ELSE 1 END,
                s.orden ASC, 
                s.fecha_solicitud ASC
        `).all();

        // SEGURIDAD PÚBLICA: Si no es Admin, borramos los nombres/fotos por privacidad
        const sanitizedResults = results.map(row => {
            if (!user || !user.isAdmin) {
                delete row.solicitante_nombre;
                delete row.solicitante_foto;
            }
            return row;
        });

        return new Response(JSON.stringify({ success: true, data: sanitizedResults }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500
        });
    }
}

// ============================================================================
// [POST] /api/requests - Agregar una nueva canción a la cola
// ============================================================================
export async function onRequestPost(context) {
    try {
        const db = getDB(context.env);
        const user = context.data.user;
        const { url } = await context.request.json();

        // BARRERA: Solo usuarios logueados pueden pedir canciones
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Debes iniciar sesión con Google para pedir un tema.' }), {
                status: 401
            });
        }

        // 1. Extraemos título y miniatura sin usar API Keys
        const metadatos = await extractMetadata(url);

        // 2. Lógica Anti-Duplicados: Verificamos si la URL ya existe en la BD
        const existingRequest = await db.prepare(
            `SELECT estado FROM solicitudes WHERE url_original = ?`
        ).bind(metadatos.url_original).first();

        if (existingRequest) {
            const mensaje = existingRequest.estado === 'pendiente' 
                ? '¡Alguien más ya pidió este temazo! Está en la cola.'
                : 'Esta canción ya sonó en la fiesta. ¡Pide otra!';
            return new Response(JSON.stringify({ success: false, error: mensaje }), {
                status: 409
            });
        }

        // 3. Inserción en Cloudflare D1
        await db.prepare(`
            INSERT INTO solicitudes (usuario_id, plataforma, url_original, titulo, miniatura)
            VALUES (?, ?, ?, ?, ?)
        `).bind(
            user.google_id,
            metadatos.plataforma,
            metadatos.url_original,
            metadatos.titulo,
            metadatos.miniatura
        ).run();

        return new Response(JSON.stringify({ success: true, message: '¡Canción agregada a la cola!' }), {
            status: 201,
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500
        });
    }
}
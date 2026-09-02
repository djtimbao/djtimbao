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
            SELECT s.id, s.plataforma, s.url_original, s.titulo, s.artista, s.miniatura, s.estado, 
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
        
        // Recibimos el payload completo (puede traer { url } o { mode, titulo, artista })
        const payload = await context.request.json();

        // BARRERA: Solo usuarios logueados pueden pedir canciones
        if (!user) {
            return new Response(JSON.stringify({ success: false, error: 'Debes iniciar sesión con Google para pedir un tema.' }), {
                status: 401,
                headers: { 
                    'Content-Type': 'application/json' 
                }
            });
        }

        // 1. Delegamos el procesamiento al motor de metadatos (Modo Link o Modo Manual)
        const metadatos = await extractMetadata(payload);

        // 🛡️ MOTOR ANTI-DUPLICADOS: Busca por Huella Digital en lugar de URL
        const existingRequest = await db.prepare(
            `SELECT estado FROM solicitudes WHERE huella_unica = ?`
        ).bind(metadatos.huella_unica).first();

        if (existingRequest) {
            const mensaje = existingRequest.estado === 'pendiente' 
                ? `¡Alguien más ya pidió "${metadatos.titulo}"! Está en la cola.`
                : `"${metadatos.titulo}" ya sonó en la fiesta. ¡Pide otra!`;
            
            return new Response(JSON.stringify({ success: false, error: mensaje }), {
                status: 409,
                headers: { 
                    'Content-Type': 'application/json' 
                }
            });
        }

        // 3. Inserción en Cloudflare D1
        await db.prepare(`
            INSERT INTO solicitudes (usuario_id, plataforma, url_original, titulo, artista, miniatura, huella_unica)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
            user.google_id, 
            metadatos.plataforma, 
            metadatos.url_original, 
            metadatos.titulo, 
            metadatos.artista,
            metadatos.miniatura,
            metadatos.huella_unica
        ).run();

        return new Response(JSON.stringify({ success: true, message: '¡Canción agregada a la cola!' }), {
            status: 201,
            headers: {
                'Content-Type': 'application/json'
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 
                    'Content-Type': 'application/json' 
            }
        });
    }
}
// Ruta: functions/api/gigs.js
// Responsabilidades:
// 1. GET (Público): Devuelve la lista de eventos para renderizar el carrusel 3D.
// 2. POST (Privado): Permite a los administradores crear nuevas fechas.
// 3. PUT (Privado): Permite editar una fecha existente y destruye el flyer viejo en R2 si se cambia.
// 4. DELETE (Privado): Elimina un evento de la BD y destruye su flyer huérfano en R2.

import { getDB } from '../_shared/db.js';

// ============================================================================
// [HELPER PRIVADO] - Eliminación de archivos en Cloudflare R2
// ============================================================================
async function deleteImageFromR2(env, fileUrl) {
    if (!fileUrl) return;
    try {
        // Extraemos dinámicamente la clave del objeto sin importar si es entorno Dev o Prod
        // Ej: "https://assets.djtimbao.com/flyers/img.webp" -> "flyers/img.webp"
        const urlObj = new URL(fileUrl);
        const objectKey = urlObj.pathname.substring(1); // Remueve el '/' inicial
        
        // Ejecutamos el borrado nativo utilizando el Binding definido en wrangler.toml
        await env.BUCKET_ASSETS.delete(objectKey);
        console.log(`[R2] Archivo destruido con éxito: ${objectKey}`);
    } catch (error) {
        // Capturamos el error silenciosamente para que no rompa la ejecución de la Base de Datos
        // si por alguna razón la imagen ya no existía en el Bucket.
        console.error(`[R2] Fallo al intentar eliminar: ${fileUrl}`, error);
    }
}

// ============================================================================
// [GET] /api/gigs - PÚBLICO: Obtener todas las fechas activas
// ============================================================================
export async function onRequestGet(context) {
    try {
        const db = getDB(context.env);
        
        // Ordenamos por la columna 'orden' y luego por ID
        const { results } = await db.prepare(`
            SELECT id, title, date, time, location, flyerUrl, actionUrl, actionText, orden 
            FROM eventos 
            ORDER BY orden ASC, id ASC
        `).all();

        return new Response(JSON.stringify({ success: true, data: results }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
}

// ============================================================================
// [POST] /api/gigs - ADMIN: Crear nueva fecha
// ============================================================================
export async function onRequestPost(context) {
    try {
        const db = getDB(context.env);
        const user = context.data.user;

        if (!user || !user.isAdmin) {
            return new Response(JSON.stringify({ success: false, error: 'Acceso denegado. Permisos de Admin requeridos.' }), { status: 403 });
        }

        const payload = await context.request.json();
        const { title, date, time, location, flyerUrl, actionUrl, actionText, orden } = payload;

        await db.prepare(`
            INSERT INTO eventos (title, date, time, location, flyerUrl, actionUrl, actionText, orden)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            title, date, time, location, flyerUrl, actionUrl, actionText || '+ Info', orden || 0
        ).run();

        return new Response(JSON.stringify({ success: true, message: 'Evento publicado exitosamente.' }), { status: 201 });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
}

// ============================================================================
// [PUT] /api/gigs - ADMIN: Actualizar evento y limpiar R2
// ============================================================================
export async function onRequestPut(context) {
    try {
        const db = getDB(context.env);
        const user = context.data.user;

        if (!user || !user.isAdmin) {
            return new Response(JSON.stringify({ success: false, error: 'Acceso denegado. Permisos de Admin requeridos.' }), { status: 403 });
        }

        const payload = await context.request.json();
        const { id, title, date, time, location, flyerUrl, actionUrl, actionText, orden } = payload;

        if (!id) return new Response(JSON.stringify({ success: false, error: 'ID del evento requerido.' }), { status: 400 });

        // 1. Consultar el evento anterior para comparar la URL de la imagen
        const oldEvent = await db.prepare('SELECT flyerUrl FROM eventos WHERE id = ?').bind(id).first();

        // 2. Si la imagen cambió, disparamos la orden de destrucción al Bucket R2
        if (oldEvent && oldEvent.flyerUrl && oldEvent.flyerUrl !== flyerUrl) {
            await deleteImageFromR2(context.env, oldEvent.flyerUrl);
        }

        // 3. Actualizar el registro en la BD
        await db.prepare(`
            UPDATE eventos 
            SET title = ?, date = ?, time = ?, location = ?, flyerUrl = ?, actionUrl = ?, actionText = ?, orden = ?
            WHERE id = ?
        `).bind(
            title, date, time, location, flyerUrl, actionUrl, actionText, orden, id
        ).run();

        return new Response(JSON.stringify({ success: true, message: 'Evento actualizado correctamente.' }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
}

// ============================================================================
// [DELETE] /api/gigs - ADMIN: Eliminar evento y vaciar R2
// ============================================================================
export async function onRequestDelete(context) {
    try {
        const db = getDB(context.env);
        const user = context.data.user;

        if (!user || !user.isAdmin) {
            return new Response(JSON.stringify({ success: false, error: 'Acceso denegado. Permisos de Admin requeridos.' }), { status: 403 });
        }

        const payload = await context.request.json();
        const { id } = payload;

        if (!id) return new Response(JSON.stringify({ success: false, error: 'ID del evento requerido.' }), { status: 400 });

        // 1. Rescatar la URL del flyer ANTES de destruir el registro
        const eventToDelete = await db.prepare('SELECT flyerUrl FROM eventos WHERE id = ?').bind(id).first();

        // 2. Si existe un flyer asociado, lo destruimos en el Bucket R2
        if (eventToDelete && eventToDelete.flyerUrl) {
            await deleteImageFromR2(context.env, eventToDelete.flyerUrl);
        }

        // 3. Eliminar definitivamente el evento de Cloudflare D1
        await db.prepare(`DELETE FROM eventos WHERE id = ?`).bind(id).run();

        return new Response(JSON.stringify({ success: true, message: 'Evento y archivo multimedia eliminados.' }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
}
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
// [POST] /api/gigs - ADMIN: Crear nueva fecha (Multipart / File Upload)
// ============================================================================
export async function onRequestPost(context) {
    try {
        const db = getDB(context.env);
        const user = context.data.user;

        if (!user || !user.isAdmin) {
            return new Response(JSON.stringify({ success: false, error: 'Acceso denegado. Permisos requeridos.' }), { status: 403 });
        }

        // 1. Extraer los datos y el archivo binario del FormData
        const formData = await context.request.formData();
        const title = formData.get('title');
        const date = formData.get('date');
        const time = formData.get('time');
        const location = formData.get('location');
        const actionUrl = formData.get('actionUrl');
        const actionText = formData.get('actionText') || '+ Info';
        const file = formData.get('flyerImage');

        if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ success: false, error: 'El archivo de imagen es obligatorio.' }), { status: 400 });
        }

        // 2. Crear nombre único y subir a Cloudflare R2 por Streaming (Costo Cero en Memoria)
        const fileExtension = file.name.split('.').pop() || 'webp';
        // Genera "flyers/1709420000-myevent.webp" para evitar colisiones
        const uniqueFileName = `flyers/${Date.now()}-${title.replace(/[^a-z0-9]/gi, '').toLowerCase()}.${fileExtension}`;
        
        await context.env.BUCKET_ASSETS.put(uniqueFileName, file.stream(), {
            httpMetadata: { contentType: file.type }
        });

        // 3. Ensamblar la URL pública utilizando la variable de entorno
        // Fallback robusto en caso de que falte la barra al final
        const baseUrl = context.env.R2_PUBLIC_URL.replace(/\/$/, ""); 
        const publicFlyerUrl = `${baseUrl}/${uniqueFileName}`;

        // 4. Guardar en Base de Datos D1
        await db.prepare(`
            INSERT INTO eventos (title, date, time, location, flyerUrl, actionUrl, actionText, orden)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            title, date, time, location, publicFlyerUrl, actionUrl, actionText, 0
        ).run();

        return new Response(JSON.stringify({ success: true, message: 'Evento publicado exitosamente.' }), { status: 201 });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
}

// ============================================================================
// [PUT] /api/gigs - ADMIN: Actualizar evento y limpiar R2 (Soporta Multipart)
// ============================================================================
export async function onRequestPut(context) {
    try {
        const db = getDB(context.env); // Conexión centralizada a D1
        const user = context.data.user;

        if (!user || !user.isAdmin) {
            return new Response(JSON.stringify({ success: false, error: 'Acceso denegado. Permisos de Admin requeridos.' }), { status: 403 });
        }

        // 1. Extraer los datos mediante formData en lugar de JSON
        const formData = await context.request.formData();
        const id = formData.get('id');
        const title = formData.get('title');
        const date = formData.get('date');
        const time = formData.get('time');
        const location = formData.get('location');
        const actionUrl = formData.get('actionUrl');
        const actionText = formData.get('actionText') || '+ Info';
        const orden = formData.get('orden') || 0;
        const file = formData.get('flyerImage'); // El archivo es opcional en la edición

        if (!id) return new Response(JSON.stringify({ success: false, error: 'ID del evento requerido.' }), { status: 400 });

        // 2. Obtener el evento actual para saber qué flyerUrl tiene asignado
        const oldEvent = await db.prepare('SELECT flyerUrl FROM eventos WHERE id = ?').bind(id).first();
        if (!oldEvent) return new Response(JSON.stringify({ success: false, error: 'Evento no encontrado.' }), { status: 404 });

        let finalFlyerUrl = oldEvent.flyerUrl; // Por defecto conservamos el viejo

        // 3. Si el administrador subió una NUEVA imagen, la procesamos
        if (file && file instanceof File && file.size > 0) {
            
            // 3.A: Borrar imagen vieja en R2 para ahorrar almacenamiento
            if (oldEvent.flyerUrl) {
                await deleteImageFromR2(context.env, oldEvent.flyerUrl);
            }

            // 3.B: Subir la imagen nueva por streaming
            const fileExtension = file.name.split('.').pop() || 'webp';
            const uniqueFileName = `flyers/${Date.now()}-${title.replace(/[^a-z0-9]/gi, '').toLowerCase()}.${fileExtension}`;
            
            await context.env.BUCKET_ASSETS.put(uniqueFileName, file.stream(), {
                httpMetadata: { contentType: file.type }
            });

            // 3.C: Generar la nueva URL pública
            const baseUrl = context.env.R2_PUBLIC_URL.replace(/\/$/, ""); 
            finalFlyerUrl = `${baseUrl}/${uniqueFileName}`;
        }

        // 4. Actualizar el registro en la BD
        await db.prepare(`
            UPDATE eventos 
            SET title = ?, date = ?, time = ?, location = ?, flyerUrl = ?, actionUrl = ?, actionText = ?, orden = ?
            WHERE id = ?
        `).bind(
            title, date, time, location, finalFlyerUrl, actionUrl, actionText, orden, id
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

        return new Response(JSON.stringify({ success: true, message: 'Evento y flyer eliminados de la plataforma.' }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
}
// Ruta: functions/api/_middleware.js
// Responsabilidades:
// 1. Interceptar todas las peticiones a /api/*.
// 2. Validar el token JWT de Google (Zero Dependencies).
// 3. Registrar o actualizar al usuario en la BD (D1).
// 4. Inyectar los datos del usuario y sus privilegios (isAdmin) en el contexto.

import { getDB } from '../lib/db.js';

export async function onRequest(context) {
    const { request, env, data, next } = context;

    // 1. Manejo amigable de CORS (Preflight)
    if (request.method === 'OPTIONS') {
        return next();
    }

    // 2. Extraer el token de la cabecera Authorization
    const authHeader = request.headers.get('Authorization');
    
    // Si no hay token, lo dejamos pasar como "Anónimo" (Para el GET de la lista pública)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        data.user = null;
        return next(); 
    }

    const token = authHeader.split(' ')[1];

    try {
        // 3. Validar el JWT directamente con Google (Evitamos instalar librerías criptográficas)
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        if (!googleRes.ok) {
            throw new Error('Token inválido o expirado.');
        }
        
        const payload = await googleRes.json();

        // 4. Trazabilidad: Sincronizar el usuario en Cloudflare D1
        const db = getDB(env);
        await db.prepare(`
            INSERT INTO usuarios (google_id, email, nombre, foto) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(google_id) DO UPDATE SET 
                nombre = excluded.nombre, 
                foto = excluded.foto
        `).bind(payload.sub, payload.email, payload.name, payload.picture).run();

        // 5. Asignación de Roles: Verificamos si es DJ/Admin
        const adminEmails = (env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
        const isAdmin = adminEmails.includes(payload.email.toLowerCase());

        // 6. Inyectamos la sesión en el contexto de la petición para que los endpoints la usen
        data.user = {
            google_id: payload.sub,
            email: payload.email,
            nombre: payload.name,
            foto: payload.picture,
            isAdmin: isAdmin
        };

        // Pasamos el control al endpoint final (ej. requests.js)
        return next();

    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: 'Autenticación fallida. Vuelve a iniciar sesión.' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
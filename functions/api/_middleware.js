// Ruta: functions/api/_middleware.js
// Responsabilidades:
// 1. Interceptar todas las peticiones a /api/*.
// 2. Validar el token JWT de Google y verificar el Client ID (aud).
// 3. Registrar o actualizar al usuario en Cloudflare D1.
// 4. Inyectar datos del usuario y rol de administración (isAdmin) en context.data.

import { getDB } from '../_shared/db.js';

const FALLBACK_CLIENT_ID = "274539249936-hi50mbgmp0a20ldrp0thfvj96o8ulm93.apps.googleusercontent.com";

export async function onRequest(context) {
    const { request, env, data, next } = context;

    // 1. Manejo amigable de CORS (Preflight)
    if (request.method === 'OPTIONS') {
        return next();
    }

    // 2. Extraer el token de la cabecera Authorization
    const authHeader = request.headers.get('Authorization');
    
    // Si no hay token, continúa como anónimo (para consultas públicas)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        data.user = null;
        return next(); 
    }

    const token = authHeader.split(' ')[1];

    try {
        // 3. Validar el JWT directamente con el endpoint de Google
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        if (!googleRes.ok) {
            throw new Error('Token inválido o expirado.');
        }
        
        const payload = await googleRes.json();

        // 4. BARRERA DE SEGURIDAD AUD (Client ID): Evita uso de tokens de otras apps de Google
        const expectedClientId = env.GOOGLE_CLIENT_ID || FALLBACK_CLIENT_ID;
        if (payload.aud !== expectedClientId) {
            throw new Error('Token no emitido para esta aplicación.');
        }

        // 5. Trazabilidad: Sincronizar el usuario en Cloudflare D1
        const db = getDB(env);
        await db.prepare(`
            INSERT INTO usuarios (google_id, email, nombre, foto) 
            VALUES (?, ?, ?, ?)
            ON CONFLICT(google_id) DO UPDATE SET 
                nombre = excluded.nombre, 
                foto = excluded.foto
        `).bind(payload.sub, payload.email, payload.name, payload.picture).run();

        // 6. Asignación de Roles: Verificamos si es DJ/Admin
        const adminEmails = (env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
        const isAdmin = adminEmails.includes(payload.email.toLowerCase());

        // 7. Inyectamos la sesión en el contexto de la petición
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
        return new Response(JSON.stringify({ 
            success: false, 
            error: error.message || 'Autenticación fallida. Vuelve a iniciar sesión.' 
        }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
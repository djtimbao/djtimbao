// Ruta: functions/lib/db.js
// Qué es: Helper centralizado para la conexión a la base de datos D1 de Cloudflare.
// Responsabilidades:
// 1. Extraer la instancia de la base de datos D1 del contexto de ejecución de Pages Functions.
// 2. Aplicar Fail-Fast si la base de datos no está conectada o el binding en wrangler.toml es incorrecto.

export function getDB(env) {
  const db = env?.DB_MASTER;

  // BARRERA DE SEGURIDAD (FAIL-FAST)
  if (!db) {
    throw new Error("🔥 FAIL-FAST CRÍTICO: No se pudo establecer la conexión con la base de datos DB_MASTER. Verifica tus bindings en el panel de Cloudflare o en wrangler.toml.");
  }

  return db;
}
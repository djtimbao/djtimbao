/**
 * • La ruta: src/js/config/env.js
 * • Que es: El "Cerebro Central" para la detección de entornos y asignación de infraestructura.
 * • Responsabilidades:
 *   1. Detectar automáticamente el entorno de ejecución (Dev, Test, Prod) basado en el hostname.
 *   2. Centralizar las URLs de servicios externos (ej. Cloudflare R2 Buckets).
 *   3. Aplicar el principio Fail-Fast frontend para configuraciones críticas.
 */

const ENV = {
    DEV: 'development',
    TEST: 'staging',
    PROD: 'production'
};

// 1. Detectar el entorno de forma dinámica
export function getCurrentEnvironment() {
    const hostname = window.location.hostname;

    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        return ENV.DEV;
    }
    // Cloudflare Pages asigna el sufijo .pages.dev a la rama test
    if (hostname.includes('.pages.dev')) {
        return ENV.TEST;
    }
    
    return ENV.PROD;
}

// 2. Patrón Fail-Fast adaptado al cliente
export function requireConfig(name, value) {
    if (!value || value.trim() === '') {
        // Rompemos la ejecución explícitamente para evitar bugs fantasmas
        throw new Error(`🔥 FAIL-FAST CRÍTICO: Falta configurar la constante obligatoria: ${name}`);
    }
    return value;
}

// 3. Obtener la URL del proyecto automáticamente
export function getBaseUrl() {
    return window.location.origin;
}

// 4. Centralizar la infraestructura externa (Ej: Tus dos buckets de R2)
export function getBucketUrl() {
    const currentEnv = getCurrentEnvironment();

    if (currentEnv === ENV.PROD) {
        // Bucket de producción (Custom Domain)
        return requireConfig('R2_PROD_BUCKET', 'https://cdn.djtimbao.com');
    }
    
    // Bucket de desarrollo/pruebas (URL genérica de Cloudflare)
    // REEMPLAZA ESTO CON LA URL DE TU BUCKET DE DESARROLLO
    return requireConfig('R2_TEST_BUCKET', 'https://pub-tu-bucket-test.r2.dev');
}
/**
 * • La ruta: src/js/config/env.js
 * • Que es: El "Cerebro Central" para la detección de entornos y asignación de infraestructura.
 * • Responsabilidades:
 *   1. Detectar automáticamente el entorno de ejecución (Dev, Test, Prod) basado en el hostname.
 *   2. Centralizar las URLs de servicios externos (Cloudflare R2 Buckets).
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
    // Detección de ramas de previsualización en Cloudflare Pages
    if (hostname.includes('.pages.dev') || hostname.startsWith('test.')) {
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

// 3. Obtener la URL base del proyecto
export function getBaseUrl() {
    return window.location.origin;
}

// 4. Centralizar la infraestructura externa (Buckets de R2)
export function getBucketUrl() {
    const currentEnv = getCurrentEnvironment();

    if (currentEnv === ENV.PROD) {
        // Bucket de producción
        return requireConfig('R2_PROD_BUCKET', 'https://assets.djtimbao.com');
    }
    
    // Entorno de desarrollo local y rama test
    return requireConfig('R2_TEST_BUCKET', 'https://assets-test.djtimbao.com');
}
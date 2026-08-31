// Ruta: functions/_shared/metadata.js
// Responsabilidades: 
// 1. Validar y parsear URLs de YouTube, YT Music y Spotify.
// 2. Extraer Título y Miniatura usando el estándar público oEmbed (Zero-Cost, No API Keys).

export async function extractMetadata(url) {
    const cleanUrl = url.trim();
    let platform = 'unknown';
    let oembedUrl = '';

    // Detección de Plataforma
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
        platform = 'youtube';
        // YT Music usa la misma infraestructura de oEmbed que YouTube normal
        oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
    } else if (cleanUrl.includes('spotify.com')) {
        platform = 'spotify';
        oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
    } else {
        throw new Error('Plataforma no soportada. Usa enlaces de YouTube o Spotify.');
    }

    // Fetch de metadatos vía oEmbed
    const response = await fetch(oembedUrl);
    if (!response.ok) {
        throw new Error('No se pudo extraer la información de la canción. Verifica que el enlace sea público.');
    }

    const data = await response.json();

    return {
        plataforma: platform,
        url_original: cleanUrl,
        titulo: data.title,
        // YouTube devuelve thumbnail_url, Spotify devuelve thumbnail_url
        miniatura: data.thumbnail_url || null 
    };
}
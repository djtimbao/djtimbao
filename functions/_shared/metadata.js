// Ruta: functions/_shared/metadata.js
// Responsabilidades: 
// 1. Validar y parsear URLs de YouTube, YT Music y Spotify.
// 2. Extraer Título y Miniatura usando el estándar público oEmbed (Zero-Cost, No API Keys).

// Motor interno para crear la Huella Digital (Fingerprint)
function generarHuella(titulo, artista) {
    const raw = `${titulo} ${artista}`.toLowerCase();
    
    // 1. Eliminar todo lo que esté entre paréntesis o corchetes (ej: "(Official Video)")
    const sinParentesis = raw.replace(/\[.*?\]|\(.*?\)/g, '');
    
    // 2. Eliminar palabras comerciales comunes en YouTube
    const sinBasura = sinParentesis.replace(/official video|video oficial|remix|feat\.?|ft\.?|lyric/g, '');
    
    // 3. Quitar tildes/acentos y dejar estrictamente caracteres alfanuméricos pegados
    const huella = sinBasura
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "");
        
    return huella;
}

export async function extractMetadata(url) {
    const cleanUrl = url.trim();
    const urlLower = cleanUrl.toLowerCase();
    
    // --- 🛡️ VALIDACIÓN BACKEND ANTI-PLAYLISTS ---
    const isSpotify = urlLower.includes('spotify.com');
    
    if (isSpotify && !urlLower.includes('/track/')) {
         throw new Error('El enlace de Spotify debe ser de una canción individual (/track/), no de playlists o álbumes.');
    }
    
    if (!isSpotify && (urlLower.includes('list=') || urlLower.includes('/playlist'))) {
         throw new Error('El enlace de YouTube contiene una lista de reproducción. Envía el tema individual.');
    }

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
    
    const titulo = data.title;
    // En YouTube author_name es el canal, en Spotify es el artista
    const artista = data.author_name || 'Desconocido'; 

    return {
        plataforma: platform,
        url_original: cleanUrl,
        titulo: titulo,
        artista: artista,
        miniatura: data.thumbnail_url || null,
        huella_unica: generarHuella(titulo, artista)
    };
}
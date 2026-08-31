// Ruta: functions/_shared/metadata.js
// Responsabilidades: 
// 1. Validar y parsear URLs de YouTube, YT Music y Spotify.
// 2. Extraer Título y Miniatura usando el estándar público oEmbed (Zero-Cost, No API Keys).

// Motor interno para crear la Huella Digital (Fingerprint)
function generarHuella(titulo, artista) {
    const raw = `${titulo} ${artista}`.toLowerCase();
    
    // 1. Eliminar todo lo que esté entre paréntesis o corchetes (ej: "(Official Video)")
    const sinParentesis = raw.replace(/\[.*?\]|\(.*?\)/g, '');
    
    // 2. Eliminar basura comercial y sufijos automáticos de YouTube
    const sinBasura = sinParentesis.replace(/\b(official video|video oficial|oficial|official|remix|feat\.?|ft\.?|lyric|topic|vevo)\b/g, '');
    
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
    
    // Variables predeterminadas preparadas para el mapeo
    let titulo = '';
    let artista = 'Desconocido';
    let miniatura = null;

    // Detección de Plataforma
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
        platform = 'youtube';
        // YT Music usa la misma infraestructura de oEmbed que YouTube normal
        oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;
        
        // Fetch de metadatos vía oEmbed
        const response = await fetch(oembedUrl);
        if (!response.ok) {
            throw new Error('No se pudo extraer la información de la canción. Verifica que el enlace sea público.');
        }

        const data = await response.json();
        titulo = data.title;
        let rawArtist = data.author_name || 'Desconocido';
        artista = rawArtist.replace(/\s*-\s*Topic\b/gi, '')
                           .replace(/\b(oficial|official|topic|vevo)\b/gi, '')
                           .trim();

        miniatura = data.thumbnail_url || null;

    } else if (cleanUrl.includes('spotify.com')) {
        platform = 'spotify';
        oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
        
        // Fetch de metadatos vía oEmbed
        const response = await fetch(oembedUrl);
        if (!response.ok) {
            throw new Error('No se pudo extraer la información de la canción. Verifica que el enlace sea público.');
        }

        const data = await response.json();
        titulo = data.title;
        miniatura = data.thumbnail_url || null;
        
        // Extracción Zero-Cost del Artista leyendo el DOM de Spotify en el Edge Network
        try {
            const htmlRes = await fetch(cleanUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            const htmlText = await htmlRes.text();
            
            // Spotify inyecta el artista en la etiqueta og:description o title
            const artistMatch = htmlText.match(/<meta property="og:description" content="Listen to [^.]+\. ([^·]+) ·/i);
            if (artistMatch && artistMatch[1]) {
                artista = artistMatch[1].trim();
            } else {
                // Fallback secundario si la etiqueta og:description no está disponible
                const titleMatch = htmlText.match(/<title>.*?(?:by|- Single by)\s+(.*?)\s+\| Spotify<\/title>/i);
                if (titleMatch && titleMatch[1]) {
                    artista = titleMatch[1].trim();
                }
            }
        } catch (e) {
            console.error('Fallo silencioso extrayendo artista de Spotify HTML', e);
        }

    } else {
        throw new Error('Plataforma no soportada. Usa enlaces de YouTube o Spotify.');
    }

    return {
        plataforma: platform,
        url_original: cleanUrl,
        titulo: titulo,
        artista: artista,
        miniatura: miniatura,
        huella_unica: generarHuella(titulo, artista)
    };
}
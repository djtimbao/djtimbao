/**
 * • Ruta: src/js/config/gigs.js
 * • Que es: Gestor dinámico de "Próximas Fechas" (Upcoming Gigs).
 * • Responsabilidades:
 *   1. Centralizar la información de los eventos para desacoplarla del HTML.
 *   2. Generar las URLs absolutas de los flyers utilizando Cloudflare R2 para el Lazy Loading.
 *   3. Proveer una estructura escalable para facilitar la actualización mensual del calendario.
 */

import { getBucketUrl } from './env.js';

// Obtenemos la URL del bucket dinámicamente (Test o Producción)
const BUCKET = getBucketUrl();

export const UPCOMING_GIGS = [
    {
        id: "gig-01",
        title: "Cuba en su salsa",
        date: "04 Sep",
        time: "21:00 Hrs",
        location: "Buenos Aires, CABA",
        // Recuerda subir los flyers en formato .webp (recomendado 800x1200px) a la subcarpeta /assets/ de tu R2
        flyerUrl: `${BUCKET}/flyers/Cuba-en-su-salsa.webp`,
        actionUrl: "https://www.instagram.com/p/DcjutnTOLdz",
        actionText: "+ Info"
    },
    {
        id: "gig-02",
        title: "French 78",
        date: "05 Sep",
        time: "21:00 Hrs",
        location: "Avellaneda, Buenos Aires",
        flyerUrl: `${BUCKET}/flyers/French78.webp`,
        actionUrl: "https://www.instagram.com/p/DcZXl27GVno",
        actionText: "+ Info"
    },
    {
        id: "gig-03",
        title: "La Candonga",
        date: "25 Sep",
        time: "21:00 Hrs",
        location: "Banfield, Uruguay",
        flyerUrl: `${BUCKET}/flyers/la-candonga.webp`,
        actionUrl: "https://www.instagram.com/p/DcWWCTERyi0",
        actionText: "+ Info"
    },
    {
        id: "gig-04",
        title: "5to Aniversario Latimba",
        date: "15 Oct",
        time: "23:00 Hrs",
        location: "San Telmo, Buenos Aires",
        flyerUrl: `${BUCKET}/flyers/latimbao-party.webp`,
        actionUrl: "https://www.instagram.com/latimbao",
        actionText: "+ Info"
    }
];
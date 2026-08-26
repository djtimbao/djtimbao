/**
 * • La ruta: scripts/export-context.js
 * • Que es: Script de utilidad en Node.js para volcar el estado completo del proyecto en un archivo Markdown.
 * • Responsabilidades:
 *   1. Limpiar y sobreescribir el archivo de salida contexto_djtimbao.md.
 *   2. Documentar el stack tecnológico activo y la marca de tiempo de exportación.
 *   3. Generar el árbol de directorios ignorando binarios y dependencias pesadas.
 *   4. Concatenar el contenido de los archivos fuente dentro de bloques de código formateados.
 */

import fs from 'node:fs';
import path from 'node:path';

// Configuración general
const OUTPUT_FILE = 'contexto_djtimbao.md';
const IGNORED_PATHS = [
    'node_modules',
    '.git',
    '.wrangler',
    'package-lock.json',
    'output.css',
    'contexto_djtimbao.md',
    'export-context.js',
    'scripts/export-context.js',
    'earth-timbao.webp',
    'img/earth-timbao.webp',
    OUTPUT_FILE
];

const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.mp4', '.webm', '.ico', '.woff', '.woff2', '.ttf'];

const STACK_INFO = `
## 🛠️ Stack Tecnológico del Proyecto
* **Arquitectura:** Single Page Application (SPA) modularizada con Módulos ES6 nativos.
* **Estilos y CSS:** Tailwind CSS v4 (Compilación nativa con @tailwindcss/cli).
* **Lógica e Interacciones:** Vanilla JavaScript puro (Zero Dependencies) a 60 FPS.
* **Infraestructura & Hosting:** Cloudflare Pages (Edge Network a costo cero).
* **Almacenamiento Multimedia:** Cloudflare R2 Buckets (Dev y Producción).
* **Herramientas de Entorno Local:** Node.js v24+, Wrangler CLI.
`;

function isTextFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return !IGNORED_EXTENSIONS.includes(ext);
}

function getLanguageByExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    const map = {
        '.js': 'javascript',
        '.mjs': 'javascript',
        '.json': 'json',
        '.html': 'html',
        '.css': 'css',
        '.md': 'markdown'
    };
    return map[ext] || '';
}

// 1. Generar Árbol de Directorios
function buildTree(dir, prefix = '') {
    let tree = '';
    const items = fs.readdirSync(dir).filter(item => !IGNORED_PATHS.includes(item));

    items.forEach((item, index) => {
        const fullPath = path.join(dir, item);
        const isLast = index === items.length - 1;
        const pointer = isLast ? '└── ' : '├── ';
        const stat = fs.statSync(fullPath);

        tree += `${prefix}${pointer}${item}\n`;

        if (stat.isDirectory()) {
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            tree += buildTree(fullPath, nextPrefix);
        }
    });

    return tree;
}

// 2. Volcar contenido de archivos
function extractFilesContent(dir, baseDir = '') {
    let content = '';
    const items = fs.readdirSync(dir).filter(item => !IGNORED_PATHS.includes(item));

    items.forEach(item => {
        const fullPath = path.join(dir, item);
        const relativePath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            content += extractFilesContent(fullPath, baseDir);
        } else if (stat.isFile() && isTextFile(item)) {
            const fileData = fs.readFileSync(fullPath, 'utf8');
            const lang = getLanguageByExtension(item);

            content += `\n### 📄 Archivo: \`${relativePath}\`\n\n`;
            content += '```' + lang + '\n';
            content += fileData;
            content += '\n```\n';
        }
    });

    return content;
}

// 3. Función Principal de Exportación
function generateContext() {
    const timestamp = new Date().toLocaleString('es-ES', { 
        timeZoneName: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    let markdown = `# 🎧 Contexto del Proyecto: DJ Timbao Web\n\n`;
    markdown += `> **Fecha y hora de exportación:** ${timestamp}\n\n`;
    markdown += `${STACK_INFO.trim()}\n\n`;
    markdown += `## 📁 Árbol de Directorios\n\n\`\`\`text\n${buildTree(process.cwd())}\`\`\`\n\n`;
    markdown += `## 📝 Contenido de los Archivos del Proyecto\n`;
    markdown += extractFilesContent(process.cwd());

    // Sobreescritura limpia del archivo
    fs.writeFileSync(OUTPUT_FILE, markdown, 'utf8');
    console.log(`✅ Archivo '${OUTPUT_FILE}' generado y sobreescrito con éxito.`);
}

generateContext();
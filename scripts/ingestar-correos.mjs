// Ingesta de los correos/publicaciones de Miguel Miranda Vila (PLAN v2.0 - FASE A)
// Uso: node scripts/ingestar-correos.mjs [--origen ./correos]
//  - Lee los .txt de la carpeta de origen (formato "-//-" a línea por párrafo)
//  - Fusiona con data/posts.json sin duplicados (detecta por num)
//  - Inyecta el mismo resultado en el array postsData embebido de index.html
//    y del HTML raíz ../consejo_medianos_ancianos.html
//  - Actualiza los contadores de texto ("N publicaciones"/"N reflexiones")
//  - Después ejecutar: node scripts/generar-xmls.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const idxOrigen = args.indexOf('--origen');
const ORIGEN = path.resolve(ROOT, idxOrigen !== -1 ? args[idxOrigen + 1] : 'correos');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- Parser ----------
// Cabecera: "-//- EVIDENCIA: 30/10/2026 -//- PUBLICACIÓN Nº: 5010 -//- MÁQUINAS -//- by miguelusdavinchius"
// Resto:    "-//- Evidentemente, el mediano anciano, ..." una línea = un párrafo
function parsearCorreo(texto, fichero) {
    const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const pubes = [];
    let actual = null;

    for (const linea of lineas) {
        const trozos = linea.split(/\s*-\s*\/?\/?-\s*/).map(s => s.trim()).filter(Boolean);
        const esCabecera = trozos.length >= 3
            && /^PUBLICACIÓN\s*Nº:\s*\d+$/i.test(trozos[1])
            && /^by\s+\S+$/.test(trozos[trozos.length - 1]);
        if (esCabecera) {
            if (actual) pubes.push(actual);
            const num = Number(trozos[1].match(/\d+/)[0]);
            const [, tipoYFecha] = trozos[0].split(':'); // "EVIDENCIA: 30/10/2026"
            actual = {
                num,
                tipo: (trozos[0].split(':')[0] || '').trim(),
                fecha: (tipoYFecha || '').trim(),
                tema: trozos[2] === undefined ? '' : trozos[2].replace(/^by\s+\S+$/, '').trim(),
                autor: (trozos.find(t => /^by\s/.test(t)) || '').replace(/^by\s+/, ''),
                parrafos: [],
            };
        } else if (actual) {
            parrafoOContinuacion(actual, linea);
        }
    }
    if (actual) pubes.push(actual);
    if (!pubes.length) console.warn(`   aviso: sin publicaciones reconocidas en ${fichero}`);
    return pubes.filter(p => p.num >= 1000 && /^\d{2}\/\d{2}\/\d{4}$/.test(p.fecha));
}

function parrafoOContinuacion(actual, linea) {
    const limpio = linea.replace(/^-\s*\/?\/?-\s*/, '').replace(/^-\s*/, '').trim();
    if (limpio) actual.parrafos.push(limpio);
}

function fechaLegible(ddMmYyyy) {
    const [d, m, y] = ddMmYyyy.split('/');
    return `${Number(d)} de ${MESES[Number(m) - 1]} de ${y}`;
}

const LEMA = /^(AMAR,\s*ALEGRÍA,\s*PAZ,\s*BIEN\s*y\s*PERDÓN\.?)$/i;

function aPost(p, meta) {
    const cuerpo = [`<p class="mb-3"><strong>Publicación Nº ${p.num} (${fechaLegible(p.fecha)})</strong></p>`];
    for (const raw of p.parrafos) {
        const t = raw.trim();
        if (!t) continue;
        if (LEMA.test(t)) {
            cuerpo.push(`<p class="mb-3 italic">"AMAR, ALEGRÍA, PAZ, BIEN Y PERDÓN."</p>`);
        } else {
            cuerpo.push(`<p class="mb-3">${esc(t)}</p>`);
        }
    }
    const indentado = cuerpo.map(x => '                    ' + x).join('\n');
    const content = `\n${indentado}\n                `;
    return {
        id: String(p.num),
        num: p.num,
        date: p.fecha,
        category: meta?.category || 'Sociedad y Democracia',
        title: meta?.title || `#${p.num} ${p.tema || p.tipo || 'REFLEXIÓN'}`,
        excerpt: meta?.excerpt || '',
        content,
        icon: meta?.icon || 'fa-feather-pointed',
    };
}

// ---------- Carga de origen ----------
const metaPorNum = JSON.parse(fs.readFileSync(path.join(ORIGEN, 'meta.json'), 'utf8'));
const ficheros = fs.readdirSync(ORIGEN).filter(f => f.endsWith('.txt')).sort();
console.log(`Archivos de correos: ${ficheros.length}`);

const reconocidas = [];
for (const f of ficheros) {
    const texto = fs.readFileSync(path.join(ORIGEN, f), 'utf8');
    reconocidas.push(...parsearCorreo(texto, f));
}
console.log(`Publicaciones reconocidas: ${reconocidas.length} → ${reconocidas.map(p => p.num).join(', ')}`);

// ---------- Fusión con data/posts.json ----------
const rutaPosts = path.join(ROOT, 'data', 'posts.json');
const posts = JSON.parse(fs.readFileSync(rutaPosts, 'utf8'));
const existentes = new Set(posts.map(p => p.num));

const aAnadir = [];
for (const p of reconocidas) {
    if (existentes.has(p.num)) { console.log(`   duplicado: #${p.num} ya está en posts.json (omitido)`); continue; }
    const meta = metaPorNum[p.num];
    aAnadir.push(aPost(p, meta));
}

const totalFinal = posts.length + aAnadir.length;
if (aAnadir.length) {
    posts.push(...aAnadir);
    posts.sort((a, b) => b.num - a.num); // cronológico inverso (nuevo primero)
    fs.writeFileSync(rutaPosts, JSON.stringify(posts, null, 2), 'utf8');
    console.log(`posts.json: ${posts.length} posts (añadidos ${aAnadir.length})`);
} else {
    console.log(`posts.json sin cambios (${posts.length} posts)`);
}

// ---------- Inyección en los HTML con postsData embebido ----------
function formarBloqueHtml(post) {
    const linasContenido = post.content
        .replace(/^\n/, '')
        .replace(/\n\s*$/, '')
        .split('\n');
    return [
        `            {`,
        `                id: "${post.id}",`,
        `                num: ${post.num},`,
        `                date: "${post.date}",`,
        `                category: "${post.category}",`,
        `                title: ${JSON.stringify(post.title)},`,
        `                excerpt: ${JSON.stringify(post.excerpt)},`,
        `                content: \`${linasContenido.join('\n')}\n                \`,`,
        `                icon: "${post.icon}"`,
        `            },`,
    ].join('\n');
}

const htmlPaths = [
    path.join(ROOT, 'index.html'),
    path.resolve(ROOT, '..', 'consejo_medianos_ancianos.html'),
];
for (const htmlPath of htmlPaths) {
    if (!fs.existsSync(htmlPath)) { console.warn(`   no existe: ${htmlPath}`); continue; }
    let html = fs.readFileSync(htmlPath, 'utf8');
    const marca = 'const postsData = [';
    const pos = html.indexOf(marca);
    if (pos === -1) { console.warn(`   sin postsData embebido: ${htmlPath}`); continue; }

    const numsHtml = new Set([...html.matchAll(/num:\s*(\d+),/g)].map(m => Number(m[1])));
    const faltantes = aAnadir.filter(p => !numsHtml.has(p.num)).sort((a, b) => b.num - a.num);
    const bloque = faltantes.map(formarBloqueHtml).join('\n');
    const corte = pos + marca.length;
    html = html.slice(0, corte) + bloque + html.slice(corte);

    // Contadores de texto desfasados
    html = html
        .replace(/(sobre las )(\d+)( publicaciones)/g, (mm, a, _n, b) => `${a}${totalFinal}${b}`)
        .replace(/(disposición las )(\d+)( reflexiones)/g, (mm, a, _n, b) => `${a}${totalFinal}${b}`)
        .replace(/(Pregúntale sobre las )(\d+)( reflexiones)/g, (mm, a, _n, b) => `${a}${totalFinal}${b}`)
        .replace(/(CON LAS )(\d+)( PUBLICACIONES COMPLETAS)/g, (mm, a, _n, b) => `${a}${totalFinal}${b}`)
        .replace(/(Reflexiones \()(\d+)(\))/g, (mm, a, _n, b) => `${a}${totalFinal}${b}`);

    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`${path.basename(htmlPath)}: +${faltantes.length} posts embebidos (${totalFinal} en total)`);
}

console.log('\nRecuerda: node scripts/generar-xmls.mjs');

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// Caracteres que provienen de bytes CP1252 0x80-0x9F cuando UTF-8 se leyó como ANSI
const CP1252_HIGH = {
    '\u20AC': 0x80, '\u201A': 0x82, '\u0192': 0x83, '\u201E': 0x84, '\u2026': 0x85,
    '\u2020': 0x86, '\u2021': 0x87, '\u02C6': 0x88, '\u2030': 0x89, '\u0160': 0x8A,
    '\u2039': 0x8B, '\u0152': 0x8C, '\u017D': 0x8E, '\u2018': 0x91, '\u2019': 0x92,
    '\u201C': 0x93, '\u201D': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
    '\u02DC': 0x98, '\u2122': 0x99, '\u0161': 0x9A, '\u203A': 0x9B, '\u0153': 0x9C,
    '\u017E': 0x9E, '\u0178': 0x9F
};
// Caracteres de rango C1 que también aparecen si se guardó como ISO-8859-1:
const C1 = {};
for (let i = 0x80; i <= 0x9F; i++) C1[String.fromCharCode(i)] = i;

function detectar(txt) {
    // huellas típicas: Ã, Â, â€, Â», Ã©...
    return /[ÃÂâ][\u0080-\u00FF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/.test(txt);
}

function reparar(txt) {
    // paso 1: volver los caracteres CP1252 altos / C1 a sus bytes originales
    let reconstruido = '';
    for (const ch of txt) {
        if (Object.prototype.hasOwnProperty.call(CP1252_HIGH, ch)) reconstruido += String.fromCharCode(CP1252_HIGH[ch]);
        else if (Object.prototype.hasOwnProperty.call(C1, ch)) reconstruido += String.fromCharCode(C1[ch]);
        else reconstruido += ch;
    }
    // paso 2: cada char de 1-2 bytes -> byte latin1 -> decodificar como UTF-8
    return Buffer.from(reconstruido, 'latin1').toString('utf8');
}

const CANDIDATOS = [
    'index.html',
    'admin.html',
    'netlify/functions/openrouter.js',
    'netlify/functions/propuestas.js',
    'netlify/functions/mensajes.js',
    'rss.xml',
    'favicon.svg',
    'manifest.webmanifest',
    'sw.js',
    'netlify.toml'
];

for (const rel of CANDIDATOS) {
    const p = path.join(ROOT, rel);
    const raw = fs.readFileSync(p);
    const txt = raw.toString('utf8');
    if (!detectar(txt)) {
        console.log(`ok          ${rel}`);
        continue;
    }
    const fixed = reparar(txt);
    if (detectar(fixed)) {
        // segunda pasada para dobles codificaciones (Ã“ -> O etc. anidadas)
        const fixed2 = reparar(fixed);
        if (!detectar(fixed2)) {
            fs.copyFileSync(p, p + '.mojibake-bak');
            fs.writeFileSync(p, fixed2, 'utf8');
            console.log(`reparado x2 ${rel}`);
            continue;
        }
        console.log(`REVISAR     ${rel}  (no se pudo reparar limpiamente)`);
        continue;
    }
    fs.copyFileSync(p, p + '.mojibake-bak');
    fs.writeFileSync(p, fixed, 'utf8');
    console.log(`reparado    ${rel}`);
}

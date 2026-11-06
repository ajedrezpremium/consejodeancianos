// Validador de posts (PLAN v2.0 - FASE A.2)
// Uso: node scripts/validar-posts.mjs
// Genera informe-ingesta.txt

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CATEGORIAS = new Set(['Movilidad', 'Sociedad y Democracia', 'Defensa', 'Vivienda', 'Salud e Higiene', 'Historia Personal', 'Salud General', 'Educación']);
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8'));

const errores = [];
const avisos = [];
const nums = posts.map(p => p.num);
const dup = nums.filter((n, i) => nums.indexOf(n) !== i);

// 1. duplicados
if (dup.length) errores.push(`Números duplicados: ${[...new Set(dup)].join(', ')}`);

// 2. campos obligatorios y formatos
for (const p of posts) {
    if (!p.id) errores.push(`#${p.num}: falta id`);
    if (p.id !== String(p.num)) errores.push(`#${p.num}: id (${p.id}) ≠ num`);
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(p.date)) errores.push(`#${p.num}: fecha mal formada "${p.date}"`);
    if (!CATEGORIAS.has(p.category)) errores.push(`#${p.num}: categoría fuera de lista "${p.category}"`);
    if (!p.title || !p.title.startsWith('#' + p.num)) avisos.push(`#${p.num}: título no empieza por #${p.num}`);
    if (!p.excerpt || p.excerpt.length < 10) avisos.push(`#${p.num}: excerpt corto/vacío`);
    if (!p.content || p.content.length < 40) errores.push(`#${p.num}: content vacío o muy corto`);
    if (!p.icon) avisos.push(`#${p.num}: sin icono`);
}

// 3. huecos de numera (informativo)
const sorted = [...nums].sort((a, b) => a - b);
const huecos = [];
for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i] - sorted[i - 1];
    if (diff > 1) huecos.push(`${sorted[i - 1]}→${sorted[i]} (faltan ${diff - 1})`);
}

// 4. orden
const descOk = posts.every((p, i, a) => i === 0 || a[i - 1].num >= p.num);

const informe = [
    `INFORME DE VALIDACIÓN — CONSEJO MEDIANOS ANCIANOS`,
    `Fecha: ${new Date().toISOString().slice(0, 10)}`,
    `Publicaciones: ${posts.length} (del #${Math.min(...nums)} al #${Math.max(...nums)})`,
    `Orden descendente correcto: ${descOk ? 'SÍ' : 'NO'}`,
    ``,
    `ERRORES (${errores.length}):`,
    ...(errores.length ? errores.map(e => '  - ' + e) : ['  (ninguno)']),
    ``,
    `AVISOS (${avisos.length}):`,
    ...(avisos.length ? avisos.map(a => '  - ' + a) : ['  (ninguno)']),
    ``,
    `HUECOS DE NUMERACIÓN (${huecos.length}):`,
    ...(huecos.length ? huecos.map(h => '  - ' + h) : ['  (ninguno)']),
    ``,
    `Categorías usadas: ${[...new Set(posts.map(p => p.category))].join(', ')}`,
    `Resultado: ${errores.length === 0 ? 'VALIDACIÓN OK' : 'VALIDACIÓN CON ERRORES'}`,
].join('\n');

fs.writeFileSync(path.join(ROOT, 'informe-ingesta.txt'), informe, 'utf8');
console.log(informe);
console.log('\nGuardado en informe-ingesta.txt');

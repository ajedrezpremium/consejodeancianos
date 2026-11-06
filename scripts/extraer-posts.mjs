import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const htmlPath = path.join(ROOT, 'index.html') ;
const html = fs.readFileSync(htmlPath, 'utf8');

const start = html.indexOf('const postsData = [');
const endMarker = '];\n\n        // RENDERIZADO';
let end = html.indexOf(endMarker);
let block;
if (end === -1) {
    const arrStart = html.indexOf('[', start);
    const arrEnd = html.indexOf('];', arrStart);
    block = 'const postsData = ' + html.slice(arrStart, arrEnd + 1) + ';';
} else {
    block = html.slice(start, end + 2);
}

const postsData = (0, eval)(`(() => { ${block}; return postsData; })()`);

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(
    path.join(ROOT, 'data', 'posts.json'),
    JSON.stringify(postsData, null, 2),
    'utf8'
);

console.log(`Extraidos ${postsData.length} posts -> data/posts.json`);

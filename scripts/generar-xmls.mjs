import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SITE = 'https://consejodeancianos.netlify.app';

const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8'));

// ---------- RSS 2.0 ----------
function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripHtml(html) {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function toRfc822(yyyyMmDd) {
    const [d, m, y] = yyyyMmDd.split('/');
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const mesesFull = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const fecha = new Date(Number(y), Number(m) - 1, Number(d));
    return `${fecha.toString().slice(0, 3)}, ${d.padStart(2, '0')} ${mesesFull[Number(m)-1]} ${y} 00:00:00 +0200`;
}

const items = posts.map(p => `
    <item>
        <title>${esc(p.title)}</title>
        <link>${SITE}/#publicaciones</link>
        <guid isPermaLink="false">post-${p.num}</guid>
        <pubDate>${toRfc822(p.date)}</pubDate>
        <description>${esc(p.excerpt)}</description>
        <category>${esc(p.category)}</category>
    </item>`).join('\n');

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>CONSEJO MEDIANOS ANCIANOS - Reflexiones de Miguel Miranda Vila</title>
<link>${SITE}/</link>
<description>Espacio virtual para pensar y mejorar la sociedad. Reflexiones sobre movilidad, vivienda, salud, pensiones, paz y democracia.</description>
<language>es</language>
<lastBuildDate>${toRfc822(posts[0].date)}</lastBuildDate>
${items}
</channel></rss>`;

fs.writeFileSync(path.join(ROOT, 'rss.xml'), rss, 'utf8');

// ---------- sitemap.xml ----------
const fns = ['', '/#publicaciones', '/#propuestas', '/#ia-agent', '/#contacto'].map(x => {
    const priority = x === '' ? '1.0' : '0.7';
    return `\t<url><loc>${SITE}/${x}</loc><priority>${priority}</priority></url>`;
}).join('\n');

const sm = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${fns}
</urlset>`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sm, 'utf8');

// ---------- robots.txt ----------
fs.writeFileSync(
    path.join(ROOT, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /admin.html\n\nSitemap: ${SITE}/sitemap.xml\n`,
    'utf8'
);

console.log(`rss.xml (${posts.length} items), sitemap.xml y robots.txt generados`);

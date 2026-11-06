const fs = require('fs');
const path = require('path');

let postsCache = null;
function loadPosts() {
    if (postsCache) return postsCache;
    const candidates = [
        path.join(process.cwd(), 'data', 'posts.json'),
        path.join(__dirname, '..', 'data', 'posts.json'),
    ];
    for (const p of candidates) {
        try { postsCache = JSON.parse(fs.readFileSync(p, 'utf8')); return postsCache; } catch (e) {}
    }
    postsCache = [];
    return postsCache;
}

function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = (req, res) => {
    const num = String(req.query.num || '').trim();
    const posts = loadPosts();
    const post = posts.find(p => String(p.num) === num || String(p.id) === num);

    if (!post) {
        res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>No encontrado — Consejo Medianos Ancianos</title></head><body style="font-family:sans-serif;padding:2rem"><h1>Publicación no encontrada</h1><p>No existe la publicación #${esc(num)}.</p><p><a href="/">Volver al inicio</a></p></body></html>`);
        return;
    }

    const title = `${post.title} — Consejo Medianos Ancianos`;
    const desc = (post.excerpt || '').slice(0, 200);
    const url = `https://consejodeancianos.vercel.app/r/${post.num}`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(post.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="Consejo Medianos Ancianos">
<meta property="og:locale" content="es_ES">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(post.title)}">
<meta name="twitter:description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 min-h-screen">
<div class="max-w-3xl mx-auto px-4 py-10">
  <a href="/" class="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400 text-sm font-bold mb-6 hover:underline"><i class="fa-solid fa-arrow-left"></i> Volver al archivo</a>
  <article class="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
    <div class="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400 mb-3">
      <span class="bg-sky-100 dark:bg-sky-950 px-2.5 py-1 rounded-md"><i class="fa-solid ${esc(post.icon)}"></i> ${esc(post.category)}</span>
      <span>${esc(post.date)}</span>
    </div>
    <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-4 leading-tight">${esc(post.title)}</h1>
    <div class="prose dark:prose-invert text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed mb-6">${post.content}</div>
    <div class="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl mb-6 text-xs text-amber-900 dark:text-amber-300 font-medium italic">
      "AMAR, ALEGRÍA, PAZ, BIEN Y PERDÓN" — Miguel Miranda Vila
    </div>
    <div class="flex flex-wrap gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
      <button onclick="speakText(document.querySelector('article').innerText)" class="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow transition">
        <i class="fa-solid fa-volume-high"></i> Escuchar
      </button>
      <button onclick="shareWhatsApp('${esc(post.title)}\\n\\n${esc(post.excerpt)}\\n\\n${esc(url)}')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow transition">
        <i class="fa-brands fa-whatsapp"></i> WhatsApp
      </button>
      <button onclick="shareTwitter('${esc(post.title)}')" class="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow transition">
        <i class="fa-brands fa-x-twitter"></i> X
      </button>
      <button onclick="copyLink()" class="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow transition">
        <i class="fa-solid fa-link"></i> Copiar enlace
      </button>
    </div>
  </article>
  <p class="text-center text-xs text-slate-400 mt-6">Consejo Medianos Ancianos · Miguel Miranda Vila · migueldavinci@hotmail.es</p>
</div>
<script>
function speakText(text){ if('speechSynthesis' in window){ window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text.replace(/<[^>]*>?/gm,'')); u.lang='es-ES'; u.rate=0.9; window.speechSynthesis.speak(u);} }
function shareWhatsApp(t){ window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank','noopener'); }
function shareTwitter(t){ window.open('https://twitter.com/intent/tweet?text='+encodeURIComponent(t.slice(0,240))+'&url='+encodeURIComponent('${esc(url)}'),'blank','noopener'); }
function copyLink(){ navigator.clipboard.writeText('${esc(url)}').then(()=>alert('Enlace copiado')); }
</script>
</body>
</html>`;

    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
};

const fs = require('fs');
const path = require('path');

// ============ CARGA DEL ARCHIVO DE PUBLICACIONES (con cache) ============
let postsCache = null;

// ============ RATE LIMIT (el key gratuito tiene ~50 peticiones/día) ============
const RATE_LIMIT_PER_MIN = 8;
const rateMap = new Map(); // ip -> timestamps de las últimas peticiones

function checkRateLimit(ip) {
    const now = Date.now();
    const windowStart = now - 60000;
    const prev = (rateMap.get(ip) || []).filter(ts => ts > windowStart);
    if (prev.length >= RATE_LIMIT_PER_MIN) {
        rateMap.set(ip, prev);
        return false;
    }
    prev.push(now);
    rateMap.set(ip, prev);
    // limpieza evasiva de IPs viejas para no crecer sin fin
    if (rateMap.size > 5000) {
        const cutoff = windowStart;
        for (const [k, v] of rateMap) {
            if (!v.some(ts => ts > cutoff)) rateMap.delete(k);
        }
    }
    return true;
}

function loadPosts() {
    if (postsCache) return postsCache;

    const candidates = [
        path.join(__dirname, '..', 'data', 'posts.json'),
        path.join(__dirname, '..', '..', 'data', 'posts.json'),
        path.join(__dirname, '..', '..', '..', 'data', 'posts.json'),
        path.join(process.cwd(), 'data', 'posts.json')
    ];

    for (const p of candidates) {
        try {
            postsCache = JSON.parse(fs.readFileSync(p, 'utf8'));
            return postsCache;
        } catch (e) { /* siguiente ruta */ }
    }

    postsCache = [];
    return postsCache;
}

// ============ BUSCADOR (RAG) SIMPLE ORIENTADO A ESPAÑOL ============
function normalize(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

const STOPWORDS = new Set([
    'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'e',
    'que', 'con', 'sin', 'para', 'por', 'del', 'al', 'a', 'en', 'es', 'sobre',
    'se', 'su', 'sus', 'lo', 'como', 'mas', 'me', 'mi', 'te', 'nos', 'son',
    'hay', 'le', 'les', 'ha', 'han', 'the', 'pero', 'esta', 'este'
]);

function stripHtml(html) {
    return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

function tokenize(str) {
    const normalized = stripHtml(normalize(str));
    return normalized
        .replace(/[^a-z0-9#]+/g, ' ')
        .split(' ')
        .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

function scorePost(post, tokens) {
    if (tokens.length === 0) return 0;
    const titleT = tokenize(post.title).join(' ');
    const catT = tokenize(post.category).join(' ');
    const bodyT = tokenize(post.excerpt + ' ' + stripHtml(post.content)).join(' ');
    const numStr = String(post.num);

    let score = 0;
    for (const t of tokens) {
        if (numStr === t) score += 25;
        else if (numStr.includes(t)) score += 10;
        if (titleT.includes(t)) score += 6;
        if (catT.includes(t)) score += 4;
        if (bodyT.includes(t)) score += 1.5;
    }
    return score;
}

function searchPosts(query, topN) {
    const posts = loadPosts();
    if (!posts.length) return [];
    const tokens = tokenize(query);
    if (tokens.length === 0) return [];

    const scored = posts
        .map(post => ({ post, score: scorePost(post, tokens) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);

    return scored.map(x => x.post);
}

function buildContextBlock(results) {
    if (!results.length) return '';
    const parts = results.map(post => {
        const clean = stripHtml(post.content).trim().slice(0, 1500);
        return `[Publicación #${post.num} (${post.date}, categoría: ${post.category})] Título: ${post.title}. Resumen: ${post.excerpt} Texto: ${clean}`;
    });
    return '\nReferencias directas extraídas del archivo de publicaciones de Miguel Miranda Vila:\n' + parts.join('\n\n');
}

// ============ PROMPT SISTEMA DEL AGENTE ============
function buildSystemPrompt(contextBlock) {
    const base = `
        Eres "El Mediano Anciano", el Agente de Inteligencia Artificial oficial de la plataforma "CONSEJO MEDIANOS ANCIANOS", representando fielmente el pensamiento de Miguel Miranda Vila (migueldavinci@hotmail.es / migueldavinci).

        La misión de plataforma es crear un espacio virtual para pensar y mejorar la sociedad.

        Tu conocimiento proviene del archivo completo de publicaciones de Miguel Miranda Vila (temas: movilidad, vehículos eléctricos, vivienda como derecho, salud e higiene auditiva, subtítulos, pensiones, voto y democracia, vocación, defensa, "Ministerio de Defensa vs Guerra", Ucrania y neutralidad, desfiles, Ceuta/Melilla/Gibraltar, DGT).

        Si el usuario pregunta algo no cubierto claramente por el archivo, responde como pensamiento propio del Mediano Anciano de forma razonable, coherente con sus valores (justicia social, envejecimiento digno, paz, acceso universal), y aclara que no consta en el archivo con ese número concreto.

        Responde con sabiduría, amabilidad, estilo claro y pausado, orientado a personas de mediana y avanzada edad.
        Cierra tus respuestas largas recordando o inspirándote en el lema: "AMAR, ALEGRÍA, PAZ, BIEN Y PERDÓN".
    `;
    return base + (contextBlock || '');
}

const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Solo se admite POST' }) };
    }

    const clientIp = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
    if (!checkRateLimit(clientIp)) {
        return {
            statusCode: 429,
            headers: { 'Retry-After': '15' },
            body: JSON.stringify({ error: 'Demasiadas consultas en poco tiempo. Espera un momento, por favor.' })
        };
    }

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
        return { statusCode: 500, body: JSON.stringify({ error: 'OPENROUTER_API_KEY no configurada' }) };
    }

    let prompt = '';
    let history = [];
    try { ({ prompt, history } = JSON.parse(event.body || '{}')); } catch (e) {}
    if (!prompt || typeof prompt !== 'string') {
        return { statusCode: 400, body: JSON.stringify({ error: 'Falta el campo prompt' }) };
    }
    if (!Array.isArray(history)) history = [];
    history = history.slice(-10);

    // RAG: localizar las publicaciones relevantes (sobre TODO el archivo)
    const relevant = searchPosts(prompt, 6);
    const contextBlock = buildContextBlock(relevant);
    const systemPrompt = buildSystemPrompt(contextBlock);

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: prompt }
    ];

    const models = [
        'nvidia/nemotron-3.5-lightning:free',
        'minimax/minimax-m3.1-flash:free',
        'google/gemma-4-31b-it:free'
    ];

    for (const model of models) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify({ model, messages })
            });

            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                console.warn(`Modelo ${model} -> HTTP ${response.status}: ${detail.slice(0, 200)}`);
                continue;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content, model, postsUrl: relevant.map(p => '#' + p.num) })
                };
            }
        } catch (err) {
            console.warn(`Fallo con modelo ${model}: ${err}`);
        }
    }

    return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Ningún modelo gratuito disponible en este momento' })
    };
};

module.exports = { handler, searchPosts, buildContextBlock, buildSystemPrompt };

// ============ ACCESO A NETLIFY BLOBS (via API directa del sitio) ============
function openStore() {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_API_TOKEN;
    if (siteID && token) {
        return getStore({ name: 'propuestas', siteID, token });
    }
    return getStore('propuestas');
}

const { getStore, connectLambda } = require('@netlify/blobs');

// ============ FORMATO/VALIDACIÓN ============
function sanitize(str, max) {
    return String(str || '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}

const CATEGORIAS = new Set([
    'Movilidad y Vehículos de Usar y Dejar',
    'Derecho a la Vivienda Constitucional',
    'Salud e Higiene Auditiva y Subtítulos',
    'Pensiones Públicas y Dignidad Senior',
    'Defensa y Reflexión Geopolítica',
    'Valores Sociales y Democracia'
]);

// ==== registro de envíos por IP (par de almacenamiento simple en memoria) ====
const postMap = new Map();
function tooFast(ip) {
    const now = Date.now();
    const last = postMap.get(ip) || 0;
    if (now - last < 30000) return true;
    postMap.set(ip, now);
    if (postMap.size > 5000) {
        for (const [k, v] of postMap) if (now - v > 3600000) postMap.delete(k);
    }
    return false;
}

const handler = async (event) => {
    // Modo compatibilidad Lambda: conectar el contexto de Blobs manualmente
    connectLambda(event);
    const method = event.httpMethod;
    const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
    const store = openStore();

    // -------- LISTA PÚBLICA: propuestas APROBADAS --------
    if (method === 'GET') {
        try {
            const { blobs } = await store.list();
            const items = [];
            for (const b of blobs.filter(x => x.key.startsWith('aprobada:'))) {
                const data = await store.get(b.key, { type: 'json' });
                if (data) items.push(data);
            }
            items.sort((a, b) => b.aprobadoEn - a.aprobadoEn);
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propuestas: items.slice(0, 100) }) };
        } catch (err) {
            console.error('GET propuestas:', err);
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propuestas: [] }) };
        }
    }

    if (method !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Solo GET o POST' }) };
    }

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    let action = 'enviar';
    if (body && typeof body === 'object' && typeof body.action === 'string') action = body.action;

    // -------- ENVIAR NUEVA PROPUESTA (pública, con login automático calmo) --------
    if (action === 'enviar') {
        if (tooFast(ip)) {
            return { statusCode: 429, body: JSON.stringify({ error: 'Ya has enviado una propuesta hace poco. Espera 30 segundos, por favor.' }) };
        }
        const nombre = sanitize(body.nombre, 80);
        const email = sanitize(body.email, 120);
        const categoria = CATEGORIAS.has(body.categoria) ? body.categoria : 'Valores Sociales y Democracia';
        const texto = sanitize(body.texto, 1500);
        if (!texto || texto.length < 10) {
            return { statusCode: 400, body: JSON.stringify({ error: 'La propuesta es demasiado corta.' }) };
        }

        const id = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        const registro = { id, nombre, email: email || '(sin correo)', categoria, texto, enviadaEn: Date.now() };
        try {
            await store.set('pendiente:' + id, JSON.stringify(registro));
        } catch (err) {
            console.error('Guardar propuesta:', err);
            return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo guardar la propuesta. Inténtalo más tarde.' }) };
        }
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: true, mensaje: 'Propuesta enviada al Consejo. Gracias por participar en mejorar la sociedad.' })
        };
    }

    // -------- MODERACIÓN (requiere ADMIN_TOKEN) --------
    const token = sanitize(body.token, 200);
    let adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
        return { statusCode: 500, body: JSON.stringify({ error: 'ADMIN_TOKEN no configurado en el servidor' }) };
    }
    if (token !== adminToken) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Token de moderación incorrecto' }) };
    }

    if (action === 'listar') {
        const items = [];
        try {
            const { blobs } = await store.list();
            for (const b of blobs.filter(x => x.key.startsWith('pendiente:'))) {
                const data = await store.get(b.key, { type: 'json' });
                if (data) items.push(data);
            }
        } catch (err) {
            console.error('Listar pendientes:', err);
        }
        items.sort((a, b) => b.enviadaEn - a.enviadaEn);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pendientes: items, ok: true }) };
    }

    if (action === 'aprobar' || action === 'rechazar') {
        const id = sanitize(body.id, 120);
        try {
            const data = await store.get('pendiente:' + id, { type: 'json' });
            if (!data) return { statusCode: 404, body: JSON.stringify({ error: 'Propuesta no encontrada' }) };
            if (action === 'aprobar') {
                const aprobada = { ...data, aprobadoEn: Date.now() };
                await store.set('aprobada:' + id, JSON.stringify(aprobada));
            }
            await store.delete('pendiente:' + id);
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
        } catch (err) {
            console.error('Moderar propuesta:', err);
            return { statusCode: 500, body: JSON.stringify({ error: 'Fallo al moderar' }) };
        }
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Acción no válida' }) };
};

module.exports = { handler };

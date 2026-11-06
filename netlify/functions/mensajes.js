const { getStore, connectLambda } = require('@netlify/blobs');

function openStore() {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_API_TOKEN;
    if (siteID && token) {
        return getStore({ name: 'mensajes', siteID, token });
    }
    return getStore('mensajes');
}

function sanitize(str, max) {
    return String(str || '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}

const TIPOS_VALIDOS = new Set(['contacto', 'newsletter']);

// anti-basura: mínimo 30 s entre envíos del mismo IP
const postMap = new Map();
function tooFast(ip, tipo) {
    const now = Date.now();
    const key = ip + ':' + tipo;
    const last = postMap.get(key) || 0;
    if (now - last < 30000) return true;
    postMap.set(key, now);
    if (postMap.size > 5000) {
        for (const [k, v] of postMap) if (now - v > 3600000) postMap.delete(k);
    }
    return false;
}

const LIMITE_TEXTO = { contacto: 4000, newsletter: 400 };

const handler = async (event) => {
    connectLambda(event);

    if (event.httpMethod === 'GET') {
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, mensaje: 'El buzón del Consejo está operativo.' }) };
    }
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Solo GET o POST' }) };
    }

    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) {}
    const action = typeof body.action === 'string' && body.action ? body.action : 'enviar';

    // -------- RECIBIR CARTA O SUSCRIPCIÓN --------
    if (action === 'enviar') {
        const tipo = TIPOS_VALIDOS.has(body.tipo) ? body.tipo : null;
        if (!tipo) return { statusCode: 400, body: JSON.stringify({ error: 'Tipo de mensaje no válido' }) };

        const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'anon').split(',')[0].trim();
        if (tooFast(ip, tipo)) {
            return { statusCode: 429, body: JSON.stringify({ error: 'Ya has enviado algo hace poco. Espera 30 segundos, por favor.' }) };
        }

        const texto = sanitize(body.texto, LIMITE_TEXTO[tipo]);
        if (tipo === 'contacto' && texto.length < 5) {
            return { statusCode: 400, body: JSON.stringify({ error: 'La carta es demasiado corta.' }) };
        }

        const registro = {
            id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
            tipo,
            nombre: sanitize(body.nombre, 80) || '(sin nombre)',
            email: sanitize(body.email, 120) || '(sin correo)',
            tema: sanitize(body.tema, 200) || '',
            texto,
            recibidoEn: Date.now()
        };

        const store = openStore();
        try {
            await store.set(tipo + ':' + registro.id, JSON.stringify(registro));
        } catch (err) {
            console.error('Guardar mensaje:', err);
            return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo guardar. Inténtalo más tarde.' }) };
        }
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok: true, mensaje: 'Guardado en el buzón del Consejo.' })
        };
    }

    // -------- ADMIN: LECTURA O BORRADO --------
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) {
        return { statusCode: 500, body: JSON.stringify({ error: 'ADMIN_TOKEN no configurado' }) };
    }
    if (sanitize(body.token, 200) !== adminToken) {
        return { statusCode: 403, body: JSON.stringify({ error: 'Token de moderación incorrecto' }) };
    }

    const store = openStore();

    if (action === 'listar') {
        const porTipo = { contacto: [], newsletter: [] };
        try {
            const { blobs } = await store.list();
            for (const b of blobs) {
                const data = await store.get(b.key, { type: 'json' });
                if (data && porTipo[data.tipo]) porTipo[data.tipo].push(data);
            }
        } catch (err) {
            console.error('Listar mensajes:', err);
        }
        porTipo.contacto.sort((a, b) => b.recibidoEn - a.recibidoEn);
        porTipo.newsletter.sort((a, b) => b.recibidoEn - a.recibidoEn);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...porTipo, ok: true }) };
    }

    if (action === 'borrar') {
        const id = sanitize(body.id, 120);
        const tipo = TIPOS_VALIDOS.has(body.tipo) ? body.tipo : null;
        if (!id || !tipo) return { statusCode: 400, body: JSON.stringify({ error: 'Falta id o tipo' }) };
        try {
            await store.delete(tipo + ':' + id);
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
        } catch (err) {
            console.error('Borrar mensaje:', err);
            return { statusCode: 500, body: JSON.stringify({ error: 'Fallo al borrar' }) };
        }
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Acción no válida' }) };
};

module.exports = { handler };

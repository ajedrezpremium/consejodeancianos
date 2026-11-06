# Cambios listos en local (pendiente de `netlify deploy --prod --dir .`)

Netlify bloqueó los despliegues el 20/10/2026 por agotamiento de crédito de la cuenta
("Account credit usage exceeded"). El sitio publicado sigue funcionando; solo faltan publicar:

## Qué falta publicar (ya escrito en local)
1. `legal.html` — Aviso Legal + Términos de uso, Política de Privacidad, Política de Cookies.
2. `index.html` — enlaces legales en el footer + aviso de cookies (barra inferior con Aceptar / Solo lo necesario).
3. `index.html` — botón del header "Hablar con IA" eliminado; nuevo botón flotante abajo a la derecha (`#fabAgent`, icono robot + tooltip "Agente IA", pulso ámbar, foco el chat al pulsar).
4. `sw.js` — caché actualizada a `cma-v3` (para que los visitantes reciban la versión nueva).
5. **Nueva ingesta 06/11/2026** — la web local pasa de 24 a **32 publicaciones** (del #4975 al #5017):
   los posts #5010–#5017 (correos del 30/10 al 06/11, incluidos en `index.html`, `data/posts.json`,
   `rss.xml` con 32 ítems y la copia raíz `../consejo_medianos_ancianos.html`).

## Ya hecho sin deploy (API de configuración)
- Badge "Powered by Netlify" desactivado (`built_with_badge_enabled: false`) — verificado: ya no aparece en producción.

## Cómo publicar cuando se destrabe
```
cd C:\Users\param\Documents\BLOG MIGUEL MIRANDA\consejodeancianos
netlify deploy --prod --dir .
```
Si da Forbidden de nuevo, comprobar con:
`Invoke-RestMethod https://api.netlify.com/api/v1/user -Headers @{Authorization="Bearer <token del CLI>"}`

## Ingesta futura de correos (nuevo flujo 06/11/2026)
1. Guardar cada correo como `correos/AAAA-MM-DD.txt` (formato "-//- " del autor).
2. Añadir metadatos curados (título/excerpt/categoría/icono) en `correos/meta.json` (clave = nº).
3. `node scripts/ingestar-correos.mjs` → sincroniza `data/posts.json` + los dos HTML embebidos.
4. `node scripts/generar-xmls.mjs` → refresca `rss.xml` (32 ítems) y `sitemap.xml`.
5. Subir a git y desplegar cuando el crédito de Netlify lo permita (o usar deploy de Netlify vía GitHub).

## Recordatorios
- Nunca editar archivos UTF-8 con Set-Content de PowerShell (mojibake): usar Node/tools.
- El token del CLI quedó expuesto en consola: rotarlo cuando se pueda (user settings → applications → remove CLI session + nuevo login).
- **Seguridad (06/11/2026)**: se eliminó la OpenRouter API key embebida en `index.html`/`consejo_medianos_ancianos.html`
  (ahora `OPENROUTER_API_KEY = ""`). Rotarla en OpenRouter y configurarla como variable de entorno
  en Netlify (`OPENROUTER_API_KEY`) para que `netlify/functions/openrouter.js` la use sin exponerla.
  El PAT de GitHub usado para el push también debe revocarse y regenerarse (quedó expuesto en chat).

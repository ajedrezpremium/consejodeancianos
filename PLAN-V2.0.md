# PLAN v2.0 — "CONSEJO MEDIANOS ANCIANOS"

Espacio virtual para pensar y mejorar la sociedad · Miguel Miranda Vila
Fecha: 20/10/2026 · Base: sitio desplegado en https://consejodeancianos.netlify.app/ (v1.0 completa y verificada)

---

## Estado actual (v1.0 - hecho)

- Web con datos en `data/posts.json` (20 posts), búsqueda, filtros, paginación, modo oscuro y TTS
- Agente IA vía Netlify Function (OpenRouter gratuito, key oculta, RAG sobre todo el archivo, historial, fallback entre modelos, rate limit)
- Muro de Propuestas con moderación (`admin.html` + token), Buzón (contacto) y suscriptores del boletín (Netlify Blobs)
- RSS, sitemap, robots.txt, favicon propio, PWA con service worker (offline básico)

---

## Objetivo de la v2.0

Soportar los ~5000 correos/publicaciones reales de Miguel y convertir el archivo en un **lugar donde la gente participa, busca y aprende** — no solo un archivo de lectura — manteniendo el coste en 0 € y la accesibilidad para personas mayores.

---

## FASE A — Ingesta de los 5000 posts (prioridad máxima, antes de subir nada)

1. **Script de ingesta** `scripts/ingestar-correos.mjs`
   - Entrada: carpeta con los correos (lo que pondrás en el proyecto)
   - Extrae: número (#XXXX), fecha, categoría (asignación automática por palabras clave con revisión manual posterior), título, resumen (primera frase), contenido limpio (solo párrafos, sin firmas ni cabeceras de correo)
   - Salida: fusiona con `data/posts.json` sin duplicados (detecta por `num`)
2. **Validador** `scripts/validar-posts.mjs`
   - Números duplicados, fechas mal formadas, categorías fuera de la lista, textos vacíos
   - Informe en consola + archivo `informe-ingesta.txt`
3. **Categorías grandes**: añadir si hace falta (`Historia Personal`, `Salud General`, `Educación`…) y dejar los emojis/iconos en un mapa `scripts/icons.json` (post → icono FontAwesome)
4. **Generador de XML** actualizado: RSS con las 5000 y sitemap por bloques (sitemap.xml + sitemap-posts.xml)

*Hito: `data/posts.json` con los 5000 posts validados y la web cargándolos sin degradarse.*

---

## FASE B — Escalado de la web (buscar y navegar 5000 posts)

1. **No bajar el archivo entero al navegador**: JSON partida en trozos `data/posts_01.json…` (o API de búsqueda server-side)
2. **Índice de búsqueda real**: FlexSearch (más ligero que lunr) cargado diferido; buscar por palabra, número y categoría; acentos ignorados
3. **Página individual por publicación**: tu versión corta (redirects dinámicos o plantilla unificada `/reflexion.html?num=4998` con metas OG/Twitter correctas para compartir en WhatsApp/Facebook — clave para personas mayores que comparten en móvil)
4. **Navegación por tiempo**: filtro por año/mes + orden cronológico/inverso
5. **"La Reflexión del Día"**: destacado automático en el hero (aleatorio del día, evita repetir)

*Hito: búsqueda con respuesta < 1 s y 5000 posts navegables sin colgar el móvil.*

---

## FASE C — Comunidad (la parte social de la misión)

1. **Comentarios por publicación** (Blobs + moderación en `admin.html`, reutilizando la estructura de propuestas; aprobado → visible bajo el post)
2. **Página "Historias de Barrio"**: sección donde los visitantes envían su experiencia (mismo mecanismo del muro, con su filtro por tema)
3. **Boletín semanal con envío real**: plantilla HTML con la reflexión destacada de la semana + docena de novedades; envío manual desde el panel con la lista de suscriptores descargable CSV (`admin.html`), sin depender de servicios externos
4. **Botón "Compartir por WhatsApp"** en cada post (protocolo wa.me)

*Hito: un miembro cualquiera puede comentar, compartir y recibir el boletín.*

---

## FASE D — Agente IA a escala de 5000 posts

1. **RAG server-side real**: TF-IDF precalculado en build (script Node) → `data/idx.json`; la Function consulta el índice, no escanea los 5000 textos en cada request
2. **Cita exacta**: el agente debe devolver SIEMPRE los números #XXXX que usó (ya lo hace la v1; mantener y exponer como enlaces clicables en el chat)
3. **Modo "habla conmigo despacio"**: respuesta más corta + TTS automático opcional en el chat (accesibilidad)
4. **Preguntas sugeridas dinámicas**: botones de chat alimentados por los temas reales del archivo (frecuencias del índice)

*Hito: pregunta sobre cualquier #1652 responde con el contenido del post exacto.*

---

## FASE E — Cuidados y operación (fina, continua)

1. **Backup automático de datos**: sesión semana a semana de blobs (propuestas/mensajes) a un ZIP o JSON descargable desde `admin.html`
2. **Estadísticas sencillas propias**: contador de lecturas por post (Blobs) y ranking "Lo más leído" (sin cookies ni analytics externos)
3. **A11y extra**: skip-to-content, foco visible, alt texts, contraste alto, probar con NVDA/VoiceOver
4. **Velocidad**: preconnexión de CDNs, carga diferida de Tailwind (migrar a CSS compilado si hay bloqueos del CDN), Lighthouse > 90
5. **Seguridad**: rotar `ADMIN_TOKEN` y el token del CLI de Netlify (visible en la consola durante una instalación); revisar el límite de 50 solicitudes/día: alternar con un segundo `key` gratuita

---

## Orden de ejecución recomendado

| Semana 1 | Semana 2 | Semana 3 | Semana 4 |
|---|---|---|---|
| **A** Ingesta+validador | **B** Escalado | **C.1-C.2** Comentarios+Historias | **D** RAG a escala |
|  |  | C.3 Boletín real | E Backup+stats |

La Fase A condiciona a todas las demás: **no se sube ningún lote antes de tener el validador pasando.**

---

## Notas de despliegue (comandos)

```bash
node scripts/ingestar-correos.mjs --origen ./correos   # cuando llegue la carpeta
node scripts/validar-posts.mjs
node scripts/generar-xmls.mjs
netlify deploy --prod --dir .
```

Admin: https://consejodeancianos.netlify.app/admin.html (token de moderación guardado por su propietario).

---

## Sugerencias PLAN MEJORA v2.0 (revisión del 06/11/2026)

**Contexto de la revisión**: ingesta verificada de los correos #5010–#5017 (30/10 → 06/11/2026,
uno diario desde el Gmail xadrezgalegoxg@gmail.com). El archivo pasa de 24 a 32 publicaciones
y todo el pipeline queda automatizado (`correos/` + `ingestar-correos.mjs` + `generar-xmls.mjs`).

### Hechos observados que condicionan el plan
1. **Cadencia diaria sostenida**: Miguel publica ~1 correo/día → para 2027 la web superará las
   300 publicaciones. La inyección del array `postsData` embebido en `index.html` NO escala
   hasta 5000: cada publicación añade ~1 KB al HTML y lo regenera con regex frágil.
2. **La cuenta migueldavinci@hotmail.es está al límite** (correos #5014, #5016, #5017: "la IA ha
   tomado el mando de HOTMAIL", "incapacidad total de abrir la cuenta"): el canal de publicación
   es ahora `xadrezgalegoxg@gmail.com`, a veces hilos con 2 publicaciones (respuesta al hilo propio).
3. **Huecos de numera**: #4999–#5005 no están publicados en la web (no aparecen en los correos
   leídos); en cambio Miguel CITA publicaciones antiguas por número (#0284, #0369, #3235, #4230,
   #4258) que la web no tiene → el archivo histórico completo no ha sido volcado todavía.
4. **La web desplegada va 12 publicaciones por detrás** del local (Netlify sin crédito): la
   diferencia crece cada día mientras no se destrabe el despliegue.
5. **Sin control de versiones**: el proyecto no tiene git ni remoto; cualquier edición manual
   frágil (regex, PowerShell) es un punto único de fallo. Hoy se ha inicializado git.

### Sugerencias priorizadas

**P1 — Despliegue constante (esta semana)**
- Destruabar el crédito de Netlify (xadrezgalegoxg@gmail.com) y conectar el repo git a Netlify
  (deploy automático desde `main`), para que el HTML local y el publicado nunca difieran.
  Mientras tanto: `netlify deploy --prod --dir .` tras cada ingesta.

**P2 — Capa de datos única (Fase B anticipada, 1–2 semanas)**
- Declarar `data/posts.json` como ÚNICA fuente en render: `index.html` deja de incrustar el
  array y hace `fetch('data/posts.json')` con `<noscript>` de carga. Elimina la doble
  sincronización (hoy: posts.json + index.html + copia raíz = 3 copias).
- Índice FlexSearch precalculado (`scripts/generar-xmls.mjs` también puede generar
  `data/idx.json`) para búsqueda < 1 s con 300+ posts.

**P3 — Retro-ingesta heurística (2–3 semanas)**
- Crear `scripts/ingestar-historico.mjs`: rehacer la ingesta desde el archivo HISTÓRICO de
  correos de Gmail (la búsqueda `from:"miguel miranda" OR from:"migueldavinci"` devuelve años
  de correos diarios), para rellenar huecos #4999–#5005 y las publicaciones citadas (#0284,
  #0369, #3235, #4230, #4258). Reutilizar el parser de `ingestar-correos.mjs`.
- Añadir al validador: aviso de huecos de numera consecutiva (reporte por año).

**P4 — Canal de publicación robusto (1 semana)**
- Fijar el canal formal: Miguel envía desde `xadrezgalegoxg@gmail.com` (o hotmail cuando vuelva).
- Sugerido por el propio autor en #5017 ("cambiar el modo de operación"): crear un
  `netlify/functions/ingesta.js` + formulario protegido en `admin.html` donde Miguel (o un
  colaborador) pegue el texto "-//-" y lo aprobar/rechace sin depender del correo. El correo
  sigue como espejo, no como única vía.
- `correos/meta.json` con etiquetas automáticas iniciales por palabra clave + revisión manual.

**P5 — Agente IA cotidianidad (Fase D, 1 semana)**
- El RAG lee `data/posts.json` → los posts nuevos entran automáticamente. Añadir al prompt del
  agente: "las publicaciones van del #4975 al #5017" (contadores dinámicos, no fijos).
- Citar los hashtags citados por Miguel (#0323, #4258...) como enlaces clicables en el chat
  (`#publicaciones` + scroll a la tarjeta).

**P6 — Comunidad y accesibilidad (Fase C, continua)**
- Botón "Compartir por WhatsApp" por post (wa.me) — los ancianos comparten desde el móvil.
- "La Reflexión del Día" en el hero (aleatorio del día con semilla de fecha).
- Corrección copy: normalizar los «<>» angulares herencia del correo (generar comillas
  «» o negritas en el parser, mejor lectura y TTS más natural).

**P7 — Resiliencia**
- Backup automático: `correos/` + `data/` versionados en git (ya en marcha) + export JSON
  descargable desde `admin.html` (blobs propuestas/mensajes/suscriptores).
- Rotar token de Netlify CLI (queda expuesto) y revisar cuota gratuita OpenRouter.

### Orden propuesto de las próximas 2 semanas
| Día 1–2 | Día 3–5 | Semana 2 |
|---|---|---|
| Deploy + git remoto | P2 capa de datos única | P4 formulario de ingesta + P5 agente afinado + P6 WhatsApp |


# Handoff: Rediseño UI/UX de CMR Canchas

## Qué es esto

Especificación de rediseño de interfaz para **CMR Canchas** (reservas de canchas del
Automóvil Club San Nicolás y otros clubes del mismo sistema multi-club).

El objetivo no es sólo modernizar: es que **cualquier persona, incluso con poca
experiencia usando aplicaciones web, entienda qué tiene que hacer sin que nadie se lo
explique**. Criterio de aceptación permanente:

> Si una persona de 60 años entra por primera vez, ¿reserva sin ayuda?

Prioridad de decisiones: **UX > claridad > accesibilidad > rendimiento > estética.**

## Sobre este paquete

Este paquete es **documentación de diseño**, no código para copiar y pegar. No incluye
prototipos HTML: incluye tokens, medidas exactas, estructura de cada pantalla, textos
literales y estados. La implementación se hace **en el código existente del repo**,
respetando sus patrones (HTML plano + Tailwind + JS vanilla + Express).

Fidelidad: **alta (hi-fi) en tokens, tipografía, espaciado, componentes y copys**;
la disposición se describe en prosa y en esquemas ASCII, no en pixel art. Los valores de
color, radio, sombra, tamaño de texto y alto de controles son exactos y deben respetarse.

## Estado actual del código (leído del repo, rama `main`)

- **Frontend**: HTML estático en `public/`, sin framework. Tailwind vía
  `<script src="https://cdn.tailwindcss.com">` en `index.html`, `admin.html`,
  `superadmin.html`, `register.html`. Existe además `public/styles.css` (CSS a mano,
  hoy prácticamente sin uso desde `index.html`) y `public/home-arena.css` (~40 KB) para
  la landing `home.html`.
- **JS**: `public/app.js` (público), `public/admin.js`, `public/superadmin.js`,
  `public/home.js`, `public/register.js`. Todos manipulan el DOM por `id` y por
  `innerHTML` con plantillas de string que incluyen clases de Tailwind.
- **Backend**: Express en `server/index.js`. Multi-club: casi todas las rutas son
  `/api/:slug/...` y el slug se deduce del primer segmento de la URL
  (`getClubSlug()` en `app.js`).
- **Datos**: Supabase / SQLite con fallback a JSON. Comprobantes con `multer`.

### Endpoints que consume el frontend público

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/:slug/config` | nombre del club, `logoUrl`, `canchas[{nombre,etiqueta}]`, `horarios[]`, `transferencia{alias,cbu,titular}`, `whatsappNumero` |
| GET | `/api/:slug/reservas?cancha=&fecha=` | reservas del día para marcar ocupados |
| GET | `/api/:slug/bloqueos?cancha=&fecha=` | bloqueos del día |
| GET | `/api/:slug/mis-reservas?telefono=` | turnos por teléfono |
| POST | `/api/:slug/reservas` | `multipart/form-data`: `nombre`, `telefono`, `cancha`, `fecha`, `horario`, `comprobante` |

### Endpoints del panel admin

`POST /api/:slug/admin/login`, `GET/DELETE /api/:slug/admin/reservas[/:id]`,
`PATCH /api/:slug/admin/reservas/:id/estado`,
`GET/POST/DELETE /api/:slug/admin/bloqueos[/:id]`,
`GET/POST/DELETE /api/:slug/admin/bloqueos-recurrentes[/:id]`,
`GET/POST/PUT/DELETE /api/:slug/admin/canchas[/:id]`,
`PATCH /api/:slug/admin/club`, `POST /api/:slug/admin/password`,
`GET /api/:slug/comprobantes/:id`.

## Alcance: qué se toca y qué no

**Se toca (presentación):**
- `public/index.html` — reestructuración completa del layout.
- `public/admin.html` — reestructuración a dashboard con navegación por secciones.
- `public/styles.css` — pasa a ser la hoja del design system (tokens + componentes).
- Las plantillas de string dentro de `app.js` / `admin.js` que generan HTML
  (slots de horario, cards de turnos, cards de bloqueos, filas de reservas).

**No se toca (lógica):**
- `server/index.js`: rutas, validaciones, persistencia, generación de horarios,
  armado de links `wa.me`, autenticación admin.
- Nombres de campos del formulario (`nombre`, `telefono`, `cancha`, `fecha`, `horario`,
  `comprobante`) ni de los query params.
- El flujo funcional: seña por transferencia, subida de comprobante, envío por WhatsApp,
  cancelación solicitada por WhatsApp y resuelta por el admin.
- Multi-club: todo lo que hoy sale de `/api/:slug/config` (nombre, logo, canchas,
  horarios) sigue siendo dinámico. **Nada hardcodeado**: ni "Cancha 11", ni el nombre
  del club, ni la lista de horarios.

**Restricción importante sobre el flujo de reserva**: el brief hablaba de un botón
"Confirmar reserva". En el código real, confirmar implica dos pasos obligatorios
(datos personales, y transferencia + comprobante). El rediseño **mantiene esos dos
pasos**, pero los presenta como un asistente de 3 pasos con indicador de progreso.
No se elimina el comprobante.

## Rendimiento (requisito explícito del cliente)

El CDN de Tailwind compila CSS en el navegador en tiempo de ejecución: descarga ~100 KB
de JS y provoca un flash sin estilos. Es lo peor que tiene hoy la app en conexiones malas.

Camino recomendado, en este orden:

1. Reemplazar el CDN por **una hoja propia**: `tokens.css` de este paquete + las clases
   de componentes de `02-componentes.md`. Objetivo: **< 12 KB sin minificar** para toda
   la app pública. Las pantallas son pocas y repetitivas; no hace falta Tailwind.
2. Si se prefiere seguir con Tailwind, usar el **CLI en build** (`npx tailwindcss -i in.css
   -o public/app.css --minify`) y mapear los tokens en `theme.extend`. Nunca CDN en producción.
3. `public/favicon.png` pesa **1,6 MB**. Comprimir a un PNG de 64×64 (< 10 KB) y, si se
   quiere el logo grande, servir un WebP aparte. Igual `public/images/logo-cmr-nav.png`
   (257 KB) → SVG o WebP ≤ 20 KB.
4. Íconos: SVG inline, sólo los ~10 que se usan. Sin librería de íconos.
5. Cargar `app.js` con `defer`. Sin animaciones que corran solas. Transiciones de
   150–250 ms sobre `background-color`, `border-color`, `color`, `transform`, `opacity`.
6. `GET /api/:slug/config` se pide hoy **en cada `refreshHorarios()`** (cada cambio de
   cancha o fecha). Cachearlo en memoria para la sesión y pedir sólo `reservas` y
   `bloqueos` al cambiar filtros. Es un cambio de rendimiento en el cliente, no de lógica.

## Contenido del paquete

| Archivo | Qué contiene |
| --- | --- |
| `00-PROMPT-CLAUDE-CODE.md` | Prompt listo para pegar en Claude Code |
| `01-design-system.md` | Colores, tipografía, espaciado, radios, sombras, foco |
| `tokens.css` | Los mismos tokens como CSS custom properties, listo para copiar a `public/` |
| `02-componentes.md` | Botón, input, select, card, badge, alert, modal, skeleton, slot de horario |
| `03-pantalla-reservas.md` | Estructura, jerarquía y comportamiento de la página pública |
| `04-panel-admin.md` | Dashboard, bloqueos, reservas, cancelaciones |
| `05-estados-y-mensajes.md` | Loading, error, vacío, éxito + textos literales |
| `06-plan-de-implementacion.md` | Orden de PRs y checklist de verificación |
| `capturas/` | Estado actual (referencia) y logo del club |

## Assets

- `capturas/logo-automovil-club.jpeg` — logo del Automóvil Club San Nicolás provisto por
  el cliente. Debe convertirse a **SVG o WebP** y usarse en el header a 40×40 (mobile) /
  48×48 (desktop), `border-radius: 50%`. El logo real de cada club llega por
  `config.logoUrl`; el archivo local es sólo fallback/referencia.
- `capturas/actual-reservas.png`, `capturas/actual-admin.png` — estado actual, para
  comparar. No replicar.
- No hay ilustraciones ni fotos nuevas. Los estados vacíos usan un ícono SVG simple de
  1 sola línea, no ilustraciones.

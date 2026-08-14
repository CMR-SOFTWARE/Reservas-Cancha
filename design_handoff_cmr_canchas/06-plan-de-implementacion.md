# 06 · Plan de implementación

Ocho PRs chicos. Cada uno se puede mergear solo y deja la app funcionando.
Después de cada PR, correr el checklist de verificación del final.

## PR 1 — Base del design system

- Copiar `tokens.css` a `public/tokens.css`.
- Reescribir `public/styles.css` con: reset mínimo, tipografía base, layout de página
  (`.page`, `.card`), y las clases de componentes de `02-componentes.md`
  (`.btn`, `.btn--primary/secondary/ghost/danger`, `.field`, `.input`, `.select`,
  `.badge`, `.alert`, `.slot`, `.modal`, `.skeleton`, `.chip`, `.empty`).
- Definir en la misma hoja los estilos de `a` y `a:hover` (color `--c-brand-700` /
  `--c-brand-800`, subrayado en hover).
- Enlazar ambas hojas en `index.html` y `admin.html`. **Todavía no** sacar el CDN de
  Tailwind: conviven en este PR.
- Objetivo de peso: `tokens.css` + `styles.css` < 12 KB.

## PR 2 — Header y footer

- Header nuevo en `index.html` y `admin.html` (64/72px, logo + nombre del club, un solo
  botón a la derecha).
- Ajustar `loadConfig()` en `app.js`: el nombre del club va a `#clubNombre` del header,
  **no** al `h1`.
- Footer con tokens.
- Comprimir `favicon.png` (a 64×64) y `logo-cmr-nav.png`.

## PR 3 — Pantalla de reservas: estructura

- Reescribir el `<main>` de `index.html` según `03-pantalla-reservas.md`:
  h1 + subtítulo, card 1 numerada, card 2, card 4.
- Sacar el botón "Solicitar cancelación" del encabezado.
- Chips Hoy / Mañana / Otro día + fecha en palabras.
- Mantener todos los `id` que usa `app.js`.

## PR 4 — Slots de horario y resumen de reserva

- Reescribir `renderHorarios()` en `app.js` para generar los slots nuevos
  (rango horario, texto de estado, punto, motivo del bloqueo visible, `aria-*`).
- Contador de disponibles en `aria-live`.
- Selección de horario: `aria-pressed`, estado visual, y card "Tu reserva".
- "Confirmar reserva" abre el modal existente (`openModal`) en el paso 1.
- Skeletons y estados vacíos de `05-estados-y-mensajes.md`.

## PR 5 — Modal de reserva

- Indicador de 3 pasos, hoja inferior en mobile, foco atrapado, cierre con `Escape`.
- Errores de validación debajo de cada campo.
- Botones "Copiar" en Alias / CBU / Titular.
- Zona de carga del comprobante con nombre de archivo y validación de tamaño/tipo en cliente.
- Mapear los errores de la API a los textos de `05-estados-y-mensajes.md`.

## PR 6 — Mis turnos y cancelaciones

- Cards de turno con badge, íconos, fecha en palabras.
- Botón "Solicitar cancelación" por turno, con modal de confirmación, pasando los datos
  reales del turno al mensaje de WhatsApp.
- Estado vacío y estado de error.

## PR 7 — Panel admin

- Shell con navegación (nav lateral desktop / tabs mobile) y las 5 secciones.
- Login como pantalla propia.
- Formulario de bloqueo en 3 pasos con radios en tarjeta; ocultar/mostrar campos de hora;
  vista previa antes de confirmar. Payload del POST sin cambios.
- Cards de bloqueos activos y recurrentes; confirmación en modal.
- Sección Reservas con filtros, segmented control lista/calendario, acciones por card.
- Sección Resumen con los 4 números.
- Sección Configuración en cards separadas.

## PR 8 — Rendimiento

- Sacar `cdn.tailwindcss.com` de `index.html` y `admin.html` (y de
  `register.html` / `superadmin.html` si ya se migraron sus clases).
- Traducir las clases de Tailwind que queden en las plantillas de string de
  `app.js` / `admin.js` a las clases del design system.
- Cachear `/api/:slug/config` en memoria por sesión; en `refreshHorarios()` pedir sólo
  `reservas` y `bloqueos`.
- `defer` en los `<script>`.
- Medir: Lighthouse mobile ≥ 90 en Performance y en Accessibility.

## Checklist de verificación (correr en cada PR)

**Flujo público**
- [ ] Carga la lista de canchas desde `/api/:slug/config` (nada hardcodeado).
- [ ] Cambiar cancha o fecha recarga los horarios.
- [ ] Ocupado, bloqueado y pasado no son clickeables; disponible sí.
- [ ] El motivo del bloqueo se lee sin hover (visible en mobile).
- [ ] Seleccionar horario muestra "Tu reserva" con cancha, fecha y rango correctos.
- [ ] Paso 1 valida nombre y teléfono; paso 2 valida comprobante; paso 3 muestra el link
      de WhatsApp correcto.
- [ ] "Consultar mis turnos" funciona con y sin resultados.
- [ ] "Solicitar cancelación" abre WhatsApp con los datos del turno correcto.

**Panel admin**
- [ ] Login correcto e incorrecto.
- [ ] Crear bloqueo en las 3 modalidades (un horario, rango, día completo) y verificar en
      la página pública que el horario quedó bloqueado.
- [ ] Quitar bloqueo pide confirmación y libera el horario.
- [ ] Bloqueos recurrentes: crear y eliminar.
- [ ] Reservas: filtrar, ver comprobante, marcar como pagada, cancelar turno.
- [ ] Configuración: guardar datos, agregar/editar/eliminar cancha, cambiar clave.

**Responsive y accesibilidad**
- [ ] Sin scroll horizontal a 320, 375, 768, 1024 y 1440px.
- [ ] Todo target táctil ≥ 44px (los controles principales, 48px).
- [ ] Navegación completa con teclado; foco siempre visible.
- [ ] Ningún estado se distingue sólo por color.
- [ ] Contraste AA en todo texto (verificar los grises sobre `--c-bg`).
- [ ] Con zoom del navegador al 200% nada se corta.
- [ ] Con `prefers-reduced-motion` no hay animaciones.

**Regresión**
- [ ] `server/index.js` sin cambios.
- [ ] Ningún `id` del DOM roto: buscar en `app.js` / `admin.js` cada
      `getElementById` y confirmar que existe en el HTML.
- [ ] Los `name` del formulario de reserva siguen siendo `nombre`, `telefono`, `cancha`,
      `fecha`, `horario`, `comprobante`.

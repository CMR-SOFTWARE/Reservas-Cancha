# 02 · Componentes

Especificación de cada componente. Los snippets usan clases propias (`.btn`, `.card`…)
pensadas para `public/styles.css`. Si se mantiene Tailwind, traducir 1:1 respetando los
valores exactos.

## Botón

| Variante | Fondo | Texto | Borde | Hover | Uso |
| --- | --- | --- | --- | --- | --- |
| `primary` | `--c-brand-700` | `#fff` | ninguno | `--c-brand-800` | Una sola por pantalla: "Ver horarios", "Confirmar reserva", "Bloquear cancha" |
| `secondary` | `--c-surface` | `--c-brand-800` | 1px `--c-border-strong` | fondo `--c-brand-50` | "Volver", "Consultar", "Cancelar" |
| `ghost` | transparente | `--c-ink-500` | ninguno | fondo `--c-surface-2` | Acciones terciarias, cerrar |
| `danger` | `--c-surface` | `--c-danger` | 1px `--c-danger-border` | fondo `--c-danger-bg` | "Quitar bloqueo", "Solicitar cancelación" |

Medidas: alto 48px (`--h-control`), padding `0 20px`, radio 12px, texto 16px/600.
En mobile, el botón primario de cada bloque es **`width: 100%` y 56px de alto**.
Acciones secundarias en desktop pueden usar 40px.

Estado `loading`: el botón queda `disabled`, el texto se reemplaza por
`Guardando…` / `Buscando…` y aparece un spinner de 16px a la izquierda.
**El ancho no cambia** (reservar el ancho con `min-width`) para que no salte el layout.

`danger` nunca es rojo sólido: el rojo pleno se reserva para errores reales.
La acción destructiva siempre pide confirmación (ver Modal de confirmación).

## Input / Select / Date

- Alto 48px, padding `0 14px`, radio 12px, texto 16px (evita el zoom automático en iOS).
- Borde 1px `--c-border-strong`; fondo `--c-surface`.
- Foco: borde `--c-brand-700` + `--sh-focus`.
- Error: borde `--c-danger` + mensaje debajo, 14px, `--c-danger`, con ícono de alerta de
  16px. El mensaje se asocia con `aria-describedby` y el control lleva `aria-invalid="true"`.
- Label siempre visible arriba, 16px/600. **Nunca** usar placeholder como label.
- El `<select>` de canchas lleva chevron SVG propio a la derecha
  (`appearance: none` + `background-image`), 20px, `--c-ink-500`.
- El `<input type="date">` mantiene el picker nativo (es lo más entendible en mobile).
  Debajo, texto de ayuda con la fecha en palabras: "Viernes 14 de agosto".

## Selector de fecha rápida (nuevo, sin lógica nueva)

Arriba del `<input type="date">`, una fila de 3 chips: **Hoy · Mañana · Elegir otro día**.
Sólo cambian el `value` del input existente y disparan su evento `change`.
Chip: alto 40px, radio pill, borde 1px `--c-border-strong`, texto 14px/600.
Chip activo: fondo `--c-brand-50`, borde 2px `--c-brand-700`, texto `--c-brand-800`.
Esto elimina el problema más común: gente que no sabe abrir un date picker.

## Card

```html
<section class="card">
  <h2 class="card-title">Horarios</h2>
  <p class="card-sub">Elegí el horario que quieras reservar.</p>
  <!-- contenido -->
</section>
```

Fondo blanco, radio 16px, borde 1px `--c-border`, sombra `--sh-xs`,
padding 16px (mobile) / 24px (desktop). Sin barra de color arriba (hoy `admin.html`
tiene una franja verde de 4px: se elimina, no aporta información).
Título 20px/600 `--c-brand-900`, subtítulo 14px `--c-ink-500`, separación 4px.

**Card numerada** (para los pasos del formulario de bloqueo): el título va precedido por
un círculo de 28px, fondo `--c-brand-700`, texto blanco 14px/700 con el número.

## Slot de horario

El componente más importante de la app. Reemplaza los rectángulos de color actuales por
**filas** que combinan hora + estado en texto + punto de color + ícono.

```
┌──────────────────────────────────────────────┐
│ ●  13:00 – 14:00              Disponible  →  │   ← clickeable
├──────────────────────────────────────────────┤
│ ○  14:00 – 15:00              Ocupado        │   ← disabled
├──────────────────────────────────────────────┤
│ ◐  16:00 – 17:00      Bloqueado · Lluvia     │   ← disabled + motivo
└──────────────────────────────────────────────┘
```

- Elemento: `<button type="button">` para disponibles, `<div aria-disabled="true">`
  para el resto (o `<button disabled>`, pero entonces con `title` accesible).
- Alto mínimo **56px**, padding `12px 16px`, radio 12px, gap 12px.
- Layout: `display: grid; grid-template-columns: 12px 1fr auto; align-items: center;`
- Hora en 18px/700. Etiqueta de estado a la derecha en 14px/600.
- El rango se muestra completo ("13:00 – 14:00"): el usuario no tiene que deducir cuánto
  dura el turno. La hora de fin se calcula sumando 1 hora al slot; los horarios siguen
  saliendo de `config.horarios`.
- **Disponible**: fondo `--c-free-bg`, borde 1px `--c-free-border`, texto `--c-free-text`,
  punto lleno `--c-free-dot`, flecha a la derecha. Hover: fondo un 4% más oscuro +
  borde `--c-brand-700`. Cursor pointer.
- **Ocupado**: fondo `--c-busy-bg`, borde `--c-busy-border`, texto `--c-busy-text`,
  punto vacío (círculo con borde 2px). `cursor: not-allowed`.
- **Bloqueado**: fondo `--c-block-bg`, borde `--c-block-border`, texto `--c-block-text`,
  punto semilleno. El motivo se muestra **en la fila**, no en un `title`
  (hoy está sólo en el tooltip y en mobile no existe el hover).
- **Pasado**: mismo tratamiento que Ocupado pero etiqueta "Ya pasó".
- **Seleccionado**: borde 2px `--c-brand-700`, fondo `--c-brand-50`,
  ícono de check en lugar de la flecha, y `aria-pressed="true"`.

Disposición: **una columna en mobile** (lista vertical, se lee de arriba abajo),
2 columnas ≥640px, 3 columnas ≥1024px, gap 8px. No usar grid de 5 columnas: los slots
angostos obligan a abreviar y pierden el texto de estado.

Leyenda arriba de la lista: 3 ítems con punto + palabra, 14px, `--c-ink-500`, gap 20px.
Se mantiene, pero es refuerzo: cada slot ya dice su estado en palabras.

## Badge

Alto 24px, padding `0 10px`, radio 8px, texto 13px/600, borde 1px.
- Pagado / Confirmada: `--c-success-bg` / `--c-success` / borde `--c-brand-100`.
- Sin pagar / Pendiente: `--c-warning-bg` / `--c-warning` / borde `--c-block-border`.
- Cancelada: `--c-danger-bg` / `--c-danger` / borde `--c-danger-border`.
Siempre con texto; el color no es el único portador de significado.

## Alert

Bloque de ancho completo, radio 12px, padding 12px 16px, borde 1px, gap 12px,
ícono 20px alineado arriba, texto 14px/1.5.
Variantes: `info` (`--c-info-bg`/`--c-info`), `success`, `warning`, `error`
(`--c-danger-bg`/`--c-danger`).
Aparece con `opacity 0→1` + `translateY(4px→0)` en 200 ms.
Los mensajes de resultado de una acción se anuncian con `role="status"` (éxito) o
`role="alert"` (error) para lectores de pantalla.

Hoy `#mensaje` y `#adminMessage` son párrafos rojos suelos al final del bloque:
pasan a ser Alerts colocados **inmediatamente arriba del botón que los generó**.

## Modal

- Overlay `rgba(14,34,51,0.55)`, contenido blanco, radio 16px, sombra `--sh-md`,
  ancho máximo 560px, padding 24px.
- Mobile (<640px): hoja inferior a ancho completo, radio sólo arriba (16px 16px 0 0),
  `max-height: 92vh`, contenido con scroll propio, y el botón primario **sticky abajo**.
- Header: título 20px/600 + botón cerrar 40×40 (ícono x de 20px, variante ghost).
- Cierra con `Escape`, click en overlay y botón. Foco atrapado dentro del modal;
  al abrir, foco en el primer campo; al cerrar, vuelve al slot que lo abrió.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` al título.

### Indicador de pasos (dentro del modal de reserva)

Fila de 3 puntos con línea de conexión, arriba del título:
completado = círculo `--c-brand-700` con check blanco; actual = círculo con borde 2px
`--c-brand-700` y número; pendiente = círculo `--c-border`. Debajo, texto
"Paso 2 de 3 · Pago" en 14px `--c-ink-500`.

### Modal de confirmación (destructivo)

Ancho 420px. Título en `--c-ink-900`, cuerpo explicando la consecuencia en palabras
concretas, y dos botones: `secondary` "Volver" a la izquierda, `danger` a la derecha.
Reemplaza los `window.confirm()` actuales de `app.js` y `admin.js`.

## Skeleton / loading

Bloque `--c-surface-2` con radio 12px y un pulso de opacidad `0.6→1` de 1.2 s.
Se usa para la lista de horarios (mostrar **3 filas skeleton de 56px**), no un spinner
centrado: el usuario ve dónde va a aparecer el contenido.
Los botones que disparan la carga pasan a estado `loading`.

## Header

Alto 64px (mobile) / 72px (desktop), fondo `--c-brand-900`, sin sombra (borde inferior
`rgba(255,255,255,0.08)`).
Izquierda: logo circular 40/48px + nombre del club en 16px/700 blanco (hoy el nombre no
está en el header público: agregarlo, sale de `config.nombre`).
Derecha: un solo botón redondo de 44px con ícono de usuario → acceso admin, con
`aria-label="Ingresar como administrador"`.
No hace falta menú hamburguesa: hay un solo destino.

## Footer

Se mantiene el contenido actual (marca CMR, WhatsApp, Instagram, email, copyright) con
los tokens nuevos: fondo `--c-brand-900`, texto `rgba(255,255,255,0.72)`, links a
`#fff` en hover, 14px, padding vertical 40px, separador `rgba(255,255,255,0.12)`.

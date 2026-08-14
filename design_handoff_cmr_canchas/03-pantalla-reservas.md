# 03 · Página pública de reservas (`public/index.html`)

La pantalla más importante. Todo el diseño se subordina a que el usuario entienda:

> **Elijo cancha → elijo fecha → elijo horario → reservo.**

## Problemas del estado actual (ver `capturas/actual-reservas.png`)

1. "Solicitar cancelación" es un botón verde grande arriba, al lado del título: compite
   con la acción principal y es lo primero que ve el usuario.
2. Los horarios son rectángulos de color sin texto de estado; el motivo de un bloqueo
   sólo está en el `title` (invisible en mobile).
3. Al hacer clic en un horario se abre el modal directamente, sin resumen previo de qué
   se está reservando.
4. "Mis turnos" queda al final, sin jerarquía clara.
5. No hay estados de carga, error ni vacío: la grilla simplemente aparece o queda vacía.
6. El paso a paso no está numerado: los tres controles (cancha, fecha, botón) se leen
   como un filtro, no como un flujo.

## Estructura nueva

```
┌─ Header (verde profundo, 64/72px) ──────────────────────────┐
│ [logo]  Automóvil Club San Nicolás              (○ usuario) │
└─────────────────────────────────────────────────────────────┘

  Reservar una cancha                                  ← h1
  Elegí la cancha, la fecha y el horario que preferís.  ← sub

┌─ Card: "1. ¿Qué cancha y qué día?" ─────────────────────────┐
│  Cancha                    Día                              │
│  [ Cancha 11        ▾ ]    [ Hoy ][ Mañana ][ Otro día ]    │
│                            [ 14/08/2026        📅 ]         │
│                            Viernes 14 de agosto             │
│                                                             │
│  [           Ver horarios           ]  ← primary, 100% mob  │
└─────────────────────────────────────────────────────────────┘

┌─ Card: "2. Elegí un horario" ───────────────────────────────┐
│  ● Disponible   ○ Ocupado   ◐ Bloqueado        ← leyenda    │
│                                                             │
│  ○  10:00 – 11:00                        Ocupado            │
│  ●  13:00 – 14:00                     Disponible  →         │
│  ◐  16:00 – 17:00            Bloqueado · Lluvia intensa     │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘

┌─ Card resumen (aparece al seleccionar) ─────────────────────┐
│  Tu reserva                                                 │
│  Cancha 11                                                  │
│  Viernes 14 de agosto · 13:00 – 14:00                       │
│  Seña: $12.000 por transferencia                            │
│  [        Confirmar reserva        ]   [ Cambiar horario ]   │
└─────────────────────────────────────────────────────────────┘

┌─ Card secundaria: "¿Ya tenés una reserva?" ─────────────────┐
│  Ingresá tu número de teléfono para consultar tus turnos.   │
│  [ 3364578599 ]  [ Consultar mis turnos ]                   │
│  → resultados como cards con badge de estado                │
└─────────────────────────────────────────────────────────────┘

└─ Footer ────────────────────────────────────────────────────┘
```

## Detalles por bloque

### h1 y subtítulo

- h1: **"Reservar una cancha"** — 30px mobile / 36px desktop, 700, `--c-ink-900`.
  El nombre del club **no** va en el h1 (hoy `app.js` lo sobreescribe con
  `Reservas - ${config.nombre}`): el nombre ya está en el header. Cambiar esa línea de
  `app.js` para que escriba en un `<span id="clubNombre">` del header en lugar del `h1`.
- Subtítulo: "Elegí la cancha, la fecha y el horario que preferís." 16/18px, `--c-ink-500`.
- Margen: 32px arriba, 24px hasta la primera card.
- **Se elimina el botón "Solicitar cancelación" de esta zona.** Pasa a estar dentro de
  cada card de "Mis turnos" (ver más abajo).

### Card 1 — Cancha y día

- Título de card con círculo numerado **1**: "¿Qué cancha y qué día?"
- Desktop (≥768px): grid de 2 columnas (cancha | día) + botón a ancho completo debajo,
  alineado a la izquierda con `min-width: 220px`. Mobile: una columna, botón 100%/56px.
- Chips **Hoy / Mañana / Otro día**: "Otro día" revela/enfoca el `input[type=date]`
  (que en Hoy/Mañana queda visible pero secundario). Sólo escriben el `value` y disparan
  `change`, que es lo que ya escucha `app.js`.
- Debajo del input de fecha, la fecha en palabras (14px, `--c-ink-500`), calculada con
  `toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long'})`.
- El botón "Ver horarios" (hoy `#btnBuscar`, "Actualizar horarios") se mantiene, pero
  como refuerzo: los horarios ya se recargan solos al cambiar cancha o fecha. Texto nuevo:
  **"Ver horarios"**.

### Card 2 — Horarios

- Título con círculo numerado **2**: "Elegí un horario".
- Leyenda de 3 estados arriba (ver `02-componentes.md` → Slot de horario).
- Lista de slots: 1 columna mobile / 2 ≥640px / 3 ≥1024px, gap 8px.
- Contador arriba a la derecha: **"5 horarios disponibles"** en 14px/600 `--c-brand-800`.
  Si hay 0: ver estado vacío en `05-estados-y-mensajes.md`.
- Al hacer clic en un slot disponible: **no se abre el modal**. Se marca como seleccionado
  y aparece la card de resumen, con scroll suave hasta ella (sólo si está fuera de vista).
  Esto resuelve el punto 4 del brief: el usuario ve qué eligió antes de comprometerse.

### Card 3 — Resumen "Tu reserva"

- Sólo existe cuando hay selección. Borde 2px `--c-brand-700`, fondo `--c-surface`.
- Contenido: etiqueta de la cancha, fecha en palabras, rango horario, y el monto de la
  seña (sale de la config del club — hoy está hardcodeado "$12.000" en el HTML del paso 2;
  usar `config.precio` si existe, y si no, mantener el texto actual).
- Botón primario **"Confirmar reserva"** (56px, 100% en mobile) → abre el modal existente
  en el Paso 1. Botón secundario "Cambiar horario" → limpia la selección y vuelve a la lista.
- En mobile, esta card se fija abajo (`position: sticky; bottom: 0`) con sombra `--sh-md`
  mientras haya selección, para que el CTA esté siempre a mano.

### Modal de reserva (3 pasos) — se mantiene la lógica

Indicador de pasos arriba (ver `02-componentes.md`). Contenido de cada paso:

1. **Tus datos** — Nombre y apellido, Teléfono. Validaciones actuales de `app.js`
   (nombre ≥ 3 caracteres, teléfono 6–15 dígitos). Los errores se muestran **debajo del
   campo**, no en un párrafo al final. Botón "Continuar".
2. **Pago de la seña** — Alert `warning` con el monto y la advertencia actual; bloque con
   Alias / CBU / Titular, cada uno con **botón "Copiar"** (40px, ghost, feedback "Copiado")
   — mejora de usabilidad pura, sin lógica de servidor. Input de comprobante rediseñado
   como zona de carga: borde 1px dashed `--c-border-strong`, radio 12px, 96px de alto,
   ícono + "Elegí una foto o PDF del comprobante" + "Máximo 5 MB". Al elegir archivo,
   muestra el nombre y un botón "Cambiar". Botones "Volver" (secondary) y "Reservar"
   (primary). Los `name` de los inputs no cambian.
3. **Confirmación** — Check verde en círculo de 64px, título "¡Turno reservado!",
   detalle en bloque `--c-surface-2`, y luego el botón de WhatsApp (primary, con ícono)
   y "Reservar otro turno" (secondary). Se mantiene el `href` armado por `buildWhatsAppUrl`.

### Card 4 — "¿Ya tenés una reserva?"

- Sección secundaria pero visible, con borde `--c-border` y **sin** título numerado.
- Copy: "Ingresá tu número de teléfono para consultar tus turnos."
- Input de teléfono (48px, `inputmode="numeric"`) + botón secondary
  **"Consultar mis turnos"**. En mobile van apilados, ambos a ancho completo.
- Resultados: una card por turno, borde `--c-border`, radio 12px, padding 16px:
  - Etiqueta de cancha en 18px/700 `--c-ink-900`.
  - Fila con ícono de calendario + fecha en palabras; fila con ícono de reloj + rango.
  - Badge de estado ("Pagado" / "Sin pagar", según `r.estado === "confirmada"`).
  - Abajo, botón `danger` de 40px **"Solicitar cancelación"** → modal de confirmación y
    luego el link `wa.me` que ya arma `buildCancelacionWhatsAppUrl()`.
    Ese link hoy manda "(indicar horario)" porque no sabe cuál es el turno: al llamarlo
    desde la card, pasarle cancha/fecha/horario reales del turno. Es un cambio en el
    armado del texto del mensaje, no en la lógica de cancelación (sigue resolviéndola el admin).

## Responsive

| | Mobile <640 | Tablet 640–1023 | Desktop ≥1024 |
| --- | --- | --- | --- |
| Padding de página | 16px | 24px | 32px |
| Cards | 1 columna | 1 columna | 1 columna, máx 1040px |
| Campos de la card 1 | apilados | 2 columnas | 2 columnas |
| Slots de horario | 1 columna | 2 columnas | 3 columnas |
| Botón primario | 100%, 56px | auto, 48px | auto, 48px |
| Resumen "Tu reserva" | sticky abajo | en flujo | en flujo |
| Modal | hoja inferior | centrado 560px | centrado 560px |

Sin scroll horizontal en ningún ancho desde 320px. Sin tablas.

## Accesibilidad de esta pantalla

- Un solo `h1`; las cards usan `h2`; los pasos del modal, `h3`.
- La lista de horarios es un `<ul>` de `<li>`; cada slot disponible, un `<button>`.
- El contador de disponibles y los mensajes de resultado van en un contenedor
  `aria-live="polite"`.
- El estado de cada slot se lee en el nombre accesible: "13:00 a 14:00, disponible".
- Orden de tabulación igual al orden visual. Skip link opcional al contenido principal.

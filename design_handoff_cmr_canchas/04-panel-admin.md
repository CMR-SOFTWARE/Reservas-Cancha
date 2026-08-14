# 04 · Panel administrativo (`public/admin.html`)

Debe sentirse como un dashboard profesional, pero seguir siendo simple. Hoy es una
columna de 5 cards apiladas (bloquear, bloqueos activos, bloqueos recurrentes, turnos
reservados, configuración) donde todo está abierto al mismo tiempo.

## Problemas del estado actual (ver `capturas/actual-admin.png`)

1. Sin navegación: todo en un scroll largo.
2. El formulario de bloqueo tiene 4 campos en una fila horizontal + checkbox "Día
   completo" que contradice a los dos selects de horario sin desactivarlos.
3. "Volver al menú principal" y "Cerrar sesión" viven dentro de la card de "Bloquear
   cancha": son acciones globales, no del formulario.
4. "Quitar bloqueo" es un botón rojo sólido y elimina con `window.confirm`.
5. La franja verde de 4px arriba de las cards no comunica nada.
6. El login es una card en el medio de la página con el mismo peso que el resto.

## Estructura nueva

### Login

Pantalla propia, centrada, sin footer largo: card de 400px, radio 16px, sombra `--sh-sm`.
Logo 48px arriba, título "Panel de administración", subtítulo con el nombre del club.
Campo de clave (48px, `type="password"` con botón "Mostrar" ghost a la derecha) y botón
primario a ancho completo "Ingresar". Error como Alert `error` arriba del botón.

### Shell del panel

```
┌─ Topbar (verde profundo, 64px) ─────────────────────────────────┐
│ [logo] CMR Canchas · Panel                  Cancha ▾  Salir     │
└─────────────────────────────────────────────────────────────────┘
┌── Nav ────────┬── Contenido ────────────────────────────────────┐
│ Resumen       │  Título de la sección                           │
│ Reservas      │  Subtítulo corto                                │
│ Bloqueos      │                                                 │
│ Cancelaciones │  [cards de la sección]                          │
│ Configuración │                                                 │
└───────────────┴─────────────────────────────────────────────────┘
```

- **Desktop ≥1024px**: nav lateral de 220px, fondo `--c-surface`, borde derecho
  `--c-border`. Ítem: alto 44px, padding 0 16px, radio 8px, texto 16px/500 `--c-ink-700`,
  ícono 20px a la izquierda. Activo: fondo `--c-brand-50`, texto `--c-brand-800`, peso 600,
  barra de 3px `--c-brand-700` a la izquierda.
- **Mobile / tablet**: las mismas 5 secciones como tabs horizontales con scroll,
  pegadas bajo la topbar (`position: sticky`), alto 48px.
- Las secciones son **la misma página con `hidden`** (igual que hoy `#loginCard` /
  `#adminPanel`): sin router, sin recarga. Cada card actual pasa a su sección.
- "Cerrar sesión" y el volver al sitio público viven en la topbar, a la derecha.

## Sección "Resumen"

Cuatro números, nada más. Grid de 2 columnas mobile / 4 desktop, cada tarjeta con
label 14px `--c-ink-500` y número 30px/700 `--c-ink-900`:

**Turnos de hoy · Turnos de mañana · Pendientes de pago · Bloqueos activos**

Los cuatro se calculan en el cliente con los datos que ya devuelven
`/admin/reservas` y `/admin/bloqueos`. Sin gráficos. Debajo, lista de los turnos de hoy
(máx. 5) y link "Ver todas las reservas" que cambia de sección.

## Sección "Bloqueos" → formulario paso a paso

Reemplaza la fila de 4 campos por 3 pasos verticales con cards numeradas:

```
1. Elegí la cancha        [ Cancha 11 ▾ ]

2. Elegí el día           [ Hoy ][ Mañana ][ Otro día ]
                          [ 14/08/2026 📅 ]
                          Viernes 14 de agosto

3. ¿Qué querés bloquear?  ( ) Un horario
                          ( ) Un rango de horarios
                          ( ) Todo el día

   → Un horario:          Horario  [ 16:00 ▾ ]
   → Rango:               Desde [ 16:00 ▾ ]  Hasta [ 18:00 ▾ ]
   → Todo el día:         (sin campos de hora)

   Motivo                 [ Ej: lluvia intensa ]
                          Se le muestra al usuario en el horario bloqueado.

   [ Bloquear cancha ]
```

- Los radios son **tarjetas seleccionables** de 56px de alto: borde 1px
  `--c-border-strong`, radio 12px, radio nativo a la izquierda (20px, `accent-color:
  var(--c-brand-700)`), label 16px/600. Seleccionada: borde 2px `--c-brand-700`, fondo
  `--c-brand-50`.
- Los campos de hora **se muestran/ocultan** según la opción. Esto sustituye al checkbox
  "Día completo" (`#bloqDiaCompleto`), que hoy convive con los selects y confunde.
  Al enviar, mapear a lo que ya espera el backend: `diaCompleto: true` para "Todo el día";
  `horario` para "Un horario"; `horarioDesde` + `horarioHasta` para el rango.
  **El payload del POST no cambia.**
- "Motivo" pasa a ser obligatorio para un rango o un día completo (validación de cliente):
  el usuario final ve ese texto. Texto de ayuda debajo del campo, como en el esquema.
- Vista previa antes de confirmar, en un Alert `info` arriba del botón:
  **"Vas a bloquear Cancha 11 el viernes 14 de agosto de 16:00 a 18:00."**

### Bloqueos activos

Grid de cards: 1 columna mobile / 2 ≥768px / 3 ≥1200px, gap 16px.

```
┌───────────────────────────────┐
│ Cancha 11          [Bloqueado]│  ← badge warning
│ Viernes 14 de agosto          │
│ 16:00 → 18:00                 │
│ Motivo: Lluvia intensa        │
│                    [ Quitar ] │  ← danger 40px
└───────────────────────────────┘
```

Fondo `--c-surface`, borde 1px `--c-block-border`, radio 12px, padding 16px.
Cancha 18px/700; fecha y horario 16px `--c-ink-700`; motivo 14px `--c-ink-500`.
"Quitar bloqueo" abre **modal de confirmación** (no `window.confirm`):
título "¿Quitar este bloqueo?", cuerpo "Cancha 11, viernes 14 de agosto, 16:00 a 18:00.
El horario vuelve a quedar disponible para reservar.", botones "Volver" / "Quitar bloqueo".

Los **bloqueos recurrentes** se mantienen en la misma sección, en una segunda card con
el mismo formato de cards, y el badge dice el día: "Todos los martes".
El formulario nuevo se muestra/oculta con el botón "+ Nuevo" que ya existe.

## Sección "Reservas"

- Filtros arriba en una sola fila: fecha, cancha, estado (Todas / Pagadas / Sin pagar),
  y "Exportar CSV" alineado a la derecha (secondary). En mobile, filtros apilados y el
  export al final.
- Se mantienen las dos vistas actuales (**Lista** / **Calendario**) como segmented control:
  contenedor con borde 1px `--c-border-strong`, radio 12px, alto 40px; activo con fondo
  `--c-brand-700` y texto blanco.
- **Lista**: cards, no tabla (hoy son cards generadas por `admin.js`, mantener). Cada una:
  cancha + horario en 18px/700, nombre y teléfono en 16px, badge de estado, y acciones
  como botones de 40px: "Ver comprobante" (secondary, abre `/api/:slug/comprobantes/:id`),
  "Marcar como pagada" (secondary → `PATCH /reservas/:id/estado`), "Cancelar turno"
  (danger → confirmación → `DELETE /reservas/:id`).
  El teléfono es un `<a href="tel:">` y suma un link a `wa.me` con ícono.
- **Calendario**: se mantiene la grilla semanal. Ajustes: celda mínima 44px de alto,
  encabezado de día sticky, celda ocupada con fondo `--c-busy-bg`, bloqueada
  `--c-block-bg`, libre `--c-surface`. Es la única zona con scroll horizontal permitido,
  dentro de su contenedor.

## Sección "Cancelaciones"

Hoy no existe como vista: las cancelaciones llegan por WhatsApp y el admin borra el turno.
La sección lista los turnos con **solicitud de cancelación pendiente** si el dato existe;
si no existe todavía en el backend, mostrar el estado vacío explicativo:

> **Las cancelaciones llegan por WhatsApp.** Cuando un usuario pide cancelar un turno, te
> escribe al WhatsApp del club. Podés cancelarlo desde **Reservas**.
> [ Ir a Reservas ]

**No inventar endpoints.** Si más adelante se agrega un estado "cancelación solicitada",
esta sección ya tiene el lugar.

## Sección "Configuración"

Se mantienen los 4 bloques actuales (datos generales, transferencia, canchas, contraseña),
pero como **cards separadas**, cada una con su propio botón "Guardar cambios" y su Alert
de resultado. Se elimina el acordeón: dentro de su sección, todo visible.
Campos en grid de 1 columna mobile / 2 desktop. La lista de canchas es una card por
cancha con nombre, etiqueta y acciones "Editar" / "Eliminar" (confirmación).

## Responsive del panel

| | Mobile <768 | Tablet 768–1023 | Desktop ≥1024 |
| --- | --- | --- | --- |
| Navegación | tabs sticky | tabs sticky | nav lateral 220px |
| Resumen | 2 columnas | 4 columnas | 4 columnas |
| Bloqueos activos | 1 columna | 2 columnas | 3 columnas |
| Formularios | 1 columna | 2 columnas | 2 columnas |
| Reservas (lista) | cards apiladas | 2 columnas | 2 columnas |

# 05 · Estados y mensajes

Todos los textos son **literales**: usarlos tal cual. Español rioplatense, voseo,
sin tecnicismos, sin códigos de error, sin signos de exclamación salvo en el éxito final.

Regla general: un mensaje dice **qué pasó** y **qué hacer ahora**.

## Carga

| Dónde | Qué se muestra |
| --- | --- |
| Horarios (primera carga y cambio de filtro) | 3 filas skeleton de 56px + botón en estado `loading` con texto "Buscando…" |
| Mis turnos | 2 filas skeleton de 72px |
| Envío de la reserva | Botón "Reservar" → `loading` con "Guardando…"; el modal no se puede cerrar mientras dura |
| Login admin | Botón → "Ingresando…" |
| Listas del panel | Skeletons con la forma de la card |

Nunca un spinner solo en el centro de la pantalla. Nunca dejar el área en blanco.

## Vacíos

**Sin horarios disponibles ese día**
> **No quedan horarios libres este día.**
> Probá con otra fecha o con la otra cancha.
> [ Ver mañana ]

**Cancha cerrada / día completo bloqueado**
> **La cancha está cerrada este día.**
> Motivo: {motivo}. Elegí otra fecha para ver los horarios disponibles.

**Todos los horarios ya pasaron (fecha de hoy, de noche)**
> **Ya pasaron todos los horarios de hoy.**
> [ Ver los horarios de mañana ]

**Sin turnos para ese teléfono**
> **No encontramos turnos con ese número.**
> Revisá que sea el mismo número que usaste al reservar, sin 0 ni 15.

**Sin bloqueos activos** (admin)
> **No hay bloqueos activos.**
> Cuando bloqueés un horario o un día, va a aparecer acá.

**Sin reservas para el filtro** (admin)
> **No hay turnos para esa fecha.**
> [ Ver todas las reservas ]

Formato del estado vacío: bloque centrado, padding 40px 24px, ícono SVG de 32px
`--c-ink-400`, título 18px/600 `--c-ink-900`, texto 16px `--c-ink-500` (máx. 42
caracteres por línea), botón secondary opcional. Sin ilustraciones.

## Errores

Los mensajes de la API llegan en `data.error`. **Nunca mostrarlos crudos ni mostrar
códigos HTTP.** Mapear por caso y usar un texto genérico como último recurso.

| Situación | Texto |
| --- | --- |
| Horario tomado mientras el usuario decidía (409 / "Horario ya reservado") | **Ese horario acaba de ser reservado por otra persona.** Elegí otro horario de la lista. |
| Horario bloqueado por el admin recién | **Ese horario acaba de ser bloqueado por el club.** Elegí otro horario. |
| Sin conexión / fetch falla | **No pudimos conectarnos.** Revisá tu conexión a internet y probá de nuevo. [ Reintentar ] |
| Falla al cargar horarios | **No pudimos cargar los horarios.** [ Probar de nuevo ] |
| Nombre corto | Escribí tu nombre y apellido. |
| Teléfono inválido | Escribí tu número sin espacios ni guiones. Ej: 3364578599 |
| Falta comprobante | Adjuntá la foto o el PDF del comprobante de transferencia. |
| Comprobante > 5 MB | Ese archivo es muy grande. El máximo es 5 MB: probá con una foto más chica. |
| Formato de comprobante inválido | Sólo aceptamos imágenes (JPG, PNG, WEBP) o PDF. |
| Fecha pasada | Esa fecha ya pasó. Elegí desde hoy en adelante. |
| Clave admin incorrecta | La clave no es correcta. Fijate que no tenga espacios de más. |
| Sesión admin vencida (401) | **Tu sesión se cerró.** Volvé a ingresar con tu clave. |
| Error genérico | **Algo no funcionó.** Probá de nuevo en un minuto. Si sigue pasando, escribinos por WhatsApp. |

Los errores de campo van **debajo del campo**, 14px `--c-danger`, con ícono de alerta de
16px, y el input pasa a borde `--c-danger` + `aria-invalid="true"`.
Los errores de operación van en un **Alert `error`** arriba del botón que la disparó,
con `role="alert"`.

## Éxito

**Reserva creada** → paso 3 del modal:
> ✓ **¡Turno reservado!**
> Cancha 11 · Viernes 14 de agosto · 13:00 – 14:00
> Enviá el comprobante por WhatsApp para que el club confirme tu pago.
> [ Enviar comprobante por WhatsApp ] [ Reservar otro turno ]

**Cancelación solicitada** → Alert `success` en la card del turno:
> **Pedido de cancelación enviado.** El club te va a confirmar por WhatsApp.

**Bloqueo creado** (admin) → Alert `success` arriba del formulario, 4 s:
> **Bloqueo creado.** Cancha 11, viernes 14 de agosto, 16:00 a 18:00.

**Bloqueo eliminado** (admin):
> **Bloqueo quitado.** El horario volvió a estar disponible.

**Configuración guardada**:
> **Cambios guardados.**

**Turno marcado como pagado**:
> **Turno marcado como pagado.**

Los Alerts de éxito se autocierran a los 4 s y llevan `role="status"`.
Los de error **no** se autocierran.

## Confirmaciones destructivas

Reemplazan a los `window.confirm()` actuales.

**Quitar bloqueo**
> **¿Quitar este bloqueo?**
> Cancha 11, viernes 14 de agosto, 16:00 a 18:00.
> El horario vuelve a quedar disponible para reservar.
> [ Volver ] [ Quitar bloqueo ]

**Cancelar un turno** (admin)
> **¿Cancelar este turno?**
> Cancha 11, viernes 14 de agosto, 13:00. Reservado por Juan Pérez.
> El horario queda libre y el turno se elimina. No se puede deshacer.
> [ Volver ] [ Cancelar turno ]

**Solicitar cancelación** (usuario)
> **¿Pedir la cancelación de este turno?**
> Te vamos a abrir WhatsApp con el mensaje ya escrito para que lo envíes al club.
> [ Volver ] [ Abrir WhatsApp ]

**Eliminar cancha** (admin)
> **¿Eliminar {etiqueta}?**
> Dejará de aparecer para reservar. Los turnos ya reservados no se borran.
> [ Volver ] [ Eliminar ]

## Micro-copys sueltos

| Elemento | Texto |
| --- | --- |
| h1 público | Reservar una cancha |
| Sub h1 | Elegí la cancha, la fecha y el horario que preferís. |
| Título card 1 | ¿Qué cancha y qué día? |
| Título card 2 | Elegí un horario |
| Botón buscar | Ver horarios |
| Contador | {n} horarios disponibles / 1 horario disponible |
| Título resumen | Tu reserva |
| CTA resumen | Confirmar reserva |
| Secundario resumen | Cambiar horario |
| Título "mis turnos" | ¿Ya tenés una reserva? |
| Sub | Ingresá tu número de teléfono para consultar tus turnos. |
| Botón | Consultar mis turnos |
| Estados de slot | Disponible · Ocupado · Bloqueado · Ya pasó |
| Paso 1 del modal | Tus datos |
| Paso 2 | Pago de la seña |
| Paso 3 | Listo |
| Ayuda comprobante | Elegí una foto o PDF del comprobante · Máximo 5 MB |
| Login admin | Panel de administración |
| Nav admin | Resumen · Reservas · Bloqueos · Cancelaciones · Configuración |
| Paso 3 admin | ¿Qué querés bloquear? |
| Opciones | Un horario · Un rango de horarios · Todo el día |
| Ayuda motivo | Se le muestra al usuario en el horario bloqueado. |
| CTA bloqueo | Bloquear cancha |

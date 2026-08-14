# Prompt para pegar en Claude Code

Copiá y pegá este texto al abrir Claude Code en el repo `Reservas-Cancha`.
Los archivos de este paquete deben estar en la raíz del repo (o pasar la ruta donde los pusiste).

---

Vamos a rediseñar la interfaz de CMR Canchas. La especificación completa está en
`design_handoff_cmr_canchas/`. Leé en este orden:

1. `README.md` — contexto, alcance y reglas.
2. `01-design-system.md` + `tokens.css` — colores, tipografía, espaciado, sombras.
3. `02-componentes.md` — botones, inputs, cards, badges, alerts, modal, skeletons.
4. `03-pantalla-reservas.md` — la pantalla más importante.
5. `04-panel-admin.md`
6. `05-estados-y-mensajes.md` — todos los estados vacío/carga/error y los textos exactos.
7. `06-plan-de-implementacion.md` — orden de trabajo en PRs chicos.

Reglas no negociables:

- **No cambiar la lógica de negocio.** No toques `server/index.js` salvo que la
  especificación lo pida explícitamente (y en ese caso, sólo cambios de presentación).
  Los endpoints, nombres de campos, validaciones y el flujo de WhatsApp siguen igual.
- **No cambiar los `id` del DOM que usa el JS** sin actualizar el JS en el mismo commit.
  `app.js` y `admin.js` buscan elementos por id (`#cancha`, `#fecha`, `#horarios`,
  `#btnBuscar`, `#modal`, `#paso1`…). Está bien renombrarlos, pero entonces hay que
  actualizar todas las referencias y verificar que la app siga funcionando.
- **Mobile primero.** La mayoría reserva desde el celular.
- **Accesibilidad real**: contraste AA, foco visible, target táctil ≥ 48px, estados que
  no dependan sólo del color.
- **Rendimiento**: sacar el CDN de Tailwind de producción (ver README, sección
  Rendimiento). Nada de librerías de UI nuevas. Sin dependencias de front nuevas.

Trabajá en PRs chicos siguiendo `06-plan-de-implementacion.md`. Antes de cada PR,
decime qué vas a tocar. Después de cada PR, probá manualmente el flujo completo:
elegir cancha → fecha → horario → paso 1 → paso 2 → confirmación → WhatsApp, y en admin:
login → crear bloqueo → ver bloqueos → quitar bloqueo.

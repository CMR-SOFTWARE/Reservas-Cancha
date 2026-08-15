function getClubSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] || "";
}
const CLUB_SLUG = getClubSlug();

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const loginCard = document.getElementById("loginCard");
const adminPanel = document.getElementById("adminPanel");
const adminPassword = document.getElementById("adminPassword");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const loginMessage = document.getElementById("loginMessage");
const adminMessage = document.getElementById("adminMessage");
const bloqCancha = document.getElementById("bloqCancha");
const bloqFecha = document.getElementById("bloqFecha");
const bloqHorarioDesde = document.getElementById("bloqHorarioDesde");
const bloqHorarioHasta = document.getElementById("bloqHorarioHasta");
const bloqMotivo = document.getElementById("bloqMotivo");
const btnCrearBloqueo = document.getElementById("btnCrearBloqueo");
const bloqueosList = document.getElementById("bloqueosList");
const reservasList = document.getElementById("reservasList");

let config = null;
let adminToken = localStorage.getItem("adminToken") || "";
let reservasActuales = [];

function todayISO() {
  const date = new Date();
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date - tzOffset).toISOString().split("T")[0];
}

function formatFecha(fechaIso) {
  const [yyyy, mm, dd] = fechaIso.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

const ICONO_ALERTA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>`;
const ICONO_OK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>`;

// Los mensajes eran parrafos de color al final del bloque; ahora son Alerts.
// Los de exito se cierran solos a los 4s, los de error se quedan.
function setMessage(el, text, isError = true) {
  if (!el) return;
  if (!text) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="alert ${isError ? "alert--error" : "alert--success"}" role="${isError ? "alert" : "status"}">
    ${isError ? ICONO_ALERTA : ICONO_OK}<span>${escapeHtml(text)}</span>
  </div>`;
  if (!isError) {
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.innerHTML = ""; }, 4000);
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || "Error de servidor.");
    err.status = response.status;
    throw err;
  }
  return data;
}

async function loadConfig() {
  config = await api(`/api/${CLUB_SLUG}/config`);

  // Poblar dropdown de canchas dinamicamente
  const canchaOptions = config.canchas
    .map((c) => `<option value="${c.nombre}">${c.etiqueta}</option>`)
    .join("");
  bloqCancha.innerHTML = canchaOptions;

  // Poblar selectores de horarios
  const horarioOptions = config.horarios
    .map((h) => `<option value="${h}">${h}</option>`)
    .join("");
  bloqHorarioDesde.innerHTML = horarioOptions;
  bloqHorarioHasta.innerHTML = horarioOptions;
  const bloqHorarioEl = document.getElementById("bloqHorario");
  if (bloqHorarioEl) bloqHorarioEl.innerHTML = horarioOptions;
  // Recien ahora los selects tienen opciones: la vista previa necesita la
  // etiqueta de la cancha para armarse.
  if (typeof sincronizarFormBloqueo === "function") sincronizarFormBloqueo();

  // Actualizar link de volver al menu
  const linkMenu = document.getElementById("linkMenu");
  if (linkMenu) linkMenu.href = `/${CLUB_SLUG}`;

  // El nombre del club va al header y al login, no al h1 de la seccion.
  if (config.nombre) {
    document.title = `${config.nombre} · Panel`;
    // Solo el nombre: el " · Panel" es un span aparte que se oculta en mobile.
    const clubEnHeader = document.querySelector(".site-club");
    if (clubEnHeader) clubEnHeader.textContent = config.nombre;
    const loginClub = document.getElementById("loginClub");
    if (loginClub) loginClub.textContent = config.nombre;
  }

  // El panel mostraba el logo de CMR: va el del club, igual que en la publica.
  pintarLogo("navLogo", "site-logo");
  pintarLogo("loginLogo", "login-logo");

  // Poblar selector de cancha del calendario
  const calCanchaEl = document.getElementById("calCancha");
  if (calCanchaEl) {
    calCanchaEl.innerHTML = config.canchas
      .map((c) => `<option value="${escapeHtml(c.nombre)}">${escapeHtml(c.etiqueta)}</option>`)
      .join("");
  }

  // Poblar selectores de bloqueos recurrentes
  const recCanchaEl = document.getElementById("recCancha");
  if (recCanchaEl) {
    recCanchaEl.innerHTML = config.canchas
      .map((c) => `<option value="${escapeHtml(c.nombre)}">${escapeHtml(c.etiqueta)}</option>`)
      .join("");
  }
  const recHorarioDesdeEl = document.getElementById("recHorarioDesde");
  const recHorarioHastaEl = document.getElementById("recHorarioHasta");
  if (recHorarioDesdeEl && recHorarioHastaEl) {
    const horarioOpts = config.horarios.map((h) => `<option value="${h}">${h}</option>`).join("");
    recHorarioDesdeEl.innerHTML = horarioOpts;
    recHorarioHastaEl.innerHTML = horarioOpts;
  }
}

// Logo del club, o sus iniciales si no cargo ninguno.
function pintarLogo(id, clase) {
  const el = document.getElementById(id);
  if (!el || !config) return;
  if (config.logoUrl) {
    el.outerHTML = `<img id="${id}" src="${escapeHtml(config.logoUrl)}" alt="" class="${clase}" />`;
    return;
  }
  const iniciales = String(config.nombre || "")
    .split(/\s+/).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
  el.textContent = iniciales;
}

// Duplicada de app.js a proposito: los dos scripts son independientes y no hay
// build. Si crecen mas helpers compartidos, conviene un public/comun.js.
function fechaEnPalabras(fechaIso) {
  const [year, month, day] = String(fechaIso).split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "";
  const texto = new Date(year, month - 1, day)
    .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    .replace(",", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function isoSumandoDias(dias) {
  const date = new Date();
  date.setDate(date.getDate() + dias);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date - tzOffset).toISOString().split("T")[0];
}

function getCanchaEtiqueta(nombreCancha) {
  if (!config) return `Cancha ${nombreCancha}`;
  const found = config.canchas.find((c) => c.nombre === String(nombreCancha));
  return found ? found.etiqueta : `Cancha ${nombreCancha}`;
}

function whatsappHref(r) {
  const telefono = r.telefono.replace(/\D/g, "");
  const canchaLabel = getCanchaEtiqueta(r.cancha);
  const fecha = formatFecha(r.fecha);
  const texto = encodeURIComponent(
    `Hola ${r.nombre}, te contactamos sobre tu reserva en ${canchaLabel} el ${fecha} a las ${r.horario}hs.`
  );
  return `https://wa.me/${telefono}?text=${texto}`;
}

function estadoBadge(estado, pasada = false) {
  if (pasada) return `<span class="badge">Pasado</span>`;
  const esPagado = estado === "confirmada";
  return `<span class="badge ${esPagado ? "badge--ok" : "badge--pendiente"}">${esPagado ? "Pagado" : "Sin pagar"}</span>`;
}

function tituloVacioReservas() {
  const filtro = document.getElementById("filtroEstado")?.value || "";
  if (filtroFecha.value) return "No hay turnos para esa fecha.";
  if (filtro === "pasadas") return "Todavía no hay turnos en el historial.";
  if (filtro) return "No hay turnos vigentes con ese estado.";
  return "No hay turnos próximos.";
}

function renderReservas(reservas) {
  if (!reservas.length) {
    reservasList.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>
      </svg>
      <p><strong style="color: var(--c-ink-900)">${escapeHtml(tituloVacioReservas())}</strong></p>
      ${filtroFecha.value ? `<button type="button" class="btn btn--secondary btn--sm" id="btnVerTodasVacio">Ver todas las reservas</button>` : ""}
    </div>`;
    document.getElementById("btnVerTodasVacio")?.addEventListener("click", () => {
      filtroFecha.value = "";
      loadReservasAdmin("");
    });
    return;
  }
  const sorted = [...reservas].sort((a, b) => {
    if (Boolean(a.pasada) !== Boolean(b.pasada)) return a.pasada ? 1 : -1;
    if (a.estado === "pendiente" && b.estado !== "pendiente") return -1;
    if (a.estado !== "pendiente" && b.estado === "pendiente") return 1;
    return 0;
  });
  reservasList.innerHTML = sorted.map((r) => {
    const detalle = `${getCanchaEtiqueta(r.cancha)}, ${fechaEnPalabras(r.fecha).toLowerCase()}, ${r.horario}. Reservado por ${r.nombre}.`;
    const telefonoLimpio = String(r.telefono).replace(/\D/g, "");
    return `
    <article class="reserva-card${r.pasada ? " es-pasada" : ""}">
      <div class="reserva-cabecera">
        <p class="reserva-turno">${escapeHtml(getCanchaEtiqueta(r.cancha))} · ${escapeHtml(r.horario)}</p>
        ${estadoBadge(r.estado, r.pasada)}
      </div>
      <p class="turno-dato">${ICONO_CALENDARIO}${escapeHtml(fechaEnPalabras(r.fecha))}</p>
      <p class="reserva-nombre">${escapeHtml(r.nombre)}</p>
      <p class="turno-dato">
        ${ICONO_TELEFONO}
        <a href="tel:${escapeHtml(telefonoLimpio)}">${escapeHtml(r.telefono)}</a>
        <a href="${escapeHtml(whatsappHref(r))}" target="_blank" rel="noopener noreferrer" title="Escribir por WhatsApp">
          ${ICONO_WHATSAPP}<span class="sr-only">Escribir por WhatsApp a ${escapeHtml(r.nombre)}</span>
        </a>
      </p>
      <div class="reserva-acciones">
        <a href="${escapeHtml(r.comprobanteUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn--sm">
          Ver comprobante
        </a>
        ${r.pasada ? "" : (r.estado === "pendiente"
          ? `<button class="btn btn--secondary btn--sm" data-action="confirmar" data-id="${r.id}" type="button">Marcar como pagada</button>`
          : `<button class="btn btn--secondary btn--sm" data-action="revertir" data-id="${r.id}" type="button">Marcar sin pagar</button>`)}
        ${r.pasada ? "" : `<button class="btn btn--danger btn--sm" data-action="cancelar" data-id="${r.id}"
          data-detalle="${escapeHtml(detalle)}" type="button">Cancelar turno</button>`}
      </div>
    </article>`;
  }).join("");
}

const ICONO_CALENDARIO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>`;
const ICONO_TELEFONO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.5a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></svg>`;
const ICONO_WHATSAPP = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:16px;height:16px"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.1-.2 0-.4.1-.5l.4-.5.2-.4v-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3c-.3.3-1 1-1 2.4s1 2.8 1.2 3a9.6 9.6 0 0 0 4.9 4.3c1.3.4 1.8.4 2.4.3.7-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2z"/></svg>`;

// Un bloqueo de ayer ya no bloquea nada: la card se llama "Bloqueos activos".
function esBloqueoVigente(bloqueo) {
  return String(bloqueo.fecha) >= todayISO();
}

function renderBloqueos(todos) {
  const bloqueos = (todos || []).filter(esBloqueoVigente);
  if (!bloqueos.length) {
    bloqueosList.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
      </svg>
      <p><strong style="color: var(--c-ink-900)">No hay bloqueos activos.</strong><br />
      Cuando bloquees un horario o un día, va a aparecer acá.</p>
    </div>`;
    return;
  }
  bloqueosList.innerHTML = bloqueos.map((b) => {
    const detalle = `${getCanchaEtiqueta(b.cancha)}, ${formatFecha(b.fecha)}, ${describeBloqueoHorario(b).toLowerCase()}`;
    return `
    <article class="bloqueo-card">
      <div style="display: flex; align-items: start; justify-content: space-between; gap: var(--s-3)">
        <p class="bloqueo-cancha">${escapeHtml(getCanchaEtiqueta(b.cancha))}</p>
        <span class="badge badge--bloqueado">Bloqueado</span>
      </div>
      <p style="margin-top: var(--s-2)">${escapeHtml(formatFecha(b.fecha))}</p>
      <p>${escapeHtml(describeBloqueoHorario(b))}</p>
      <p class="bloqueo-motivo">Motivo: ${escapeHtml(b.motivo)}</p>
      <button class="btn btn--danger btn--sm" style="margin-top: var(--s-3)"
        data-action="quitar-bloqueo" data-id="${b.id}" data-detalle="${escapeHtml(detalle)}" type="button">
        Quitar bloqueo
      </button>
    </article>`;
  }).join("");
}

function describeBloqueoHorario(bloqueo) {
  if (bloqueo.diaCompleto) return "Dia completo";
  if (bloqueo.horarioDesde && bloqueo.horarioHasta) {
    return `Horario ${bloqueo.horarioDesde} a ${bloqueo.horarioHasta}`;
  }
  return `Horario ${bloqueo.horario}`;
}

const filtroFecha = document.getElementById("filtroFecha");
const btnFiltrarReservas = document.getElementById("btnFiltrarReservas");
const btnLimpiarFiltro = document.getElementById("btnLimpiarFiltro");

// El filtrado es en el cliente: la API no tiene esos parametros y no se
// inventan endpoints. Los turnos pasados no se borran, solo salen de la vista
// por defecto y se consultan con el filtro "Pasados".
function aplicarFiltroEstado(reservas) {
  const filtro = document.getElementById("filtroEstado")?.value || "";
  if (filtro === "pasadas") return reservas.filter((r) => r.pasada);
  const vigentes = reservas.filter((r) => !r.pasada);
  if (!filtro) return vigentes;
  return vigentes.filter((r) => (r.estado || "pendiente") === filtro);
}

async function loadReservasAdmin(fecha = "") {
  const qs = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  const reservas = await api(`/api/${CLUB_SLUG}/admin/reservas${qs}`);
  reservasActuales = reservas;
  renderReservas(aplicarFiltroEstado(reservas));
}

async function refreshAdminData() {
  const [, bloqueos, bloqueosRec] = await Promise.all([
    loadReservasAdmin(filtroFecha.value),
    api(`/api/${CLUB_SLUG}/admin/bloqueos`),
    api(`/api/${CLUB_SLUG}/admin/bloqueos-recurrentes`),
  ]);
  renderBloqueos(bloqueos);
  renderBloqueosRecurrentes(bloqueosRec);
  renderResumen(bloqueos);
}

// ── Resumen ───────────────────────────────────────────────────
// Los cuatro numeros salen de los datos que ya se cargaron: sin endpoints nuevos.
function renderResumen(bloqueos = []) {
  const hoy = todayISO();
  const manana = isoSumandoDias(1);
  const vigentes = reservasActuales.filter((r) => !r.pasada);

  const deHoy = vigentes.filter((r) => r.fecha === hoy);
  const set = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(valor);
  };
  set("mtHoy", deHoy.length);
  set("mtManana", vigentes.filter((r) => r.fecha === manana).length);
  set("mtPendientes", vigentes.filter((r) => r.estado !== "confirmada").length);
  set("mtBloqueos", bloqueos.filter(esBloqueoVigente).length);

  const lista = document.getElementById("turnosDeHoy");
  if (!lista) return;
  if (!deHoy.length) {
    lista.innerHTML = `<p class="help">No hay turnos para hoy.</p>`;
    return;
  }
  lista.innerHTML = deHoy
    .sort((a, b) => a.horario.localeCompare(b.horario))
    .slice(0, 5)
    .map((r) => `<div class="turno-dato">
      <strong style="color: var(--c-ink-900)">${escapeHtml(r.horario)}</strong>
      ${escapeHtml(getCanchaEtiqueta(r.cancha))} · ${escapeHtml(r.nombre)}
      <span class="badge ${r.estado === "confirmada" ? "badge--ok" : "badge--pendiente"}">
        ${r.estado === "confirmada" ? "Pagado" : "Sin pagar"}
      </span>
    </div>`)
    .join("");
}

btnFiltrarReservas.addEventListener("click", () => loadReservasAdmin(filtroFecha.value));

btnLimpiarFiltro.addEventListener("click", () => {
  filtroFecha.value = "";
  const estado = document.getElementById("filtroEstado");
  if (estado) estado.value = "";
  loadReservasAdmin("");
});

document.getElementById("filtroEstado")?.addEventListener("change", () => {
  loadReservasAdmin(filtroFecha.value);
});

function setAuthenticatedUI(isAuth) {
  // Atributo hidden y no clase: cada pantalla tiene su propio <main>, y el
  // landmark del que esta oculto tiene que quedar fuera del arbol accesible.
  loginCard.hidden = isAuth;
  adminPanel.hidden = !isAuth;
  const acciones = document.getElementById("topbarAcciones");
  if (acciones) acciones.hidden = !isAuth;
  // El menu solo tiene sentido con sesion abierta.
  const menu = document.getElementById("btnMenu");
  if (menu) menu.hidden = !isAuth;
}

// ── Navegacion entre secciones ────────────────────────────────
// Sin router: las secciones son la misma pagina y se muestran con hidden.
function mostrarSeccion(nombre) {
  document.querySelectorAll(".panel-seccion").forEach((seccion) => {
    seccion.classList.toggle("hidden", seccion.dataset.panel !== nombre);
  });
  // Los datos del club se piden al entrar a Configuracion, como antes hacia el
  // acordeon al abrirse.
  if (nombre === "configuracion") loadConfigPanel();
  document.querySelectorAll(".panel-nav-item").forEach((item) => {
    item.classList.toggle("is-activa", item.dataset.seccion === nombre);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Cajon lateral (mobile) ────────────────────────────────────
// De 1024px para arriba la nav es fija y el cajon no existe: el CSS oculta el
// boton y el overlay, y esta logica queda sin efecto.
const panelNav = document.getElementById("panelNav");
const panelOverlay = document.getElementById("panelOverlay");
const btnMenu = document.getElementById("btnMenu");
let focoPrevioMenu = null;

function menuEsCajon() {
  return window.matchMedia("(max-width: 1023px)").matches;
}

function abrirMenu() {
  if (!menuEsCajon()) return;
  focoPrevioMenu = document.activeElement;
  panelNav.classList.add("is-abierta");
  panelOverlay.hidden = false;
  btnMenu.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
  panelNav.querySelector(".panel-nav-item")?.focus();
}

function cerrarMenu({ devolverFoco = true } = {}) {
  panelNav.classList.remove("is-abierta");
  panelOverlay.hidden = true;
  btnMenu.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
  if (devolverFoco && focoPrevioMenu && document.contains(focoPrevioMenu)) focoPrevioMenu.focus();
}

function menuAbierto() {
  return panelNav.classList.contains("is-abierta");
}

btnMenu?.addEventListener("click", () => (menuAbierto() ? cerrarMenu() : abrirMenu()));
panelOverlay?.addEventListener("click", () => cerrarMenu());

document.addEventListener("keydown", (event) => {
  if (!menuAbierto()) return;
  if (event.key === "Escape") { cerrarMenu(); return; }
  if (event.key !== "Tab") return;
  // Foco atrapado dentro del cajon mientras esta abierto.
  const focheables = panelNav.querySelectorAll("button, a[href]");
  if (!focheables.length) return;
  const primero = focheables[0];
  const ultimo = focheables[focheables.length - 1];
  if (event.shiftKey && document.activeElement === primero) {
    event.preventDefault();
    ultimo.focus();
  } else if (!event.shiftKey && document.activeElement === ultimo) {
    event.preventDefault();
    primero.focus();
  }
});

// Si la ventana se agranda con el cajon abierto, hay que soltar el scroll.
window.addEventListener("resize", () => {
  if (!menuEsCajon() && menuAbierto()) cerrarMenu({ devolverFoco: false });
});

document.querySelectorAll(".panel-nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    mostrarSeccion(item.dataset.seccion);
    if (menuAbierto()) cerrarMenu();
  });
});
document.querySelectorAll("[data-ir-a]").forEach((boton) => {
  boton.addEventListener("click", () => mostrarSeccion(boton.dataset.irA));
});

// ── Modal de confirmacion (reemplaza window.confirm) ──────────
const modalConfirmar = document.getElementById("modalConfirmar");
const confirmarTitulo = document.getElementById("confirmarTitulo");
const confirmarCuerpo = document.getElementById("confirmarCuerpo");
const btnConfirmarSi = document.getElementById("btnConfirmarSi");
const btnConfirmarNo = document.getElementById("btnConfirmarNo");
let accionConfirmada = null;

function pedirConfirmacion({ titulo, cuerpo, textoAccion, onAceptar }) {
  confirmarTitulo.textContent = titulo;
  confirmarCuerpo.innerHTML = cuerpo;
  btnConfirmarSi.textContent = textoAccion;
  accionConfirmada = onAceptar;
  modalConfirmar.classList.remove("hidden");
  btnConfirmarSi.focus();
}

function cerrarConfirmacion() {
  modalConfirmar.classList.add("hidden");
  accionConfirmada = null;
}

btnConfirmarNo.addEventListener("click", cerrarConfirmacion);
modalConfirmar.addEventListener("click", (e) => { if (e.target === modalConfirmar) cerrarConfirmacion(); });
btnConfirmarSi.addEventListener("click", () => {
  const accion = accionConfirmada;
  cerrarConfirmacion();
  if (accion) accion();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalConfirmar.classList.contains("hidden")) cerrarConfirmacion();
});

// Mostrar / ocultar la clave en el login
const btnVerClave = document.getElementById("btnVerClave");
if (btnVerClave) {
  btnVerClave.addEventListener("click", () => {
    const visible = adminPassword.type === "text";
    adminPassword.type = visible ? "password" : "text";
    btnVerClave.textContent = visible ? "Mostrar" : "Ocultar";
    btnVerClave.setAttribute("aria-pressed", String(!visible));
    adminPassword.focus();
  });
}

btnLogin.addEventListener("click", async () => {
  try {
    const password = adminPassword.value.trim();
    if (!password) { setMessage(loginMessage, "Ingresa la clave admin."); return; }
    const data = await api(`/api/${CLUB_SLUG}/admin/login`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    adminToken = data.token;
    localStorage.setItem("adminToken", adminToken);
    setAuthenticatedUI(true);
    setMessage(loginMessage, "");
    await refreshAdminData();
  } catch (error) { setMessage(loginMessage, error.message || "No se pudo iniciar sesion."); }
});

btnLogout.addEventListener("click", () => {
  adminToken = "";
  localStorage.removeItem("adminToken");
  window.location.href = `/${CLUB_SLUG}`;
});

// ── Formulario de bloqueo ─────────────────────────────────────
// El checkbox "Dia completo" convivia con los dos selects de horario sin
// desactivarlos. Ahora hay tres opciones excluyentes y los campos de hora se
// muestran segun cual este elegida. El payload al backend es el mismo.
const bloqHorario = document.getElementById("bloqHorario");
const campoHorarioUnico = document.getElementById("campoHorarioUnico");
const campoRango = document.getElementById("campoRango");
const bloqPreview = document.getElementById("bloqPreview");
const bloqFechaEnPalabras = document.getElementById("bloqFechaEnPalabras");

function tipoDeBloqueo() {
  return document.querySelector('input[name="bloqTipo"]:checked')?.value || "horario";
}

function armarPayloadBloqueo() {
  const tipo = tipoDeBloqueo();
  return {
    cancha: bloqCancha.value,
    fecha: bloqFecha.value,
    horario: tipo === "horario" ? bloqHorario.value : "",
    horarioDesde: tipo === "rango" ? bloqHorarioDesde.value : "",
    horarioHasta: tipo === "rango" ? bloqHorarioHasta.value : "",
    diaCompleto: tipo === "dia",
    motivo: bloqMotivo.value.trim(),
  };
}

function describirBloqueoElegido() {
  const tipo = tipoDeBloqueo();
  const cancha = bloqCancha.options[bloqCancha.selectedIndex]?.text || bloqCancha.value;
  const dia = fechaEnPalabras(bloqFecha.value);
  if (!cancha || !dia) return "";
  if (tipo === "dia") return `Vas a bloquear ${cancha} el ${dia.toLowerCase()}, todo el día.`;
  if (tipo === "rango") return `Vas a bloquear ${cancha} el ${dia.toLowerCase()} de ${bloqHorarioDesde.value} a ${bloqHorarioHasta.value}.`;
  return `Vas a bloquear ${cancha} el ${dia.toLowerCase()} a las ${bloqHorario.value}.`;
}

function sincronizarFormBloqueo() {
  const tipo = tipoDeBloqueo();
  campoHorarioUnico.classList.toggle("hidden", tipo !== "horario");
  campoRango.classList.toggle("hidden", tipo !== "rango");

  if (bloqFechaEnPalabras) bloqFechaEnPalabras.textContent = fechaEnPalabras(bloqFecha.value);
  const hoy = todayISO();
  const manana = isoSumandoDias(1);
  document.getElementById("bloqChipHoy")?.setAttribute("aria-pressed", String(bloqFecha.value === hoy));
  document.getElementById("bloqChipManana")?.setAttribute("aria-pressed", String(bloqFecha.value === manana));
  document.getElementById("bloqChipOtro")?.setAttribute("aria-pressed",
    String(Boolean(bloqFecha.value) && bloqFecha.value !== hoy && bloqFecha.value !== manana));

  const texto = describirBloqueoElegido();
  bloqPreview.innerHTML = texto
    ? `<div class="alert alert--info">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/></svg>
         <span>${escapeHtml(texto)}</span>
       </div>`
    : "";
}

document.querySelectorAll('input[name="bloqTipo"]').forEach((radio) => {
  radio.addEventListener("change", sincronizarFormBloqueo);
});
[bloqCancha, bloqFecha, bloqHorario, bloqHorarioDesde, bloqHorarioHasta].forEach((campo) => {
  campo?.addEventListener("change", sincronizarFormBloqueo);
});

function setFechaBloqueo(iso) {
  bloqFecha.value = iso;
  sincronizarFormBloqueo();
}
document.getElementById("bloqChipHoy")?.addEventListener("click", () => setFechaBloqueo(todayISO()));
document.getElementById("bloqChipManana")?.addEventListener("click", () => setFechaBloqueo(isoSumandoDias(1)));
document.getElementById("bloqChipOtro")?.addEventListener("click", () => {
  bloqFecha.focus();
  if (typeof bloqFecha.showPicker === "function") {
    try { bloqFecha.showPicker(); } catch (_) { /* algunos navegadores lo bloquean */ }
  }
});

btnCrearBloqueo.addEventListener("click", async () => {
  const tipo = tipoDeBloqueo();
  const payload = armarPayloadBloqueo();

  if (!payload.fecha) {
    setMessage(adminMessage, "Elegí el día que querés bloquear.");
    return;
  }
  // El motivo lo ve el usuario final: obligatorio cuando cierra varias horas.
  if (tipo !== "horario" && !payload.motivo) {
    setErrorAdmin("errorBloqMotivo", "bloqMotivo", "Escribí el motivo: se lo mostramos al usuario en el horario bloqueado.");
    return;
  }
  setErrorAdmin("errorBloqMotivo", "bloqMotivo", "");

  const textoOriginal = btnCrearBloqueo.textContent;
  btnCrearBloqueo.disabled = true;
  btnCrearBloqueo.classList.add("is-loading");
  btnCrearBloqueo.textContent = "Guardando…";
  try {
    await api(`/api/${CLUB_SLUG}/admin/bloqueos`, { method: "POST", body: JSON.stringify(payload) });
    setMessage(adminMessage, `Bloqueo creado. ${describirBloqueoElegido().replace("Vas a bloquear ", "")}`, false);
    bloqMotivo.value = "";
    await refreshAdminData();
    sincronizarFormBloqueo();
  } catch (error) {
    setMessage(adminMessage, error.message || "No se pudo crear el bloqueo.");
  } finally {
    btnCrearBloqueo.disabled = false;
    btnCrearBloqueo.classList.remove("is-loading");
    btnCrearBloqueo.textContent = textoOriginal;
  }
});

function setErrorAdmin(idError, idCampo, texto) {
  const caja = document.getElementById(idError);
  const campo = document.getElementById(idCampo);
  if (!caja || !campo) return;
  if (!texto) {
    caja.hidden = true;
    campo.removeAttribute("aria-invalid");
    return;
  }
  caja.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg><span>${escapeHtml(texto)}</span>`;
  caja.hidden = false;
  campo.setAttribute("aria-invalid", "true");
  campo.focus();
}

bloqueosList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.dataset.action !== "quitar-bloqueo") return;
  const id = target.dataset.id;
  if (!id) return;
  pedirConfirmacion({
    titulo: "¿Quitar este bloqueo?",
    cuerpo: `${escapeHtml(target.dataset.detalle || "")}<br />El horario vuelve a quedar disponible para reservar.`,
    textoAccion: "Quitar bloqueo",
    onAceptar: async () => {
      try {
        await api(`/api/${CLUB_SLUG}/admin/bloqueos/${id}`, { method: "DELETE" });
        setMessage(adminMessage, "Bloqueo quitado. El horario volvió a estar disponible.", false);
        await refreshAdminData();
      } catch (error) { setMessage(adminMessage, error.message || "No se pudo eliminar el bloqueo."); }
    },
  });
});

reservasList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const { action, id } = target.dataset;
  if (!action || !id) return;

  if (action === "confirmar" || action === "revertir") {
    const nuevoEstado = action === "confirmar" ? "confirmada" : "pendiente";
    try {
      await api(`/api/${CLUB_SLUG}/admin/reservas/${id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      setMessage(adminMessage, nuevoEstado === "confirmada" ? "Turno marcado como pagado." : "Turno marcado sin pagar.", false);
      await loadReservasAdmin(filtroFecha.value);
    } catch (error) { setMessage(adminMessage, error.message || "No se pudo actualizar el estado."); }
    return;
  }

  if (action === "cancelar") {
    pedirConfirmacion({
      titulo: "¿Cancelar este turno?",
      cuerpo: `${escapeHtml(target.dataset.detalle || "")}<br />El horario queda libre y el turno se elimina. No se puede deshacer.`,
      textoAccion: "Cancelar turno",
      onAceptar: () => cancelarTurno(id),
    });
    return;
  }
});

async function cancelarTurno(id) {
    try {
      const data = await api(`/api/${CLUB_SLUG}/admin/reservas/${id}`, { method: "DELETE" });
      setMessage(adminMessage, "Turno cancelado y liberado.", false);
      const r = data.reserva;
      const telefono = r.telefono.replace(/\D/g, "");
      const fecha = formatFecha(r.fecha);
      const canchaLabel = getCanchaEtiqueta(r.cancha);
      const mensajeWa = encodeURIComponent(
        `Hola ${r.nombre}, te informamos que tu turno en ${canchaLabel} el ${fecha} a las ${r.horario}hs fue cancelado por administración. Disculpá los inconvenientes.`
      );
      window.open(`https://wa.me/${telefono}?text=${mensajeWa}`, "_blank");
      await refreshAdminData();
    } catch (error) { setMessage(adminMessage, error.message || "No se pudo cancelar el turno."); }
}

// ── Configuración del club ────────────────────────────────────

const cfgNombre = document.getElementById("cfgNombre");
const cfgWhatsapp = document.getElementById("cfgWhatsapp");
const cfgHoraInicio = document.getElementById("cfgHoraInicio");
const cfgHoraFin = document.getElementById("cfgHoraFin");
const cfgPrecio = document.getElementById("cfgPrecio");
const cfgAlias = document.getElementById("cfgAlias");
const cfgCbu = document.getElementById("cfgCbu");
const cfgTitular = document.getElementById("cfgTitular");
const btnGuardarClub = document.getElementById("btnGuardarClub");
const cfgClubMsg = document.getElementById("cfgClubMsg");

const canchasList = document.getElementById("canchasList");
const nuevaCanchaNombre = document.getElementById("nuevaCanchaNombre");
const nuevaCanchaEtiqueta = document.getElementById("nuevaCanchaEtiqueta");
const btnAgregarCancha = document.getElementById("btnAgregarCancha");
const cfgCanchaMsg = document.getElementById("cfgCanchaMsg");

const cfgPassActual = document.getElementById("cfgPassActual");
const cfgPassNuevo = document.getElementById("cfgPassNuevo");
const btnCambiarPass = document.getElementById("btnCambiarPass");
const cfgPassMsg = document.getElementById("cfgPassMsg");

// El acordeon se elimino: la configuracion se carga al entrar a su seccion.

function fillClubForm(cfg) {
  cfgNombre.value = cfg.nombre || "";
  cfgWhatsapp.value = cfg.whatsappNumero || "";
  cfgHoraInicio.value = cfg.horaInicio ?? 10;
  cfgHoraFin.value = cfg.horaFin ?? 23;
  cfgPrecio.value = cfg.precio || "0";
  cfgAlias.value = cfg.transferencia?.alias || "";
  cfgCbu.value = cfg.transferencia?.cbu || "";
  cfgTitular.value = cfg.transferencia?.titular || "";
}

const PLAN_LABEL = { inicial: "Inicial", estandar: "Estándar", max: "Max" };

async function loadCanchas() {
  const canchas = await api(`/api/${CLUB_SLUG}/admin/canchas`);
  const plan = config?.plan || "inicial";
  const maxCanchas = config?.maxCanchas ?? 2;
  const planNombre = PLAN_LABEL[plan] || plan;
  const activas = canchas.filter((c) => c.activa !== false).length;
  const atLimit = activas >= maxCanchas;

  const planBadge = `
    <div class="reservas-cabecera" style="margin-bottom: var(--s-3)">
      <span class="help">
        Plan <strong style="color: var(--c-ink-900)">${escapeHtml(planNombre)}</strong> — ${activas}/${maxCanchas} cancha${maxCanchas === 1 ? "" : "s"}
      </span>
      ${atLimit ? `<span class="badge badge--pendiente">Límite alcanzado</span>` : ""}
    </div>
  `;

  if (!canchas.length) {
    canchasList.innerHTML = planBadge + `<p class="help">No hay canchas cargadas.</p>`;
    return;
  }
  canchasList.innerHTML = planBadge + canchas.map((c) => `
    <div class="cancha-fila" data-cancha-id="${c.id}">
      <span class="cancha-nombre">${escapeHtml(c.nombre)}</span>
      <input type="text" value="${escapeHtml(c.etiqueta)}" class="input cancha-etiqueta-input" data-id="${c.id}"
        aria-label="Etiqueta de la cancha ${escapeHtml(c.nombre)}" />
      <button class="btn btn--secondary btn--sm" data-action="renombrar-cancha" data-id="${c.id}" type="button">Guardar</button>
      <button class="btn btn--danger btn--sm" data-action="eliminar-cancha" data-id="${c.id}"
        data-etiqueta="${escapeHtml(c.etiqueta)}" type="button">Eliminar</button>
    </div>
  `).join("");
}

async function loadConfigPanel() {
  try {
    fillClubForm(config);
    await loadCanchas();
  } catch (error) {
    setMessage(cfgClubMsg, error.message || "No se pudo cargar la configuracion.");
  }
}

btnGuardarClub.addEventListener("click", async () => {
  try {
    await api(`/api/${CLUB_SLUG}/admin/club`, {
      method: "PATCH",
      body: JSON.stringify({
        nombre: cfgNombre.value.trim(),
        whatsapp: cfgWhatsapp.value.trim(),
        horaInicio: cfgHoraInicio.value,
        horaFin: cfgHoraFin.value,
        precio: cfgPrecio.value.trim(),
        transferAlias: cfgAlias.value.trim(),
        transferCbu: cfgCbu.value.trim(),
        transferTitular: cfgTitular.value.trim(),
      }),
    });
    setMessage(cfgClubMsg, "Cambios guardados.", false);
    // Recargar config para reflejar cambios en el resto del panel
    await loadConfig();
  } catch (error) { setMessage(cfgClubMsg, error.message || "No se pudo guardar."); }
});

btnAgregarCancha.addEventListener("click", async () => {
  try {
    await api(`/api/${CLUB_SLUG}/admin/canchas`, {
      method: "POST",
      body: JSON.stringify({
        nombre: nuevaCanchaNombre.value.trim(),
        etiqueta: nuevaCanchaEtiqueta.value.trim(),
      }),
    });
    nuevaCanchaNombre.value = "";
    nuevaCanchaEtiqueta.value = "";
    setMessage(cfgCanchaMsg, "Cancha agregada.", false);
    await loadCanchas();
    await loadConfig();
  } catch (error) { setMessage(cfgCanchaMsg, error.message || "No se pudo agregar la cancha."); }
});

canchasList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.dataset.action === "renombrar-cancha") {
    const id = target.dataset.id;
    const input = canchasList.querySelector(`.cancha-etiqueta-input[data-id="${id}"]`);
    const etiqueta = input?.value.trim();
    if (!etiqueta) { setMessage(cfgCanchaMsg, "La etiqueta no puede estar vacia."); return; }
    try {
      await api(`/api/${CLUB_SLUG}/admin/canchas/${id}`, { method: "PUT", body: JSON.stringify({ etiqueta }) });
      setMessage(cfgCanchaMsg, "Etiqueta actualizada.", false);
      await loadConfig();
    } catch (error) { setMessage(cfgCanchaMsg, error.message || "No se pudo actualizar."); }
  }

  if (target.dataset.action === "eliminar-cancha") {
    const id = target.dataset.id;
    pedirConfirmacion({
      titulo: `¿Eliminar ${escapeHtml(target.dataset.etiqueta || "esta cancha")}?`,
      cuerpo: "Dejará de aparecer para reservar. Los turnos ya reservados no se borran.",
      textoAccion: "Eliminar",
      onAceptar: () => eliminarCancha(id),
    });
  }
});

async function eliminarCancha(id) {
  try {
    await api(`/api/${CLUB_SLUG}/admin/canchas/${id}`, { method: "DELETE" });
    setMessage(cfgCanchaMsg, "Cancha eliminada.", false);
    await loadCanchas();
    await loadConfig();
  } catch (error) { setMessage(cfgCanchaMsg, error.message || "No se pudo eliminar."); }
}

btnCambiarPass.addEventListener("click", async () => {
  try {
    await api(`/api/${CLUB_SLUG}/admin/password`, {
      method: "POST",
      body: JSON.stringify({
        passwordActual: cfgPassActual.value,
        passwordNuevo: cfgPassNuevo.value,
      }),
    });
    cfgPassActual.value = "";
    cfgPassNuevo.value = "";
    setMessage(cfgPassMsg, "Contrasena cambiada correctamente.", false);
  } catch (error) { setMessage(cfgPassMsg, error.message || "No se pudo cambiar la contrasena."); }
});

// ── Bloqueos recurrentes ──────────────────────────────────────

const DAY_LABELS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function renderBloqueosRecurrentes(bloqueos) {
  const container = document.getElementById("bloqueosRecurrentesList");
  if (!container) return;
  if (!bloqueos.length) {
    container.innerHTML = `<p class="help">No hay bloqueos recurrentes.</p>`;
    return;
  }
  container.innerHTML = bloqueos.map((b) => {
    const canchaLabel = getCanchaEtiqueta(b.cancha);
    const diaLabel = DAY_LABELS_FULL[b.diaSemana] ?? `Día ${b.diaSemana}`;
    const horarioLabel = b.diaCompleto ? "Día completo" : `${b.horarioDesde} — ${b.horarioHasta}`;
    const detalle = `${canchaLabel}, todos los ${diaLabel.toLowerCase()}, ${horarioLabel.toLowerCase()}`;
    return `<article class="recurrente-card">
      <div>
        <p class="bloqueo-cancha">${escapeHtml(canchaLabel)}</p>
        <span class="badge badge--pendiente" style="margin-top: var(--s-1)">Todos los ${escapeHtml(diaLabel.toLowerCase())}</span>
        <p class="bloqueo-motivo" style="margin-top: var(--s-2)">${escapeHtml(horarioLabel)}${b.motivo ? ` · ${escapeHtml(b.motivo)}` : ""}</p>
      </div>
      <button class="btn btn--danger btn--sm" data-action="quitar-bloqueo-rec" data-id="${b.id}"
        data-detalle="${escapeHtml(detalle)}" type="button">Quitar</button>
    </article>`;
  }).join("");
}

document.getElementById("btnToggleBloqRec")?.addEventListener("click", () => {
  document.getElementById("formBloqRecContainer")?.classList.toggle("hidden");
});

document.getElementById("btnCancelarBloqRec")?.addEventListener("click", () => {
  document.getElementById("formBloqRecContainer")?.classList.add("hidden");
});

document.getElementById("recDiaCompleto")?.addEventListener("change", (e) => {
  const dis = e.target.checked;
  document.getElementById("recHorarioDesde").disabled = dis;
  document.getElementById("recHorarioHasta").disabled = dis;
});

document.getElementById("btnGuardarBloqRec")?.addEventListener("click", async () => {
  const recMsg = document.getElementById("recMsg");
  try {
    const cancha = document.getElementById("recCancha").value;
    const diaSemana = parseInt(document.getElementById("recDiaSemana").value, 10);
    const diaCompleto = document.getElementById("recDiaCompleto").checked;
    const horarioDesde = document.getElementById("recHorarioDesde").value;
    const horarioHasta = document.getElementById("recHorarioHasta").value;
    const motivo = document.getElementById("recMotivo").value.trim();
    await api(`/api/${CLUB_SLUG}/admin/bloqueos-recurrentes`, {
      method: "POST",
      body: JSON.stringify({ cancha, diaSemana, diaCompleto, horarioDesde, horarioHasta, motivo }),
    });
    setMessage(recMsg, "Bloqueo recurrente guardado.", false);
    document.getElementById("recMotivo").value = "";
    document.getElementById("recDiaCompleto").checked = false;
    document.getElementById("recHorarioDesde").disabled = false;
    document.getElementById("recHorarioHasta").disabled = false;
    document.getElementById("formBloqRecContainer").classList.add("hidden");
    const bloqueosRec = await api(`/api/${CLUB_SLUG}/admin/bloqueos-recurrentes`);
    renderBloqueosRecurrentes(bloqueosRec);
  } catch (e) { setMessage(recMsg, e.message || "No se pudo guardar."); }
});

document.getElementById("bloqueosRecurrentesList")?.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.dataset.action !== "quitar-bloqueo-rec") return;
  const id = target.dataset.id;
  if (!id) return;
  pedirConfirmacion({
    titulo: "¿Quitar este bloqueo recurrente?",
    cuerpo: `${escapeHtml(target.dataset.detalle || "")}<br />Deja de aplicarse todas las semanas.`,
    textoAccion: "Quitar bloqueo",
    onAceptar: () => quitarBloqueoRecurrente(id),
  });
});

async function quitarBloqueoRecurrente(id) {
  try {
    await api(`/api/${CLUB_SLUG}/admin/bloqueos-recurrentes/${id}`, { method: "DELETE" });
    setMessage(adminMessage, "Bloqueo recurrente eliminado.", false);
    const bloqueosRec = await api(`/api/${CLUB_SLUG}/admin/bloqueos-recurrentes`);
    renderBloqueosRecurrentes(bloqueosRec);
  } catch (e) { setMessage(adminMessage, e.message || "No se pudo eliminar."); }
}

// ── Vista calendario ──────────────────────────────────────────

const btnVistaLista = document.getElementById("btnVistaLista");
const btnVistaCalendario = document.getElementById("btnVistaCalendario");
const vistaLista = document.getElementById("vistaLista");
const vistaCalendario = document.getElementById("vistaCalendario");
const filtrosLista = document.getElementById("filtrosLista");

let calSemanaOffset = 0;

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function getWeekDates(offset = 0) {
  const today = new Date();
  const dow = today.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().split("T")[0];
  });
}

function updateCalLabel(dates) {
  const label = document.getElementById("calSemanaLabel");
  if (!label) return;
  const [, m0, d0] = dates[0].split("-");
  const [y1, m1, d1] = dates[6].split("-");
  label.textContent = `${d0}/${m0} — ${d1}/${m1}/${y1}`;
}

function findBloqueoCalendario(bloqueos, cancha, fecha, horario) {
  const horaNum = Number(horario.split(":")[0]);
  return bloqueos.find((b) => {
    if (b.cancha !== cancha || b.fecha !== fecha) return false;
    if (b.diaCompleto) return true;
    if (b.horarioDesde && b.horarioHasta) {
      return horaNum >= Number(b.horarioDesde.split(":")[0]) && horaNum <= Number(b.horarioHasta.split(":")[0]);
    }
    return b.horario === horario;
  });
}

function renderCalGrid(dates, reservasPorDia, bloqueos, cancha) {
  const calGrid = document.getElementById("calGrid");
  if (!calGrid || !config) return;
  const horarios = config.horarios;
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60000;
  const todayStr = new Date(now - tz).toISOString().split("T")[0];

  const reservaMap = {};
  dates.forEach((fecha, i) => { reservaMap[fecha] = reservasPorDia[i] || []; });

  const thead = `<thead><tr>
    <th class="cal-hora">Hora</th>
    ${dates.map((fecha, i) => {
      const [, mm, dd] = fecha.split("-");
      const isToday = fecha === todayStr;
      return `<th${isToday ? " class=\"cal-hoy\"" : ""}>
        ${escapeHtml(DAY_NAMES[i])}<br/><span style="font-weight: var(--fw-regular)">${dd}/${mm}</span>
      </th>`;
    }).join("")}
  </tr></thead>`;

  const tbody = horarios.map((horario) => {
    const cells = dates.map((fecha) => {
      const reserva = (reservaMap[fecha] || []).find((r) => r.horario === horario);
      const bloqueo = findBloqueoCalendario(bloqueos, cancha, fecha, horario);
      const [y, mo, d] = fecha.split("-").map(Number);
      const [h, m] = horario.split(":").map(Number);
      const pasado = new Date(y, mo - 1, d, h, m).getTime() < Date.now();

      if (bloqueo) {
        return `<td class="cal-bloqueado">
          <span class="cal-dato" style="font-weight: var(--fw-semi)">Bloqueado</span>
          ${bloqueo.motivo ? `<span class="cal-dato">${escapeHtml(bloqueo.motivo)}</span>` : ""}
        </td>`;
      }
      if (reserva) {
        const color = reserva.estado === "confirmada" ? "var(--c-success)" : "var(--c-warning)";
        const label = reserva.estado === "confirmada" ? "Pagado" : "Sin pagar";
        return `<td class="cal-ocupado">
          <span class="cal-dato" style="font-weight: var(--fw-semi)">${escapeHtml(reserva.nombre)}</span>
          <span class="cal-dato" style="color: ${color}">${escapeHtml(label)}</span>
        </td>`;
      }
      if (pasado) {
        return `<td class="cal-pasado">—</td>`;
      }
      return `<td class="cal-libre">libre</td>`;
    }).join("");
    return `<tr>
      <td class="cal-hora">${escapeHtml(horario)}</td>
      ${cells}
    </tr>`;
  }).join("");

  calGrid.innerHTML = `<table>${thead}<tbody>${tbody}</tbody></table>`;
}

async function loadCalendario() {
  const calGrid = document.getElementById("calGrid");
  const calCanchaEl = document.getElementById("calCancha");
  if (!calGrid || !calCanchaEl || !config) return;
  const cancha = calCanchaEl.value;
  const dates = getWeekDates(calSemanaOffset);
  updateCalLabel(dates);
  calGrid.innerHTML = `<div class="skeleton" style="height: 200px; margin: var(--s-3)"></div>`;
  try {
    const [reservasPorDia, todosBloqueos] = await Promise.all([
      Promise.all(
        dates.map((fecha) =>
          api(`/api/${CLUB_SLUG}/admin/reservas?fecha=${encodeURIComponent(fecha)}`)
            .then((rs) => rs.filter((r) => r.cancha === cancha))
            .catch(() => [])
        )
      ),
      api(`/api/${CLUB_SLUG}/admin/bloqueos`).catch(() => []),
    ]);
    renderCalGrid(dates, reservasPorDia, todosBloqueos, cancha);
  } catch (e) {
    calGrid.innerHTML = `<div class="alert alert--error" role="alert" style="margin: var(--s-3)">${ICONO_ALERTA}<span>${escapeHtml(e.message)}</span></div>`;
  }
}

function setVista(vista) {
  const isLista = vista === "lista";
  vistaLista?.classList.toggle("hidden", !isLista);
  vistaCalendario?.classList.toggle("hidden", isLista);
  filtrosLista?.classList.toggle("hidden", !isLista);
  btnVistaLista?.classList.toggle("is-activa", isLista);
  btnVistaLista?.setAttribute("aria-pressed", String(isLista));
  btnVistaCalendario?.classList.toggle("is-activa", !isLista);
  btnVistaCalendario?.setAttribute("aria-pressed", String(!isLista));
  if (!isLista) loadCalendario();
}

btnVistaLista?.addEventListener("click", () => setVista("lista"));
btnVistaCalendario?.addEventListener("click", () => setVista("calendario"));
document.getElementById("btnCalPrev")?.addEventListener("click", () => { calSemanaOffset--; loadCalendario(); });
document.getElementById("btnCalNext")?.addEventListener("click", () => { calSemanaOffset++; loadCalendario(); });
document.getElementById("calCancha")?.addEventListener("change", () => loadCalendario());

// ── Exportar CSV ──────────────────────────────────────────────

function exportarCSV() {
  if (!reservasActuales.length) {
    alert("No hay reservas cargadas. Filtrá primero las reservas que querés exportar.");
    return;
  }
  const headers = ["Fecha", "Cancha", "Horario", "Nombre", "Telefono", "Estado"];
  const filas = [headers, ...reservasActuales.map((r) => [
    r.fecha,
    getCanchaEtiqueta(r.cancha),
    r.horario,
    r.nombre,
    r.telefono,
    r.estado === "confirmada" ? "Pagado" : "Sin pagar",
  ])];
  const csv = filas.map((f) => f.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reservas-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById("btnExportarCSV")?.addEventListener("click", exportarCSV);

// ─────────────────────────────────────────────────────────────

async function init() {
  bloqFecha.value = todayISO();
  sincronizarFormBloqueo();
  await loadConfig();
  if (adminToken) {
    try {
      setAuthenticatedUI(true);
      await refreshAdminData();
      return;
    } catch (err) {
      if (err.status === 401) {
        adminToken = "";
        localStorage.removeItem("adminToken");
      } else {
        setMessage(adminMessage, err.message || "Error al cargar datos. Recargá la página.");
        return;
      }
    }
  }
  setAuthenticatedUI(false);
}

init();

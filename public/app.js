// Extrae el slug del club desde la URL: "/cmr-futbol" -> "cmr-futbol"
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

const canchaSelect = document.getElementById("cancha");
const fechaInput = document.getElementById("fecha");
const btnBuscar = document.getElementById("btnBuscar");
const horariosContainer = document.getElementById("horarios");
const modal = document.getElementById("modal");
const btnCerrarModal = document.getElementById("btnCerrarModal");
const reservaSeleccion = document.getElementById("reservaSeleccion");
const formReserva = document.getElementById("formReserva");
const paso1 = document.getElementById("paso1");
const paso2 = document.getElementById("paso2");
const btnPaso2 = document.getElementById("btnPaso2");
const btnVolverPaso1 = document.getElementById("btnVolverPaso1");
const mensaje = document.getElementById("mensaje");
const aliasTransferencia = document.getElementById("aliasTransferencia");
const cbuTransferencia = document.getElementById("cbuTransferencia");
const titularTransferencia = document.getElementById("titularTransferencia");
const btnSolicitarCancelacion = document.getElementById("btnSolicitarCancelacion");
const telefonoInput = document.getElementById("telefono");
const contadorDisponibles = document.getElementById("contadorDisponibles");
const cardResumen = document.getElementById("cardResumen");
const resumenDetalle = document.getElementById("resumenDetalle");
const btnConfirmarReserva = document.getElementById("btnConfirmarReserva");
const btnCambiarHorario = document.getElementById("btnCambiarHorario");

let config = null;
let reservasActuales = [];
let bloqueosActuales = [];
let seleccion = null;

function formatFecha(fechaIso) {
  const [yyyy, mm, dd] = fechaIso.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function setMensaje(texto, isError = true) {
  mensaje.textContent = texto;
  mensaje.style.color = isError ? "#c62020" : "#1d6d2b";
}

function todayISO() {
  const date = new Date();
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date - tzOffset).toISOString().split("T")[0];
}

function isoSumandoDias(dias) {
  const date = new Date();
  date.setDate(date.getDate() + dias);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date - tzOffset).toISOString().split("T")[0];
}

// "2026-08-14" -> "Viernes 14 de agosto". Se arma con las partes para que no
// corra un dia por zona horaria (new Date("2026-08-14") es UTC).
function fechaEnPalabras(fechaIso) {
  const [year, month, day] = String(fechaIso).split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "";
  const texto = new Date(year, month - 1, day)
    .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    .replace(",", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function isHorarioPasado(fechaIso, horario) {
  const [year, month, day] = String(fechaIso).split("-").map(Number);
  const [hour = 0, minute = 0] = String(horario).split(":").map(Number);
  if (
    !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) ||
    !Number.isFinite(hour) || !Number.isFinite(minute)
  ) return false;
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime() < Date.now();
}

async function loadConfig() {
  const response = await fetch(`/api/${CLUB_SLUG}/config`);
  if (!response.ok) throw new Error("No se pudo cargar la configuracion.");
  config = await response.json();

  // Poblar dropdown de canchas dinamicamente
  canchaSelect.innerHTML = config.canchas
    .map((c) => `<option value="${escapeHtml(c.nombre)}">${escapeHtml(c.etiqueta)}</option>`)
    .join("");

  aliasTransferencia.textContent = config.transferencia.alias;
  cbuTransferencia.textContent = config.transferencia.cbu;
  titularTransferencia.textContent = config.transferencia.titular;

  // Actualizar link al panel admin
  const linkAdmin = document.getElementById("linkAdmin");
  if (linkAdmin) linkAdmin.href = `/${CLUB_SLUG}/admin`;

  // El nombre del club va al header; el h1 es siempre "Reservar una cancha".
  const clubNombre = document.getElementById("clubNombre");
  if (clubNombre && config.nombre) {
    clubNombre.textContent = config.nombre;
    document.title = `${config.nombre} · Reservar una cancha`;
  }

  // Logo o avatar con iniciales en el header
  const navLogo = document.getElementById("navLogo");
  if (navLogo) {
    if (config.logoUrl) {
      navLogo.outerHTML = `<img id="navLogo" src="${escapeHtml(config.logoUrl)}" alt="${escapeHtml(config.nombre)}" class="site-logo" />`;
    } else {
      const initials = config.nombre.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
      navLogo.textContent = initials;
    }
  }
}

async function loadReservas() {
  const cancha = canchaSelect.value;
  const fecha = fechaInput.value;
  const response = await fetch(
    `/api/${CLUB_SLUG}/reservas?cancha=${encodeURIComponent(cancha)}&fecha=${encodeURIComponent(fecha)}`
  );
  if (!response.ok) throw new Error("No se pudieron cargar los horarios.");
  reservasActuales = await response.json();
}

async function loadBloqueos() {
  const cancha = canchaSelect.value;
  const fecha = fechaInput.value;
  const response = await fetch(
    `/api/${CLUB_SLUG}/bloqueos?cancha=${encodeURIComponent(cancha)}&fecha=${encodeURIComponent(fecha)}`
  );
  if (!response.ok) throw new Error("No se pudieron cargar los bloqueos.");
  bloqueosActuales = await response.json();
}

function isOcupado(horario) {
  return reservasActuales.some((reserva) => reserva.horario === horario);
}

function findBloqueo(horario) {
  const [horaActual] = horario.split(":");
  const horaActualNum = Number(horaActual);
  return bloqueosActuales.find((bloqueo) => {
    if (bloqueo.diaCompleto) return true;
    if (bloqueo.horarioDesde && bloqueo.horarioHasta) {
      const [desde] = bloqueo.horarioDesde.split(":");
      const [hasta] = bloqueo.horarioHasta.split(":");
      return horaActualNum >= Number(desde) && horaActualNum <= Number(hasta);
    }
    return bloqueo.horario === horario;
  });
}

// "13:00" -> "13:00 – 14:00". El usuario no tiene que deducir cuanto dura.
function rangoHorario(horario) {
  const hora = Number(String(horario).split(":")[0]);
  if (!Number.isFinite(hora)) return horario;
  return `${horario} – ${String((hora + 1) % 24).padStart(2, "0")}:00`;
}

const FLECHA_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;
const CHECK_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>`;

function renderSkeletonHorarios() {
  horariosContainer.innerHTML = Array.from(
    { length: 3 },
    () => `<div class="skeleton" aria-hidden="true"></div>`
  ).join("");
  if (contadorDisponibles) contadorDisponibles.textContent = "";
}

function renderHorarios() {
  horariosContainer.innerHTML = "";
  let disponibles = 0;

  config.horarios.forEach((horario) => {
    const ocupado = isOcupado(horario);
    const bloqueo = findBloqueo(horario);
    const pasado = isHorarioPasado(fechaInput.value, horario);
    const bloqueado = Boolean(bloqueo);

    let clase = "slot--libre";
    let estado = "Disponible";
    let libre = false;

    if (pasado) {
      clase = "slot--ocupado";
      estado = "Ya pasó";
    } else if (bloqueado) {
      clase = "slot--bloqueado";
      // El motivo va en la fila: en mobile no existe el hover del title.
      estado = `Bloqueado · ${bloqueo.motivo || "Por administración"}`;
    } else if (ocupado) {
      clase = "slot--ocupado";
      estado = "Ocupado";
    } else {
      libre = true;
      disponibles += 1;
    }

    const contenido = `
      <span class="slot-dot" aria-hidden="true"></span>
      <span class="slot-hora">${escapeHtml(rangoHorario(horario))}</span>
      <span class="slot-estado">${escapeHtml(estado)}${libre ? FLECHA_SVG : ""}</span>`;

    if (libre) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `slot ${clase}`;
      btn.dataset.horario = horario;
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", `Reservar ${rangoHorario(horario)}`);
      btn.innerHTML = contenido;
      btn.addEventListener("click", () => seleccionarHorario(horario));
      horariosContainer.appendChild(btn);
      return;
    }

    const div = document.createElement("div");
    div.className = `slot ${clase}`;
    div.setAttribute("aria-disabled", "true");
    div.innerHTML = contenido;
    horariosContainer.appendChild(div);
  });

  if (contadorDisponibles) {
    contadorDisponibles.textContent = disponibles === 1
      ? "1 horario disponible"
      : `${disponibles} horarios disponibles`;
  }

  if (!config.horarios.length || disponibles === 0) {
    horariosContainer.insertAdjacentHTML("beforeend", `
      <div class="empty" style="grid-column: 1 / -1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg>
        <p>No quedan horarios libres para este día. Probá con otra fecha u otra cancha.</p>
      </div>`);
  }

  // La seleccion no sobrevive a un cambio de cancha o fecha.
  limpiarSeleccion();
}

// Al elegir un horario ya no se abre el modal de una: primero se muestra el
// resumen para que el usuario vea que esta por reservar.
function seleccionarHorario(horario) {
  const canchaSeleccionada = canchaSelect.options[canchaSelect.selectedIndex];
  seleccion = {
    cancha: canchaSelect.value,
    canchaEtiqueta: canchaSeleccionada ? canchaSeleccionada.text : canchaSelect.value,
    fecha: fechaInput.value,
    horario,
  };

  horariosContainer.querySelectorAll(".slot[aria-pressed]").forEach((slot) => {
    const elegido = slot.dataset.horario === horario;
    slot.setAttribute("aria-pressed", String(elegido));
    const estado = slot.querySelector(".slot-estado");
    if (estado) estado.innerHTML = elegido ? `Elegido${CHECK_SVG}` : `Disponible${FLECHA_SVG}`;
  });

  if (!cardResumen) return;
  const senia = config?.precio && Number(config.precio) > 0
    ? `<p>Seña: <strong>$${escapeHtml(config.precio)}</strong> por transferencia</p>`
    : "";
  resumenDetalle.innerHTML = `
    <p><strong>${escapeHtml(seleccion.canchaEtiqueta)}</strong></p>
    <p>${escapeHtml(fechaEnPalabras(seleccion.fecha))} · ${escapeHtml(rangoHorario(horario))}</p>
    ${senia}`;
  cardResumen.hidden = false;

  const caja = cardResumen.getBoundingClientRect();
  if (caja.bottom > window.innerHeight) {
    cardResumen.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function limpiarSeleccion() {
  seleccion = null;
  if (cardResumen) cardResumen.hidden = true;
  horariosContainer.querySelectorAll('.slot[aria-pressed="true"]').forEach((slot) => {
    slot.setAttribute("aria-pressed", "false");
    const estado = slot.querySelector(".slot-estado");
    if (estado) estado.innerHTML = `Disponible${FLECHA_SVG}`;
  });
}

function openModal(horario) {
  const canchaSeleccionada = canchaSelect.options[canchaSelect.selectedIndex];
  seleccion = {
    cancha: canchaSelect.value,
    canchaEtiqueta: canchaSeleccionada ? canchaSeleccionada.text : canchaSelect.value,
    fecha: fechaInput.value,
    horario,
  };
  reservaSeleccion.textContent = `${seleccion.canchaEtiqueta} - ${formatFecha(seleccion.fecha)} - ${seleccion.horario}`;
  paso1.classList.remove("hidden");
  paso2.classList.add("hidden");
  document.getElementById("paso3").classList.add("hidden");
  setMensaje("");
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  formReserva.reset();
  seleccion = null;
  setMensaje("");
  paso1.classList.remove("hidden");
  paso2.classList.add("hidden");
  document.getElementById("paso3").classList.add("hidden");
}

function validarPaso1() {
  const nombre = document.getElementById("nombre").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  if (nombre.length < 3) { setMensaje("Ingresa nombre y apellido."); return false; }
  if (!/^\d{6,15}$/.test(telefono)) { setMensaje("Ingresa un telefono valido (solo numeros)."); return false; }
  return true;
}

function etiquetaCancha(nombre) {
  return config?.canchas?.find((c) => c.nombre === nombre)?.etiqueta || `Cancha ${nombre}`;
}

function buildWhatsAppUrl(reserva) {
  const canchaLabel = seleccion ? seleccion.canchaEtiqueta : etiquetaCancha(reserva.cancha);
  const comprobanteTexto = reserva.comprobanteUrl
    ? `Comprobante: ${reserva.comprobanteUrl}`
    : "Comprobante: cargado en la web";
  const text = [
    "Hola, quiero reservar:",
    `Nombre: ${reserva.nombre}`,
    `Telefono: ${reserva.telefono}`,
    `${canchaLabel}`,
    `Fecha: ${formatFecha(reserva.fecha)}`,
    `Horario: ${reserva.horario}`,
    comprobanteTexto,
    "Ya realice la transferencia.",
  ].join("\n");
  return `https://wa.me/${config.whatsappNumero}?text=${encodeURIComponent(text)}`;
}

async function refreshHorarios() {
  if (!fechaInput.value) fechaInput.value = todayISO();
  renderSkeletonHorarios();
  const prevCancha = canchaSelect.value;
  await loadConfig();
  if ([...canchaSelect.options].some((o) => o.value === prevCancha)) {
    canchaSelect.value = prevCancha;
  }
  await Promise.all([
    loadReservas().catch(() => { reservasActuales = []; }),
    loadBloqueos().catch(() => { bloqueosActuales = []; }),
  ]);
  renderHorarios();
}

function buildCancelacionWhatsAppUrl() {
  const canchaOpt = canchaSelect.options[canchaSelect.selectedIndex];
  const canchaLabel = canchaOpt ? canchaOpt.text : canchaSelect.value;
  const fecha = fechaInput.value ? formatFecha(fechaInput.value) : "(indicar fecha)";
  const texto = [
    "Hola, quiero solicitar la cancelacion de un turno.",
    `Cancha: ${canchaLabel}`,
    `Fecha: ${fecha}`,
    "Horario: (indicar horario)",
    "Nombre y telefono: (indicar datos)",
  ].join("\n");
  return `https://wa.me/${config.whatsappNumero}?text=${encodeURIComponent(texto)}`;
}

btnBuscar.addEventListener("click", async () => {
  try { await refreshHorarios(); }
  catch (error) { setMensaje(error.message || "Error al cargar horarios."); }
});

canchaSelect.addEventListener("change", async () => {
  try { await refreshHorarios(); }
  catch (error) { setMensaje(error.message || "Error al cargar horarios."); }
});

fechaInput.addEventListener("change", async () => {
  try { await refreshHorarios(); }
  catch (error) { setMensaje(error.message || "Error al cargar horarios."); }
});

telefonoInput.addEventListener("input", () => {
  telefonoInput.value = telefonoInput.value.replace(/\D/g, "");
});

btnCerrarModal.addEventListener("click", closeModal);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

btnPaso2.addEventListener("click", () => {
  if (!validarPaso1()) return;
  setMensaje("");
  paso1.classList.add("hidden");
  paso2.classList.remove("hidden");
});

btnVolverPaso1.addEventListener("click", () => {
  paso2.classList.add("hidden");
  paso1.classList.remove("hidden");
  setMensaje("");
});

// La cancelacion ahora se pide desde cada turno en "Mis turnos".
if (btnSolicitarCancelacion) {
  btnSolicitarCancelacion.addEventListener("click", () => {
    if (!config?.whatsappNumero) { setMensaje("No hay numero de WhatsApp configurado."); return; }
    const confirmar = window.confirm("¿Estas seguro de que queres solicitar la cancelacion del turno?");
    if (!confirmar) return;
    window.location.href = buildCancelacionWhatsAppUrl();
  });
}

if (btnConfirmarReserva) {
  btnConfirmarReserva.addEventListener("click", () => {
    if (!seleccion) return;
    openModal(seleccion.horario);
  });
}

if (btnCambiarHorario) {
  btnCambiarHorario.addEventListener("click", () => {
    limpiarSeleccion();
    horariosContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

// ── Chips de fecha rapida ─────────────────────────────────────
// Solo escriben el value del input y disparan "change": la carga de horarios
// sigue colgando del mismo listener de siempre.
const chipHoy = document.getElementById("chipHoy");
const chipManana = document.getElementById("chipManana");
const chipOtro = document.getElementById("chipOtro");
const fechaEnPalabrasEl = document.getElementById("fechaEnPalabras");

function setFecha(iso) {
  fechaInput.value = iso;
  fechaInput.dispatchEvent(new Event("change"));
}

function syncFecha() {
  const valor = fechaInput.value;
  if (fechaEnPalabrasEl) fechaEnPalabrasEl.textContent = fechaEnPalabras(valor);
  if (chipHoy) chipHoy.setAttribute("aria-pressed", String(valor === todayISO()));
  if (chipManana) chipManana.setAttribute("aria-pressed", String(valor === isoSumandoDias(1)));
  if (chipOtro) {
    const esOtro = Boolean(valor) && valor !== todayISO() && valor !== isoSumandoDias(1);
    chipOtro.setAttribute("aria-pressed", String(esOtro));
  }
}

if (chipHoy) chipHoy.addEventListener("click", () => setFecha(todayISO()));
if (chipManana) chipManana.addEventListener("click", () => setFecha(isoSumandoDias(1)));
if (chipOtro) {
  chipOtro.addEventListener("click", () => {
    fechaInput.focus();
    if (typeof fechaInput.showPicker === "function") {
      try { fechaInput.showPicker(); } catch (_) { /* algunos navegadores lo bloquean */ }
    }
  });
}
fechaInput.addEventListener("change", syncFecha);

formReserva.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!seleccion) return;

  const formData = new FormData(formReserva);
  formData.set("cancha", seleccion.cancha);
  formData.set("fecha", seleccion.fecha);
  formData.set("horario", seleccion.horario);

  try {
    setMensaje("Guardando reserva...", false);
    const response = await fetch(`/api/${CLUB_SLUG}/reservas`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo guardar la reserva.");

    await refreshHorarios();
    showConfirmacion(data);
  } catch (error) { setMensaje(error.message || "Error al reservar."); }
});

// ── Pantalla de confirmacion ──────────────────────────────────

function showConfirmacion(reserva) {
  const canchaLabel = seleccion
    ? seleccion.canchaEtiqueta
    : (config?.canchas?.find((c) => c.nombre === reserva.cancha)?.etiqueta || `Cancha ${reserva.cancha}`);
  const detalle = document.getElementById("confirmacionDetalle");
  if (detalle) {
    detalle.innerHTML = [
      `<p><strong>Nombre:</strong> ${escapeHtml(reserva.nombre)}</p>`,
      `<p><strong>Cancha:</strong> ${escapeHtml(canchaLabel)}</p>`,
      `<p><strong>Fecha:</strong> ${escapeHtml(formatFecha(reserva.fecha))}</p>`,
      `<p><strong>Horario:</strong> ${escapeHtml(reserva.horario)}hs</p>`,
    ].join("");
  }
  const btnWa = document.getElementById("btnWhatsAppConfirm");
  if (btnWa) btnWa.href = buildWhatsAppUrl(reserva);
  paso1.classList.add("hidden");
  paso2.classList.add("hidden");
  document.getElementById("paso3").classList.remove("hidden");
  setMensaje("");
}

document.getElementById("btnOtraReserva").addEventListener("click", closeModal);

// ── Mis turnos ────────────────────────────────────────────────

const misTelefonoInput = document.getElementById("misTelefono");
const btnMisReservas = document.getElementById("btnMisReservas");
const misTurnosList = document.getElementById("misTurnosList");

misTelefonoInput.addEventListener("input", () => {
  misTelefonoInput.value = misTelefonoInput.value.replace(/\D/g, "");
});

misTelefonoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnMisReservas.click();
});

btnMisReservas.addEventListener("click", async () => {
  const tel = misTelefonoInput.value.trim();
  if (!/^\d{6,15}$/.test(tel)) {
    misTurnosList.innerHTML = `<p class="text-sm text-red-600">Ingresá un número de teléfono válido (solo números).</p>`;
    return;
  }
  misTurnosList.innerHTML = `<p class="text-sm text-slate-400">Buscando...</p>`;
  try {
    const response = await fetch(`/api/${CLUB_SLUG}/mis-reservas?telefono=${encodeURIComponent(tel)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Error al consultar.");
    if (!data.length) {
      misTurnosList.innerHTML = `<p class="text-sm text-slate-500">No se encontraron turnos activos para ese número.</p>`;
      return;
    }
    misTurnosList.innerHTML = data.map((r) => {
      const canchaLabel = config?.canchas?.find((c) => c.nombre === r.cancha)?.etiqueta || `Cancha ${escapeHtml(r.cancha)}`;
      const estadoColor = r.estado === "confirmada"
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
      const estadoLabel = r.estado === "confirmada" ? "Pagado" : "Sin pagar";
      return `<div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <p class="font-semibold text-slate-800">${escapeHtml(canchaLabel)} · ${formatFecha(r.fecha)} · ${escapeHtml(r.horario)}hs</p>
        <span class="mt-1 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${estadoColor}">${estadoLabel}</span>
      </div>`;
    }).join("");
  } catch (e) {
    misTurnosList.innerHTML = `<p class="text-sm text-red-600">${escapeHtml(e.message)}</p>`;
  }
});

// ─────────────────────────────────────────────────────────────

async function init() {
  fechaInput.min = todayISO();
  fechaInput.value = todayISO();
  syncFecha();
  try {
    await refreshHorarios();
  } catch (error) { setMensaje(error.message || "Error inicializando la aplicacion."); }
}

init();

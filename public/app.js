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
const paso3 = document.getElementById("paso3");
const stepsLabel = document.getElementById("stepsLabel");
const alertReserva = document.getElementById("alertReserva");
const comprobanteInput = document.getElementById("comprobante");
const nombreArchivo = document.getElementById("nombreArchivo");
const textoSenia = document.getElementById("textoSenia");
const btnPaso2 = document.getElementById("btnPaso2");
const btnVolverPaso1 = document.getElementById("btnVolverPaso1");
const mensaje = document.getElementById("mensaje");
const aliasTransferencia = document.getElementById("aliasTransferencia");
const cbuTransferencia = document.getElementById("cbuTransferencia");
const titularTransferencia = document.getElementById("titularTransferencia");
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
let enviandoReserva = false;
let ultimoFoco = null;

function formatFecha(fechaIso) {
  const [yyyy, mm, dd] = fechaIso.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

// #mensaje quedo como region para lectores de pantalla; lo visible son los
// errores por campo y el alert arriba del boton.
function setMensaje(texto) {
  mensaje.textContent = texto || "";
}

const ALERTA_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>`;

function setErrorCampo(idCampo, idError, texto) {
  const campo = document.getElementById(idCampo);
  const caja = document.getElementById(idError);
  if (!campo || !caja) return;
  if (!texto) {
    caja.hidden = true;
    caja.textContent = "";
    campo.removeAttribute("aria-invalid");
    return;
  }
  caja.innerHTML = `${ALERTA_SVG}<span>${escapeHtml(texto)}</span>`;
  caja.hidden = false;
  campo.setAttribute("aria-invalid", "true");
}

function limpiarErrores() {
  setErrorCampo("nombre", "errorNombre", "");
  setErrorCampo("telefono", "errorTelefono", "");
  setErrorCampo("comprobante", "errorComprobante", "");
  if (alertReserva) alertReserva.innerHTML = "";
  setMensaje("");
}

function setAlertaReserva(texto) {
  if (!alertReserva) return;
  alertReserva.innerHTML = texto
    ? `<div class="alert alert--error" role="alert">${ALERTA_SVG}<span>${escapeHtml(texto)}</span></div>`
    : "";
  setMensaje(texto);
}

// Los mensajes de la API no se muestran crudos: se mapean a texto util.
function mensajeDeError(error) {
  const crudo = String(error?.message || error || "");
  if (/ya fue reservado|ya reservado/i.test(crudo)) {
    return "Ese horario acaba de ser reservado por otra persona. Elegí otro horario de la lista.";
  }
  if (/bloqueado/i.test(crudo)) {
    return "Ese horario acaba de ser bloqueado por el club. Elegí otro horario.";
  }
  if (/supera|5\s*MB/i.test(crudo)) {
    return "Ese archivo es muy grande. El máximo es 5 MB: probá con una foto más chica.";
  }
  if (/imagenes|imágenes|PDF|archivo no es v/i.test(crudo)) {
    return "Sólo aceptamos imágenes (JPG, PNG, WEBP) o PDF.";
  }
  if (/ya paso|ya pasó/i.test(crudo)) {
    return "Esa fecha ya pasó. Elegí desde hoy en adelante.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(crudo)) {
    return "No pudimos conectarnos. Revisá tu conexión a internet y probá de nuevo.";
  }
  return "Algo no funcionó. Probá de nuevo en un minuto. Si sigue pasando, escribinos por WhatsApp.";
}

const PASOS = { 1: "Tus datos", 2: "Pago de la seña", 3: "Listo" };

function mostrarPaso(numero) {
  paso1.classList.toggle("hidden", numero !== 1);
  paso2.classList.toggle("hidden", numero !== 2);
  paso3.classList.toggle("hidden", numero !== 3);

  document.querySelectorAll("#stepsIndicador .step-dot").forEach((punto) => {
    const suyo = Number(punto.dataset.paso);
    punto.classList.toggle("step-dot--actual", suyo === numero);
    punto.classList.toggle("step-dot--hecho", suyo < numero);
    punto.textContent = suyo < numero ? "✓" : String(suyo);
  });
  document.querySelectorAll("#stepsIndicador .step-line").forEach((linea) => {
    linea.classList.toggle("step-line--hecho", Number(linea.dataset.linea) < numero);
  });
  if (stepsLabel) stepsLabel.textContent = `Paso ${numero} de 3 · ${PASOS[numero]}`;
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

// La config del club no cambia durante la sesion: se pedia de nuevo en cada
// refreshHorarios(), o sea en cada cambio de cancha o de fecha.
async function loadConfig({ forzar = false } = {}) {
  if (config && !forzar) return;

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
      // alt vacio: el nombre del club ya esta al lado como texto visible.
      navLogo.outerHTML = `<img id="navLogo" src="${escapeHtml(config.logoUrl)}" alt="" class="site-logo" />`;
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

// El precio del club se guarda como texto libre. Si es un numero, se muestra
// con separador de miles ("12000" -> "12.000"); si el club escribio otra cosa,
// se respeta tal cual.
function formatPrecio(valor) {
  const limpio = String(valor ?? "").trim();
  // Ya viene con separador de miles ("12.000"): se deja como esta.
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(limpio)) return limpio;
  // Entero o decimal con coma: se agrupa.
  if (/^\d+(,\d+)?$/.test(limpio)) {
    const numero = Number(limpio.replace(",", "."));
    if (Number.isFinite(numero)) return numero.toLocaleString("es-AR");
  }
  // Cualquier otra cosa que haya escrito el club, tal cual.
  return limpio;
}

function tienePrecio() {
  const limpio = String(config?.precio ?? "").trim();
  if (!limpio) return false;
  const numero = Number(limpio.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero > 0 : true;
}

// "13:00" -> "13:00 – 14:00". El usuario no tiene que deducir cuanto dura.
function rangoHorario(horario) {
  const hora = Number(String(horario).split(":")[0]);
  if (!Number.isFinite(hora)) return horario;
  return `${horario} – ${String((hora + 1) % 24).padStart(2, "0")}:00`;
}

const FLECHA_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>`;
const CHECK_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>`;

function mostrarErrorHorarios(texto) {
  horariosContainer.innerHTML =
    `<div class="alert alert--error" role="alert" style="grid-column: 1 / -1">${ALERTA_SVG}<span>${escapeHtml(texto)}</span></div>`;
  if (contadorDisponibles) contadorDisponibles.textContent = "";
}

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
      clase = "slot--pasado";
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
      // Sin aria-label: el nombre accesible sale del texto visible
      // ("18:00 - 19:00 Disponible"). Un label distinto rompe WCAG 2.5.3.
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
  const senia = tienePrecio()
    ? `<p>Seña: <strong>$${escapeHtml(formatPrecio(config.precio))}</strong> por transferencia</p>`
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
  reservaSeleccion.textContent =
    `${seleccion.canchaEtiqueta} · ${fechaEnPalabras(seleccion.fecha)} · ${rangoHorario(seleccion.horario)}`;
  if (textoSenia) {
    textoSenia.innerHTML = tienePrecio()
      ? `Para reservar, la seña es de <strong>$${escapeHtml(formatPrecio(config.precio))}</strong>. Si no se transfiere ese monto, el turno se cancela automáticamente.`
      : "Para reservar hay que transferir la seña. Si no se transfiere, el turno se cancela automáticamente.";
  }
  limpiarErrores();
  mostrarPaso(1);
  modal.classList.remove("hidden");
  ultimoFoco = document.activeElement;
  document.getElementById("nombre")?.focus();
}

function closeModal() {
  if (enviandoReserva) return;
  modal.classList.add("hidden");
  formReserva.reset();
  if (nombreArchivo) nombreArchivo.textContent = "Elegí una foto o PDF del comprobante";
  seleccion = null;
  limpiarErrores();
  mostrarPaso(1);
  if (ultimoFoco && document.contains(ultimoFoco)) ultimoFoco.focus();
}

function validarPaso1() {
  const nombre = document.getElementById("nombre").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  let ok = true;

  if (nombre.length < 3) {
    setErrorCampo("nombre", "errorNombre", "Escribí tu nombre y apellido.");
    ok = false;
  } else {
    setErrorCampo("nombre", "errorNombre", "");
  }

  if (!/^\d{6,15}$/.test(telefono)) {
    setErrorCampo("telefono", "errorTelefono", "Escribí tu número sin espacios ni guiones. Ej: 3364578599");
    ok = false;
  } else {
    setErrorCampo("telefono", "errorTelefono", "");
  }

  if (!ok) {
    const primerError = document.querySelector('#paso1 [aria-invalid="true"]');
    primerError?.focus();
  }
  return ok;
}

const MAX_COMPROBANTE = 5 * 1024 * 1024;

function validarComprobante() {
  const archivo = comprobanteInput?.files?.[0];
  if (!archivo) {
    setErrorCampo("comprobante", "errorComprobante", "Adjuntá la foto o el PDF del comprobante de transferencia.");
    return false;
  }
  if (archivo.size > MAX_COMPROBANTE) {
    setErrorCampo("comprobante", "errorComprobante", "Ese archivo es muy grande. El máximo es 5 MB: probá con una foto más chica.");
    return false;
  }
  setErrorCampo("comprobante", "errorComprobante", "");
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

async function refreshHorarios({ forzarConfig = false } = {}) {
  if (!fechaInput.value) fechaInput.value = todayISO();
  renderSkeletonHorarios();

  const prevCancha = canchaSelect.value;
  await loadConfig({ forzar: forzarConfig });
  // Si se repoblo el select (primera carga o refresco explicito), conservar la
  // cancha elegida.
  if (prevCancha && [...canchaSelect.options].some((o) => o.value === prevCancha)) {
    canchaSelect.value = prevCancha;
  }

  await Promise.all([
    loadReservas().catch(() => { reservasActuales = []; }),
    loadBloqueos().catch(() => { bloqueosActuales = []; }),
  ]);
  renderHorarios();
}

// Se arma con los datos del turno elegido: antes mandaba "(indicar horario)"
// y "(indicar datos)" porque no sabia de que turno se trataba.
function buildCancelacionWhatsAppUrl(turno) {
  const texto = [
    "Hola, quiero solicitar la cancelacion de un turno.",
    `Cancha: ${etiquetaCancha(turno.cancha)}`,
    `Fecha: ${formatFecha(turno.fecha)}`,
    `Horario: ${turno.horario}`,
    `Nombre: ${turno.nombre || "(indicar nombre)"}`,
    `Telefono: ${turno.telefono || misTelefonoInput.value.trim()}`,
  ].join("\n");
  return `https://wa.me/${config.whatsappNumero}?text=${encodeURIComponent(texto)}`;
}

// El unico refresco que vuelve a pedir la config: lo pide el usuario a mano.
btnBuscar.addEventListener("click", async () => {
  const textoOriginal = btnBuscar.textContent;
  btnBuscar.disabled = true;
  btnBuscar.classList.add("is-loading");
  btnBuscar.textContent = "Buscando…";
  try {
    await refreshHorarios({ forzarConfig: true });
  } catch (error) {
    mostrarErrorHorarios(mensajeDeError(error));
  } finally {
    btnBuscar.disabled = false;
    btnBuscar.classList.remove("is-loading");
    btnBuscar.textContent = textoOriginal;
  }
});

canchaSelect.addEventListener("change", async () => {
  try { await refreshHorarios(); }
  catch (error) { mostrarErrorHorarios(mensajeDeError(error)); }
});

fechaInput.addEventListener("change", async () => {
  try { await refreshHorarios(); }
  catch (error) { mostrarErrorHorarios(mensajeDeError(error)); }
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
  limpiarErrores();
  mostrarPaso(2);
});

btnVolverPaso1.addEventListener("click", () => {
  limpiarErrores();
  mostrarPaso(1);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!modalConfirmar.classList.contains("hidden")) { cerrarConfirmacion(); return; }
  if (!modal.classList.contains("hidden")) closeModal();
});

// Copiar alias / CBU / titular
document.querySelectorAll("[data-copiar]").forEach((boton) => {
  boton.addEventListener("click", async () => {
    const valor = document.getElementById(boton.dataset.copiar)?.textContent?.trim();
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      const original = boton.textContent;
      boton.textContent = "Copiado";
      setTimeout(() => { boton.textContent = original; }, 1500);
    } catch (_) { /* sin permiso de portapapeles: que copie a mano */ }
  });
});

if (comprobanteInput) {
  comprobanteInput.addEventListener("change", () => {
    const archivo = comprobanteInput.files?.[0];
    if (nombreArchivo) {
      nombreArchivo.textContent = archivo ? archivo.name : "Elegí una foto o PDF del comprobante";
    }
    if (archivo) validarComprobante();
  });
}

// ── Modal de confirmacion (reemplaza window.confirm) ──────────
const modalConfirmar = document.getElementById("modalConfirmar");
const confirmarTitulo = document.getElementById("confirmarTitulo");
const confirmarCuerpo = document.getElementById("confirmarCuerpo");
const btnConfirmarSi = document.getElementById("btnConfirmarSi");
const btnConfirmarNo = document.getElementById("btnConfirmarNo");
let accionConfirmada = null;
let focoPrevioConfirmacion = null;

function pedirConfirmacion({ titulo, cuerpo, textoAccion, onAceptar }) {
  confirmarTitulo.textContent = titulo;
  confirmarCuerpo.innerHTML = cuerpo;
  btnConfirmarSi.textContent = textoAccion;
  accionConfirmada = onAceptar;
  focoPrevioConfirmacion = document.activeElement;
  modalConfirmar.classList.remove("hidden");
  btnConfirmarSi.focus();
}

function cerrarConfirmacion() {
  modalConfirmar.classList.add("hidden");
  accionConfirmada = null;
  if (focoPrevioConfirmacion && document.contains(focoPrevioConfirmacion)) focoPrevioConfirmacion.focus();
}

btnConfirmarNo.addEventListener("click", cerrarConfirmacion);
modalConfirmar.addEventListener("click", (event) => {
  if (event.target === modalConfirmar) cerrarConfirmacion();
});
btnConfirmarSi.addEventListener("click", () => {
  const accion = accionConfirmada;
  cerrarConfirmacion();
  if (accion) accion();
});

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
const btnDiaAnterior = document.getElementById("btnDiaAnterior");
const btnDiaSiguiente = document.getElementById("btnDiaSiguiente");

function setFecha(iso) {
  fechaInput.value = iso;
  fechaInput.dispatchEvent(new Event("change"));
}

// "2026-08-15" + 1 dia. Se arma con las partes para no correrse por zona horaria.
function isoDesplazado(fechaIso, dias) {
  const [year, month, day] = String(fechaIso).split("-").map(Number);
  if (!Number.isFinite(year)) return fechaIso;
  const fecha = new Date(year, month - 1, day + dias);
  const tz = fecha.getTimezoneOffset() * 60000;
  return new Date(fecha - tz).toISOString().split("T")[0];
}

function syncFecha() {
  const valor = fechaInput.value;
  if (fechaEnPalabrasEl) fechaEnPalabrasEl.textContent = fechaEnPalabras(valor);
  // No se puede reservar en el pasado: la flecha de atras muere en hoy.
  if (btnDiaAnterior) btnDiaAnterior.disabled = !valor || valor <= todayISO();
  if (chipHoy) chipHoy.setAttribute("aria-pressed", String(valor === todayISO()));
  if (chipManana) chipManana.setAttribute("aria-pressed", String(valor === isoSumandoDias(1)));
  if (chipOtro) {
    const esOtro = Boolean(valor) && valor !== todayISO() && valor !== isoSumandoDias(1);
    chipOtro.setAttribute("aria-pressed", String(esOtro));
  }
}

if (btnDiaAnterior) {
  btnDiaAnterior.addEventListener("click", () => {
    const anterior = isoDesplazado(fechaInput.value || todayISO(), -1);
    if (anterior >= todayISO()) setFecha(anterior);
  });
}
if (btnDiaSiguiente) {
  btnDiaSiguiente.addEventListener("click", () => {
    setFecha(isoDesplazado(fechaInput.value || todayISO(), 1));
  });
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
  if (!seleccion || enviandoReserva) return;
  if (!validarComprobante()) return;

  const reserva = { ...seleccion };
  const formData = new FormData(formReserva);
  formData.set("cancha", reserva.cancha);
  formData.set("fecha", reserva.fecha);
  formData.set("horario", reserva.horario);

  const textoOriginal = btnReservar.textContent;
  enviandoReserva = true;
  btnReservar.disabled = true;
  btnReservar.classList.add("is-loading");
  btnReservar.textContent = "Guardando…";
  setAlertaReserva("");

  try {
    const response = await fetch(`/api/${CLUB_SLUG}/reservas`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo guardar la reserva.");

    enviandoReserva = false;
    seleccion = reserva; // refreshHorarios limpia la seleccion; el paso 3 la necesita
    await refreshHorarios();
    seleccion = reserva;
    showConfirmacion(data);
  } catch (error) {
    setAlertaReserva(mensajeDeError(error));
  } finally {
    enviandoReserva = false;
    btnReservar.disabled = false;
    btnReservar.classList.remove("is-loading");
    btnReservar.textContent = textoOriginal;
  }
});

// ── Pantalla de confirmacion ──────────────────────────────────

function showConfirmacion(reserva) {
  const canchaLabel = seleccion ? seleccion.canchaEtiqueta : etiquetaCancha(reserva.cancha);
  const detalle = document.getElementById("confirmacionDetalle");
  if (detalle) {
    detalle.innerHTML = [
      `<p><strong>${escapeHtml(canchaLabel)}</strong></p>`,
      `<p>${escapeHtml(fechaEnPalabras(reserva.fecha))} · ${escapeHtml(rangoHorario(reserva.horario))}</p>`,
      `<p class="help">A nombre de ${escapeHtml(reserva.nombre)}</p>`,
    ].join("");
  }
  const btnWa = document.getElementById("btnWhatsAppConfirm");
  if (btnWa) btnWa.href = buildWhatsAppUrl(reserva);
  limpiarErrores();
  mostrarPaso(3);
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

const CALENDARIO_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>`;
const RELOJ_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;

let misTurnos = [];

function renderMisTurnos() {
  misTurnosList.innerHTML = misTurnos.map((turno, indice) => {
    const pagado = turno.estado === "confirmada";
    return `<article class="turno">
      <div style="display: flex; align-items: start; justify-content: space-between; gap: var(--s-3)">
        <h3 class="turno-cancha">${escapeHtml(etiquetaCancha(turno.cancha))}</h3>
        <span class="badge ${pagado ? "badge--ok" : "badge--pendiente"}">${pagado ? "Pagado" : "Sin pagar"}</span>
      </div>
      <p class="turno-dato">${CALENDARIO_SVG}${escapeHtml(fechaEnPalabras(turno.fecha))}</p>
      <p class="turno-dato">${RELOJ_SVG}${escapeHtml(rangoHorario(turno.horario))}</p>
      <button type="button" class="btn btn--danger btn--sm" data-cancelar="${indice}" style="margin-top: var(--s-4)">
        Solicitar cancelación
      </button>
    </article>`;
  }).join("");

  misTurnosList.querySelectorAll("[data-cancelar]").forEach((boton) => {
    boton.addEventListener("click", () => {
      const turno = misTurnos[Number(boton.dataset.cancelar)];
      if (!turno) return;
      if (!config?.whatsappNumero) {
        misTurnosList.insertAdjacentHTML("afterbegin",
          `<div class="alert alert--error" role="alert">${ALERTA_SVG}<span>El club no tiene WhatsApp configurado.</span></div>`);
        return;
      }
      pedirConfirmacion({
        titulo: "¿Pedir la cancelación de este turno?",
        cuerpo: `${escapeHtml(etiquetaCancha(turno.cancha))} · ${escapeHtml(fechaEnPalabras(turno.fecha))} · ${escapeHtml(rangoHorario(turno.horario))}.<br />Te vamos a abrir WhatsApp con el mensaje ya escrito para que lo envíes al club.`,
        textoAccion: "Abrir WhatsApp",
        onAceptar: () => { window.open(buildCancelacionWhatsAppUrl(turno), "_blank", "noopener"); },
      });
    });
  });
}

function renderMisTurnosVacio(titulo, texto) {
  misTurnosList.innerHTML = `<div class="empty">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>
    </svg>
    <p><strong style="color: var(--c-ink-900)">${escapeHtml(titulo)}</strong><br />${escapeHtml(texto)}</p>
  </div>`;
}

btnMisReservas.addEventListener("click", async () => {
  const tel = misTelefonoInput.value.trim();
  if (!/^\d{6,15}$/.test(tel)) {
    renderMisTurnosVacio("Revisá el número.", "Escribí tu número sin espacios ni guiones. Ej: 3364578599");
    return;
  }

  misTurnosList.innerHTML = `<div class="skeleton" style="height: 72px"></div><div class="skeleton" style="height: 72px"></div>`;
  const textoOriginal = btnMisReservas.textContent;
  btnMisReservas.disabled = true;
  btnMisReservas.textContent = "Buscando…";

  try {
    const response = await fetch(`/api/${CLUB_SLUG}/mis-reservas?telefono=${encodeURIComponent(tel)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Error al consultar.");
    misTurnos = data;
    if (!data.length) {
      renderMisTurnosVacio(
        "No encontramos turnos con ese número.",
        "Revisá que sea el mismo número que usaste al reservar, sin 0 ni 15."
      );
      return;
    }
    renderMisTurnos();
  } catch (error) {
    misTurnosList.innerHTML =
      `<div class="alert alert--error" role="alert">${ALERTA_SVG}<span>${escapeHtml(mensajeDeError(error))}</span></div>`;
  } finally {
    btnMisReservas.disabled = false;
    btnMisReservas.textContent = textoOriginal;
  }
});

// ─────────────────────────────────────────────────────────────

async function init() {
  fechaInput.min = todayISO();
  fechaInput.value = todayISO();
  syncFecha();
  try {
    await refreshHorarios();
  } catch (error) { mostrarErrorHorarios(mensajeDeError(error)); }
}

init();

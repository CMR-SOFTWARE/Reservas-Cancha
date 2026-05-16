const paso1 = document.getElementById("paso1");
const paso2 = document.getElementById("paso2");
const paso3 = document.getElementById("paso3");
const dot2 = document.getElementById("dot2");
const dot3 = document.getElementById("dot3");
const label2 = document.getElementById("label2");
const label3 = document.getElementById("label3");

const nombreInput = document.getElementById("nombre");
const deporteInput = document.getElementById("deporte");
const whatsappInput = document.getElementById("whatsapp");
const emailInput = document.getElementById("email");
const slugPreview = document.getElementById("slugPreview");
const msg1 = document.getElementById("msg1");

const comprobanteInput = document.getElementById("comprobante");
const msg2 = document.getElementById("msg2");

let datosClub = {};

function toSlug(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

nombreInput.addEventListener("input", () => {
  const slug = toSlug(nombreInput.value);
  slugPreview.textContent = slug ? `turnos.club/${slug}` : "—";
});

function showMsg(el, text) {
  el.textContent = text;
  el.classList.remove("hidden");
}

function activateDot(dot, label) {
  dot.className = "w-8 h-8 rounded-full bg-green-700 text-white text-sm font-bold flex items-center justify-center";
  label.className = "text-sm font-semibold text-green-700";
}

document.getElementById("btnSiguiente").addEventListener("click", async () => {
  msg1.classList.add("hidden");

  const nombre = nombreInput.value.trim();
  const deporte = deporteInput.value;
  const whatsapp = whatsappInput.value.trim().replace(/\D/g, "");
  const email = emailInput.value.trim();

  if (!nombre) return showMsg(msg1, "El nombre del club es requerido.");
  if (!whatsapp || whatsapp.length < 8) return showMsg(msg1, "Ingresá un número de WhatsApp válido.");
  if (!email || !email.includes("@")) return showMsg(msg1, "Ingresá un email válido.");

  datosClub = { nombre, deporte, whatsapp: "549" + whatsapp, email };

  try {
    const res = await fetch("/api/suscripcion");
    const sub = await res.json();
    document.getElementById("precioSub").textContent = Number(sub.precio).toLocaleString("es-AR");
    document.getElementById("aliasSub").textContent = sub.alias || "—";
    document.getElementById("cbuSub").textContent = sub.cbu || "—";
    document.getElementById("titularSub").textContent = sub.titular || "—";
  } catch (_) {}

  paso1.classList.add("hidden");
  paso2.classList.remove("hidden");
  activateDot(dot2, label2);
});

document.getElementById("btnVolver").addEventListener("click", () => {
  paso2.classList.add("hidden");
  paso1.classList.remove("hidden");
  dot2.className = "w-8 h-8 rounded-full bg-slate-300 text-slate-500 text-sm font-bold flex items-center justify-center";
  label2.className = "text-sm font-semibold text-slate-400";
});

document.getElementById("btnEnviar").addEventListener("click", async () => {
  msg2.classList.add("hidden");
  const btn = document.getElementById("btnEnviar");

  if (!comprobanteInput.files?.length) return showMsg(msg2, "Adjuntá el comprobante de pago.");

  const formData = new FormData();
  formData.append("nombre", datosClub.nombre);
  formData.append("deporte", datosClub.deporte);
  formData.append("whatsapp", datosClub.whatsapp);
  formData.append("email", datosClub.email);
  formData.append("comprobante", comprobanteInput.files[0]);

  try {
    btn.disabled = true;
    btn.textContent = "Enviando...";

    const res = await fetch("/api/solicitudes", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error al enviar la solicitud.");

    paso2.classList.add("hidden");
    paso3.classList.remove("hidden");
    activateDot(dot3, label3);
  } catch (error) {
    showMsg(msg2, error.message);
    btn.disabled = false;
    btn.textContent = "Enviar solicitud";
  }
});

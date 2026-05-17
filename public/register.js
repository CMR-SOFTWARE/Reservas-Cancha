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

const PLANES = {
  inicial:  { nombre: "Inicial",  maxCanchas: 2,  precio: 50000 },
  estandar: { nombre: "Estándar", maxCanchas: 5,  precio: 80000 },
  max:      { nombre: "Max",      maxCanchas: 10, precio: 100000 },
};

let datosClub = {};

function toSlug(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// Plan selector visual
function getSelectedPlan() {
  const checked = document.querySelector('input[name="plan"]:checked');
  return checked ? checked.value : "inicial";
}

function selectPlan(value) {
  document.querySelectorAll('input[name="plan"]').forEach((radio) => {
    const card = radio.nextElementSibling;
    if (radio.value === value) {
      radio.checked = true;
      card.classList.add("border-green-600", "bg-green-50");
      card.classList.remove("border-slate-200", "bg-slate-50");
    } else {
      radio.checked = false;
      card.classList.remove("border-green-600", "bg-green-50");
      card.classList.add("border-slate-200", "bg-slate-50");
    }
  });
}

document.getElementById("planSelector").addEventListener("change", (e) => {
  if (e.target.name === "plan") selectPlan(e.target.value);
});

// Pre-seleccionar plan desde ?plan= en la URL
const urlPlan = new URLSearchParams(window.location.search).get("plan") || "inicial";
selectPlan(PLANES[urlPlan] ? urlPlan : "inicial");

nombreInput.addEventListener("input", () => {
  const slug = toSlug(nombreInput.value);
  slugPreview.textContent = slug ? `cmrcanchas.com/${slug}` : "—";
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
  const plan = getSelectedPlan();

  if (!nombre) return showMsg(msg1, "El nombre del club es requerido.");
  if (!whatsapp || whatsapp.length < 8) return showMsg(msg1, "Ingresá un número de WhatsApp válido.");
  if (!email || !email.includes("@")) return showMsg(msg1, "Ingresá un email válido.");

  datosClub = { nombre, deporte, whatsapp: "549" + whatsapp, email, plan };

  const planInfo = PLANES[plan];
  document.getElementById("precioSub").textContent = planInfo.precio.toLocaleString("es-AR");

  try {
    const res = await fetch("/api/planes");
    const planes = await res.json();
    const p = planes.find((x) => x.id === plan);
    if (p) {
      document.getElementById("aliasSub").textContent = p.alias || "—";
      document.getElementById("cbuSub").textContent = p.cbu || "—";
      document.getElementById("titularSub").textContent = p.titular || "—";
    }
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
  formData.append("plan", datosClub.plan);
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

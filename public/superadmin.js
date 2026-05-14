const loginCard = document.getElementById("loginCard");
const saPanel = document.getElementById("saPanel");
const saPassword = document.getElementById("saPassword");
const btnSaLogin = document.getElementById("btnSaLogin");
const loginMsg = document.getElementById("loginMsg");
const clubsList = document.getElementById("clubsList");
const btnRefreshClubs = document.getElementById("btnRefreshClubs");
const logoMsg = document.getElementById("logoMsg");
const cfgNombre = document.getElementById("cfgNombre");
const cfgSlug = document.getElementById("cfgSlug");
const cfgPassword = document.getElementById("cfgPassword");
const btnCrearClub = document.getElementById("btnCrearClub");
const createMsg = document.getElementById("createMsg");

let saToken = sessionStorage.getItem("saToken") || "";

function setMsg(el, text, isError = true) {
  el.textContent = text;
  el.className = `text-sm ${isError ? "text-red-600" : "text-emerald-700"}`;
  el.classList.remove("hidden");
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(saToken ? { Authorization: `Bearer ${saToken}` } : {}),
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de servidor.");
  return data;
}

// Auto-genera slug a partir del nombre
cfgNombre.addEventListener("input", () => {
  cfgSlug.value = cfgNombre.value
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
});

function logoPreview(club) {
  if (club.logo_url) {
    return `<img src="${club.logo_url}" alt="${club.nombre}"
              class="w-12 h-12 rounded-lg object-cover border border-slate-200 flex-shrink-0" />`;
  }
  const colors = ["bg-blue-500","bg-emerald-500","bg-violet-500","bg-orange-500","bg-rose-500","bg-teal-500"];
  let n = 0;
  for (const ch of club.slug) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  const color = colors[n % colors.length];
  const initials = club.nombre.split(/\s+/).slice(0,2).map((w) => w[0]?.toUpperCase() || "").join("");
  return `<div class="w-12 h-12 rounded-lg ${color} flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            ${initials}
          </div>`;
}

async function loadClubs() {
  clubsList.textContent = "Cargando...";
  try {
    const clubs = await api("/api/superadmin/clubs");
    if (!clubs.length) {
      clubsList.innerHTML = "<p class='text-slate-400 text-sm'>No hay clubs registrados.</p>";
      return;
    }
    clubsList.innerHTML = clubs.map((c) => `
      <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div class="flex items-center gap-3">
          ${logoPreview(c)}
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-slate-800 truncate">${c.nombre}</div>
            <div class="text-xs text-slate-400 font-mono">/${c.slug}</div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${c.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}">
              ${c.activo ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <label class="flex-1 min-w-0">
            <input type="file" accept="image/*"
                   class="logo-file-input block w-full text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-300 cursor-pointer"
                   data-club-id="${c.id}" />
          </label>
          <button class="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 flex-shrink-0"
                  data-action="subir-logo" data-club-id="${c.id}">
            Subir logo
          </button>
          <a href="/${c.slug}" target="_blank"
             class="text-xs text-blue-600 hover:underline flex-shrink-0">Ver</a>
          <a href="/${c.slug}/admin" target="_blank"
             class="text-xs text-blue-600 hover:underline flex-shrink-0">Admin</a>
        </div>
      </div>
    `).join("");

    clubsList.addEventListener("click", handleClubListClick, { once: true });
  } catch (error) {
    clubsList.textContent = error.message;
  }
}

async function handleClubListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) { clubsList.addEventListener("click", handleClubListClick, { once: true }); return; }
  if (target.dataset.action !== "subir-logo") { clubsList.addEventListener("click", handleClubListClick, { once: true }); return; }

  const clubId = target.dataset.clubId;
  const input = clubsList.querySelector(`.logo-file-input[data-club-id="${clubId}"]`);
  if (!input?.files?.length) {
    setMsg(logoMsg, "Seleccioná una imagen primero.");
    clubsList.addEventListener("click", handleClubListClick, { once: true });
    return;
  }

  const formData = new FormData();
  formData.append("logo", input.files[0]);

  try {
    target.disabled = true;
    target.textContent = "Subiendo...";
    const data = await api(`/api/superadmin/clubs/${clubId}/logo`, {
      method: "PATCH",
      body: formData,
    });
    setMsg(logoMsg, "Logo actualizado correctamente.", false);
    await loadClubs();
  } catch (error) {
    setMsg(logoMsg, error.message || "No se pudo subir el logo.");
    target.disabled = false;
    target.textContent = "Subir logo";
    clubsList.addEventListener("click", handleClubListClick, { once: true });
  }
}

btnSaLogin.addEventListener("click", async () => {
  const password = saPassword.value.trim();
  if (!password) { setMsg(loginMsg, "Ingresá la clave maestra."); return; }
  try {
    const data = await api("/api/superadmin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    saToken = data.token;
    sessionStorage.setItem("saToken", saToken);
    loginCard.classList.add("hidden");
    saPanel.classList.remove("hidden");
    await loadClubs();
  } catch (error) { setMsg(loginMsg, error.message || "No se pudo iniciar sesión."); }
});

btnRefreshClubs.addEventListener("click", loadClubs);

btnCrearClub.addEventListener("click", async () => {
  const nombre = cfgNombre.value.trim();
  const slug = cfgSlug.value.trim();
  const password = cfgPassword.value.trim();
  if (!nombre || !slug || !password) {
    setMsg(createMsg, "Completá todos los campos.");
    return;
  }
  try {
    const data = await api("/api/superadmin/clubs", {
      method: "POST",
      body: JSON.stringify({ nombre, slug, password }),
    });
    setMsg(createMsg, `Club "${data.nombre}" creado. URL: /${data.slug}`, false);
    cfgNombre.value = "";
    cfgSlug.value = "";
    cfgPassword.value = "";
    await loadClubs();
  } catch (error) { setMsg(createMsg, error.message || "No se pudo crear el club."); }
});

if (saToken) {
  loginCard.classList.add("hidden");
  saPanel.classList.remove("hidden");
  loadClubs();
}

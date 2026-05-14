const loginCard = document.getElementById("loginCard");
const saPanel = document.getElementById("saPanel");
const saPassword = document.getElementById("saPassword");
const btnSaLogin = document.getElementById("btnSaLogin");
const loginMsg = document.getElementById("loginMsg");
const clubsList = document.getElementById("clubsList");
const btnRefreshClubs = document.getElementById("btnRefreshClubs");
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
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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

async function loadClubs() {
  clubsList.textContent = "Cargando...";
  try {
    const clubs = await api("/api/superadmin/clubs");
    if (!clubs.length) {
      clubsList.innerHTML = "<p>No hay clubs registrados.</p>";
      return;
    }
    clubsList.innerHTML = clubs.map((c) => `
      <div class="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div>
          <span class="font-semibold text-slate-700">${c.nombre}</span>
          <span class="ml-2 font-mono text-xs text-slate-400">/${c.slug}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs ${c.activo ? "text-emerald-600" : "text-slate-400"}">${c.activo ? "Activo" : "Inactivo"}</span>
          <a href="/${c.slug}" target="_blank"
             class="text-xs text-blue-600 hover:underline">Ver</a>
          <a href="/${c.slug}/admin" target="_blank"
             class="text-xs text-blue-600 hover:underline">Admin</a>
        </div>
      </div>
    `).join("");
  } catch (error) {
    clubsList.textContent = error.message;
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

// Si ya hay token en sesión, intentar entrar directo
if (saToken) {
  loginCard.classList.add("hidden");
  saPanel.classList.remove("hidden");
  loadClubs();
}

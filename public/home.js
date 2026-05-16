const loading = document.getElementById("loading");
const emptyState = document.getElementById("emptyState");
const clubsGrid = document.getElementById("clubsGrid");
const searchInput = document.getElementById("searchInput");
const sportFilters = document.getElementById("sportFilters");

const PALETTE = [
  "bg-blue-600", "bg-emerald-600", "bg-violet-600",
  "bg-orange-500", "bg-rose-600", "bg-teal-600",
];

const DEPORTE_LABEL = {
  futbol: "Fútbol", padel: "Pádel", tenis: "Tenis",
  basquet: "Básquet", voley: "Voley", hockey: "Hockey",
};

function initials(nombre) {
  return nombre.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("");
}

function colorForSlug(slug) {
  let n = 0;
  for (const ch of slug) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[n % PALETTE.length];
}

function deporteLabel(d) {
  return DEPORTE_LABEL[d] || (d ? d.charAt(0).toUpperCase() + d.slice(1) : "Otro");
}

let allClubs = [];
let activeDeporte = "todos";

function renderGrid() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = allClubs.filter((c) => {
    const matchDeporte = activeDeporte === "todos" || c.deporte === activeDeporte;
    const matchSearch = !query || c.nombre.toLowerCase().includes(query);
    return matchDeporte && matchSearch;
  });

  if (!filtered.length) {
    clubsGrid.classList.add("hidden");
    emptyState.classList.remove("hidden");
    emptyState.querySelector("p").textContent =
      query || activeDeporte !== "todos"
        ? "No se encontraron clubs con ese criterio."
        : "No hay clubs disponibles aún.";
    return;
  }

  emptyState.classList.add("hidden");
  clubsGrid.classList.remove("hidden");
  clubsGrid.innerHTML = filtered.map((club) => {
    const color = colorForSlug(club.slug);
    const avatar = club.logoUrl
      ? `<img src="${club.logoUrl}" alt="${club.nombre}" class="w-16 h-16 rounded-full object-cover" />`
      : `<div class="w-16 h-16 rounded-full ${color} flex items-center justify-center text-white text-2xl font-bold select-none">
           ${initials(club.nombre)}
         </div>`;

    return `
      <article class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col items-center gap-4 hover:shadow-md transition-shadow">
        ${avatar}
        <div class="text-center">
          <h2 class="text-lg font-bold text-slate-800">${club.nombre}</h2>
          <span class="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            ${deporteLabel(club.deporte)}
          </span>
        </div>
        <a href="/${club.slug}"
           class="w-full text-center rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 transition-colors">
          Reservar turno
        </a>
      </article>
    `;
  }).join("");
}

function buildFilters() {
  const deportes = [...new Set(allClubs.map((c) => c.deporte))];
  if (deportes.length <= 1) return;

  sportFilters.classList.remove("hidden");
  const all = ["todos", ...deportes];
  sportFilters.innerHTML = all.map((d) => `
    <button data-deporte="${d}"
            class="sport-btn rounded-full px-3 py-1 text-xs font-semibold border transition-colors
                   ${d === activeDeporte
                     ? "bg-green-700 text-white border-green-700"
                     : "bg-white text-slate-600 border-slate-300 hover:border-green-600 hover:text-green-700"}">
      ${d === "todos" ? "Todos" : deporteLabel(d)}
    </button>
  `).join("");

  sportFilters.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-deporte]");
    if (!btn) return;
    activeDeporte = btn.dataset.deporte;
    buildFilters();
    renderGrid();
  });
}

searchInput.addEventListener("input", renderGrid);

async function init() {
  try {
    const res = await fetch("/api/clubs");
    allClubs = await res.json();
    loading.classList.add("hidden");
    buildFilters();
    renderGrid();
  } catch (_) {
    loading.textContent = "No se pudo cargar la lista de clubs.";
  }
}

init();

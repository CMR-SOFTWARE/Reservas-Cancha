const loading = document.getElementById("loading");
const emptyState = document.getElementById("emptyState");
const clubsGrid = document.getElementById("clubsGrid");

function initials(nombre) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

const PALETTE = [
  "bg-blue-600", "bg-emerald-600", "bg-violet-600",
  "bg-orange-500", "bg-rose-600", "bg-teal-600",
];

function colorForSlug(slug) {
  let n = 0;
  for (const ch of slug) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[n % PALETTE.length];
}

function renderClubs(clubs) {
  loading.classList.add("hidden");

  if (!clubs.length) {
    emptyState.classList.remove("hidden");
    return;
  }

  clubsGrid.classList.remove("hidden");
  clubsGrid.innerHTML = clubs.map((club) => {
    const avatarColor = colorForSlug(club.slug);
    const avatar = club.logoUrl
      ? `<img src="${club.logoUrl}" alt="${club.nombre}" class="w-16 h-16 rounded-full object-cover" />`
      : `<div class="w-16 h-16 rounded-full ${avatarColor} flex items-center justify-center text-white text-2xl font-bold select-none">
           ${initials(club.nombre)}
         </div>`;

    return `
      <article class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col items-center gap-4 hover:shadow-md transition-shadow">
        ${avatar}
        <div class="text-center">
          <h2 class="text-lg font-bold text-slate-800">${club.nombre}</h2>
          <p class="text-xs text-slate-400 mt-0.5">/${club.slug}</p>
        </div>
        <a href="/${club.slug}"
           class="w-full text-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
          Reservar turno
        </a>
      </article>
    `;
  }).join("");
}

async function init() {
  try {
    const res = await fetch("/api/clubs");
    const clubs = await res.json();
    renderClubs(clubs);
  } catch (_) {
    loading.textContent = "No se pudo cargar la lista de clubs.";
  }
}

init();

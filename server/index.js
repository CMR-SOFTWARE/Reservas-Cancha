const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const multer = require("multer");
const fs = require("fs/promises");
const fsSync = require("fs");
const crypto = require("crypto");

let sqlite3 = null;
try { sqlite3 = require("sqlite3").verbose(); } catch (_) { sqlite3 = null; }
let supabase = null;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const { createClient } = require("@supabase/supabase-js");
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  }
} catch (_) { supabase = null; }

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, "..");
const IS_VERCEL = process.env.VERCEL === "1";
const DATA_DIR = IS_VERCEL ? path.join("/tmp", "reservas-turno-data") : ROOT_DIR;
const DB_FILE = process.env.SQLITE_PATH || path.join(DATA_DIR, "reservas.sqlite");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "cambia_esta_clave";
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const ADMIN_SCRYPT_KEYLEN = 64;
const ADMIN_SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const USE_SUPABASE = Boolean(supabase);
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "comprobantes";
const USE_SQLITE = !USE_SUPABASE && Boolean(sqlite3);

const DEFAULT_CLUB_SLUG = (process.env.CLUB_SLUG || "mi-club").toLowerCase().replace(/[^a-z0-9-]/g, "-");
const DEFAULT_CLUB_NOMBRE = process.env.CLUB_NOMBRE || process.env.TRANSFER_TITULAR || "Mi Club";
const DEFAULT_CLUB_DEPORTE = process.env.CLUB_DEPORTE || "futbol";
const DEFAULT_CLUB_HORA_INICIO = parseInt(process.env.CLUB_HORA_INICIO || "10", 10);
const DEFAULT_CLUB_HORA_FIN = parseInt(process.env.CLUB_HORA_FIN || "23", 10);
const DEFAULT_CLUB_PRECIO = process.env.CLUB_PRECIO || "0";
const DEFAULT_CLUB_WHATSAPP = (process.env.WHATSAPP_NUMERO || "5491112345678").replace(/\D/g, "");
const DEFAULT_CLUB_ALIAS = process.env.TRANSFER_ALIAS || "mi.alias";
const DEFAULT_CLUB_CBU = process.env.TRANSFER_CBU || "0000000000000000000000";
const DEFAULT_CLUB_TITULAR = process.env.TRANSFER_TITULAR || "Nombre Club";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const DEFAULT_ADMIN_PASSWORD_SECOND = process.env.ADMIN_PASSWORD_SECOND || "";

function parseDefaultCanchas() {
  const nombres = (process.env.CLUB_CANCHAS || "11,7").split(",").map((s) => s.trim()).filter(Boolean);
  const etiquetas = (process.env.CLUB_CANCHAS_ETIQUETAS || "").split(",").map((s) => s.trim());
  return nombres.map((nombre, i) => ({
    nombre,
    etiqueta: etiquetas[i] || `Cancha ${nombre}`,
  }));
}

if (!fsSync.existsSync(DATA_DIR)) fsSync.mkdirSync(DATA_DIR, { recursive: true });
if (!fsSync.existsSync(UPLOADS_DIR)) fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = USE_SQLITE ? new sqlite3.Database(DB_FILE) : null;

// ============================================================
// DB HELPERS
// ============================================================
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) { reject(error); return; }
      resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) { reject(error); return; }
      resolve(rows);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) { reject(error); return; }
      resolve(row || null);
    });
  });
}

// ============================================================
// SCHEMA INIT
// ============================================================
async function initDb() {
  if (!USE_SQLITE) return;

  await dbRun(`
    CREATE TABLE IF NOT EXISTS clubs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      deporte TEXT NOT NULL DEFAULT 'futbol',
      logo_url TEXT,
      whatsapp TEXT NOT NULL,
      transfer_alias TEXT NOT NULL,
      transfer_cbu TEXT NOT NULL,
      transfer_titular TEXT NOT NULL,
      hora_inicio INTEGER NOT NULL DEFAULT 10,
      hora_fin INTEGER NOT NULL DEFAULT 23,
      precio TEXT NOT NULL DEFAULT '0',
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS canchas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      etiqueta TEXT NOT NULL,
      activa INTEGER NOT NULL DEFAULT 1,
      UNIQUE(club_id, nombre),
      FOREIGN KEY (club_id) REFERENCES clubs(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt_b TEXT,
      password_hash_b TEXT,
      actualizado_en TEXT NOT NULL,
      FOREIGN KEY (club_id) REFERENCES clubs(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      cancha TEXT NOT NULL,
      fecha TEXT NOT NULL,
      horario TEXT NOT NULL,
      comprobante_nombre_original TEXT NOT NULL,
      comprobante_archivo TEXT NOT NULL,
      comprobante_mimetype TEXT NOT NULL,
      comprobante_size INTEGER NOT NULL,
      creado_en TEXT NOT NULL
    )
  `);
  const reservaCols = await dbAll("PRAGMA table_info(reservas)");
  const reservaColSet = new Set(reservaCols.map((c) => c.name));
  if (!reservaColSet.has("club_id")) {
    await dbRun("ALTER TABLE reservas ADD COLUMN club_id INTEGER");
  }

  await dbRun(`
    CREATE TABLE IF NOT EXISTS bloqueos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER,
      cancha TEXT NOT NULL,
      fecha TEXT NOT NULL,
      horario TEXT,
      horario_desde TEXT,
      horario_hasta TEXT,
      dia_completo INTEGER NOT NULL,
      motivo TEXT NOT NULL,
      creado_en TEXT NOT NULL
    )
  `);
  const bloqueoCols = await dbAll("PRAGMA table_info(bloqueos)");
  const bloqueoColSet = new Set(bloqueoCols.map((c) => c.name));
  if (!bloqueoColSet.has("club_id")) {
    await dbRun("ALTER TABLE bloqueos ADD COLUMN club_id INTEGER");
  }
}

// ============================================================
// AUTH HELPERS
// ============================================================
function hashAdminPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plain, salt, ADMIN_SCRYPT_KEYLEN, ADMIN_SCRYPT_OPTS).toString("hex");
  return { salt, hash };
}

function verifyAdminPasswordScrypt(plain, salt, hashHex) {
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(plain, salt, expected.length, ADMIN_SCRYPT_OPTS);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_) { return false; }
}

function verifyAdminRowPasswords(plain, row) {
  if (!row) return false;
  if (verifyAdminPasswordScrypt(plain, row.password_salt, row.password_hash)) return true;
  if (row.password_salt_b && row.password_hash_b &&
      verifyAdminPasswordScrypt(plain, row.password_salt_b, row.password_hash_b)) return true;
  return false;
}

// Token: "${clubId}:${expiresAt}.${hmac}"
function createAdminSession(clubId) {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  const payload = `${clubId}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function parseAdminToken(token) {
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.substring(0, lastDot);
  const providedSig = token.substring(lastDot + 1);
  const expectedSig = crypto.createHmac("sha256", ADMIN_SESSION_SECRET).update(payload).digest("hex");
  if (providedSig !== expectedSig) return null;
  const colonIdx = payload.indexOf(":");
  if (colonIdx === -1) return null;
  const clubId = Number(payload.substring(0, colonIdx));
  const expiresAt = Number(payload.substring(colonIdx + 1));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return { clubId };
}

async function verifyAdminPasswordForClub(plain, clubId) {
  if (USE_SQLITE) {
    const row = await dbGet("SELECT * FROM admins WHERE club_id = ? LIMIT 1", [clubId]);
    return row ? verifyAdminRowPasswords(plain, row) : null;
  }
  if (USE_SUPABASE) {
    const { data } = await supabase.from("admins").select("*").eq("club_id", clubId).maybeSingle();
    return data ? verifyAdminRowPasswords(plain, data) : null;
  }
  return null;
}

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const [, token] = auth.split(" ");
  const parsed = parseAdminToken(token);
  if (!parsed || parsed.clubId !== req.club.id) {
    return res.status(401).json({ error: "No autorizado." });
  }
  return next();
}

// ============================================================
// CLUB DATA ACCESS
// ============================================================
function mapClubRow(clubRow, canchaRows) {
  return {
    id: clubRow.id,
    slug: clubRow.slug,
    nombre: clubRow.nombre,
    deporte: clubRow.deporte || "futbol",
    logoUrl: clubRow.logo_url || null,
    whatsapp: clubRow.whatsapp,
    transferencia: {
      alias: clubRow.transfer_alias,
      cbu: clubRow.transfer_cbu,
      titular: clubRow.transfer_titular,
    },
    horaInicio: Number(clubRow.hora_inicio),
    horaFin: Number(clubRow.hora_fin),
    precio: clubRow.precio,
    canchas: (canchaRows || []).map((c) => ({ nombre: c.nombre, etiqueta: c.etiqueta })),
  };
}

async function getClubBySlug(slug) {
  if (USE_SQLITE) {
    const clubRow = await dbGet("SELECT * FROM clubs WHERE slug = ? AND activo = 1 LIMIT 1", [slug]);
    if (!clubRow) return null;
    const canchas = await dbAll(
      "SELECT * FROM canchas WHERE club_id = ? AND activa = 1 ORDER BY id ASC",
      [clubRow.id]
    );
    return mapClubRow(clubRow, canchas);
  }
  if (USE_SUPABASE) {
    const { data: clubRow, error } = await supabase
      .from("clubs").select("*").eq("slug", slug).eq("activo", true).maybeSingle();
    if (error || !clubRow) return null;
    const { data: canchas } = await supabase
      .from("canchas").select("*").eq("club_id", clubRow.id).eq("activa", true).order("id");
    return mapClubRow(clubRow, canchas || []);
  }
  return null;
}

async function getDefaultClubSlug() {
  if (USE_SQLITE) {
    const row = await dbGet("SELECT slug FROM clubs WHERE activo = 1 ORDER BY id ASC LIMIT 1");
    return row ? row.slug : DEFAULT_CLUB_SLUG;
  }
  if (USE_SUPABASE) {
    const { data } = await supabase
      .from("clubs").select("slug").eq("activo", true).order("id").limit(1).maybeSingle();
    return data ? data.slug : DEFAULT_CLUB_SLUG;
  }
  return DEFAULT_CLUB_SLUG;
}

// ============================================================
// SEED CLUB POR DEFECTO
// ============================================================
async function ensureAdminForClub(clubId, now) {
  if (USE_SQLITE) {
    const existing = await dbGet("SELECT id FROM admins WHERE club_id = ? LIMIT 1", [clubId]);
    if (existing) {
      const h1 = hashAdminPassword(DEFAULT_ADMIN_PASSWORD);
      const h2 = DEFAULT_ADMIN_PASSWORD_SECOND ? hashAdminPassword(DEFAULT_ADMIN_PASSWORD_SECOND) : null;
      await dbRun(
        "UPDATE admins SET password_salt=?, password_hash=?, password_salt_b=?, password_hash_b=?, actualizado_en=? WHERE club_id=?",
        [h1.salt, h1.hash, h2 ? h2.salt : null, h2 ? h2.hash : null, now, clubId]
      );
      return;
    }
    const h1 = hashAdminPassword(DEFAULT_ADMIN_PASSWORD);
    const h2 = DEFAULT_ADMIN_PASSWORD_SECOND ? hashAdminPassword(DEFAULT_ADMIN_PASSWORD_SECOND) : null;
    await dbRun(
      `INSERT INTO admins (club_id, password_salt, password_hash, password_salt_b, password_hash_b, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clubId, h1.salt, h1.hash, h2 ? h2.salt : null, h2 ? h2.hash : null, now]
    );
    return;
  }
  if (USE_SUPABASE) {
    const { data: existing } = await supabase
      .from("admins").select("id").eq("club_id", clubId).maybeSingle();
    if (existing) return;
    const h1 = hashAdminPassword(DEFAULT_ADMIN_PASSWORD);
    const h2 = DEFAULT_ADMIN_PASSWORD_SECOND ? hashAdminPassword(DEFAULT_ADMIN_PASSWORD_SECOND) : null;
    const { error } = await supabase.from("admins").insert({
      club_id: clubId,
      password_salt: h1.salt,
      password_hash: h1.hash,
      password_salt_b: h2 ? h2.salt : null,
      password_hash_b: h2 ? h2.hash : null,
      actualizado_en: now,
    });
    if (error) console.warn("[seed] No se pudo crear admin:", error.message);
  }
}

async function seedDefaultClub() {
  const now = new Date().toISOString();

  if (USE_SQLITE) {
    const existing = await dbGet("SELECT id FROM clubs WHERE slug = ? LIMIT 1", [DEFAULT_CLUB_SLUG]);
    if (existing) {
      await ensureAdminForClub(existing.id, now);
      return;
    }
    const result = await dbRun(
      `INSERT INTO clubs (slug, nombre, deporte, whatsapp, transfer_alias, transfer_cbu, transfer_titular,
        hora_inicio, hora_fin, precio, activo, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [DEFAULT_CLUB_SLUG, DEFAULT_CLUB_NOMBRE, DEFAULT_CLUB_DEPORTE, DEFAULT_CLUB_WHATSAPP,
       DEFAULT_CLUB_ALIAS, DEFAULT_CLUB_CBU, DEFAULT_CLUB_TITULAR,
       DEFAULT_CLUB_HORA_INICIO, DEFAULT_CLUB_HORA_FIN, DEFAULT_CLUB_PRECIO, now]
    );
    const clubId = result.lastID;
    for (const cancha of parseDefaultCanchas()) {
      await dbRun(
        "INSERT OR IGNORE INTO canchas (club_id, nombre, etiqueta, activa) VALUES (?, ?, ?, 1)",
        [clubId, cancha.nombre, cancha.etiqueta]
      );
    }
    await dbRun("UPDATE reservas SET club_id = ? WHERE club_id IS NULL", [clubId]);
    await dbRun("UPDATE bloqueos SET club_id = ? WHERE club_id IS NULL", [clubId]);
    await ensureAdminForClub(clubId, now);
    console.log(`[seed] Club "${DEFAULT_CLUB_NOMBRE}" creado con slug "${DEFAULT_CLUB_SLUG}"`);
    return;
  }

  if (USE_SUPABASE) {
    const { data: existing } = await supabase
      .from("clubs").select("id").eq("slug", DEFAULT_CLUB_SLUG).maybeSingle();
    if (existing) {
      await ensureAdminForClub(existing.id, now);
      return;
    }
    const { data: club, error } = await supabase.from("clubs").insert({
      slug: DEFAULT_CLUB_SLUG,
      nombre: DEFAULT_CLUB_NOMBRE,
      deporte: DEFAULT_CLUB_DEPORTE,
      whatsapp: DEFAULT_CLUB_WHATSAPP,
      transfer_alias: DEFAULT_CLUB_ALIAS,
      transfer_cbu: DEFAULT_CLUB_CBU,
      transfer_titular: DEFAULT_CLUB_TITULAR,
      hora_inicio: DEFAULT_CLUB_HORA_INICIO,
      hora_fin: DEFAULT_CLUB_HORA_FIN,
      precio: DEFAULT_CLUB_PRECIO,
      activo: true,
      creado_en: now,
    }).select().single();
    if (error) { console.warn("[seed] No se pudo crear club en Supabase:", error.message); return; }
    const clubId = club.id;
    for (const cancha of parseDefaultCanchas()) {
      await supabase.from("canchas").upsert(
        { club_id: clubId, nombre: cancha.nombre, etiqueta: cancha.etiqueta, activa: true },
        { onConflict: "club_id,nombre" }
      );
    }
    await supabase.from("reservas").update({ club_id: clubId }).is("club_id", null);
    await supabase.from("bloqueos").update({ club_id: clubId }).is("club_id", null);
    await ensureAdminForClub(clubId, now);
    console.log(`[seed] Club "${DEFAULT_CLUB_NOMBRE}" creado en Supabase con slug "${DEFAULT_CLUB_SLUG}"`);
  }
}

// ============================================================
// HELPERS GENERALES
// ============================================================
function toHorario(hora) { return `${String(hora).padStart(2, "0")}:00`; }

function horarioToNumber(horario) {
  if (!horario) return null;
  return Number(String(horario).split(":")[0]);
}

function generarHorarios(club) {
  const horarios = [];
  for (let hora = club.horaInicio; hora <= club.horaFin; hora += 1) {
    horarios.push(toHorario(hora));
  }
  return horarios;
}

function toReservaTimestamp(fecha, horario) {
  if (!fecha || !horario) return NaN;
  const [year, month, day] = String(fecha).split("-").map(Number);
  const [hour = 0, minute = 0] = String(horario).split(":").map(Number);
  if ([year, month, day, hour, minute].some((v) => !Number.isFinite(v))) return NaN;
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function isReservaExpirada(reserva, nowMs = Date.now()) {
  const ms = toReservaTimestamp(reserva.fecha, reserva.horario);
  return !Number.isNaN(ms) && ms < nowMs;
}

function getBloqueoRango(bloqueo, club) {
  if (bloqueo.diaCompleto) return { desde: club.horaInicio, hasta: club.horaFin };
  if (bloqueo.horarioDesde && bloqueo.horarioHasta) {
    return { desde: horarioToNumber(bloqueo.horarioDesde), hasta: horarioToNumber(bloqueo.horarioHasta) };
  }
  const hora = horarioToNumber(bloqueo.horario);
  return { desde: hora, hasta: hora };
}

function bloqueosSeSuperponen(a, b, club) {
  if (a.diaCompleto || b.diaCompleto) return true;
  const ra = getBloqueoRango(a, club);
  const rb = getBloqueoRango(b, club);
  if (ra.desde == null || ra.hasta == null || rb.desde == null || rb.hasta == null) return false;
  return ra.desde <= rb.hasta && rb.desde <= ra.hasta;
}

function isReservaBloqueada(bloqueos, cancha, fecha, horario) {
  const horarioNum = horarioToNumber(horario);
  return bloqueos.some((b) => {
    if (String(b.cancha) !== String(cancha) || b.fecha !== fecha) return false;
    if (b.diaCompleto) return true;
    if (b.horarioDesde && b.horarioHasta) {
      return horarioNum >= horarioToNumber(b.horarioDesde) && horarioNum <= horarioToNumber(b.horarioHasta);
    }
    return b.horario === horario;
  });
}

function mapReservaRow(row) {
  return {
    id: row.id,
    clubId: row.club_id,
    nombre: row.nombre,
    telefono: row.telefono,
    cancha: String(row.cancha),
    fecha: row.fecha,
    horario: row.horario,
    comprobante: {
      nombreOriginal: row.comprobante_nombre_original,
      archivo: row.comprobante_archivo,
      mimetype: row.comprobante_mimetype,
      size: row.comprobante_size,
    },
    creadoEn: row.creado_en,
  };
}

function mapBloqueoRow(row) {
  return {
    id: row.id,
    clubId: row.club_id,
    cancha: String(row.cancha),
    fecha: row.fecha,
    horario: row.horario,
    horarioDesde: row.horario_desde,
    horarioHasta: row.horario_hasta,
    diaCompleto: Boolean(row.dia_completo),
    motivo: row.motivo,
    creadoEn: row.creado_en,
  };
}

// ============================================================
// FUNCIONES DE DATOS
// ============================================================
async function readReservas({ clubId, fecha = "", cancha = null } = {}) {
  if (USE_SUPABASE) {
    let query = supabase.from("reservas").select("*")
      .order("fecha", { ascending: true }).order("horario", { ascending: true });
    if (clubId != null) query = query.eq("club_id", clubId);
    if (fecha) query = query.eq("fecha", fecha);
    if (cancha) query = query.eq("cancha", String(cancha));
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data.map(mapReservaRow);
  }
  const where = [];
  const params = [];
  if (clubId != null) { where.push("club_id = ?"); params.push(clubId); }
  if (fecha) { where.push("fecha = ?"); params.push(fecha); }
  if (cancha) { where.push("cancha = ?"); params.push(String(cancha)); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await dbAll(
    `SELECT * FROM reservas ${whereSql} ORDER BY fecha ASC, horario ASC, id DESC`,
    params
  );
  return rows.map(mapReservaRow);
}

async function purgeExpiredReservas(clubId) {
  const nowMs = Date.now();
  const reservas = await readReservas({ clubId });
  const expiradas = reservas.filter((r) => isReservaExpirada(r, nowMs));
  if (!expiradas.length) return 0;
  const ids = expiradas.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
  if (!ids.length) return 0;

  if (USE_SUPABASE) {
    const archivos = expiradas.map((r) => r.comprobante?.archivo).filter(Boolean);
    if (archivos.length) await supabase.storage.from(SUPABASE_BUCKET).remove(archivos);
    const { error } = await supabase.from("reservas").delete().in("id", ids);
    if (error) throw new Error(error.message);
    return ids.length;
  }
  const placeholders = ids.map(() => "?").join(", ");
  await dbRun(`DELETE FROM reservas WHERE id IN (${placeholders})`, ids);
  return ids.length;
}

async function readBloqueos({ clubId, fecha = "", cancha = null } = {}) {
  if (USE_SUPABASE) {
    let query = supabase.from("bloqueos").select("*").order("fecha", { ascending: true });
    if (clubId != null) query = query.eq("club_id", clubId);
    if (fecha) query = query.eq("fecha", fecha);
    if (cancha) query = query.eq("cancha", String(cancha));
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data.map(mapBloqueoRow);
  }
  const where = [];
  const params = [];
  if (clubId != null) { where.push("club_id = ?"); params.push(clubId); }
  if (fecha) { where.push("fecha = ?"); params.push(fecha); }
  if (cancha) { where.push("cancha = ?"); params.push(String(cancha)); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await dbAll(
    `SELECT * FROM bloqueos ${whereSql} ORDER BY fecha ASC, id DESC`,
    params
  );
  return rows.map(mapBloqueoRow);
}

// ============================================================
// VALIDACION
// ============================================================
function validateReservaPayload(body, club) {
  const nombre = (body.nombre || "").trim();
  const telefono = (body.telefono || "").trim();
  const cancha = String(body.cancha || "").trim();
  const fecha = (body.fecha || "").trim();
  const horario = (body.horario || "").trim();
  const canchaValida = club.canchas.some((c) => c.nombre === cancha);
  const horariosValidos = generarHorarios(club);

  if (!nombre || nombre.length < 3) return "El nombre y apellido es obligatorio.";
  if (!telefono || telefono.length < 6) return "El telefono es obligatorio.";
  if (!canchaValida) return "Cancha invalida.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return "Fecha invalida.";
  if (!horariosValidos.includes(horario)) return "Horario invalido.";
  if (toReservaTimestamp(fecha, horario) < Date.now()) return "Ese horario ya paso. Elegi uno actual o futuro.";
  return null;
}

// ============================================================
// EXPRESS SETUP
// ============================================================
const storage = USE_SUPABASE
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
      filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^\w.\-]/g, "_").toLowerCase();
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`);
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) { cb(null, true); return; }
    cb(new Error("Solo se permiten imagenes (JPG, PNG, WEBP) o PDF."));
  },
});

app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(path.join(ROOT_DIR, "public")));

const dbReady = initDb()
  .then(() => seedDefaultClub())
  .catch((err) => console.error("[init] Error inicializando BD:", err.message));

app.use(async (_req, _res, next) => {
  try { await dbReady; next(); } catch (error) { next(error); }
});

// ============================================================
// MIDDLEWARE RESOLVE CLUB
// ============================================================
async function resolveClub(req, res, next) {
  try {
    const slug = req.params.slug;
    const club = await getClubBySlug(slug);
    if (!club) return res.status(404).json({ error: "Club no encontrado." });
    req.club = club;
    return next();
  } catch (error) { return next(error); }
}

// ============================================================
// RUTAS API  /api/:slug/...
// ============================================================
app.get("/api/:slug/config", resolveClub, (req, res) => {
  const club = req.club;
  res.json({
    slug: club.slug,
    nombre: club.nombre,
    deporte: club.deporte,
    canchas: club.canchas,
    horarios: generarHorarios(club),
    horaInicio: club.horaInicio,
    horaFin: club.horaFin,
    precio: club.precio,
    transferencia: club.transferencia,
    whatsappNumero: club.whatsapp,
  });
});

app.post("/api/:slug/admin/login", resolveClub, async (req, res, next) => {
  try {
    const password = (req.body?.password || "").trim();
    if (!password) return res.status(401).json({ error: "Clave de admin incorrecta." });
    const ok = await verifyAdminPasswordForClub(password, req.club.id);
    if (!ok) return res.status(401).json({ error: "Clave de admin incorrecta." });
    const token = createAdminSession(req.club.id);
    return res.json({ token, expiresInMs: ADMIN_SESSION_TTL_MS });
  } catch (error) { return next(error); }
});

app.get("/api/:slug/reservas", resolveClub, async (req, res, next) => {
  try {
    await purgeExpiredReservas(req.club.id);
    const fecha = (req.query.fecha || "").trim();
    const cancha = req.query.cancha ? String(req.query.cancha) : null;
    const reservas = await readReservas({ clubId: req.club.id, fecha, cancha });
    res.json(reservas);
  } catch (error) { next(error); }
});

app.get("/api/:slug/bloqueos", resolveClub, async (req, res, next) => {
  try {
    const fecha = (req.query.fecha || "").trim();
    const cancha = req.query.cancha ? String(req.query.cancha) : null;
    const bloqueos = await readBloqueos({ clubId: req.club.id, fecha, cancha });
    res.json(bloqueos);
  } catch (error) { next(error); }
});

app.post("/api/:slug/reservas", resolveClub, upload.single("comprobante"), async (req, res, next) => {
  try {
    await purgeExpiredReservas(req.club.id);
    const validationError = validateReservaPayload(req.body, req.club);
    if (validationError) return res.status(400).json({ error: validationError });
    if (!req.file) return res.status(400).json({ error: "Debes subir un comprobante." });

    const nombre = req.body.nombre.trim();
    const telefono = req.body.telefono.trim();
    const cancha = String(req.body.cancha).trim();
    const fecha = req.body.fecha.trim();
    const horario = req.body.horario.trim();
    const clubId = req.club.id;

    const [reservas, bloqueos] = await Promise.all([
      readReservas({ clubId }),
      readBloqueos({ clubId }),
    ]);
    if (reservas.some((r) => r.cancha === cancha && r.fecha === fecha && r.horario === horario)) {
      return res.status(409).json({ error: "Ese horario ya fue reservado. Elegi otro." });
    }
    if (isReservaBloqueada(bloqueos, cancha, fecha, horario)) {
      return res.status(409).json({ error: "Ese horario esta bloqueado por administracion." });
    }

    const creadoEn = new Date().toISOString();
    let comprobanteUrl, comprobanteArchivo, reservaId;

    if (USE_SUPABASE) {
      const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
      const storagePath = `${clubId}/${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET).upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      comprobanteArchivo = storagePath;
      comprobanteUrl = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
      const { data: insertData, error: insertError } = await supabase.from("reservas").insert({
        club_id: clubId, nombre, telefono, cancha, fecha, horario,
        comprobante_nombre_original: req.file.originalname,
        comprobante_archivo: storagePath,
        comprobante_mimetype: req.file.mimetype,
        comprobante_size: req.file.size,
        creado_en: creadoEn,
      }).select().single();
      if (insertError) throw new Error(insertError.message);
      reservaId = insertData.id;
    } else {
      comprobanteArchivo = req.file.filename;
      comprobanteUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
      const insertResult = await dbRun(
        `INSERT INTO reservas
          (club_id, nombre, telefono, cancha, fecha, horario,
           comprobante_nombre_original, comprobante_archivo, comprobante_mimetype,
           comprobante_size, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clubId, nombre, telefono, cancha, fecha, horario,
         req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, creadoEn]
      );
      reservaId = insertResult.lastID;
    }

    return res.status(201).json({
      id: reservaId, nombre, telefono, cancha, fecha, horario,
      comprobante: { nombreOriginal: req.file.originalname, archivo: comprobanteArchivo,
        mimetype: req.file.mimetype, size: req.file.size },
      creadoEn, comprobanteUrl,
    });
  } catch (error) { next(error); }
});

app.get("/api/:slug/admin/reservas", resolveClub, requireAdmin, async (req, res, next) => {
  try {
    await purgeExpiredReservas(req.club.id);
    const fecha = (req.query.fecha || "").trim();
    const reservas = await readReservas({ clubId: req.club.id, fecha: fecha || undefined });
    const reservasConLink = reservas.map((r) => ({
      ...r,
      comprobanteUrl: USE_SUPABASE
        ? supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(r.comprobante.archivo).data.publicUrl
        : `/uploads/${r.comprobante.archivo}`,
    }));
    res.json(reservasConLink);
  } catch (error) { next(error); }
});

app.delete("/api/:slug/admin/reservas/:id", resolveClub, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const clubId = req.club.id;
    const reservas = await readReservas({ clubId });
    const eliminada = reservas.find((r) => Number(r.id) === id);
    if (!eliminada) return res.status(404).json({ error: "Reserva no encontrada." });

    if (USE_SUPABASE) {
      await supabase.storage.from(SUPABASE_BUCKET).remove([eliminada.comprobante.archivo]);
      const { error } = await supabase.from("reservas").delete().eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      await dbRun("DELETE FROM reservas WHERE id = ?", [id]);
      const filePath = path.join(UPLOADS_DIR, eliminada.comprobante.archivo);
      fs.unlink(filePath).catch(() => {});
    }
    return res.json({ ok: true, reserva: eliminada });
  } catch (error) { next(error); }
});

app.get("/api/:slug/admin/bloqueos", resolveClub, requireAdmin, async (req, res, next) => {
  try {
    const bloqueos = await readBloqueos({ clubId: req.club.id });
    res.json(bloqueos);
  } catch (error) { next(error); }
});

app.post("/api/:slug/admin/bloqueos", resolveClub, requireAdmin, async (req, res, next) => {
  try {
    const cancha = String(req.body.cancha || "").trim();
    const fecha = (req.body.fecha || "").trim();
    const horario = (req.body.horario || "").trim();
    const horarioDesde = (req.body.horarioDesde || "").trim();
    const horarioHasta = (req.body.horarioHasta || "").trim();
    const motivo = (req.body.motivo || "").trim() || "Bloqueado por administracion";
    const diaCompleto = Boolean(req.body.diaCompleto);
    const club = req.club;
    const clubId = club.id;
    const horariosValidos = generarHorarios(club);
    const canchaValida = club.canchas.some((c) => c.nombre === cancha);

    if (!canchaValida) return res.status(400).json({ error: "Cancha invalida." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return res.status(400).json({ error: "Fecha invalida." });
    const tieneRango = Boolean(horarioDesde && horarioHasta);
    if (!diaCompleto && tieneRango) {
      if (!horariosValidos.includes(horarioDesde) || !horariosValidos.includes(horarioHasta)) {
        return res.status(400).json({ error: "Rango horario invalido." });
      }
      if (horarioToNumber(horarioDesde) > horarioToNumber(horarioHasta)) {
        return res.status(400).json({ error: "El horario desde no puede ser mayor al hasta." });
      }
    } else if (!diaCompleto && !horariosValidos.includes(horario)) {
      return res.status(400).json({ error: "Horario invalido." });
    }

    const bloqueos = await readBloqueos({ clubId });
    const nuevoBloqueo = {
      cancha, fecha, diaCompleto,
      horario: diaCompleto ? null : tieneRango ? null : horario,
      horarioDesde: diaCompleto ? null : tieneRango ? horarioDesde : null,
      horarioHasta: diaCompleto ? null : tieneRango ? horarioHasta : null,
    };
    const yaExiste = bloqueos.some(
      (b) => b.cancha === cancha && b.fecha === fecha && bloqueosSeSuperponen(b, nuevoBloqueo, club)
    );
    if (yaExiste) return res.status(409).json({ error: "Ese bloqueo se superpone con otro ya existente." });

    const creadoEn = new Date().toISOString();
    let bloqueoId;

    if (USE_SUPABASE) {
      const { data: insertData, error: insertError } = await supabase.from("bloqueos").insert({
        club_id: clubId, cancha, fecha,
        horario: nuevoBloqueo.horario,
        horario_desde: nuevoBloqueo.horarioDesde,
        horario_hasta: nuevoBloqueo.horarioHasta,
        dia_completo: diaCompleto, motivo, creado_en: creadoEn,
      }).select().single();
      if (insertError) throw new Error(insertError.message);
      bloqueoId = insertData.id;
    } else {
      const insertResult = await dbRun(
        `INSERT INTO bloqueos
          (club_id, cancha, fecha, horario, horario_desde, horario_hasta, dia_completo, motivo, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [clubId, cancha, fecha, nuevoBloqueo.horario, nuevoBloqueo.horarioDesde,
         nuevoBloqueo.horarioHasta, diaCompleto ? 1 : 0, motivo, creadoEn]
      );
      bloqueoId = insertResult.lastID;
    }

    return res.status(201).json({
      id: bloqueoId, clubId, cancha, fecha,
      horario: nuevoBloqueo.horario,
      horarioDesde: nuevoBloqueo.horarioDesde,
      horarioHasta: nuevoBloqueo.horarioHasta,
      diaCompleto, motivo, creadoEn,
    });
  } catch (error) { next(error); }
});

app.delete("/api/:slug/admin/bloqueos/:id", resolveClub, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const clubId = req.club.id;
    const bloqueos = await readBloqueos({ clubId });
    const eliminado = bloqueos.find((b) => Number(b.id) === id);
    if (!eliminado) return res.status(404).json({ error: "Bloqueo no encontrado." });

    if (USE_SUPABASE) {
      const { error } = await supabase.from("bloqueos").delete().eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      await dbRun("DELETE FROM bloqueos WHERE id = ?", [id]);
    }
    return res.json({ ok: true, bloqueo: eliminado });
  } catch (error) { next(error); }
});

// ============================================================
// RUTAS ADMIN: CONFIGURACION DEL CLUB
// ============================================================
app.get("/api/:slug/admin/canchas", resolveClub, requireAdmin, async (req, res, next) => {
  try {
    const clubId = req.club.id;
    if (USE_SUPABASE) {
      const { data, error } = await supabase.from("canchas").select("*").eq("club_id", clubId).order("id");
      if (error) throw new Error(error.message);
      return res.json((data || []).map((r) => ({ id: r.id, nombre: r.nombre, etiqueta: r.etiqueta, activa: r.activa })));
    }
    const rows = await dbAll("SELECT * FROM canchas WHERE club_id = ? ORDER BY id ASC", [clubId]);
    return res.json(rows.map((r) => ({ id: r.id, nombre: r.nombre, etiqueta: r.etiqueta, activa: Boolean(r.activa) })));
  } catch (error) { next(error); }
});

app.post("/api/:slug/admin/canchas", resolveClub, requireAdmin, async (req, res, next) => {
  try {
    const clubId = req.club.id;
    const nombre = (req.body?.nombre || "").trim();
    const etiqueta = (req.body?.etiqueta || "").trim();
    if (!nombre) return res.status(400).json({ error: "El nombre de la cancha es obligatorio." });
    if (!etiqueta) return res.status(400).json({ error: "La etiqueta de la cancha es obligatoria." });

    if (USE_SUPABASE) {
      const { data, error } = await supabase.from("canchas")
        .insert({ club_id: clubId, nombre, etiqueta, activa: true }).select().single();
      if (error) return res.status(409).json({ error: "Ya existe una cancha con ese nombre." });
      return res.json({ id: data.id, nombre: data.nombre, etiqueta: data.etiqueta, activa: data.activa });
    }
    const result = await dbRun(
      "INSERT OR IGNORE INTO canchas (club_id, nombre, etiqueta, activa) VALUES (?, ?, ?, 1)",
      [clubId, nombre, etiqueta]
    );
    if (!result.lastID) return res.status(409).json({ error: "Ya existe una cancha con ese nombre." });
    return res.json({ id: result.lastID, nombre, etiqueta, activa: true });
  } catch (error) { next(error); }
});

app.put("/api/:slug/admin/canchas/:id", resolveClub, requireAdmin, async (req, res, next) => {
  try {
    const clubId = req.club.id;
    const id = Number(req.params.id);
    const etiqueta = (req.body?.etiqueta || "").trim();
    if (!etiqueta) return res.status(400).json({ error: "La etiqueta es obligatoria." });

    if (USE_SUPABASE) {
      const { error } = await supabase.from("canchas").update({ etiqueta }).eq("id", id).eq("club_id", clubId);
      if (error) throw new Error(error.message);
      return res.json({ ok: true });
    }
    await dbRun("UPDATE canchas SET etiqueta = ? WHERE id = ? AND club_id = ?", [etiqueta, id, clubId]);
    return res.json({ ok: true });
  } catch (error) { next(error); }
});

app.delete("/api/:slug/admin/canchas/:id", resolveClub, requireAdmin, async (req, res, next) => {
  try {
    const clubId = req.club.id;
    const id = Number(req.params.id);
    const hoy = new Date().toISOString().split("T")[0];

    if (USE_SUPABASE) {
      const { data: cancha } = await supabase.from("canchas").select("*").eq("id", id).eq("club_id", clubId).maybeSingle();
      if (!cancha) return res.status(404).json({ error: "Cancha no encontrada." });
      const { data: futuras } = await supabase.from("reservas")
        .select("id").eq("club_id", clubId).eq("cancha", cancha.nombre).gte("fecha", hoy);
      if (futuras?.length) return res.status(409).json({ error: `La cancha tiene ${futuras.length} reserva(s) futura(s). Cancelalas primero.` });
      await supabase.from("canchas").delete().eq("id", id).eq("club_id", clubId);
      return res.json({ ok: true });
    }
    const cancha = await dbGet("SELECT * FROM canchas WHERE id = ? AND club_id = ?", [id, clubId]);
    if (!cancha) return res.status(404).json({ error: "Cancha no encontrada." });
    const futuras = await dbAll(
      "SELECT id FROM reservas WHERE club_id = ? AND cancha = ? AND fecha >= ?",
      [clubId, cancha.nombre, hoy]
    );
    if (futuras.length) return res.status(409).json({ error: `La cancha tiene ${futuras.length} reserva(s) futura(s). Cancelalas primero.` });
    await dbRun("DELETE FROM canchas WHERE id = ? AND club_id = ?", [id, clubId]);
    return res.json({ ok: true });
  } catch (error) { next(error); }
});

app.patch("/api/:slug/admin/club", resolveClub, requireAdmin, async (req, res, next) => {
  try {
    const clubId = req.club.id;
    const body = req.body || {};

    const nombre = (body.nombre || "").trim();
    const whatsapp = (body.whatsapp || "").replace(/\D/g, "");
    const transferAlias = (body.transferAlias || "").trim();
    const transferCbu = (body.transferCbu || "").trim();
    const transferTitular = (body.transferTitular || "").trim();
    const horaInicio = parseInt(body.horaInicio, 10);
    const horaFin = parseInt(body.horaFin, 10);
    const precio = (body.precio || "0").trim();

    if (!nombre) return res.status(400).json({ error: "El nombre del club es obligatorio." });
    if (!Number.isFinite(horaInicio) || !Number.isFinite(horaFin) || horaInicio >= horaFin) {
      return res.status(400).json({ error: "Horario inválido: hora inicio debe ser menor a hora fin." });
    }
    if (horaInicio < 0 || horaFin > 23) return res.status(400).json({ error: "Horario fuera de rango (0-23)." });

    if (USE_SUPABASE) {
      const { error } = await supabase.from("clubs").update({
        nombre, whatsapp, transfer_alias: transferAlias, transfer_cbu: transferCbu,
        transfer_titular: transferTitular, hora_inicio: horaInicio, hora_fin: horaFin, precio,
      }).eq("id", clubId);
      if (error) throw new Error(error.message);
      return res.json({ ok: true });
    }
    await dbRun(
      `UPDATE clubs SET nombre=?, whatsapp=?, transfer_alias=?, transfer_cbu=?, transfer_titular=?,
       hora_inicio=?, hora_fin=?, precio=? WHERE id=?`,
      [nombre, whatsapp, transferAlias, transferCbu, transferTitular, horaInicio, horaFin, precio, clubId]
    );
    return res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post("/api/:slug/admin/password", resolveClub, requireAdmin, async (req, res, next) => {
  try {
    const clubId = req.club.id;
    const passwordActual = (req.body?.passwordActual || "").trim();
    const passwordNuevo = (req.body?.passwordNuevo || "").trim();

    if (!passwordActual || !passwordNuevo) return res.status(400).json({ error: "Ambas contraseñas son requeridas." });
    if (passwordNuevo.length < 6) return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres." });

    const ok = await verifyAdminPasswordForClub(passwordActual, clubId);
    if (!ok) return res.status(401).json({ error: "La contraseña actual es incorrecta." });

    const { salt, hash } = hashAdminPassword(passwordNuevo);
    const now = new Date().toISOString();

    if (USE_SUPABASE) {
      const { error } = await supabase.from("admins").update({
        password_salt: salt, password_hash: hash,
        password_salt_b: null, password_hash_b: null, actualizado_en: now,
      }).eq("club_id", clubId);
      if (error) throw new Error(error.message);
      return res.json({ ok: true });
    }
    await dbRun(
      "UPDATE admins SET password_salt=?, password_hash=?, password_salt_b=NULL, password_hash_b=NULL, actualizado_en=? WHERE club_id=?",
      [salt, hash, now, clubId]
    );
    return res.json({ ok: true });
  } catch (error) { next(error); }
});

// ============================================================
// RUTAS DE PAGINAS  /:slug  y  /:slug/admin
// ============================================================
app.get("/", async (_req, res) => {
  try {
    const slug = await getDefaultClubSlug();
    res.redirect(`/${slug}`);
  } catch (_) { res.redirect(`/${DEFAULT_CLUB_SLUG}`); }
});

app.get("/:slug", async (req, res, next) => {
  if (req.params.slug.includes(".")) return next();
  try {
    const club = await getClubBySlug(req.params.slug);
    if (!club) return next();
    res.sendFile(path.join(ROOT_DIR, "public", "index.html"));
  } catch (error) { next(error); }
});

app.get("/:slug/admin", async (req, res, next) => {
  if (req.params.slug.includes(".")) return next();
  try {
    const club = await getClubBySlug(req.params.slug);
    if (!club) return next();
    res.sendFile(path.join(ROOT_DIR, "public", "admin.html"));
  } catch (error) { next(error); }
});

// ============================================================
// ERROR HANDLER
// ============================================================
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "El comprobante supera 5MB. Subi un archivo mas liviano." });
    }
    return res.status(400).json({ error: "Error al subir comprobante." });
  }
  if (err.message) return res.status(400).json({ error: err.message });
  return res.status(500).json({ error: "Error interno del servidor." });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Servidor iniciado en http://localhost:${PORT}`));
}

module.exports = app;

-- ============================================================
-- ESQUEMA MULTI-TENANT
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Tabla de clubes
create table if not exists clubs (
  id bigserial primary key,
  slug text not null unique,
  nombre text not null,
  deporte text not null default 'futbol',
  logo_url text,
  whatsapp text not null,
  transfer_alias text not null,
  transfer_cbu text not null,
  transfer_titular text not null,
  hora_inicio integer not null default 10,
  hora_fin integer not null default 23,
  precio text not null default '0',
  activo boolean not null default true,
  creado_en text not null
);

-- Canchas por club
create table if not exists canchas (
  id bigserial primary key,
  club_id bigint not null references clubs(id),
  nombre text not null,
  etiqueta text not null,
  activa boolean not null default true,
  unique(club_id, nombre)
);

-- Un admin por club (con dos slots de clave)
create table if not exists admins (
  id bigserial primary key,
  club_id bigint not null unique references clubs(id),
  password_salt text not null,
  password_hash text not null,
  password_salt_b text,
  password_hash_b text,
  actualizado_en text not null
);

-- Reservas con club_id
create table if not exists reservas (
  id bigserial primary key,
  club_id bigint references clubs(id),
  nombre text not null,
  telefono text not null,
  cancha text not null,
  fecha text not null,
  horario text not null,
  estado text not null default 'pendiente',
  comprobante_nombre_original text not null,
  comprobante_archivo text not null,
  comprobante_mimetype text not null,
  comprobante_size integer not null,
  creado_en text not null
);

-- Bloqueos con club_id
create table if not exists bloqueos (
  id bigserial primary key,
  club_id bigint references clubs(id),
  cancha text not null,
  fecha text not null,
  horario text,
  horario_desde text,
  horario_hasta text,
  dia_completo boolean not null default false,
  motivo text not null,
  creado_en text not null
);

-- Solicitudes de registro de nuevos clubs
create table if not exists solicitudes (
  id bigserial primary key,
  nombre text not null,
  slug text not null,
  deporte text not null default 'futbol',
  whatsapp text not null,
  email text not null,
  comprobante_url text,
  estado text not null default 'pendiente',
  creado_en text not null
);

-- RLS deshabilitado (el backend usa service key y controla el acceso)
alter table clubs disable row level security;
alter table canchas disable row level security;
alter table admins disable row level security;
alter table reservas disable row level security;
alter table bloqueos disable row level security;
alter table solicitudes disable row level security;

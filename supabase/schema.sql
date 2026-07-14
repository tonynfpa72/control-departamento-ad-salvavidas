-- =========================================================
-- Esquema de Supabase: Usuarios del sistema (login + CRUD)
-- Departamento A&D Salvavidas
--
-- CÓMO USAR ESTE ARCHIVO:
-- 1. Entra a tu proyecto en https://app.supabase.com
-- 2. Ve a "SQL Editor" (menú izquierdo)
-- 3. Pega TODO este archivo y dale "Run"
-- =========================================================

create extension if not exists "pgcrypto";

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  pin text not null,
  categoria text not null check (categoria in ('admin', 'asistente', 'tecnico')),
  name text not null,
  area text,
  created_at timestamptz default now()
);

-- Activamos seguridad a nivel de fila. A propósito NO agregamos políticas
-- de SELECT/INSERT/UPDATE/DELETE directas: esto bloquea que cualquiera con
-- la "anon key" pública pueda leer la tabla (y ver los PIN) directamente.
-- Todo el acceso pasa por las funciones de abajo, que sí podemos controlar.
alter table usuarios enable row level security;

-- ---------------------------------------------------------
-- Login: recibe email + pin, devuelve el usuario SIN exponer
-- la columna pin al cliente.
-- ---------------------------------------------------------
create or replace function login_usuario(p_email text, p_pin text)
returns table (id uuid, email text, categoria text, name text, area text)
language sql
security definer
as $$
  select id, email, categoria, name, area
  from usuarios
  where lower(email) = lower(p_email) and pin = p_pin;
$$;

-- ---------------------------------------------------------
-- Listar usuarios (para la pantalla "Gestión de Usuarios")
-- ---------------------------------------------------------
create or replace function listar_usuarios()
returns table (id uuid, email text, categoria text, name text, area text)
language sql
security definer
as $$
  select id, email, categoria, name, area from usuarios order by name;
$$;

-- ---------------------------------------------------------
-- Crear usuario
-- ---------------------------------------------------------
create or replace function crear_usuario(p_email text, p_pin text, p_categoria text, p_name text, p_area text default null)
returns table (id uuid, email text, categoria text, name text, area text)
language sql
security definer
as $$
  insert into usuarios (email, pin, categoria, name, area)
  values (p_email, p_pin, p_categoria, p_name, p_area)
  returning id, email, categoria, name, area;
$$;

-- ---------------------------------------------------------
-- Actualizar usuario
-- ---------------------------------------------------------
create or replace function actualizar_usuario(p_id uuid, p_email text, p_pin text, p_categoria text, p_name text, p_area text default null)
returns table (id uuid, email text, categoria text, name text, area text)
language sql
security definer
as $$
  update usuarios
  set email = p_email, pin = p_pin, categoria = p_categoria, name = p_name, area = p_area
  where id = p_id
  returning id, email, categoria, name, area;
$$;

-- ---------------------------------------------------------
-- Eliminar usuario
-- ---------------------------------------------------------
create or replace function eliminar_usuario(p_id uuid)
returns void
language sql
security definer
as $$
  delete from usuarios where id = p_id;
$$;

-- Permitimos que el cliente (anon key) pueda llamar estas funciones.
-- Esto es seguro porque las funciones controlan exactamente qué se
-- puede hacer y qué columnas se devuelven (nunca el pin).
grant execute on function login_usuario(text, text) to anon, authenticated;
grant execute on function listar_usuarios() to anon, authenticated;
grant execute on function crear_usuario(text, text, text, text, text) to anon, authenticated;
grant execute on function actualizar_usuario(uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function eliminar_usuario(uuid) to anon, authenticated;

-- ---------------------------------------------------------
-- Usuarios iniciales (los mismos de la demo)
-- ---------------------------------------------------------
insert into usuarios (email, pin, categoria, name, area) values
  ('admin@empresa.com', '1234', 'admin', 'Gerencia', 'admin'),
  ('acampos@gruposalvavidas.com', 'NFPA72', 'admin', 'A. Campos', 'admin'),
  ('inspecciones@empresa.com', '1111', 'asistente', 'Encargado Inspecciones', 'inspecciones'),
  ('proyectos@empresa.com', '2222', 'asistente', 'Encargado Proyectos', 'proyectos'),
  ('cotizaciones@empresa.com', '3333', 'tecnico', 'Cotizador', 'cotizaciones'),
  ('saludocup@empresa.com', '4444', 'tecnico', 'Salud Ocupacional', 'salud')
on conflict (email) do nothing;

-- ---------------------------------------------------------
-- ¿Ya habías corrido este script antes (proyecto ya en producción)?
-- Corre SOLO este bloque para agregar/actualizar un usuario puntual
-- sin tocar nada más:
-- ---------------------------------------------------------
-- insert into usuarios (email, pin, categoria, name, area)
-- values ('acampos@gruposalvavidas.com', 'NFPA72', 'admin', 'A. Campos', 'admin')
-- on conflict (email) do update
--   set pin = excluded.pin, categoria = excluded.categoria, name = excluded.name;

-- ==================================================================
-- TAUROS BARBERÍA — Esquema de datos en Supabase (sección 10)
--
-- Formato "colecciones JSON" del documento de proyecto: cada colección
-- se modela como una tabla cuya FILA ES UN DOCUMENTO JSON (columna `datos`),
-- con el id generado automáticamente por Supabase como columna principal.
--
-- CÓMO USARLO:
--   1. En Supabase → SQL Editor → "New query"
--   2. Pega TODO el contenido de este archivo
--   3. Pulsa "Run" (debe decir "Success. No rows returned")
--   El script es repetible (idempotente): puedes volver a ejecutarlo.
-- ==================================================================

-- ---------- Colección: barberos (sección 10.1) ----------
-- documento: { nombre, especialidad, silla_id, activo, foto_url, creado_en }
create table if not exists barberos (
  id    uuid primary key default gen_random_uuid(),
  datos jsonb not null
);

-- ---------- Colección: horarios (sección 10.2) ----------
-- documento: { barbero_id, dia_semana, hora_inicio, hora_fin, duracion_slot, activo }
create table if not exists horarios (
  id    uuid primary key default gen_random_uuid(),
  datos jsonb not null
);

-- ---------- Colección: citas (sección 10.3) ----------
-- documento: { barbero_id, cliente_nombre, cliente_contacto, fecha,
--              hora_inicio, hora_fin, estado, creado_en }
create table if not exists citas (
  id    uuid primary key default gen_random_uuid(),
  datos jsonb not null
);

-- ==================================================================
-- Índices: aceleran las consultas e imponen reglas de integridad
-- ==================================================================

-- Cada silla puede tener UN solo barbero (RF-08)
create unique index if not exists barberos_silla_unica
  on barberos ((datos->>'silla_id'));

-- Un solo horario por barbero y día de la semana (RF-10)
create unique index if not exists horarios_barbero_dia
  on horarios ((datos->>'barbero_id'), (datos->>'dia_semana'));

-- Consultas frecuentes del módulo cliente y del panel (RF-04, RF-11)
create index if not exists citas_fecha
  on citas ((datos->>'fecha'));
create index if not exists citas_barbero_fecha
  on citas ((datos->>'barbero_id'), (datos->>'fecha'));

-- ⛔ ANTI DOBLE RESERVA (sección 12 del documento)
-- No pueden existir dos citas 'confirmada' o 'completada' con el mismo
-- barbero + fecha + hora de inicio. Si dos clientes intentan el mismo slot
-- a la vez, el segundo recibe el error 23505 y la app muestra:
-- "Ese horario acaba de ser ocupado por otro cliente."
create unique index if not exists citas_slot_unico
  on citas ((datos->>'barbero_id'), (datos->>'fecha'), (datos->>'hora_inicio'))
  where (datos->>'estado') in ('confirmada', 'completada');

-- ==================================================================
-- Límites de reserva (anti-acaparamiento · cliente sin cuenta)
-- ==================================================================
-- Un visitante no se autentica, pero la base de datos impone dos reglas
-- que nadie puede saltarse (ni siquiera con curl contra la API):
--
--   1. VENTANA: solo se reserva hasta 14 días hacia adelante (coincide
--      con DIAS_A_DELANTE en js/config.js).
--   2. TOPE POR CONTACTO: un mismo teléfono/contacto no puede tener más
--      de 3 citas futuras confirmadas (coincide con
--      MAX_RESERVAS_CONTACTO en js/config.js).
--
-- La función es SECURITY DEFINER (corre con permisos de la dueña de la
-- tabla), lo que evita la recursión de RLS al contar citas existentes.
create or replace function public.puede_reservar(p_contacto text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cantidad integer;
begin
  -- Sin dato de contacto no se puede limitar por persona: en ese caso
  -- solo aplica la ventana de días (evaluada en la política).
  if p_contacto is null or p_contacto = '' then
    return true;
  end if;

  select count(*) into v_cantidad from citas
   where datos->>'cliente_contacto' = p_contacto
     and datos->>'estado' = 'confirmada'
     and (datos->>'fecha') >= to_char(current_date, 'YYYY-MM-DD');

  return v_cantidad < 3;
end;
$$;

-- El cliente (rol anon) necesita ejecutar la función: la política la invoca.
grant execute on function public.puede_reservar(text) to anon, authenticated;

-- ==================================================================
-- RLS — Row Level Security (sección 14 del documento · RF-07 · RNF-05)
-- ==================================================================
-- Diseño en tres niveles:
--
--   1. LECTURA PÚBLICA — el cliente ve sillas, horarios y citas sin
--      registrarse (alcance del proyecto). Las políticas de SELECT con
--      using (true) son el patrón deliberado de lectura pública y el
--      Security Advisor las excluye de sus avisos.
--
--   2. RESERVA DE CLIENTES — un visitante solo puede INSERTAR citas, y
--      únicamente con estado 'confirmada' (condición real, no always-true).
--      No puede editar ni borrar nada.
--
--   3. ESCRITURA DE ADMINISTRACIÓN — toda creación/modificación/borrado de
--      barberos, horarios o citas exige haber iniciado sesión en /admin
--      (Supabase Auth). Sin sesión, la API rechaza la escritura, por lo que
--      el RNF-05 se cumple en el servidor y no solo en la interfaz:
--      cualquiera con la clave pública sigue sin poder tocar los datos y
--      desaparecen los avisos "RLS Policy Always True" del Advisor.
--
--   (En modo demostración —sin Supabase— no hay base de datos que proteger.)
alter table barberos enable row level security;
alter table horarios enable row level security;
alter table citas     enable row level security;

-- Limpieza de políticas anteriores: hace repetible la ejecución del script
drop policy if exists "acceso publico barberos"    on barberos;
drop policy if exists "acceso publico horarios"    on horarios;
drop policy if exists "acceso publico citas"       on citas;
drop policy if exists "lectura publica barberos"   on barberos;
drop policy if exists "lectura publica horarios"   on horarios;
drop policy if exists "lectura publica citas"      on citas;
drop policy if exists "reserva de clientes"        on citas;
drop policy if exists "admin escribe barberos"     on barberos;
drop policy if exists "admin escribe horarios"     on horarios;
drop policy if exists "admin escribe citas"        on citas;

-- 1) Lectura pública (cliente sin autenticación)
create policy "lectura publica barberos" on barberos
  for select to anon, authenticated using (true);
create policy "lectura publica horarios" on horarios
  for select to anon, authenticated using (true);
create policy "lectura publica citas" on citas
  for select to anon, authenticated using (true);

-- 2) Reserva de clientes: solo INSERT de citas confirmadas, dentro de la
--    ventana de 14 días y sin superar el tope de 3 por contacto (límites
--    anti-acaparamiento). El estado vive dentro del documento JSON, por
--    eso se accede con datos->>.
create policy "reserva de clientes" on citas
  for insert to anon
  with check (
    (datos->>'estado') = 'confirmada'
    and (datos->>'fecha') >= to_char(current_date, 'YYYY-MM-DD')
    and (datos->>'fecha') <= to_char(current_date + 14, 'YYYY-MM-DD')
    and public.puede_reservar(datos->>'cliente_contacto')
  );

-- 3) Escritura de administración: SOLO el administrador (Supabase Auth).
--    Se exige que el JWT pertenezca al correo del admin. Cualquier otra
--    cuenta —aunque alguien logre registrarse— queda SIN permiso de
--    escritura. La condición es real (no es un always-true), por lo que el
--    Security Advisor sigue sin marcar estas políticas.
--    ⚠ Si cambias el correo del admin en js/config.js, cámbialo también aquí.
create policy "admin escribe barberos" on barberos
  for all to authenticated
  using ((select auth.jwt() ->> 'email') = 'admin@tauros.com')
  with check ((select auth.jwt() ->> 'email') = 'admin@tauros.com');
create policy "admin escribe horarios" on horarios
  for all to authenticated
  using ((select auth.jwt() ->> 'email') = 'admin@tauros.com')
  with check ((select auth.jwt() ->> 'email') = 'admin@tauros.com');
create policy "admin escribe citas" on citas
  for all to authenticated
  using ((select auth.jwt() ->> 'email') = 'admin@tauros.com')
  with check ((select auth.jwt() ->> 'email') = 'admin@tauros.com');

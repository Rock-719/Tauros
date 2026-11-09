/**
 * config.js — Configuración general de Tauros Barbería
 *
 * IMPORTANTE: reemplaza los valores marcados con TU_... cuando crees tu
 * proyecto en Supabase (paso 2). Mientras esos valores no se configuren,
 * la aplicación funcionará en MODO DEMOSTRACIÓN: los datos se guardan en
 * el navegador (localStorage) para que puedas probar todo el flujo.
 *
 * Nota (RNF-05): la clave "anon" de Supabase es de uso público y se expone
 * en el navegador por diseño; la protección real de los datos se logra con
 * las políticas RLS configuradas en Supabase.
 */
window.TAUROS_CONFIG = {
  // URL del proyecto de Supabase (SIN /rest/v1/ al final; el SDK lo agrega).
  SUPABASE_URL: 'https://mqacczkffdbbuqgvzemh.supabase.co',

  // Clave pública (anon) del proyecto de Supabase.
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xYWNjemtmZmRiYnVxZ3Z6ZW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMjQ0NDQsImV4cCI6MjEwODkwMDQ0NH0.boL6XNWkt7DIkAjrq8qCsPaBN1zbyiO6tGxsEej441E',

  // ⚠ MODO DEMOSTRACIÓN únicamente (sin Supabase): contraseña simple de
  // front-end para el panel /admin (RF-07). NO es la contraseña real.
  // La contraseña real de Supabase Auth se crea en el dashboard y NO se
  // guarda en el código (seguridad: el código es público en el navegador).
  ADMIN_PASSWORD: 'tauros2026',

  // Correo del administrador para Supabase Auth. Se crea UNA sola vez en
  // Supabase → Authentication → Users → Add user (con Auto Confirm activado).
  ADMIN_EMAIL: 'admin@tauros.com',

  // Cuántos días hacia adelante puede elegir el cliente (RF-03).
  // Es también la VENTANA DE RESERVA que impone la base de datos
  // (anti-acaparamiento): si lo cambias, actualiza los 14 días del
  // policy "reserva de clientes" en supabase/schema.sql.
  DIAS_A_DELANTE: 14,

  // Máximo de reservas futuras confirmadas con el mismo teléfono/contacto.
  // Lo impone la base de datos (función puede_reservar en
  // supabase/schema.sql) para evitar que alguien acapare citas sin
  // crear cuenta. Debe coincidir con el valor `< 3` de esa función.
  MAX_RESERVAS_CONTACTO: 3,

  // Horario general de la barbería. Se usa como valor por defecto cuando un
  // barbero aún no tiene horarios configurados en el panel de administración.
  HORARIO_APERTURA: '09:00',
  HORARIO_CIERRE: '18:00',

  // Duración por defecto de cada cita, en minutos.
  DURACION_SLOT: 30
};

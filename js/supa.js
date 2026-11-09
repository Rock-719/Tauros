/**
 * supa.js — Inicialización del cliente de Supabase
 *
 * Si la configuración en config.js está completa, se crea el cliente real.
 * Si no, la aplicación sigue funcionando en modo demostración (ver api.js).
 */
window.Supa = (function () {
  let cliente = null;

  /** true si el proyecto de Supabase ya fue configurado en config.js */
  function configurado() {
    const c = window.TAUROS_CONFIG;
    return !!(
      c &&
      c.SUPABASE_URL && c.SUPABASE_ANON_KEY &&
      /^https?:\/\//.test(c.SUPABASE_URL) &&
      !c.SUPABASE_URL.includes('TU_') &&
      !c.SUPABASE_ANON_KEY.includes('TU_')
    );
  }

  /** Devuelve el cliente de Supabase (o null si no está configurado). */
  function obtener() {
    if (cliente) return cliente;
    if (!configurado()) return null;
    if (typeof window.supabase === 'undefined') {
      console.warn('[Tauros] El SDK de Supabase no se cargó (¿sin conexión?). Se usará modo demo.');
      return null;
    }
    const c = window.TAUROS_CONFIG;
    cliente = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
    return cliente;
  }

  return { configurado, obtener };
})();

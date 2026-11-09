/**
 * api.js — Capa de acceso a datos
 *
 * La aplicación trabaja SIEMPRE con objetos planos (los campos descritos en
 * la sección 10 del documento). La persistencia depende de la configuración:
 *
 * 1. MODO SUPABASE (config.js con URL + anon key):
 *    Cada colección se guarda como una TABLA CUYA FILA ES UN DOCUMENTO JSON
 *    (columna `datos jsonb`), fiel al "modo colecciones JSON" del documento:
 *
 *      fila de `citas`  →  { id: "uuid…", datos: { barbero_id, fecha, … } }
 *
 *    El id lo genera Supabase (columna principal) y el documento `datos`
 *    contiene todos los campos de la sección 10. Esta capa aplana el
 *    documento antes de devolverlo, por lo que app.js y admin.js no cambian.
 *
 * 2. MODO DEMOSTRACIÓN (Supabase sin configurar):
 *    Los mismos objetos se guardan en localStorage con datos de ejemplo,
 *    para probar todo el flujo sin backend.
 *
 * Todas las funciones devuelven Promises.
 */
window.API = (function () {
  const DEMO_KEY = 'tauros_demo_v1';
  const sb = window.Supa.obtener();
  const CFG = window.TAUROS_CONFIG;

  /* ------------------------------------------------------------------ */
  /*  Utilidades generales                                              */
  /* ------------------------------------------------------------------ */

  function nowISO() { return new Date().toISOString(); }

  function uid() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** UUID v4 para las columnas id de Supabase. */
  function nuevoUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** Simula latencia de red en modo demo para un comportamiento realista. */
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  /** Fila Supabase (id, datos) → objeto plano que usa la interfaz. */
  function filaAObj(fila) {
    return { id: fila.id, ...(fila.datos || {}) };
  }

  /** Número de silla a partir de silla_id ('silla_3' → 3). */
  function numSilla(b) {
    return parseInt(String((b && b.silla_id) || '').replace(/\D/g, ''), 10) || 0;
  }

  /* ------------------------------------------------------------------ */
  /*  MODO DEMOSTRACIÓN (localStorage)                                  */
  /* ------------------------------------------------------------------ */

  function seedDemo() {
    const hoy = new Date().toISOString().slice(0, 10);
    const barberos = [
      { id: 'b1', nombre: 'Carlos Rodríguez', especialidad: 'Cortes clásicos y fade', silla_id: 'silla_1', activo: true, foto_url: '', creado_en: nowISO() },
      { id: 'b2', nombre: 'Luis Mendoza',     especialidad: 'Barba y diseño',          silla_id: 'silla_2', activo: true, foto_url: '', creado_en: nowISO() },
      { id: 'b3', nombre: 'Andrés Torres',    especialidad: 'Cortes modernos y color', silla_id: 'silla_3', activo: false, foto_url: '', creado_en: nowISO() }
    ];
    const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const horarios = [];
    barberos.forEach(b => {
      dias.forEach(d => {
        horarios.push({
          id: uid(), barbero_id: b.id, dia_semana: d,
          hora_inicio: '09:00', hora_fin: '18:00',
          duracion_slot: 30, activo: true
        });
      });
    });
    const citas = [
      { id: uid(), barbero_id: 'b1', cliente_nombre: 'Cliente demo', cliente_contacto: '555-0001',
        fecha: hoy, hora_inicio: '10:00', hora_fin: '10:30',
        estado: 'confirmada', creado_en: nowISO() }
    ];
    return { barberos, horarios, citas };
  }

  function demoLoad() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* datos corruptos: se regeneran */ }
    const data = seedDemo();
    demoSave(data);
    return data;
  }

  function demoSave(data) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(data)); }
    catch (e) { console.warn('[Tauros] No se pudo guardar en localStorage:', e); }
  }

  /* ------------------------------------------------------------------ */
  /*  BARBEROS                                                          */
  /* ------------------------------------------------------------------ */

  async function getBarberos() {
    let lista;
    if (sb) {
      const { data, error } = await sb.from('barberos').select('id, datos');
      if (error) throw new Error('No se pudieron cargar los barberos: ' + error.message);
      lista = (data || []).map(filaAObj);
    } else {
      await delay(150);
      lista = demoLoad().barberos;
    }
    // Orden estable por número de silla (igual en ambos modos)
    return lista.slice().sort((a, b) => numSilla(a) - numSilla(b));
  }

  async function createBarbero(datos) {
    if (sb) {
      // Documento JSON de la colección barberos (sección 10.1)
      const doc = {
        nombre: datos.nombre,
        especialidad: datos.especialidad || '',
        silla_id: datos.silla_id,
        activo: true,
        foto_url: datos.foto_url || '',
        creado_en: nowISO()
      };
      const { data, error } = await sb.from('barberos')
        .insert([{ datos: doc }])
        .select('id, datos').single();
      if (error) {
        // 23505 = índice único violado → silla ya asignada
        if (error.code === '23505') {
          throw new Error('La ' + doc.silla_id + ' ya está asignada a otro barbero.');
        }
        throw new Error('No se pudo registrar el barbero: ' + error.message);
      }
      return filaAObj(data);
    }
    await delay(150);
    const db = demoLoad();
    const nuevo = { id: uid(), creado_en: nowISO(), activo: true, foto_url: '', ...datos };
    db.barberos.push(nuevo);
    demoSave(db);
    return nuevo;
  }

  async function updateBarbero(id, cambios) {
    if (sb) {
      // Escritura sobre documento JSON: leer → fusionar → escribir
      const { data: fila, error: eLectura } = await sb.from('barberos')
        .select('datos').eq('id', id).single();
      if (eLectura) {
        throw new Error(eLectura.code === 'PGRST116'
          ? 'Barbero no encontrado.'
          : 'No se pudo leer el barbero: ' + eLectura.message);
      }
      const datos = { ...(fila.datos || {}), ...cambios };
      const { data, error } = await sb.from('barberos')
        .update({ datos }).eq('id', id).select('id, datos').single();
      if (error) {
        if (error.code === '23505') {
          throw new Error('La ' + (datos.silla_id || '') + ' ya está asignada a otro barbero.');
        }
        throw new Error('No se pudo actualizar el barbero: ' + error.message);
      }
      return filaAObj(data);
    }
    await delay(150);
    const db = demoLoad();
    const i = db.barberos.findIndex(b => b.id === id);
    if (i === -1) throw new Error('Barbero no encontrado.');
    db.barberos[i] = { ...db.barberos[i], ...cambios };
    demoSave(db);
    return db.barberos[i];
  }

  async function deleteBarbero(id) {
    if (sb) {
      // Sin claves foráneas (modo colecciones): se borra por referencia JSON
      await sb.from('horarios').delete().eq('datos->>barbero_id', id);
      await sb.from('citas').delete().eq('datos->>barbero_id', id);
      const { error } = await sb.from('barberos').delete().eq('id', id);
      if (error) throw new Error('No se pudo eliminar el barbero: ' + error.message);
      return true;
    }
    await delay(150);
    const db = demoLoad();
    db.barberos = db.barberos.filter(b => b.id !== id);
    db.horarios = db.horarios.filter(h => h.barbero_id !== id);
    db.citas = db.citas.filter(c => c.barbero_id !== id);
    demoSave(db);
    return true;
  }

  /** RF-12: cambia el estado disponible / no disponible. */
  async function toggleBarbero(id, activo) {
    return updateBarbero(id, { activo });
  }

  /* ------------------------------------------------------------------ */
  /*  HORARIOS (RF-10)                                                  */
  /* ------------------------------------------------------------------ */

  async function getHorarios(barberoId) {
    if (sb) {
      let q = sb.from('horarios').select('id, datos');
      if (barberoId) q = q.eq('datos->>barbero_id', barberoId);
      const { data, error } = await q;
      if (error) throw new Error('No se pudieron cargar los horarios: ' + error.message);
      return (data || []).map(filaAObj);
    }
    await delay(100);
    const db = demoLoad();
    return db.horarios.filter(h => !barberoId || h.barbero_id === barberoId);
  }

  /**
   * Guarda los horarios de un barbero (los 7 días de la semana).
   * Cada día es un documento JSON independiente de la colección `horarios`.
   */
  async function saveHorarios(barberoId, lista) {
    if (sb) {
      const registros = lista.map(h => ({
        // Upsert por id: actualiza los días existentes y crea los nuevos
        id: h.id || nuevoUUID(),
        datos: {
          barbero_id: barberoId,
          dia_semana: h.dia_semana,
          hora_inicio: h.hora_inicio,
          hora_fin: h.hora_fin,
          duracion_slot: Number(h.duracion_slot) || 30,
          activo: h.activo !== false
        }
      }));
      const { error } = await sb.from('horarios').upsert(registros, { onConflict: 'id' });
      if (error) {
        if (error.code === '23505') {
          throw new Error('Ya existe un horario para ese día. Recarga e inténtalo de nuevo.');
        }
        throw new Error('No se pudieron guardar los horarios: ' + error.message);
      }
      return registros.map(filaAObj);
    }

    // Modo demo: reemplaza los registros del barbero día a día
    await delay(150);
    const db = demoLoad();
    lista.forEach(h => {
      const reg = {
        id: h.id || uid(),
        barbero_id: barberoId,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        hora_fin: h.hora_fin,
        duracion_slot: Number(h.duracion_slot) || 30,
        activo: h.activo !== false
      };
      const i = db.horarios.findIndex(x => x.barbero_id === barberoId && x.dia_semana === reg.dia_semana);
      if (i >= 0) db.horarios[i] = reg; else db.horarios.push(reg);
    });
    demoSave(db);
    return lista;
  }

  /* ------------------------------------------------------------------ */
  /*  CITAS (RF-05, RF-11)                                              */
  /* ------------------------------------------------------------------ */

  /** Devuelve citas filtradas. filtros: { fecha, barbero_id, estado } */
  async function getCitas(filtros) {
    filtros = filtros || {};
    let citas;

    if (sb) {
      let q = sb.from('citas').select('id, datos');
      // Filtros sobre campos dentro del documento JSON
      if (filtros.fecha) q = q.eq('datos->>fecha', filtros.fecha);
      if (filtros.barbero_id) q = q.eq('datos->>barbero_id', filtros.barbero_id);
      if (filtros.estado) q = q.eq('datos->>estado', filtros.estado);
      const { data, error } = await q;
      if (error) throw new Error('No se pudieron cargar las citas: ' + error.message);
      citas = (data || []).map(filaAObj);
    } else {
      await delay(100);
      citas = demoLoad().citas;
      if (filtros.fecha) citas = citas.filter(c => c.fecha === filtros.fecha);
      if (filtros.barbero_id) citas = citas.filter(c => c.barbero_id === filtros.barbero_id);
      if (filtros.estado) citas = citas.filter(c => c.estado === filtros.estado);
      citas = citas.slice();
    }

    return citas.sort((a, b) =>
      (a.fecha + a.hora_inicio).localeCompare(b.fecha + b.hora_inicio));
  }

  /**
   * Reservas futuras confirmadas de un contacto (anti-acaparamiento).
   * En Supabase se consulta con COUNT sobre datos->>cliente_contacto;
   * en modo demo se cuentan en localStorage. Coincide con la función
   * SQL puede_reservar de supabase/schema.sql.
   */
  async function contarFuturasContacto(contacto) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (sb) {
      const { count, error } = await sb.from('citas')
        .select('id', { count: 'exact', head: true })
        .eq('datos->>cliente_contacto', contacto)
        .eq('datos->>estado', 'confirmada')
        .gte('datos->>fecha', hoy);
      if (error) throw new Error('No se pudo verificar el contacto: ' + error.message);
      return count || 0;
    }
    return demoLoad().citas.filter(c =>
      c.cliente_contacto === contacto &&
      c.estado === 'confirmada' &&
      c.fecha >= hoy).length;
  }

  /**
   * RF-05 + condición de carrera (sección 12 del documento):
   * doble verificación ANTES de confirmar. Se reconsulta la disponibilidad
   * en el momento de la escritura; además, en Supabase el índice
   * `citas_slot_unico` imposibilita físicamente dos citas con el mismo
   * barbero + fecha + hora (la app traduce el error 23505 a un mensaje claro).
   */
  async function createCita(cita) {
    const duracion = Number(cita.duracion_slot) || 30;
    const hora_fin = addMinutes(cita.hora_inicio, duracion);

    // --- 1ª verificación: slot ocupado en este instante ---
    const existentes = await getCitas({ fecha: cita.fecha, barbero_id: cita.barbero_id });
    const enConflicto = existentes.find(c =>
      c.estado !== 'cancelada' && overlaps(cita.hora_inicio, hora_fin, c.hora_inicio, c.hora_fin));
    if (enConflicto) {
      throw new Error('Ese horario acaba de ser ocupado por otro cliente. Elige uno diferente.');
    }

    // --- Límite anti-acaparamiento: máximo MAX_RESERVAS_CONTACTO reservas
    // futuras por mismo contacto. La base de datos también lo impone
    // (función puede_reservar), aquí solo para avisar antes de enviar. ---
    const contacto = (cita.cliente_contacto || '').trim();
    if (contacto) {
      const tope = CFG.MAX_RESERVAS_CONTACTO || 3;
      const futuras = await contarFuturasContacto(contacto);
      if (futuras >= tope) {
        throw new Error('Este contacto ya tiene ' + tope +
          ' reservas próximas. Libera una desde el panel o usa otro contacto.');
      }
    }

    const datos = {
      barbero_id: cita.barbero_id,
      cliente_nombre: cita.cliente_nombre,
      cliente_contacto: cita.cliente_contacto || '',
      fecha: cita.fecha,
      hora_inicio: cita.hora_inicio,
      hora_fin: hora_fin,
      estado: 'confirmada',
      creado_en: nowISO()
    };

    if (sb) {
      const { data, error } = await sb.from('citas')
        .insert([{ datos }]).select('id, datos').single();
      if (error) {
        // 23505 = otro cliente ganó la carrera por el mismo slot
        if (error.code === '23505') {
          throw new Error('Ese horario acaba de ser ocupado por otro cliente. Elige uno diferente.');
        }
        // 42501 = rechazado por los límites de la política (ventana de
        // días o tope por contacto); se traduce a un mensaje claro.
        if (error.code === '42501') {
          throw new Error('No se pudo agendar: revisa que la fecha sea dentro de ' +
            (CFG.DIAS_A_DELANTE || 14) + ' días y que tu contacto no supere el límite de reservas.');
        }
        throw new Error('No se pudo agendar la cita: ' + error.message);
      }
      // --- 2ª verificación: la cita quedó registrada ---
      if (!data) throw new Error('La reserva no se confirmó. Intenta nuevamente.');
      return filaAObj(data);
    }

    // Modo demo: relectura y escritura dentro del mismo tick
    await delay(200);
    const db = demoLoad();
    const registro = { id: uid(), ...datos };
    const doble = db.citas.find(c =>
      c.estado !== 'cancelada' &&
      c.barbero_id === registro.barbero_id &&
      c.fecha === registro.fecha &&
      overlaps(registro.hora_inicio, registro.hora_fin, c.hora_inicio, c.hora_fin));
    if (doble) throw new Error('Ese horario acaba de ser ocupado. Elige uno diferente.');
    db.citas.push(registro);
    demoSave(db);
    return registro;
  }

  async function updateCita(id, cambios) {
    if (sb) {
      // Escritura sobre documento JSON: leer → fusionar → escribir
      const { data: fila, error: eLectura } = await sb.from('citas')
        .select('datos').eq('id', id).single();
      if (eLectura) {
        throw new Error(eLectura.code === 'PGRST116'
          ? 'Cita no encontrada.'
          : 'No se pudo leer la cita: ' + eLectura.message);
      }
      const datos = { ...(fila.datos || {}), ...cambios };
      const { data, error } = await sb.from('citas')
        .update({ datos }).eq('id', id).select('id, datos').single();
      if (error) throw new Error('No se pudo actualizar la cita: ' + error.message);
      return filaAObj(data);
    }
    await delay(100);
    const db = demoLoad();
    const i = db.citas.findIndex(c => c.id === id);
    if (i === -1) throw new Error('Cita no encontrada.');
    db.citas[i] = { ...db.citas[i], ...cambios };
    demoSave(db);
    return db.citas[i];
  }

  async function deleteCita(id) {
    if (sb) {
      const { error } = await sb.from('citas').delete().eq('id', id);
      if (error) throw new Error('No se pudo eliminar la cita: ' + error.message);
      return true;
    }
    await delay(100);
    const db = demoLoad();
    db.citas = db.citas.filter(c => c.id !== id);
    demoSave(db);
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers de tiempo                                                 */
  /* ------------------------------------------------------------------ */

  function addMinutes(hhmm, min) {
    const [h, m] = hhmm.split(':').map(Number);
    const total = h * 60 + m + min;
    return String(Math.floor(total / 60) % 24).padStart(2, '0') + ':' +
           String(total % 60).padStart(2, '0');
  }

  function overlaps(ini1, fin1, ini2, fin2) {
    const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return toMin(ini1) < toMin(fin2) && toMin(ini2) < toMin(fin1);
  }

  /** true si la aplicación corre en modo demostración (sin Supabase). */
  const esDemo = !sb;

  return {
    esDemo,
    getBarberos, createBarbero, updateBarbero, deleteBarbero, toggleBarbero,
    getHorarios, saveHorarios,
    getCitas, createCita, updateCita, deleteCita
  };
})();

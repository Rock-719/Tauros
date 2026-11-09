/**
 * slots.js — Generación de bloques de horario (RF-04)
 *
 * A partir del horario de atención de un barbero y sus citas existentes,
 * genera la lista de slots disponibles y ocupados para una fecha dada.
 *
 * Un slot se considera ocupado si existe una cita (confirmada o completada)
 * que se superpone con el rango [inicio del slot, inicio + duración].
 * Las citas 'cancelada' liberan el horario.
 */
window.Slots = (function () {
  /**
   * @param {string} fechaISO   'yyyy-mm-dd' de la cita
   * @param {object} horario    { hora_inicio, hora_fin, duracion_slot }
   * @param {array}  citas      citas del barbero para ese día
   * @returns {array} [{ hora: '10:00', libre: true, ocupado: false, pasada: false }, ...]
   */
  function generar(fechaISO, horario, citas) {
    const paso = Number(horario.duracion_slot) || 30;
    const inicio = Util.horaAMin(horario.hora_inicio);
    const fin = Util.horaAMin(horario.hora_fin);
    const esHoy = fechaISO === Util.fechaISO(new Date());
    const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes();
    const lista = citas || [];

    const resultado = [];
    for (let m = inicio; m + paso <= fin; m += paso) {
      const finSlot = m + paso;
      // ¿La cita existente se superpone con este slot?
      const ocupado = lista.some(c => {
        if (c.estado === 'cancelada') return false;
        const ini = Util.horaAMin(c.hora_inicio);
        const finCita = Util.horaAMin(c.hora_fin || c.hora_inicio);
        return m < finCita && finSlot > ini;
      });
      // Si es hoy y el slot ya pasó, no se puede reservar.
      const pasada = esHoy && ahoraMin >= finSlot;
      resultado.push({
        hora: Util.minAHora(m),
        libre: !ocupado && !pasada,
        ocupado,
        pasada
      });
    }
    return resultado;
  }

  return { generar };
})();

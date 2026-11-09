/**
 * util.js — Utilidades compartidas (fechas, horas, HTML y notificaciones)
 */
window.Util = (function () {
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /** Date -> 'yyyy-mm-dd' usando la zona horaria LOCAL (evita el salto UTC). */
  function fechaISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  }

  /** 'yyyy-mm-dd' -> objeto Date (medianoche local). */
  function parseFecha(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** '2025-11-15' -> 'sábado' */
  function nombreDia(iso) {
    return DIAS[parseFecha(iso).getDay()];
  }

  /** '2025-11-15' -> 'sábado 15 de noviembre' */
  function fechaLegible(iso) {
    const d = parseFecha(iso);
    return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  }

  /** 'lunes' -> 'Lun' */
  function inicialesDia(dia) {
    const i = DIAS.indexOf(dia.toLowerCase());
    return i >= 0 ? DIAS_CORTOS[i] : dia.slice(0, 3);
  }

  /** 'HH:MM' -> minutos desde medianoche. Ej: '09:30' -> 570 */
  function horaAMin(hhmm) {
    const [h, m] = String(hhmm || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  /** minutos -> 'HH:MM'. Ej: 570 -> '09:30' */
  function minAHora(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** '10:00' -> '10:00 a. m.' */
  function horaLegible(hhmm) {
    const [h, m] = String(hhmm).split(':').map(Number);
    const sufijo = h >= 12 ? 'p. m.' : 'a. m.';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
  }

  /** Escapa texto del usuario antes de insertarlo en el HTML (evita XSS). */
  function escapar(txt) {
    return String(txt == null ? '' : txt)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Muestra una notificación flotante. tipo: 'info' | 'exito' | 'error' */
  function toast(mensaje, tipo) {
    let cont = document.getElementById('toasts');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'toasts';
      cont.className = 'toasts';
      document.body.appendChild(cont);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${tipo || 'info'}`;
    const icono = tipo === 'exito' ? 'fa-circle-check'
      : tipo === 'error' ? 'fa-circle-exclamation'
      : 'fa-circle-info';
    el.innerHTML = `<i class="fa-solid ${icono}"></i><span>${escapar(mensaje)}</span>`;
    cont.appendChild(el);
    setTimeout(() => {
      el.classList.add('saliendo');
      setTimeout(() => el.remove(), 350);
    }, 3800);
  }

  return {
    DIAS, DIAS_CORTOS, MESES,
    fechaISO, parseFecha, nombreDia, fechaLegible, inicialesDia,
    horaAMin, minAHora, horaLegible, escapar, toast
  };
})();

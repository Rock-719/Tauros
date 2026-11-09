/**
 * app.js — Módulo Cliente (index.html)
 *
 * Flujo CU-02 "Agendar cita":
 * 1. Carga barberos/sillas y renderiza las cards (RF-01)
 * 2. Cliente toca una silla → muestra horarios de la fecha elegida (RF-02, RF-04)
 * 3. Selector de fecha (RF-03)
 * 4. Selecciona slot → formulario con nombre/contacto (RF-05)
 * 5. Confirmación con comprobante (RF-06)
 */
(function () {
  'use strict';

  const CFG = window.TAUROS_CONFIG;
  const $ = sel => document.querySelector(sel);

  // Estado de la UI
  const estado = {
    barberos: [],
    fecha: hoyISO(),
    cita: { barbero: null, hora: null }
  };

  /* ------------------------------------------------------------------ */
  /*  Utilidades locales                                                */
  /* ------------------------------------------------------------------ */

  function hoyISO() { return Util.fechaISO(new Date()); }

  function barberoPorSilla(sillaId) {
    return estado.barberos.find(b => b.silla_id === sillaId);
  }

  /** Día de la semana en español para una fecha ISO (0=domingo). */
  const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function diaSemana(fechaISO) {
    return DIAS_SEMANA[Util.parseFecha(fechaISO).getDay()];
  }

  /* ------------------------------------------------------------------ */
  /*  Render: sillas (RF-01)                                            */
  /* ------------------------------------------------------------------ */

  async function cargarSillas() {
    const grid = $('#sillas-grid');
    try {
      estado.barberos = await API.getBarberos();

      if (!estado.barberos.length) {
        grid.innerHTML =
          '<div class="vacio">' +
          '<i class="fa-solid fa-chair"></i>' +
          '<p>Aún no hay sillas registradas.</p>' +
          '<span>El administrador debe crear barberos desde el panel.</span>' +
          '</div>';
        return;
      }

      // Citas existentes de la fecha, agrupadas por barbero (para el estado)
      const citas = await API.getCitas({ fecha: estado.fecha });
      const citasPorBarbero = {};
      citas.filter(c => c.estado !== 'cancelada').forEach(c => {
        citasPorBarbero[c.barbero_id] = (citasPorBarbero[c.barbero_id] || 0) + 1;
      });

      // RF-01: mostrar TODAS las sillas, incluidas las sin barbero asignado
      const numSilla = sid => parseInt(String(sid).replace(/\D/g, ''), 10) || 0;
      const totalSillas = estado.barberos.reduce(
        (max, b) => Math.max(max, numSilla(b.silla_id)), 0);
      const porSilla = {};
      estado.barberos.forEach(b => { porSilla[numSilla(b.silla_id)] = b; });

      let html = '';
      for (let i = 1; i <= totalSillas; i++) {
        const b = porSilla[i];

        if (!b) { // silla física sin barbero asignado
          html +=
            '<div class="silla-card silla-inactiva silla-vacia">' +
              '<div class="silla-icono"><i class="fa-solid fa-chair"></i></div>' +
              '<div class="silla-datos">' +
                '<span class="silla-nombre">Silla ' + i + '</span>' +
                '<span class="silla-especialidad">Sin barbero asignado</span>' +
              '</div>' +
              '<span class="silla-estado silla-estado-ocupada">' +
                '<i class="fa-solid fa-minus"></i> No disponible' +
              '</span>' +
            '</div>';
          continue;
        }

        const activo = !!b.activo;
        const nCitas = citasPorBarbero[b.id] || 0;
        const estadoTexto = !activo ? 'No disponible'
          : nCitas > 0 ? nCitas + (nCitas === 1 ? ' cita agendada' : ' citas agendadas')
          : 'Disponible';
        const icono = !activo ? 'fa-moon' : nCitas > 0 ? 'fa-hourglass-half' : 'fa-check';
        const clase = activo ? 'libre' : 'ocupada';

        html +=
          '<button class="silla-card ' + (activo ? '' : 'silla-inactiva') + '"' +
          ' data-silla="' + Util.escapar(b.silla_id) + '"' +
          (activo ? '' : ' disabled') + '>' +
            '<div class="silla-icono"><i class="fa-solid fa-chair"></i></div>' +
            '<div class="silla-datos">' +
              '<span class="silla-nombre">' + Util.escapar(b.nombre) + '</span>' +
              '<span class="silla-especialidad">Silla ' + i + ' · ' +
                Util.escapar(b.especialidad || 'Barbero') + '</span>' +
            '</div>' +
            '<span class="silla-estado silla-estado-' + clase + '">' +
              '<i class="fa-solid ' + icono + '"></i> ' + estadoTexto +
            '</span>' +
          '</button>';
      }

      grid.innerHTML = html;

      grid.querySelectorAll('.silla-card[data-silla]:not([disabled])').forEach(card => {
        card.addEventListener('click', () => abrirModal(card.dataset.silla));
      });
    } catch (err) {
      grid.innerHTML =
        '<div class="vacio vacio-error">' +
        '<i class="fa-solid fa-triangle-exclamation"></i>' +
        '<p>No se pudieron cargar las sillas.</p>' +
        '<span>' + Util.escapar(err.message) + '</span>' +
        '</div>';
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Selector de fecha (RF-03)                                         */
  /* ------------------------------------------------------------------ */

  function inicializarFecha() {
    const input = $('#fecha-principal');
    input.value = estado.fecha;
    input.min = hoyISO();
    // Ventana de reserva (anti-acaparamiento): hasta CFG.DIAS_A_DELANTE
    // días hacia adelante. La base de datos impone el mismo límite.
    const max = new Date();
    max.setDate(max.getDate() + CFG.DIAS_A_DELANTE);
    input.max = Util.fechaISO(max);

    input.addEventListener('change', () => {
      if (!input.value) return;
      estado.fecha = input.value;
      actualizarLeyendaFecha();
      cargarSillas(); // la ocupación de sillas depende de la fecha
      if (!$('#modal').hidden && estado.cita.barbero) {
        renderSlots(); // refresca los horarios si el modal está abierto
      }
    });
    actualizarLeyendaFecha();
  }

  function actualizarLeyendaFecha() {
    $('#fecha-leyenda').textContent = '· ' + Util.fechaLegible(estado.fecha);
  }

  /* ------------------------------------------------------------------ */
  /*  Modal de agendamiento                                              */
  /* ------------------------------------------------------------------ */

  function abrirModal(sillaId) {
    const barbero = barberoPorSilla(sillaId);
    if (!barbero) return;

    estado.cita = { barbero, hora: null };
    $('#modal-subtitulo').textContent =
      barbero.nombre + ' · ' + Util.fechaLegible(estado.fecha);

    mostrarPaso('paso-horarios');
    $('#modal').hidden = false;
    document.body.classList.add('modal-abierto');
    renderSlots();
  }

  function cerrarModal() {
    $('#modal').hidden = true;
    document.body.classList.remove('modal-abierto');
    $('#modal-error').hidden = true;
    estado.cita = { barbero: null, hora: null };
  }

  function mostrarPaso(id) {
    ['paso-horarios', 'paso-datos', 'paso-exito'].forEach(p => {
      $('#' + p).hidden = (p !== id);
    });
  }

  /** RF-04: slots disponibles/ocupados para barbero + fecha. */
  async function renderSlots() {
    const grid = $('#slots-grid');
    const barbero = estado.cita.barbero;
    if (!barbero) return;

    grid.innerHTML = '<div class="cargando"><i class="fa-solid fa-circle-notch fa-spin"></i> Consultando disponibilidad…</div>';

    try {
      const [horarios, citas] = await Promise.all([
        API.getHorarios(barbero.id),
        API.getCitas({ fecha: estado.fecha, barbero_id: barbero.id })
      ]);

      // Horario activo del día de la semana elegido
      const dia = diaSemana(estado.fecha);
      const horarioDia = horarios.find(h => h.dia_semana === dia && h.activo !== false);

      if (!horarioDia) {
        grid.innerHTML =
          '<div class="vacio">' +
          '<i class="fa-solid fa-calendar-xmark"></i>' +
          '<p>Sin horario este día</p>' +
          '<span>Prueba con otra fecha. ' +
          Util.escapar(barbero.nombre) + ' no atiende los ' + Util.escapar(dia) + '.</span>' +
          '</div>';
        return;
      }

      // Si es hoy, descartar horas ya pasadas
      const ahora = new Date();
      const esHoy = estado.fecha === hoyISO();
      const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

      const slots = Slots.generar(estado.fecha, horarioDia, citas)
        .filter(s => !(esHoy && Util.horaAMin(s.hora) < minutosAhora));

      const libres = slots.filter(s => s.libre);

      if (!slots.length || !libres.length) {
        grid.innerHTML =
          '<div class="vacio">' +
          '<i class="fa-solid fa-hourglass-end"></i>' +
          '<p>' + (slots.length ? 'Día completo agendado' : 'Ya cerró la atención de hoy') + '</p>' +
          '<span>Elige otra fecha para continuar.</span>' +
          '</div>';
        return;
      }

      grid.innerHTML = slots.map(s =>
        '<button class="slot ' + (s.libre ? 'slot-libre' : 'slot-ocupado') + '"' +
        ' data-hora="' + s.hora + '"' + (s.libre ? '' : ' disabled') + '>' +
          '<span class="slot-hora">' + Util.horaLegible(s.hora) + '</span>' +
          '<span class="slot-estado">' + (s.libre ? 'Libre' : 'Ocupado') + '</span>' +
        '</button>'
      ).join('');

      grid.querySelectorAll('.slot-libre').forEach(btn => {
        btn.addEventListener('click', () => elegirSlot(btn.dataset.hora));
      });
    } catch (err) {
      grid.innerHTML =
        '<div class="vacio vacio-error">' +
        '<i class="fa-solid fa-triangle-exclamation"></i>' +
        '<p>No se pudo consultar la disponibilidad.</p>' +
        '<span>' + Util.escapar(err.message) + '</span>' +
        '</div>';
    }
  }

  /** Paso 2: resumen + formulario (RF-05). */
  function elegirSlot(hora) {
    estado.cita.hora = hora;
    $('#resumen-cita').textContent =
      estado.cita.barbero.nombre + ' · ' +
      Util.fechaLegible(estado.fecha) + ' · ' +
      Util.horaLegible(hora);
    $('#error-nombre').textContent = '';
    mostrarPaso('paso-datos');
    setTimeout(() => $('#cliente-nombre').focus(), 50);
  }

  /** Confirmación de la reserva (RF-05 + anti doble reserva). */
  async function confirmarCita(evento) {
    evento.preventDefault();
    const nombre = $('#cliente-nombre').value.trim();
    const contacto = $('#cliente-contacto').value.trim();

    if (!nombre) {
      $('#error-nombre').textContent = 'Por favor escribe tu nombre.';
      $('#cliente-nombre').focus();
      return;
    }
    $('#error-nombre').textContent = '';

    const btn = $('#btn-confirmar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Confirmando…';

    try {
      const horarios = await API.getHorarios(estado.cita.barbero.id);
      const dia = diaSemana(estado.fecha);
      const horarioDia = horarios.find(h => h.dia_semana === dia && h.activo !== false);
      const duracion = (horarioDia && horarioDia.duracion_slot) || CFG.DURACION_SLOT || 30;

      const cita = await API.createCita({
        barbero_id: estado.cita.barbero.id,
        cliente_nombre: nombre,
        cliente_contacto: contacto,
        fecha: estado.fecha,
        hora_inicio: estado.cita.hora,
        duracion_slot: duracion
      });

      mostrarTicket(cita);
      mostrarPaso('paso-exito');
      cargarSillas(); // actualiza el estado de las sillas
    } catch (err) {
      Util.toast(err.message, 'error');
      // Vuelve a consultar slots: pudo ocuparse mientras tanto (condición de carrera)
      mostrarPaso('paso-horarios');
      renderSlots();
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar reserva';
    }
  }

  /** RF-06: comprobante visual con los datos de la cita. */
  function mostrarTicket(cita) {
    const b = estado.cita.barbero;
    $('#ticket').innerHTML =
      '<div class="ticket-fila"><span>Barbero</span><strong>' + Util.escapar(b.nombre) + '</strong></div>' +
      '<div class="ticket-fila"><span>Silla</span><strong>' + Util.escapar(b.silla_id) + '</strong></div>' +
      '<div class="ticket-fila"><span>Fecha</span><strong>' + Util.escapar(Util.fechaLegible(cita.fecha)) + '</strong></div>' +
      '<div class="ticket-fila"><span>Hora</span><strong>' + Util.escapar(Util.horaLegible(cita.hora_inicio)) + '</strong></div>' +
      '<div class="ticket-fila"><span>Cliente</span><strong>' + Util.escapar(cita.cliente_nombre) + '</strong></div>' +
      (cita.cliente_contacto
        ? '<div class="ticket-fila"><span>Contacto</span><strong>' + Util.escapar(cita.cliente_contacto) + '</strong></div>'
        : '');
  }

  /* ------------------------------------------------------------------ */
  /*  Eventos globales                                                  */
  /* ------------------------------------------------------------------ */

  function bindEventos() {
    $('#btn-cerrar').addEventListener('click', cerrarModal);
    $('#btn-finalizar').addEventListener('click', cerrarModal);
    $('#btn-atras').addEventListener('click', () => mostrarPaso('paso-horarios'));
    $('#form-cita').addEventListener('submit', confirmarCita);

    // Cerrar con Escape o clic fuera del modal
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('#modal').hidden) cerrarModal();
    });
    $('#modal').addEventListener('click', e => {
      if (e.target === $('#modal')) cerrarModal();
    });

    // Aviso de modo demostración
    if (API.esDemo) {
      $('#aviso-demo').hidden = false;
      $('#btn-cerrar-aviso').addEventListener('click', () => {
        $('#aviso-demo').hidden = true;
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Init                                                              */
  /* ------------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', () => {
    $('#anio').textContent = new Date().getFullYear();
    inicializarFecha();
    bindEventos();
    cargarSillas();
  });
})();

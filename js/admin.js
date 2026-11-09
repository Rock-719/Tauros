/**
 * admin.js — Módulo Administrador (admin.html)
 *
 * RF-07  Acceso al panel con contraseña simple (front-end).
 * RF-08  Registro de barberos.
 * RF-09  Listado de barberos con estado.
 * RF-10  Gestión de horarios por día de la semana.
 * RF-11  Visualización de citas con filtros (fecha / barbero / estado).
 * RF-12  Cambio de estado del barbero (disponible / no disponible).
 */
(function () {
  'use strict';

  const CFG = window.TAUROS_CONFIG;
  const $ = sel => document.querySelector(sel);
  const SESION_KEY = 'tauros_admin_activa';

  const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

  const estado = {
    barberos: [],
    horarios: [],   // horarios del barbero seleccionado en la sección Horarios
    seccion: 'barberos'
  };

  /* ================================================================== */
  /*  ACCESO (RF-07)                                                    */
  /* ================================================================== */

  function bindLogin() {
    $('#form-login').addEventListener('submit', async e => {
      e.preventDefault();
      const clave = $('#clave-admin').value;
      const errorEl = $('#error-login');
      errorEl.textContent = '';

      // ---- Modo demostración (sin Supabase): clave simple de front-end ----
      if (API.esDemo) {
        if (clave === CFG.ADMIN_PASSWORD) {
          sessionStorage.setItem(SESION_KEY, '1');
          mostrarPanel();
        } else {
          errorEl.textContent = 'Contraseña incorrecta.';
          $('#clave-admin').value = '';
          $('#clave-admin').focus();
        }
        return;
      }

      // ---- Modo Supabase: autenticación REAL en el servidor (Supabase Auth)
      const correo = $('#correo-admin').value.trim();
      if (!correo) { errorEl.textContent = 'Escribe tu correo electrónico.'; return; }
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const { error } = await window.Supa.obtener().auth
          .signInWithPassword({ email: correo, password: clave });
        if (error) {
          errorEl.textContent = (error.message === 'Invalid login credentials')
            ? 'Correo o contraseña incorrectos.'
            : 'No se pudo iniciar sesión: ' + error.message;
          return;
        }
        mostrarPanel();
      } catch (err) {
        errorEl.textContent = 'Error de conexión con Supabase. Inténtalo de nuevo.';
      } finally {
        btn.disabled = false;
      }
    });

    $('#btn-salir').addEventListener('click', async () => {
      if (API.esDemo) {
        sessionStorage.removeItem(SESION_KEY);
        location.reload();
        return;
      }
      try { await window.Supa.obtener().auth.signOut(); } catch (err) { /* sin sesión */ }
      location.reload();
    });
  }

  function mostrarPanel() {
    $('#login').hidden = true;
    $('#panel').hidden = false;
    iniciarPanel();
  }

  /* ================================================================== */
  /*  NAVEGACIÓN ENTRE SECCIONES                                        */
  /* ================================================================== */

  function bindNav() {
    document.querySelectorAll('#admin-nav .admin-nav-item').forEach(btn => {
      btn.addEventListener('click', () => cambiarSeccion(btn.dataset.seccion));
    });
  }

  function cambiarSeccion(seccion) {
    estado.seccion = seccion;
    document.querySelectorAll('#admin-nav .admin-nav-item').forEach(b => {
      b.classList.toggle('activo', b.dataset.seccion === seccion);
    });
    $('#sec-barberos').hidden = seccion !== 'barberos';
    $('#sec-horarios').hidden = seccion !== 'horarios';
    $('#sec-citas').hidden = seccion !== 'citas';

    if (seccion === 'barberos') cargarBarberos();
    if (seccion === 'horarios') cargarSeccionHorarios();
    if (seccion === 'citas') cargarCitas();
  }

  /* ================================================================== */
  /*  BARBEROS (RF-08, RF-09, RF-12)                                    */
  /* ================================================================== */

  async function cargarBarberos() {
    try {
      estado.barberos = await API.getBarberos();
      renderBarberos();
      actualizarContadores();
      llenarSelects();
      llenarSelectSillas();
    } catch (err) {
      Util.toast('Error al cargar barberos: ' + err.message, 'error');
    }
  }

  function renderBarberos() {
    const tbody = $('#tabla-barberos tbody');
    const vacio = $('#barberos-vacio');

    $('#tabla-barberos').hidden = !estado.barberos.length;
    vacio.hidden = !!estado.barberos.length;

    tbody.innerHTML = estado.barberos.map(b => (
      '<tr>' +
        '<td><span class="chip-silla">' + Util.escapar(b.silla_id) + '</span></td>' +
        '<td><strong>' + Util.escapar(b.nombre) + '</strong></td>' +
        '<td>' + Util.escapar(b.especialidad || '—') + '</td>' +
        '<td>' +
          '<button class="toggle-estado ' + (b.activo ? 'toggle-on' : 'toggle-off') + '"' +
          ' data-id="' + b.id + '" data-accion="toggle"' +
          ' title="Cambiar disponibilidad (RF-12)">' +
            '<span class="toggle-bola"></span>' +
            (b.activo ? 'Disponible' : 'No disponible') +
          '</button>' +
        '</td>' +
        '<td class="td-acciones">' +
          '<button class="icon-btn" data-id="' + b.id + '" data-accion="editar" title="Editar">' +
            '<i class="fa-solid fa-pen"></i></button>' +
          '<button class="icon-btn icon-btn-peligro" data-id="' + b.id + '" data-accion="eliminar" title="Eliminar">' +
            '<i class="fa-solid fa-trash"></i></button>' +
        '</td>' +
      '</tr>'
    )).join('');
  }

  function bindTablaBarberos() {
    $('#tabla-barberos').addEventListener('click', async e => {
      const btn = e.target.closest('[data-accion]');
      if (!btn) return;
      const id = btn.dataset.id;
      const barbero = estado.barberos.find(b => b.id === id);

      if (btn.dataset.accion === 'toggle') {
        try {
          await API.toggleBarbero(id, !barbero.activo);
          Util.toast(
            barbero.nombre + (barbero.activo ? ' marcado como NO disponible' : ' marcado como disponible') + '.',
            'exito');
          await cargarBarberos();
        } catch (err) { Util.toast(err.message, 'error'); }
      }

      if (btn.dataset.accion === 'editar') {
        $('#form-barbero-card').hidden = false;
        $('#form-barbero-titulo').textContent = 'Editar barbero';
        $('#barbero-id').value = barbero.id;
        $('#barbero-nombre').value = barbero.nombre;
        $('#barbero-especialidad').value = barbero.especialidad || '';
        llenarSelectSillas(barbero.silla_id);
        $('#barbero-nombre').focus();
      }

      if (btn.dataset.accion === 'eliminar') {
        const ok = confirm('¿Eliminar a ' + barbero.nombre + '?\n\nSe borrarán también sus horarios y citas.');
        if (!ok) return;
        try {
          await API.deleteBarbero(id);
          Util.toast('Barbero eliminado.', 'exito');
          await cargarBarberos();
        } catch (err) { Util.toast(err.message, 'error'); }
      }
    });
  }

  /** Lista las sillas: 1..N+2, marcando las ocupadas como deshabilitadas. */
  function llenarSelectSillas(sillaActual) {
    const select = $('#barbero-silla');
    const ocupadas = new Set(estado.barberos
      .filter(b => b.silla_id !== sillaActual)
      .map(b => b.silla_id));
    // Un poco más que las existentes para poder agregar sillas nuevas (RNF-08)
    const total = Math.max(estado.barberos.length + 2, 5);

    let primeraLibre = null;
    let html = '';
    for (let i = 1; i <= total; i++) {
      const sid = 'silla_' + i;
      const libre = !ocupadas.has(sid);
      if (libre && !primeraLibre) primeraLibre = sid;
      const elegida = sillaActual ? (sillaActual === sid) : (primeraLibre === sid);
      html += '<option value="' + sid + '"' +
        (elegida ? ' selected' : '') +
        (libre ? '' : ' disabled') + '>' +
        'Silla ' + i + (libre ? '' : ' (ocupada)') +
        '</option>';
    }
    select.innerHTML = html;
  }

  function bindFormBarbero() {
    $('#btn-nuevo-barbero').addEventListener('click', () => {
      const card = $('#form-barbero-card');
      const abrir = card.hidden;
      card.hidden = !abrir;
      if (abrir) {
        $('#form-barbero-titulo').textContent = 'Registrar barbero';
        $('#form-barbero').reset();
        $('#barbero-id').value = '';
        llenarSelectSillas();
        $('#barbero-nombre').focus();
      }
    });

    $('#btn-cancelar-barbero').addEventListener('click', () => {
      $('#form-barbero-card').hidden = true;
      $('#form-barbero').reset();
      $('#barbero-id').value = '';
    });

    $('#form-barbero').addEventListener('submit', async e => {
      e.preventDefault();
      const id = $('#barbero-id').value;
      const nombre = $('#barbero-nombre').value.trim();
      const especialidad = $('#barbero-especialidad').value.trim();
      const silla = $('#barbero-silla').value;

      if (!nombre) { Util.toast('El nombre es obligatorio.', 'error'); return; }

      // Validación: la silla no puede estar ocupada por otro barbero
      const choque = estado.barberos.find(b => b.silla_id === silla && b.id !== id);
      if (choque) { Util.toast('La ' + silla + ' ya está asignada a ' + choque.nombre + '.', 'error'); return; }

      try {
        if (id) {
          await API.updateBarbero(id, { nombre, especialidad, silla_id: silla });
          Util.toast('Barbero actualizado.', 'exito');
        } else {
          await API.createBarbero({ nombre, especialidad, silla_id: silla });
          Util.toast('Barbero registrado.', 'exito');
        }
        $('#form-barbero-card').hidden = true;
        $('#form-barbero').reset();
        $('#barbero-id').value = '';
        await cargarBarberos();
      } catch (err) {
        Util.toast(err.message, 'error');
      }
    });
  }

  /* ================================================================== */
  /*  HORARIOS (RF-10)                                                  */
  /* ================================================================== */

  async function cargarSeccionHorarios() {
    await cargarBarberosSilencioso();
    const select = $('#select-barbero-horario');
    const vacio = $('#horarios-vacio');
    const card = $('#horarios-card');

    if (!estado.barberos.length) {
      card.hidden = true;
      vacio.hidden = false;
      return;
    }
    card.hidden = false;
    vacio.hidden = true;

    const previo = select.value;
    select.innerHTML = estado.barberos.map(b =>
      '<option value="' + b.id + '">' + Util.escapar(b.nombre) + ' · ' + Util.escapar(b.silla_id) + '</option>'
    ).join('');
    if (previo && estado.barberos.some(b => b.id === previo)) select.value = previo;

    await cargarHorariosBarbero();
  }

  /** Carga barberos sin volver a renderizar la tabla (evita parpadeos). */
  async function cargarBarberosSilencioso() {
    try { estado.barberos = await API.getBarberos(); }
    catch (err) { Util.toast('Error al cargar barberos: ' + err.message, 'error'); }
  }

  async function cargarHorariosBarbero() {
    const barberoId = $('#select-barbero-horario').value;
    if (!barberoId) return;
    try {
      estado.horarios = await API.getHorarios(barberoId);
    } catch (err) {
      Util.toast('Error al cargar horarios: ' + err.message, 'error');
      estado.horarios = [];
    }

    const tbody = $('#tabla-horarios tbody');
    tbody.innerHTML = DIAS.map(dia => {
      const h = estado.horarios.find(x => x.dia_semana === dia) ||
        { dia_semana: dia, hora_inicio: CFG.HORARIO_APERTURA, hora_fin: CFG.HORARIO_CIERRE, duracion_slot: CFG.DURACION_SLOT, activo: false };
      const activo = h.activo !== false;
      return (
        '<tr data-dia="' + dia + '" class="' + (activo ? '' : 'fila-inactiva') + '">' +
          '<td class="td-dia"><strong>' + dia.charAt(0).toUpperCase() + dia.slice(1) + '</strong></td>' +
          '<td>' +
            '<label class="check-switch">' +
              '<input type="checkbox" class="chk-activo"' + (activo ? ' checked' : '') + '>' +
              '<span></span>' +
            '</label>' +
          '</td>' +
          '<td><input type="time" class="inp-inicio" value="' + h.hora_inicio + '"></td>' +
          '<td><input type="time" class="inp-fin" value="' + h.hora_fin + '"></td>' +
          '<td><input type="number" class="inp-duracion" min="5" max="240" step="5" value="' + h.duracion_slot + '"></td>' +
        '</tr>'
      );
    }).join('');

    tbody.querySelectorAll('.chk-activo').forEach(chk => {
      chk.addEventListener('change', e => {
        e.target.closest('tr').classList.toggle('fila-inactiva', !e.target.checked);
      });
    });
  }

  async function guardarHorarios() {
    const barberoId = $('#select-barbero-horario').value;
    if (!barberoId) { Util.toast('Selecciona un barbero.', 'error'); return; }

    const filas = Array.from(document.querySelectorAll('#tabla-horarios tbody tr'));
    const lista = [];
    for (const tr of filas) {
      const dia = tr.dataset.dia;
      const activo = tr.querySelector('.chk-activo').checked;
      const hora_inicio = tr.querySelector('.inp-inicio').value;
      const hora_fin = tr.querySelector('.inp-fin').value;
      const duracion_slot = Number(tr.querySelector('.inp-duracion').value) || 30;

      if (activo) {
        if (!hora_inicio || !hora_fin) {
          Util.toast('Completa inicio y fin en ' + dia + ' (o desactívalo).', 'error');
          return;
        }
        if (Util.horaAMin(hora_fin) <= Util.horaAMin(hora_inicio)) {
          Util.toast('En ' + dia + ', la hora fin debe ser posterior a la de inicio.', 'error');
          return;
        }
      }
      const previo = estado.horarios.find(h => h.dia_semana === dia);
      lista.push({
        id: previo ? previo.id : null,
        dia_semana: dia, hora_inicio, hora_fin, duracion_slot, activo
      });
    }

    try {
      await API.saveHorarios(barberoId, lista);
      Util.toast('Horarios guardados correctamente.', 'exito');
      estado.horarios = await API.getHorarios(barberoId);
    } catch (err) {
      Util.toast(err.message, 'error');
    }
  }

  /* ================================================================== */
  /*  CITAS (RF-11)                                                     */
  /* ================================================================== */

  async function cargarCitas() {
    await cargarBarberosSilencioso();
    const filtroBarbero = $('#filtro-barbero');
    const valorPrevio = filtroBarbero.value;
    filtroBarbero.innerHTML = '<option value="">Todos</option>' +
      estado.barberos.map(b =>
        '<option value="' + b.id + '">' + Util.escapar(b.nombre) + '</option>').join('');
    filtroBarbero.value = valorPrevio;

    try {
      const citas = await API.getCitas({
        fecha: $('#filtro-fecha').value || undefined,
        barbero_id: $('#filtro-barbero').value || undefined,
        estado: $('#filtro-estado').value || undefined
      });
      renderCitas(citas);
      actualizarContadores();
    } catch (err) {
      Util.toast('Error al cargar citas: ' + err.message, 'error');
    }
  }

  function renderCitas(citas) {
    const tbody = $('#tabla-citas tbody');
    $('#tabla-citas').hidden = !citas.length;
    $('#citas-vacio').hidden = !!citas.length;

    tbody.innerHTML = citas.map(c => {
      const barbero = estado.barberos.find(b => b.id === c.barbero_id);
      const clases = {
        confirmada: 'estado-confirmada',
        completada: 'estado-completada',
        cancelada: 'estado-cancelada'
      };
      let acciones = '';
      if (c.estado === 'confirmada') {
        acciones =
          '<button class="icon-btn" data-id="' + c.id + '" data-accion="completar" title="Marcar completada">' +
            '<i class="fa-solid fa-check"></i></button>' +
          '<button class="icon-btn icon-btn-peligro" data-id="' + c.id + '" data-accion="cancelar" title="Cancelar cita">' +
            '<i class="fa-solid fa-xmark"></i></button>';
      } else {
        acciones = '<span class="sin-acciones">—</span>';
      }
      return (
        '<tr>' +
          '<td>' + Util.escapar(Util.fechaLegible(c.fecha)) + '</td>' +
          '<td><strong>' + Util.escapar(Util.horaLegible(c.hora_inicio)) + '</strong> – ' + Util.escapar(Util.horaLegible(c.hora_fin)) + '</td>' +
          '<td>' + Util.escapar(c.cliente_nombre) +
            (c.cliente_contacto ? '<br><small class="texto-suave">' + Util.escapar(c.cliente_contacto) + '</small>' : '') +
          '</td>' +
          '<td>' + Util.escapar(barbero ? barbero.nombre : '—') + '</td>' +
          '<td><span class="estado-cita ' + clases[c.estado] + '">' + c.estado + '</span></td>' +
          '<td class="td-acciones">' + acciones + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function bindCitas() {
    ['#filtro-fecha', '#filtro-barbero', '#filtro-estado'].forEach(sel => {
      $(sel).addEventListener('change', cargarCitas);
    });
    $('#btn-limpiar-filtros').addEventListener('click', () => {
      $('#filtro-fecha').value = '';
      $('#filtro-barbero').value = '';
      $('#filtro-estado').value = '';
      cargarCitas();
    });

    $('#tabla-citas').addEventListener('click', async e => {
      const btn = e.target.closest('[data-accion]');
      if (!btn) return;
      try {
        if (btn.dataset.accion === 'completar') {
          await API.updateCita(btn.dataset.id, { estado: 'completada' });
          Util.toast('Cita marcada como completada.', 'exito');
        }
        if (btn.dataset.accion === 'cancelar') {
          const ok = confirm('¿Cancelar esta cita? El horario quedará libre para otro cliente.');
          if (!ok) return;
          await API.updateCita(btn.dataset.id, { estado: 'cancelada' });
          Util.toast('Cita cancelada. El horario se liberó.', 'exito');
        }
        await cargarCitas();
      } catch (err) {
        Util.toast(err.message, 'error');
      }
    });
  }

  /* ================================================================== */
  /*  GENERALES                                                         */
  /* ================================================================== */

  function actualizarContadores() {
    $('#badge-barberos').textContent = estado.barberos.length;
    $('#badge-citas').textContent = '';
    API.getCitas({ estado: 'confirmada' })
      .then(c => { $('#badge-citas').textContent = c.length; })
      .catch(() => { $('#badge-citas').textContent = ''; });
  }

  function llenarSelects() {
    const sel = $('#select-barbero-horario');
    const previo = sel.value;
    if (estado.barberos.length && !sel.options.length) {
      sel.innerHTML = estado.barberos.map(b =>
        '<option value="' + b.id + '">' + Util.escapar(b.nombre) + '</option>').join('');
    } else if (previo && !estado.barberos.some(b => b.id === previo)) {
      sel.innerHTML = estado.barberos.map(b =>
        '<option value="' + b.id + '">' + Util.escapar(b.nombre) + '</option>').join('');
    }
  }

  let panelIniciado = false;
  function iniciarPanel() {
    if (panelIniciado) return;
    panelIniciado = true;

    bindNav();
    bindFormBarbero();
    bindTablaBarberos();
    bindCitas();

    $('#select-barbero-horario').addEventListener('change', cargarHorariosBarbero);
    $('#btn-guardar-horarios').addEventListener('click', guardarHorarios);

    cargarBarberos();
    if (API.esDemo) Util.toast('Modo demostración: los datos se guardan solo en este navegador.', 'info');
  }

  /* ================================================================== */
  /*  INIT                                                              */
  /* ================================================================== */

  document.addEventListener('DOMContentLoaded', () => {
    bindLogin();

    // Sin Supabase: solo contraseña simple (campo de correo innecesario)
    if (API.esDemo) {
      $('#campo-email').hidden = true;
      $('#login-sub').textContent = 'Ingresa la contraseña para continuar.';
      if (sessionStorage.getItem(SESION_KEY) === '1') mostrarPanel();
      else $('#clave-admin').focus();
      return;
    }

    // Con Supabase: correo + contraseña reales (Supabase Auth)
    $('#correo-admin').value = CFG.ADMIN_EMAIL || '';
    $('#login-sub').textContent = 'Ingresa tus credenciales para continuar.';
    (async () => {
      try {
        const { data } = await window.Supa.obtener().auth.getSession();
        if (data && data.session) { mostrarPanel(); return; } // sesión guardada
      } catch (err) { /* sin sesión guardada */ }
      $('#clave-admin').focus();
    })();
  });
})();

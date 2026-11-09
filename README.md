# 🐂 Tauros Barbería — Sistema de Agendamiento de Citas

Aplicación web para agendamiento de citas desarrollada según el documento de
proyecto: los clientes reservan silla, barbero, fecha y hora en tiempo real, y
el administrador gestiona barberos, horarios y citas desde un panel protegido.

## 🧰 Stack tecnológico

| Tecnología | Uso |
|---|---|
| HTML5 | Estructura semántica de las páginas |
| CSS3 | Estilos, paleta oscura/dorado y responsividad (Flexbox/Grid) |
| JavaScript (ES6+) | Lógica del cliente, DOM y llamadas a la API |
| Supabase (SDK JS) | Base de datos y API REST |
| GitHub | Control de versiones |
| Vercel | Despliegue continuo |

## 📁 Estructura

```
Tauros/
├── index.html        # Módulo cliente (visualizar sillas, agendar cita)
├── admin.html        # Módulo administrador (/admin)
├── css/
│   ├── styles.css    # Estilos generales y del módulo cliente
│   └── admin.css     # Estilos del panel de administración
└── js/
    ├── config.js     # ⚙️ Configuración (Supabase + contraseña admin)
    ├── util.js       # Fechas, horas, escapado HTML y toasts
    ├── supa.js       # Inicialización del cliente de Supabase
    ├── slots.js      # Generación de bloques de horario (RF-04)
    ├── api.js        # Capa de acceso a datos (Supabase o demo local)
    ├── app.js        # Lógica del módulo cliente
    └── admin.js      # Lógica del módulo administrador
```

## 🚀 Cómo ejecutar en local

1. Clona o descarga el repositorio.
2. Abre la carpeta en VS Code y arranca el servidor desde la terminal
   integrada (Ctrl+`):

   ```bash
   npm start
   ```

   (Equivalente a `python -m http.server 8080`; también puedes usar la
   extensión "Live Server" de VS Code.)

3. Abre `http://localhost:8080` en el navegador.

### Modo demostración (sin Supabase)

Mientras `js/config.js` tenga los valores `TU_...`, la app funciona en **modo
demostración**: barberos, horarios y citas se guardan en `localStorage` del
navegador. Así puedes probar todo el flujo (incluido el panel `/admin`)
antes de conectar la base de datos.

- Credenciales del panel en **modo demostración**: `tauros2026` (contraseña
  de front-end guardada en `js/config.js`; los datos viven solo en tu
  navegador). Con Supabase se usa la contraseña real, que **no está en el
  repositorio**.
- Para reiniciar los datos de demostración: DevTools → Application →
  Local Storage → elimina la clave `tauros_demo_v1`.

## 🔗 Conectar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Copia la **Project URL** y la **anon key** (Settings → API).
3. Pega ambos valores en `js/config.js` (reemplaza `TU_...`).
4. Crea las colecciones/tablas `barberos`, `horarios` y `citas` con los campos
   descritos en la sección 10 del documento de proyecto.
5. Recarga la página: el aviso de "modo demostración" desaparecerá.

## 🌐 Despliegue en Vercel

1. Sube el código a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo.
3. Framework preset: **Other** (no hay build). Deploy.
4. Opcional: si prefieres no editar `config.js` en el repo, configura las
   variables `SUPABASE_URL` / `SUPABASE_ANON_KEY` en Vercel y genera
   `config.js` en un pequeño paso de build.

## 🔑 Seguridad (RF-07, RNF-05 y sección 14)

- **Panel `/admin` con autenticación real (Supabase Auth):** el administrador
  inicia sesión con correo y contraseña validados **en el servidor**, no solo
  en la interfaz. El usuario se crea una sola vez en Supabase →
  Authentication → Add user: correo `admin@tauros.com`, con *Auto Confirm*
  activado (no hay registro público). **La contraseña nunca se escribe en el
  código ni en este archivo** (RNF-05): se gestiona desde el dashboard de
  Supabase.
- **Políticas RLS en tres niveles** (ver comentarios en `supabase/schema.sql`):
  1. **Lectura pública:** el cliente ve sillas/horarios/citas sin registrarse,
     tal como define el alcance del proyecto.
  2. **Reserva de clientes:** un visitante solo puede *insertar* citas y
     únicamente con estado `confirmada`; no puede editar ni borrar nada.
  3. **Escritura de administración:** crear/editar barberos, horarios o citas
     exige sesión iniciada; sin ella la API rechaza la operación. Así, tener
     la clave pública **no permite modificar ni borrar datos** y el Security
     Advisor de Supabase queda en 0 avisos (antes marcaba *RLS Policy Always
     True* por las políticas `USING (true)` en escritura).
- La clave anon de Supabase es pública por diseño; con estas políticas ser
  pública no compromete los datos (RNF-05: "evitar modificaciones no
  autorizadas").
- **Modo demostración** (sin Supabase): el panel usa una contraseña simple en
  el front-end — la "medida básica" que describe el documento.
- **Anti doble reserva:** la app realiza la doble verificación de la sección 12
  y, además, el índice `citas_slot_unico` la bloquea en la propia base de datos
  (la app traduce el error `23505` a un mensaje claro para el cliente).
- **Anti-acaparamiento sin cuentas de usuario:** la base de datos solo admite
  citas con hasta **14 días de antelación** y máximo **3 reservas futuras por
  mismo teléfono/contacto** (función `puede_reservar` + `WITH CHECK` en
  `supabase/schema.sql`; mismos valores en `js/config.js`). Un abusador no
  puede vaciar el calendario aunque use la API directamente, y el cliente
  nunca necesita crear cuenta.

## ✅ Requisitos cubiertos

**Cliente:** RF-01 visualización de sillas · RF-02 selección de silla ·
RF-03 elección de fecha · RF-04 horarios disponibles · RF-05 reserva ·
RF-06 confirmación.

**Administrador:** RF-07 acceso con clave · RF-08 registro de barberos ·
RF-09 listado de barberos · RF-10 gestión de horarios · RF-11 citas con
filtros · RF-12 cambio de estado de barbero.

**No funcionales:** RNF-01 usabilidad (agenda en 3 pasos) · RNF-02
responsividad · RNF-03 rendimiento (consultas simples) · RNF-06
mantenibilidad (archivos separados y comentados) · RNF-08 escalabilidad
(sillas/barberos dinámicos).

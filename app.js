/* ============================================================
   APLICACIÓN: menú, registros, pantallas de datos, configuración
   Los datos se guardan siempre en este navegador y, si la parroquia
   se conecta con Google, también en su Google Drive.
   ============================================================ */

const CONFIG_DEFECTO = {
  nombre: 'Parroquia de Ejemplo',
  direccion: 'c/ Mayor, 1',
  localidad: 'Villanueva',
  cp: '28000',
  provincia: 'Madrid',
  web: 'www.parroquiadeejemplo.es',
  diocesis: 'Madrid',
  nombreCorto: '',
  papa: 'León XIV',
  // Vicaría (para el Alegato V)
  diocesisTitulo: 'Arzobispado de Madrid', logoDiocesis: '',
  vicaria: '', vicario: '', vicarioCargo: 'Vicario Episcopal',
  vicariaCalle: '', vicariaNumero: '', vicariaCP: '', vicariaCiudad: '', vicariaEmail: '', vicariaTelefono: '',
  color: '#a8322d',
  logo: '', sello: '',
  firmas: [
    { nombre: 'Nombre del Párroco', cargo: 'Párroco', firma: '' },
    { nombre: 'Nombre de la Secretaria', cargo: 'secretaria', firma: '' },
  ],
};

const Almacen = {
  leer(clave, defecto) {
    try { const v = localStorage.getItem('certificados.' + clave); return v ? JSON.parse(v) : defecto; }
    catch (e) { return defecto; }
  },
  guardar(clave, valor) {
    try { localStorage.setItem('certificados.' + clave, JSON.stringify(valor)); return true; }
    catch (e) { return false; }
  }
};

const ahora = () => new Date().toISOString();
const nuevoId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nuevoRegistro = () => ({ id: nuevoId(), creado: ahora(), actualizado: ahora(), datos: {} });

const estado = {
  config: Object.assign(structuredClone(CONFIG_DEFECTO), Almacen.leer('config', {})),
  registros: Almacen.leer('registros', null),
  actualId: Almacen.leer('actual', null),
  fechaDocumento: hoyISO(),
  vista: 'menu',
  certId: null,
  descargas: null,
  firma: null,      // índice del firmante elegido; al abrir la aplicación no hay ninguno
  pestanaExp: 'datos', parteExp: 'portada', volverA: null, abiertos: {},
};
// Migración desde la primera versión (un único registro)
if (!Array.isArray(estado.registros)) {
  const viejo = Almacen.leer('registro', null);
  const r = nuevoRegistro(); if (viejo) r.datos = viejo;
  estado.registros = [r];
}
if (!estado.registros.length) estado.registros.push(nuevoRegistro());
if (!estado.registros.find(r => r.id === estado.actualId)) estado.actualId = estado.registros[estado.registros.length - 1].id;

const actual = () => estado.registros.find(r => r.id === estado.actualId);
Object.defineProperty(estado, 'registro', { get: () => actual().datos });

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const sinAcentos = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function aviso(msg, ms = 3600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(aviso._t); aviso._t = setTimeout(() => t.classList.remove('on'), ms);
}
function confirmar(msg, si = 'Sí', no = 'Cancelar') {
  return new Promise(res => {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="caja"><p>${esc(msg)}</p><div class="fila" style="justify-content:flex-end"><button class="btn" data-r="0">${esc(no)}</button><button class="btn prim" data-r="1">${esc(si)}</button></div></div>`;
    m.addEventListener('click', e => { const r = e.target.dataset.r; if (r !== undefined) { m.remove(); res(r === '1'); } });
    document.body.appendChild(m);
  });
}

/* Cuando un mismo dato ha cambiado aquí y en Google Drive, se pregunta cuál se queda */
function fechaHora(iso) {
  const d = new Date(iso);
  return iso && !isNaN(d) ? d.toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'fecha desconocida';
}
function elegirConflictos(lista) {
  return new Promise(res => {
    const elegido = {};
    const m = document.createElement('div');
    m.className = 'modal conflictos';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    const fila = c => `<li data-id="${esc(c.id)}">
        <div class="cf-titulo">${esc(c.titulo)}${c.tipo === 'config' ? '' : '<span>Registro</span>'}</div>
        <div class="cf-opciones">
          <button type="button" class="cf-op" data-elige="aqui"><strong>Este ordenador</strong><span>Modificado: ${esc(fechaHora(c.aqui))}</span></button>
          <button type="button" class="cf-op" data-elige="drive"><strong>Google Drive</strong><span>Modificado: ${esc(fechaHora(c.drive))}</span></button>
        </div>
      </li>`;
    m.innerHTML = `<div class="caja">
      <h3>Datos distintos aquí y en Google Drive</h3>
      <p>${lista.length === 1 ? 'Este dato se ha cambiado' : 'Estos datos se han cambiado'} en este ordenador y también en Google Drive (desde otro ordenador) desde la última vez que se sincronizaron. Elige qué versión se queda en cada caso; la otra se descartará.</p>
      <ul class="cf-lista">${lista.map(fila).join('')}</ul>
      ${lista.length > 1 ? `<div class="fila cf-todos"><button type="button" class="btn" data-todos="aqui">Todo de este ordenador</button><button type="button" class="btn" data-todos="drive">Todo de Google Drive</button></div>` : ''}
      <div class="fila" style="justify-content:flex-end"><button type="button" class="btn prim" data-aceptar disabled>Aceptar</button></div>
    </div>`;
    const pintar = () => {
      m.querySelectorAll('.cf-lista li').forEach(li => li.querySelectorAll('.cf-op').forEach(b => b.classList.toggle('on', elegido[li.dataset.id] === b.dataset.elige)));
      m.querySelector('[data-aceptar]').disabled = lista.some(c => !elegido[c.id]);
    };
    m.addEventListener('click', e => {
      const op = e.target.closest('.cf-op'), todos = e.target.closest('[data-todos]');
      if (op) { elegido[op.closest('li').dataset.id] = op.dataset.elige; pintar(); }
      else if (todos) { lista.forEach(c => { elegido[c.id] = todos.dataset.todos; }); pintar(); }
      else if (e.target.closest('[data-aceptar]') && !lista.some(c => !elegido[c.id])) { m.remove(); res(elegido); }
    });
    document.body.appendChild(m);
  });
}

/* ---------------- GUARDAR ---------------- */
const NO_CUENTAN = /^(sexo|sexo_manual|motivo_bendicion|conyuge|documentos|diligencia|feligres)$|_res_\d+$/;
const tieneDatos = r => Object.entries(r.datos).some(([k, v]) => !NO_CUENTAN.test(k) && v && String(v).trim());
const registrosGuardables = () => estado.registros.filter(r => tieneDatos(r) || r.id === estado.actualId);
// Huella de los datos de la parroquia y firmantes (sin tareas ni eliminados): si cambia, se apunta la fecha
function huellaConfig(c) { const { tareas, eliminados, modificado, ...resto } = c || {}; return JSON.stringify(resto); }
let _huellaConfig = null;
function guardarConfig() {
  const h = huellaConfig(estado.config);
  if (_huellaConfig === null) _huellaConfig = huellaConfig(Almacen.leer('config', {}));
  if (h !== _huellaConfig) estado.config.modificado = ahora();
  _huellaConfig = h;
  if (!Almacen.guardar('config', estado.config)) aviso('No se pudo guardar en este navegador (imágenes demasiado grandes).');
  Google.cambiado('config');
}
function guardarRegistro() {
  actual().actualizado = ahora();
  Almacen.guardar('registros', registrosGuardables());
  Almacen.guardar('actual', estado.actualId);
  Google.cambiado('registros');
}
function firmante() { return estado.firma == null ? {} : (estado.config.firmas[estado.firma] || {}); }
const sinFirma = () => estado.firma == null || !estado.config.firmas[estado.firma];

// Lo que ve Google: datos para subir y cómo aplicar lo que baja
Google.usarProveedor({
  obtenerDatos: () => ({ config: estado.config, registros: estado.registros.filter(tieneDatos) }),
  tituloRegistro: r => tituloRegistro(r),
  // Un ordenador que nunca ha tocado los datos de la parroquia no compite con los de Drive
  configSinTocar: c => !c.modificado && huellaConfig(c) === huellaConfig(Object.assign(structuredClone(CONFIG_DEFECTO), { eliminados: c.eliminados, tareas: c.tareas })),
  resolverConflictos: lista => elegirConflictos(lista),
  aplicarDatos: (config, registros) => {
    // los registros eliminados en cualquier ordenador no vuelven
    const eliminados = [...new Set([...(estado.config.eliminados || []), ...(config.eliminados || [])])];
    const tareas = unirTareas(estado.config.tareas, config.tareas);
    const firmaTareas = l => JSON.stringify((l || []).map(t => t.id + t.actualizado).sort());
    const faltabanEnDrive = eliminados.length > (config.eliminados || []).length || firmaTareas(tareas) !== firmaTareas(config.tareas);
    estado.config = Object.assign(structuredClone(CONFIG_DEFECTO), config, { eliminados, tareas });
    _huellaConfig = huellaConfig(estado.config);
    registros = registros.filter(r => !eliminados.includes(r.id));
    const vacio = actual() && !tieneDatos(actual()) ? actual() : null;
    estado.registros = registros.length ? registros : [nuevoRegistro()];
    if (vacio && !estado.registros.find(r => r.id === vacio.id)) estado.registros.push(vacio);
    if (!estado.registros.find(r => r.id === estado.actualId)) estado.actualId = estado.registros[estado.registros.length - 1].id;
    Almacen.guardar('config', estado.config);
    Almacen.guardar('registros', registrosGuardables());
    const escribiendo = document.activeElement?.dataset?.k || document.activeElement?.dataset?.tarea || ['tareaNueva', 'callejeroQ', 'callejeroMun'].includes(document.activeElement?.id);
    // En «Datos de la parroquia» y «Firmantes» no se redibuja: si se acaba de elegir una imagen
    // (sello, logo, firma) el campo de archivo tiene que seguir siendo el mismo para recibirla.
    const editandoConfig = estado.vista === 'parroquia' || estado.vista === 'firmantes';
    if (!escribiendo && !editandoConfig) render();
    else if (estado.vista === 'menu' && !document.activeElement?.dataset?.tarea) pintarTareas();
    return { registros: estado.registros.filter(tieneDatos), configPendiente: faltabanEnDrive };
  }
});

/* ---------------- REGISTROS ---------------- */
function tituloRegistro(r) {
  const d = r.datos, j = (a, b) => [a, b].filter(x => x && x.trim()).join(' ').trim();
  const persona = j(d.nombre, d.apellidos);
  const novios = [j(d.novio_nombre, d.novio_apellidos), j(d.novia_nombre, d.novia_apellidos)].filter(Boolean).join(' y ');
  return persona || novios || '(registro vacío)';
}
function posicion() {
  const lista = estado.registros;
  return { i: lista.findIndex(r => r.id === estado.actualId), n: lista.length };
}
function irARegistro(id) { estado.actualId = id; Almacen.guardar('actual', id); render(); }
function crearRegistro() {
  if (!tieneDatos(actual())) { aviso('Ya estás en un registro vacío.'); return; }
  const r = nuevoRegistro();
  estado.registros.push(r);
  estado.actualId = r.id;
  Almacen.guardar('registros', registrosGuardables()); Almacen.guardar('actual', r.id);
  render(); aviso('Registro nuevo.');
}
async function eliminarRegistro() {
  const r = actual();
  if (!tieneDatos(r)) { aviso('Este registro está vacío: no hay nada que eliminar.'); return; }
  if (!await confirmar(`¿Eliminar el registro de ${tituloRegistro(r)}? Se borrará también de Google Drive y no se puede deshacer.`, 'Eliminar')) return;
  const i = estado.registros.findIndex(x => x.id === r.id);
  estado.config.eliminados = [...(estado.config.eliminados || []), r.id];
  estado.registros.splice(i, 1);
  const quedan = estado.registros.filter(tieneDatos);
  if (!quedan.length) estado.registros = [nuevoRegistro()];
  estado.actualId = (estado.registros[Math.min(i, estado.registros.length - 1)] || estado.registros[0]).id;
  guardarConfig();
  Almacen.guardar('registros', registrosGuardables()); Almacen.guardar('actual', estado.actualId);
  Google.cambiado('registros');
  render(); aviso('Registro eliminado.');
}
function personasRegistro(r) {
  const d = r.datos, j = (a, b) => [a, b].filter(x => x && String(x).trim()).join(' ').trim();
  const bloques = [];
  const persona = j(d.nombre, d.apellidos);
  if (persona) bloques.push({ lineas: [persona], etiqueta: 'Nombre y apellidos' });
  const novio = j(d.novio_nombre, d.novio_apellidos), novia = j(d.novia_nombre, d.novia_apellidos);
  if (novio || novia) bloques.push({ lineas: [novio || '—', novia || '—'], etiqueta: 'Novio y novia (matrimonio)' });
  return bloques;
}
function moverRegistro(paso) {
  // los registros vacíos que no son el actual no cuentan
  estado.registros = estado.registros.filter(r => tieneDatos(r) || r.id === estado.actualId);
  const { i, n } = posicion();
  const j = i + paso;
  if (j < 0 || j >= n) { aviso(paso < 0 ? 'Es el primer registro.' : 'Es el último registro.'); return; }
  irARegistro(estado.registros[j].id);
}
function resumenRegistro(r) {
  const d = r.datos, partes = [];
  if (d.f_bau) partes.push('Bautismo ' + H.fecha(d.f_bau));
  if (d.f_conf) partes.push('Confirmación ' + H.fecha(d.f_conf));
  if (d.f_mat) partes.push('Matrimonio ' + H.fecha(d.f_mat));
  if (d.f_nac && !partes.length) partes.push('Nacimiento ' + H.fecha(d.f_nac));
  return partes.join(' · ');
}
function abrirBusqueda() {
  const m = document.createElement('div');
  m.className = 'modal'; m.id = 'busqueda';
  m.innerHTML = `<div class="caja ancha">
    <div class="fila" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">Buscar registro</h3><button class="btn" data-cerrar>Cerrar</button></div>
    <input type="text" id="textoBusqueda" placeholder="Escribe nombres o apellidos (novio, novia, padres…)" autocomplete="off">
    <div class="resultados" id="resultados"></div></div>`;
  m.addEventListener('click', e => {
    if (e.target === m || e.target.closest('[data-cerrar]')) m.remove();
    const r = e.target.closest('[data-ir-registro]');
    if (r) { m.remove(); irARegistro(r.dataset.irRegistro); }
  });
  document.body.appendChild(m);
  const pintar = () => {
    const palabras = sinAcentos($('#textoBusqueda').value).split(/\s+/).filter(Boolean);
    const lista = estado.registros.filter(tieneDatos).filter(r => {
      const texto = sinAcentos(Object.values(r.datos).join(' '));
      return palabras.every(p => texto.includes(p));
    }).slice().reverse();
    $('#resultados').innerHTML = lista.length ? lista.slice(0, 60).map(r =>
      `<button class="resultado ${r.id === estado.actualId ? 'on' : ''}" data-ir-registro="${r.id}"><strong>${esc(tituloRegistro(r))}</strong><span>${esc(resumenRegistro(r))}</span></button>`).join('')
      : `<p class="nota">${palabras.length ? 'No hay ningún registro que coincida.' : 'Todavía no hay registros guardados.'}</p>`;
  };
  $('#textoBusqueda').addEventListener('input', pintar);
  pintar(); $('#textoBusqueda').focus();
}

/* ---------------- ICONOS ---------------- */
const ICONOS = {
  catequesis: `<svg viewBox="0 0 48 48"><circle cx="24" cy="9" r="5" fill="#f3ead2"/><path d="M12 17h24c0 8-5 13-12 13S12 25 12 17z" fill="#c9a65a"/><rect x="22" y="30" width="4" height="8" fill="#c9a65a"/><path d="M15 42c0-3 4-4 9-4s9 1 9 4z" fill="#c9a65a"/><path d="M24 19v8M21 22h6" stroke="#7a4f12" stroke-width="1.6"/></svg>`,
  bautismo: `<svg viewBox="0 0 48 48"><path d="M24 40C12 40 6 30 8 20c6-1 11-8 16-12 5 4 10 11 16 12 2 10-4 20-16 20z" fill="#efe2c4"/><path d="M24 12v26M17 16l4 22M31 16l-4 22M11 22l9 16M37 22l-9 16" stroke="#c9a65a" stroke-width="1.2" fill="none"/><path d="M24 20v8M21 23h6" stroke="#7a4f12" stroke-width="1.8"/></svg>`,
  matrimonio: `<svg viewBox="0 0 48 48"><path d="M24 42S6 31 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 13-18 24-18 24z" fill="#efe2c4"/><circle cx="20" cy="24" r="6.5" fill="none" stroke="#c9a65a" stroke-width="3"/><circle cx="28" cy="24" r="6.5" fill="none" stroke="#e0b84e" stroke-width="3"/></svg>`,
  confirmacion: `<svg viewBox="0 0 48 48"> <g stroke="#c9a65a" stroke-width="1.2" stroke-linecap="round" opacity=".85"> <path d="M17 34l-4 7M23 35l-1 8M29 34l2 7M35 31l5 6"/> </g> <path d="M22.5 23C21 17 18.5 12.5 15 9c4.5 2 8 6 9.8 12.5z" fill="#d9c7a0"/> <path d="M7.6 20.2c0-3.1 2.4-5.2 5.2-4.9 3 .3 4.6 2.6 6.4 5 3.3 3.6 11.6 3.6 17.6-.4l9-5.2-3.3 6 4.3.6-7.6 3.6c-5.6 5.4-15.2 7.6-21.6 5.2-5.3-2-9.5-5.2-10-9.9z" fill="#fbf6e8"/> <path d="M21 21.5c2-6.5 6.5-13 14.5-18.5-.6 3.2-2 5.4-3.2 6.8 2.8-.9 5.6-1.9 8.4-3.6-1.6 3.6-4.2 6-6.6 7.4 2.2 0 4.4-.3 6.4-1.2-2.8 4.8-7.6 8.2-13.6 10.2z" fill="#f3ead2"/> <g stroke="#c9a65a" stroke-width=".55" fill="none" opacity=".7"> <path d="M24.5 19c2-3.5 5-7 8.5-9.5M26.5 21c2.6-2.4 6-4.6 9.5-6"/> </g> <path d="M7.9 18.8L3.6 20.3l4.4 1.1z" fill="#c9a65a"/> <circle cx="10.6" cy="18.6" r=".85" fill="#1f2f5c"/> </svg>`,
};
const IC = {
  menu: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  nuevo: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M12 11v6M9 14h6"/></svg>',
  pdf: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M12 10v7M9 14l3 3 3-3"/></svg>',
  pluma: '<svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M14 4l4 4-9 9H5v-4z"/></svg>',
  imprimir: '<svg viewBox="0 0 24 24"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
  guardar: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  buscar: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>',
  ant: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  sig: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  papelera: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
};

/* ---------------- INDICADOR DE GOOGLE DRIVE ---------------- */
function chipDrive() {
  const g = Google.estado();
  if (!g.configurado) return `<span class="chip" title="Falta el ID de cliente de Google en config.js">☁ Drive sin configurar</span>`;
  if (!g.disponible && !g.usuario && g.estado !== 'conectando') return `<span class="chip" title="El inicio de sesión de Google no carga en esta página">☁ Drive no disponible aquí</span>`;
  if (g.estado === 'desconectado') return `<button class="chip accion" data-google="conectar">☁ Conectar con Google Drive</button>`;
  if (g.estado === 'conectando') return `<span class="chip">☁ Conectando…</span>`;
  if (g.estado === 'caducado') return `<button class="chip aviso" data-google="reconectar" title="${esc(g.mensaje)}">☁ Reconectar Drive</button>`;
  if (g.estado === 'error') return `<button class="chip aviso" data-google="${g.usuario ? 'reconectar' : 'conectar'}" title="${esc(g.mensaje)}">☁ ${esc(g.mensaje).slice(0, 60)} · Reintentar</button>`;
  const txt = g.estado === 'guardando' ? 'Guardando…' : 'Guardado';
  return `<button class="chip ok" data-google="menu" title="${esc(g.usuario?.email || '')}">☁ ${txt} · ${esc(g.usuario?.email || '')}</button>`;
}
function pintarChip() { document.querySelectorAll('[data-chip]').forEach(el => { el.innerHTML = chipDrive(); }); }
Google.suscribir(pintarChip);

function menuDrive() {
  const m = document.createElement('div');
  m.className = 'modal';
  const g = Google.estado();
  m.innerHTML = `<div class="caja"><h3 style="margin-top:0">Google Drive</h3>
    <p>Conectado como <strong>${esc(g.usuario?.email)}</strong>. Los registros y la configuración se guardan solos en la carpeta «Certificados parroquiales» de este Drive.</p>
    <div class="fila" style="flex-direction:column;align-items:stretch">
      <a class="btn" href="${Google.urlHoja()}" target="_blank" rel="noopener">Abrir la hoja de registros</a>
      <a class="btn" href="${Google.urlCarpeta()}" target="_blank" rel="noopener">Abrir la carpeta en Drive</a>
      <button class="btn" data-google="desconectar">Desconectar esta cuenta</button>
      <button class="btn prim" data-cerrar>Cerrar</button>
    </div></div>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-cerrar]') || e.target.closest('[data-google]')) m.remove(); });
  document.body.appendChild(m);
}

/* ---------------- CABECERA CON EL NOMBRE Y LOGO DE LA PARROQUIA ---------------- */
function cabecera(titulo, derecha = '', portada = false) {
  const c = estado.config;
  const logo = c.logo ? `<span class="logo"><img src="${c.logo}" alt=""></span>` : '';
  return `<header class="barra ${portada ? 'portada' : ''}">
    <div class="marca"><button class="marca-inicio" data-ir="menu" title="Volver a la pantalla de inicio">${logo}<span class="parroquia">${esc(c.nombre || '')}</span></button><h1>${titulo}</h1></div>
    <div class="cab-der"><div class="tamano" role="group" aria-label="Tamaño de letra"><button class="menos" data-tam="-1" title="Letra más pequeña" aria-label="Letra más pequeña">A</button><button class="mas" data-tam="1" title="Letra más grande" aria-label="Letra más grande">A</button></div><span data-chip>${chipDrive()}</span>${derecha}</div>
  </header>`;
}

/* ---------------- RENDER GENERAL ---------------- */
function render() {
  const app = $('#app');
  if (estado.vista === 'menu') app.innerHTML = vistaMenu();
  else if (estado.vista === 'parroquia') app.innerHTML = vistaParroquia();
  else if (estado.vista === 'firmantes') app.innerHTML = vistaFirmantes();
  else app.innerHTML = vistaFormulario();
  if (estado.vista === 'form') actualizarPrevia();
  if (estado.vista === 'menu') { ajustarTareas(); if (typeof Callejero !== 'undefined') Callejero.montar(); }
  if (estado.vista !== 'menu') setTimeout(irAlPrimerVacio, 0);
}
function irA(vista) { estado.vista = vista; render(); window.scrollTo(0, 0); }

/* ---------------- MENÚ PRINCIPAL ---------------- */
function vistaMenu() {
  const cfg = estado.config;
  const bloq = sinFirma() ? 'disabled' : '';
  const opcFirmas = (sinFirma() ? '<option value="" selected disabled>Elige quién firma…</option>' : '') +
    cfg.firmas.map((f, i) => `<option value="${i}" ${i === estado.firma ? 'selected' : ''}>${esc(f.nombre)} — ${esc(f.cargo)}</option>`).join('');
  const grupos = GRUPOS.map(g => {
    const botones = CERTIFICADOS.filter(c => c.grupo === g.id).map(c =>
      `<button class="cert ${c.estado === 'pendiente' ? 'pend' : ''}" data-abrir="${c.id}" ${bloq}>${c.estado === 'pendiente' ? '<span class="pill">pendiente</span>' : ''}${esc(c.nombre)}</button>`).join('');
    return `<div class="grupo"><div><div class="icono">${ICONOS[g.id]}</div><div class="etq">${g.nombre}</div></div><div class="botones">${botones}</div></div>`;
  }).join('');
  const r = actual(), { i, n } = posicion();
  const total = estado.registros.filter(tieneDatos).length;
  const bloques = personasRegistro(r);
  return `
  ${cabecera('Certificados', '<button class="btn-cab" data-ir="parroquia">⚙ Datos de la parroquia</button>', true)}
  <main>
    <div class="menu-top">
      <div class="tarjeta ${sinFirma() ? 'pide-firma' : ''}">
        <h3>Firma</h3>
        <div class="fila"><select id="selFirma">${opcFirmas}</select><button class="btn" data-ir="firmantes">Firmantes</button></div>
        <p class="nota">${sinFirma() ? '<strong>Elige quién firma para empezar.</strong> Hasta entonces los certificados y los registros están bloqueados.' : 'Quien firma los certificados. Se puede cambiar también en cada pantalla.'}</p>
      </div>
      <div class="tarjeta">
        <div class="cab-registros"><h3>Registros</h3><span class="contador">${tieneDatos(r) ? `Registro ${i + 1} de ${n}` : 'Registro nuevo'} · ${total} guardado${total === 1 ? '' : 's'}</span></div>
        <div class="registro-actual">${bloques.length ? bloques.map(b => `
          <div class="bloque">${b.lineas.map(l => `<strong>${esc(l)}</strong>`).join('')}<span>${esc(b.etiqueta)}</span></div>`).join('')
          : '<div class="bloque"><strong class="vacio">Registro vacío</strong><span>Rellena cualquier certificado para empezar</span></div>'}
        </div>
        <div class="botonera">
          <button class="btn prim" data-registro="nuevo" ${bloq}>${IC.nuevo}Nuevo</button>
          <button class="btn" data-registro="buscar" ${bloq}>${IC.buscar}Buscar</button>
          <button class="btn" data-registro="anterior" ${bloq} title="Registro anterior">${IC.ant}Anterior</button>
          <button class="btn" data-registro="siguiente" ${bloq} title="Registro siguiente">Siguiente${IC.sig}</button>
          <button class="btn peligro" data-registro="eliminar" ${bloq} title="Eliminar este registro">${IC.papelera}Eliminar</button>
        </div>
      </div>
    </div>
    <div class="menu-cuerpo">
      <div class="tarjeta">${grupos}
        <div class="leyenda"><span>Modelo listo</span><span class="p">Falta el modelo (PDF de ejemplo)</span></div>
      </div>
      <div class="columna-derecha">
        ${callejeroHTML()}
        ${tareasHTML()}
      </div>
    </div>
  </main>`;
}

/* ---------------- BUSCADOR DE PARROQUIAS (callejero.js) ---------------- */
function callejeroHTML() {
  return `<section class="tarjeta callejero">
    <h3>Buscar parroquia</h3>
    <p class="nota">Escribe la dirección (calle, número y, si lo sabes, municipio) y te digo a qué parroquia pertenece.</p>
    <div class="cj-busca">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input id="callejeroQ" type="search" autocomplete="off" spellcheck="false" placeholder="P. ej. Alcalá 120" aria-label="Dirección" role="combobox" aria-autocomplete="list" aria-controls="callejeroSug" aria-expanded="false">
      <button id="callejeroX" type="button" aria-label="Borrar" hidden>✕</button>
      <ul id="callejeroSug" role="listbox" hidden></ul>
    </div>
    <select id="callejeroMun" aria-label="Municipio"><option value="">Todos los municipios</option></select>
    <div id="callejeroEstado" class="nota" aria-live="polite"></div>
    <div id="callejeroOut"></div>
    <p class="nota cj-pie">Callejero parroquial de la Archidiócesis de Madrid. Ante cualquier duda, confirmar con la parroquia o la vicaría.</p>
  </section>`;
}

/* ---------------- TAREAS PENDIENTES (compartidas por la parroquia vía Drive) ---------------- */
const tareasVivas = () => (estado.config.tareas || []).filter(t => !t.borrada);
function tareasHTML() {
  const lista = tareasVivas().sort((a, b) => (a.hecha - b.hecha) || (a.hecha ? b.actualizado.localeCompare(a.actualizado) : a.creada.localeCompare(b.creada)));
  const pend = lista.filter(t => !t.hecha).length, hechas = lista.length - pend;
  const fecha = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }); };
  const item = t => `<li class="tarea ${t.hecha ? 'hecha' : ''}">
      <input type="checkbox" data-tarea-hecha="${t.id}" ${t.hecha ? 'checked' : ''} aria-label="Hecha">
      <div class="tarea-cuerpo">
        <textarea rows="1" class="tarea-texto" data-tarea="${t.id}" aria-label="Tarea">${esc(t.texto)}</textarea>
        <span class="tarea-meta">${esc([t.autor, fecha(t.actualizado)].filter(Boolean).join(' · '))}</span>
      </div>
      <button class="tarea-borrar" data-tarea-borrar="${t.id}" title="Eliminar tarea" aria-label="Eliminar tarea">${IC.papelera}</button>
    </li>`;
  return `<aside class="tarjeta tareas">
    <div class="cab-registros"><h3>Tareas pendientes</h3><span class="contador">${pend ? pend + ' pendiente' + (pend === 1 ? '' : 's') : 'Nada pendiente'}</span></div>
    <form class="tarea-nueva" data-tarea-form>
      <input type="text" id="tareaNueva" placeholder="Nueva tarea…" autocomplete="off" maxlength="300">
      <button class="btn prim" type="submit" title="Añadir tarea">${IC.nuevo}Añadir</button>
    </form>
    <ul class="lista-tareas">${lista.map(item).join('') || '<li class="nota tarea-vacia">No hay tareas. Escribe una arriba y pulsa Añadir.</li>'}</ul>
    ${hechas ? `<button class="btn enlace" data-tareas-limpiar>Quitar las ${hechas} hecha${hechas === 1 ? '' : 's'}</button>` : ''}
    <p class="nota">Las ve cualquiera que use esta parroquia con su cuenta de Google.</p>
  </aside>`;
}
function autorTarea() {
  const u = Google.estado().usuario;
  return u ? (u.nombre || u.name || u.email || '').split(' ')[0] : '';
}
function cambiarTarea(id, cambios) {
  const t = (estado.config.tareas || []).find(x => x.id === id); if (!t) return;
  Object.assign(t, cambios, { actualizado: ahora() });
  guardarConfig();
}
function pintarTareas() {
  const v = document.querySelector('aside.tareas'); if (!v) return;
  const foco = document.activeElement && document.activeElement.id === 'tareaNueva';
  v.outerHTML = tareasHTML();
  ajustarTareas();
  if (foco) $('#tareaNueva').focus();
}
function ajustarTareas() {
  document.querySelectorAll('.tarea-texto').forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; });
}
// Une las tareas de este ordenador con las de Drive: por tarea, gana el cambio más reciente
function unirTareas(a = [], b = []) {
  const m = new Map();
  [...a, ...b].forEach(t => { const x = m.get(t.id); if (!x || (t.actualizado || '') > (x.actualizado || '')) m.set(t.id, t); });
  const mes = Date.now() - 60 * 86400000; // los borrados se recuerdan dos meses
  return [...m.values()].filter(t => !t.borrada || new Date(t.actualizado).getTime() > mes);
}

/* ---------------- PANTALLA DE DATOS ---------------- */
/* Límite de caracteres de cada dato que va sobre una línea de puntos del expediente.
   Se calcula con el largo de la línea a 9 pt (Helvetica: 0,46 del tamaño por carácter de media). */
let _limites = null;
function limites() {
  if (_limites || typeof EXPEDIENTE === 'undefined') return _limites || {};
  const POR_CARACTER = 0.46 * 9;
  const cabe = (x, x1, lineas = 1) => Math.floor((x1 - x) * lineas * (lineas > 1 ? 0.93 : 1) / POR_CARACTER);
  const m = {};
  const pref = { novio: 'novio_ex_', novia: 'novia_ex_', t1: 't1_', t2: 't2_' };
  Object.entries(EXPEDIENTE.examen).forEach(([q, campos]) => Object.entries(campos).forEach(([k, p]) => {
    if (k === 'firma' || k === 'juramento') return;
    m[pref[q] + k] = cabe(p[1], p[3] || 548, p[4] || 1);
  }));
  Object.entries(EXPEDIENTE.datos).forEach(([k, [izq, der]]) => {
    if (/^f_/.test(k)) return;
    if (k === 'padre' || k === 'madre') {
      // nombre y apellidos van en la misma línea: el límite es conjunto
      ['novio', 'novia'].forEach((l, j) => {
        const pos = j ? der : izq, cap = cabe(pos[0], pos[2] || (j ? 548 : 300));
        m[`${l}_${k}_nombre`] = m[`${l}_${k}_apellidos`] = { cap, par: [`${l}_${k}_nombre`, `${l}_${k}_apellidos`] };
      });
      return;
    }
    m['novio_' + k] = cabe(izq[0], izq[2] || 300, izq[3] || 1);
    m['novia_' + k] = cabe(der[0], der[2] || 548, der[3] || 1);
  });
  Object.assign(m, {
    parroquia_boda: cabe(74, 548) - 12, domicilio_boda: cabe(74, 548), num_expediente: cabe(400, 487),
    proclamas_parroquias: cabe(68, 548), dispensa_motivo: cabe(408, 548) + cabe(68, 548),
    otra_parroquia: cabe(364, 548, 2), motivo_otra_parroquia: cabe(257, 548),
  });
  return (_limites = m);
}
// Límite y caracteres usados de un campo (los que comparten línea cuentan juntos, con el espacio entre ellos)
function cuentaDe(k) {
  const l = limites()[k];
  if (!l) return null;
  if (typeof l === 'number') { const n = String(estado.registro[k] ?? '').length; return { usado: n, cap: l, max: l }; }
  const [a, b] = l.par.map(x => String(estado.registro[x] ?? '').trim().length);
  const usado = a + b + (a && b ? 1 : 0), propio = k === l.par[0] ? a : b;
  return { usado, cap: l.cap, max: Math.max(propio, l.cap - (usado - propio) - (usado - propio ? 1 : 0)), par: l.par };
}
function contadorHTML(k) {
  const c = cuentaDe(k);
  return c ? `<span class="contador-c ${c.usado >= c.cap ? 'lleno' : ''}" data-cuenta="${k}">${c.usado}/${c.cap}</span>` : '';
}
function refrescarContador(k) {
  const c = cuentaDe(k); if (!c) return;
  (c.par || [k]).forEach(x => {
    const cx = cuentaDe(x), span = document.querySelector(`[data-cuenta="${x}"]`), el = document.getElementById('c_' + x);
    if (span) { span.textContent = `${cx.usado}/${cx.cap}`; span.classList.toggle('lleno', cx.usado >= cx.cap); }
    if (el) el.maxLength = cx.max;
  });
}

function campoHTML(c) {
  const v = estado.registro[c.k] ?? '';
  const id = 'c_' + c.k;
  let ctl;
  if (c.tipo === 'sexo') {
    const s = v || 'M';
    ctl = `<div class="sexo" data-sexo><button type="button" data-v="M" class="${s === 'M' ? 'on' : ''}">Varón</button><button type="button" data-v="F" class="${s === 'F' ? 'on' : ''}">Mujer</button></div>`;
  } else if (c.tipo === 'textarea') ctl = `<textarea id="${id}" data-k="${c.k}" rows="3" ${cuentaDe(c.k) ? `maxlength="${cuentaDe(c.k).max}"` : ''}>${esc(v)}</textarea>`;
  else if (c.tipo === 'select') ctl = `<select id="${id}" data-k="${c.k}">${c.opciones.map((o, i) => `<option ${o === v || (!v && i === 0) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else ctl = `<input id="${id}" data-k="${c.k}" type="${c.tipo || 'text'}" value="${esc(v)}" placeholder="${esc(c.ph || '')}" autocomplete="off" ${cuentaDe(c.k) && (!c.tipo || c.tipo === 'text' || c.tipo === 'tel') ? `maxlength="${cuentaDe(c.k).max}"` : ''}>`;
  const estilo = `grid-column:${c.nueva ? '1 / ' : ''}span ${c.w || 6}`;
  const cuenta = c.tipo === 'date' || c.tipo === 'select' || c.tipo === 'sexo' ? '' : contadorHTML(c.k);
  return `${c.sep ? '<hr class="sep">' : ''}<div class="campo${cuenta ? ' con-contador' : ''}" style="${estilo}"><label for="${id}">${esc(c.label)}</label>${ctl}${cuenta}</div>`;
}

function vistaFormulario() {
  const cert = CERTIFICADOS.find(c => c.id === estado.certId);
  if (cert.formato === 'expediente') return vistaExpediente(cert);
  const listo = cert.estado === 'listo';
  const cfg = estado.config;
  const opcFirmas = cfg.firmas.map((f, i) => `<option value="${i}" ${i === estado.firma ? 'selected' : ''}>${esc(f.nombre)} — ${esc(f.cargo)}</option>`).join('');
  cert.campos.forEach(c => { if (c.tipo === 'select' && !estado.registro[c.k]) estado.registro[c.k] = c.opciones[0]; });
  cert.campos.forEach(c => { if (c.defecto && estado.registro[c.k] === undefined) estado.registro[c.k] = c.defecto(); });
  let campos = cert.campos.length ? cert.campos.map(campoHTML).join('')
    : '<p class="nota" style="grid-column:1/-1">Esta pantalla todavía no está hecha. Cuando me pases la captura y un PDF de ejemplo, la monto.</p>';
  if (cert.camposLado) {
    const porClave = Object.fromEntries(CAMPOS_PAREJA.map(f => [f.k, f]));
    campos = cert.camposLado.map(k => campoHTML({ ...porClave[k], k: `${cert.lado}_${k}`, sep: false, nueva: false })).join('') + campos;
  }
  if (cert.camposPareja) {
    const d = estado.registro;
    // si solo se escribieron los apellidos juntos en otro certificado, se aprovechan
    ['novio', 'novia'].forEach(l => { if (!d[l + '_apellido1'] && !d[l + '_apellido2'] && d[l + '_apellidos']) d[l + '_apellido1'] = d[l + '_apellidos']; });
    const columna = (lado, titulo) => `<div class="columna-pareja"><h4>${titulo}</h4><div class="rejilla">${
      cert.camposPareja.map(f => campoHTML({ ...f, k: f.clave ? f.clave(lado) : `${lado}_${f.k}` })).join('')}</div></div>`;
    campos = `<div class="pareja">${columna('novio', 'El contrayente')}${columna('novia', 'La contrayente')}</div>` + campos;
  }

  return `
  ${cabecera(esc(cert.titulo))}
  <main>
    <div class="form-layout">
      <div class="tarjeta">
        <div class="rejilla">
          <div class="campo" style="grid-column:span 6"><label for="selFirma">Firma</label><select id="selFirma">${opcFirmas}</select></div>
          <div class="campo" style="grid-column:span 3"><label for="fechaDoc">Fecha del documento</label><input type="date" id="fechaDoc" value="${estado.fechaDocumento}"></div>
          <hr class="sep">
          ${campos}
        </div>
      </div>
      <div class="lateral">
        <button class="acc" data-ir="menu">${IC.menu}Menú principal</button>
        ${estado.volverA === 'expediente' && cert.id !== 'expediente' ? `<button class="acc" data-abrir="expediente">${IC.ant}Volver al expediente</button>` : ''}
        <button class="acc" data-registro="nuevo">${IC.nuevo}Nuevo registro</button>
        <button class="miniatura" id="previa" title="Pulsa para ampliar" ${listo ? '' : 'disabled'}></button>
        <div class="grupo-acc"><span>${IC.imprimir}Imprimir</span>
          <button class="acc" data-imprimir="1" ${listo ? '' : 'disabled'}>${IC.pluma}<span>Con firma<small>Con sello y firma escaneada</small></span></button>
          <button class="acc" data-imprimir="0" ${listo ? '' : 'disabled'}>${IC.pdf.replace('M12 10v7M9 14l3 3 3-3', 'M9 12h6M9 16h6')}<span>Sin firma<small>Para firmar a mano</small></span></button>
        </div>
        <div class="grupo-acc"><span>${IC.guardar}Guardar PDF</span>
          <button class="acc" data-pdf="1" ${listo ? '' : 'disabled'}>${IC.pluma}<span>Con firma<small>Con sello y firma escaneada</small></span></button>
          <button class="acc" data-pdf="0" ${listo ? '' : 'disabled'}>${IC.pdf.replace('M12 10v7M9 14l3 3 3-3', 'M9 12h6M9 16h6')}<span>Sin firma<small>Para firmar a mano</small></span></button>
        </div>
        <button class="acc" data-correo ${listo ? '' : 'disabled'}>${IC.mail}<span>Enviar por mail<small>PDF adjunto, desde tu Gmail</small></span></button>
      </div>
    </div>
  </main>`;
}


/* ---------------- EXPEDIENTE MATRIMONIAL ---------------- */
const PESTANAS_EXP = [
  { id: 'datos', nombre: 'Datos generales', parte: 'portada' },
  { id: 'novio', nombre: 'Novio', parte: 'novio' },
  { id: 'novia', nombre: 'Novia', parte: 'novia' },
  { id: 't1', nombre: 'Testigo 1', parte: 't1' },
  { id: 't2', nombre: 'Testigo 2', parte: 't2' },
  { id: 'ultima', nombre: 'Última página', parte: 'ultima' },
];

// Bloques del examen, en orden:
// - bloqueado (plegado, no se puede abrir) hasta jurar/prometer y, después, hasta resolver el anterior;
// - el que toca rellenar está abierto y no se pliega;
// - los resueltos se pliegan solos y luego se abren y cierran a mano.
function bloquesAbiertos(pref) {   // resueltos que el usuario ha abierto a mano
  const clave = `${estado.actualId}:${pref}`;
  return (estado.abiertos[clave] = estado.abiertos[clave] || new Set());
}
function estadoBloque(pref, i) {
  const d = estado.registro;
  if (!d[pref + 'juramento']) return 'bloqueado';
  for (let j = 1; j < i; j++) if (d[`${pref}res_${j}`] !== '1') return 'bloqueado';
  return d[`${pref}res_${i}`] === '1' ? 'resuelto' : 'actual';
}
function abiertoBloque(pref, i) {
  const e = estadoBloque(pref, i);
  return e === 'actual' || (e === 'resuelto' && bloquesAbiertos(pref).has(i));
}
function aplicarBloques(pref) {
  document.querySelectorAll(`details.seccion-exp[data-pref="${pref}"]`).forEach(det => {
    const i = +det.dataset.i, e = estadoBloque(pref, i);
    det.dataset.estado = e;
    det.open = abiertoBloque(pref, i);
    const chk = det.querySelector('[data-resuelto]');
    chk.disabled = e === 'bloqueado';
  });
}

function seccionesHTML(secciones, pref) {
  const d = estado.registro;
  return secciones.map((sec, i) => {
    const est = estadoBloque(pref, i + 1);
    const resuelto = d[`${pref}res_${i + 1}`] === '1';
    const preguntas = sec.preguntas.map(q => campoHTML({ ...q, k: pref + q.k, w: q.w || 12, ph: q.ph })).join('');
    return `<details class="seccion-exp" data-pref="${pref}" data-i="${i + 1}" data-estado="${est}" style="--color:${sec.color}" ${abiertoBloque(pref, i + 1) ? 'open' : ''}>
      <summary><span>${i + 1}. ${esc(sec.seccion)}</span>
        <label class="resuelto" title="Marca la sección como resuelta: se pliega y se abre la siguiente"><input type="checkbox" data-resuelto="${pref}res_${i + 1}" ${resuelto ? 'checked' : ''} ${est === 'bloqueado' ? 'disabled' : ''}> Resuelto</label></summary>
      <div class="rejilla">${preguntas}</div>
    </details>`;
  }).join('');
}

function juramentoHTML(k, texto) {
  return `<div class="campo" style="grid-column:1/-1"><label for="c_${k}" style="white-space:normal;text-transform:none;letter-spacing:0;font-size:14px;color:var(--tinta)">${texto}</label>
    <select id="c_${k}" data-k="${k}" style="max-width:180px">${['', 'JURO', 'PROMETO'].map(o => `<option ${estado.registro[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
}

function vistaExpediente(cert) {
  const d = estado.registro, cfg = estado.config, pest = estado.pestanaExp;
  if (d.documentos === undefined) d.documentos = EXPEDIENTE.DOCUMENTOS;
  if (!d.diligencia) d.diligencia = 'Amonestaciones aquí';
  ['novio', 'novia'].forEach(l => { if (!d[l + '_apellido1'] && !d[l + '_apellido2'] && d[l + '_apellidos']) d[l + '_apellido1'] = d[l + '_apellidos']; });
  const opcFirmas = cfg.firmas.map((f, i) => `<option value="${i}" ${i === estado.firma ? 'selected' : ''}>${esc(f.nombre)} — ${esc(f.cargo)}</option>`).join('');
  let cuerpo = '';
  if (pest === 'datos') {
    const columna = (lado, titulo) => `<div class="columna-pareja"><h4>${titulo}</h4><div class="rejilla">${
      CAMPOS_PAREJA.map(f => campoHTML({ ...f, k: `${lado}_${f.k}` })).join('')}</div></div>`;
    cuerpo = `<div class="pareja">${columna('novio', 'El contrayente')}${columna('novia', 'La contrayente')}</div>` + cert.campos.map(campoHTML).join('');
  } else if (pest === 'novio' || pest === 'novia') {
    const la = pest === 'novio' ? 'del contrayente' : 'de la contrayente';
    cuerpo = `<div class="intro-exp" style="grid-column:1/-1"><h4>Examen ${la}</h4>
      <p>Estas preguntas concluyen la preparación al matrimonio, que ha ayudado a los novios a tomar conciencia de los valores y obligaciones del matrimonio. Cada uno de los contrayentes debe ser interrogado <strong>por separado y en ausencia de los testigos</strong>.</p></div>
      ${juramentoHTML(pest + '_ex_juramento', '¿Acepta Vd. responder a las siguientes preguntas bajo juramento?')}
      <div style="grid-column:1/-1">${seccionesHTML(EXPEDIENTE.contrayente(pest), pest + '_ex_')}</div>`;
  } else if (pest === 't1' || pest === 't2') {
    cuerpo = `<div class="intro-exp" style="grid-column:1/-1"><h4>Examen del testigo ${pest[1]}</h4>
      <p>Cada testigo debe ser interrogado <strong>por separado y en ausencia de los contrayentes</strong>.</p></div>
      ${juramentoHTML(pest + '_juramento', '¿Acepta Vd. responder a las siguientes preguntas bajo juramento?')}
      <div style="grid-column:1/-1">${seccionesHTML(EXPEDIENTE.testigo, pest + '_')}</div>`;
  } else {
    const dispensa = d.diligencia === 'Dispensa de amonestaciones';
    cuerpo = `<div class="intro-exp" style="grid-column:1/-1"><h4>Diligencias</h4></div>
      <div class="campo" style="grid-column:1/-1"><div class="sexo opciones-dil" data-opcion="diligencia">
        ${['Amonestaciones aquí', 'Dispensa de amonestaciones'].map(o => `<button type="button" data-v="${o}" class="${d.diligencia === o ? 'on' : ''}">${o}</button>`).join('')}</div></div>
      ${dispensa
        ? campoHTML({ k: 'dispensa_motivo', label: 'Los contrayentes solicitan dispensa de las proclamas matrimoniales por', w: 12 })
        : campoHTML({ k: 'proclamas_desde', label: 'Las proclamas matrimoniales fueron publicadas en esta parroquia desde el día', tipo: 'date', w: 4 }) +
          campoHTML({ k: 'proclamas_hasta', label: 'hasta el día', tipo: 'date', w: 4 }) +
          campoHTML({ k: 'proclamas_parroquias', label: 'y en las parroquias de', w: 12 })}
      <hr class="sep"><p class="nota" style="grid-column:1/-1;margin:0">Si procede</p>
      ${campoHTML({ k: 'otra_parroquia', label: 'Los contrayentes solicitan la celebración de su matrimonio en', w: 12 })}
      ${campoHTML({ k: 'motivo_otra_parroquia', label: 'Motivo', w: 12 })}`;
  }
  const partes = EXPEDIENTE.partes.map(p => `<option value="${p.id}" ${p.id === estado.parteExp ? 'selected' : ''}>${p.nombre}</option>`).join('');
  const otros = [
    ['alegato', 'Alegato V'], ['exhorto:Novio', 'Exhorto novio'], ['exhorto:Novia', 'Exhorto novia'],
    ['fe_vida_novio', 'Fe de vida y estado novio'], ['fe_vida_novia', 'Fe de vida y estado novia'], ['atestado', 'Atestado de libertad'],
  ].map(([id, n]) => `<button class="btn" data-otro-doc="${id}">${n}</button>`).join('') + `<button class="btn" disabled title="Falta el modelo">Amonestaciones</button>`;
  return `
  ${cabecera(esc(cert.titulo))}
  <main>
    <div class="form-layout">
      <div class="tarjeta">
        <div class="pestanas" role="tablist">${PESTANAS_EXP.map(p => `<button role="tab" class="${p.id === pest ? 'on' : ''}" data-pestana="${p.id}">${p.nombre}</button>`).join('')}</div>
        <div class="rejilla">
          <div class="campo" style="grid-column:span 6"><label for="selFirma">Firma</label><select id="selFirma">${opcFirmas}</select></div>
          <div class="campo" style="grid-column:span 3"><label for="fechaDoc">Fecha del documento</label><input type="date" id="fechaDoc" value="${estado.fechaDocumento}"></div>
          <hr class="sep">
          ${cuerpo}
        </div>
      </div>
      <div class="lateral">
        <button class="acc" data-ir="menu">${IC.menu}Menú principal</button>
        <button class="acc" data-registro="nuevo">${IC.nuevo}Nuevo registro</button>
        <button class="miniatura" id="previa" title="Pulsa para ampliar"></button>
        <div class="grupo-acc"><span>${IC.imprimir}Expediente</span>
          <select id="parteExp" aria-label="Qué parte del expediente">${partes}</select>
          <button class="acc" data-imprimir="1">${IC.imprimir}<span>Imprimir</span></button>
          <button class="acc" data-pdf="1">${IC.guardar}<span>Guardar PDF</span></button>
          <button class="acc" data-correo>${IC.mail}<span>Enviar por mail</span></button>
        </div>
        <div class="grupo-acc otros-docs"><span>${IC.pdf}Otros documentos</span>${otros}</div>
      </div>
    </div>
  </main>`;
}

let _previaPend = null, _ultimoSVG = '';
function actualizarPrevia() {
  clearTimeout(_previaPend);
  _previaPend = setTimeout(async () => {
    const caja = $('#previa'); if (!caja) return;
    const cert = CERTIFICADOS.find(c => c.id === estado.certId);
    if (cert.estado !== 'listo') {
      caja.innerHTML = `<div class="pendiente-aviso"><strong>Falta el modelo</strong>Pásame un PDF de ejemplo y lo dejo igual que el original.</div>`;
      return;
    }
    const res = await Motor.maquetar(cert, estado.registro, ctx(), true);
    const paginas = Motor.paginas(res).map(p => Motor.aSVG(p));
    _ultimoSVG = paginas.join('');
    caja.innerHTML = paginas[0] + `<span class="lupa">⤢ Ampliar</span>${paginas.length > 1 ? `<span class="n-paginas">${paginas.length} páginas</span>` : ''}`;
    const grande = $('#ampliada .hoja-grande'); if (grande) grande.innerHTML = _ultimoSVG;
  }, 60);
}
function abrirAmpliada() {
  if (!_ultimoSVG) return;
  const m = document.createElement('div');
  m.className = 'modal ampliada'; m.id = 'ampliada';
  m.innerHTML = `<div class="hoja-grande">${_ultimoSVG}</div><button class="cerrar" data-cerrar aria-label="Cerrar">✕</button>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-cerrar]')) m.remove(); });
  document.body.appendChild(m);
}
function ctx() { return { config: estado.config, firmante: firmante(), fechaDocumento: estado.fechaDocumento, parteExpediente: estado.parteExp }; }

async function crearPDF(conFirma) {
  const cert = CERTIFICADOS.find(c => c.id === estado.certId);
  const res = await Motor.maquetar(cert, estado.registro, ctx(), conFirma);
  const bytes = await Motor.aPDF(res, cert.titulo);
  const quien = tituloRegistro(actual()).replace('(registro vacío)', '');
  const parte = cert.formato === 'expediente' ? ' - ' + (EXPEDIENTE.partes.find(p => p.id === estado.parteExp) || {}).nombre : '';
  const nombre = `${cert.formato === 'expediente' ? 'Expediente matrimonial' : cert.nombre}${parte}${quien ? ' - ' + quien : ''}.pdf`.replace(/[\\/:*?"<>|]/g, '');
  return { bytes, nombre, cert };
}

/* Imprimir: abre directamente la ventana de impresión con el certificado, sin descargar nada.
   - Chrome, Edge y Firefox: se imprime el propio PDF del certificado (tamaño exacto, sin
     encabezados ni pies de página del navegador, sin hojas de más).
   - Safari (Mac, iPhone, iPad): se imprimen las hojas del certificado como página, ocultando
     la aplicación, porque Safari no imprime bien un PDF incrustado. */
const _ua = navigator.userAgent;
// iPhone/iPad (el iPad moderno se presenta como Mac, pero tiene pantalla táctil): todos sus navegadores son Safari por dentro
const esIOS = /iP(hone|ad|od)/.test(_ua) || (/Macintosh/.test(_ua) && navigator.maxTouchPoints > 1);
const esSafari = esIOS || /^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(_ua);

async function imprimir(conFirma) {
  const cert = CERTIFICADOS.find(c => c.id === estado.certId);
  const res = await Motor.maquetar(cert, estado.registro, ctx(), conFirma);
  const nombre = cert.nombre + (tituloRegistro(actual()) !== '(registro vacío)' ? ' - ' + tituloRegistro(actual()) : '');
  if (!esSafari) return imprimirPDF(await Motor.aPDF(res, nombre));
  return imprimirHojas(Motor.paginas(res), nombre);
}

function imprimirPDF(bytes) {
  document.getElementById('marcoImpresion')?.remove();
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const marco = document.createElement('iframe');
  marco.id = 'marcoImpresion';
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
  marco.onload = () => setTimeout(() => {
    try { marco.contentWindow.focus(); marco.contentWindow.print(); }
    catch (e) { window.open(url, '_blank'); } // si el navegador no lo permite, se abre el PDF para imprimirlo desde ahí
  }, 250);
  marco.src = url;
  document.body.appendChild(marco);
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60000);
}

async function imprimirHojas(paginas, titulo) {
  document.getElementById('zonaImpresion')?.remove();
  const zona = document.createElement('div');
  zona.id = 'zonaImpresion';
  if (!esIOS) zona.className = 'con-margenes';
  zona.innerHTML = paginas.map(p => `<div class="hoja-impresion">${Motor.aSVG(p)}</div>`).join('');
  document.body.appendChild(zona);
  const tituloAntes = document.title;
  document.title = titulo;
  // Las hojas NO se quitan al terminar: en iPad/iPhone el aviso de «impresión terminada» llega
  // al abrir la ventana de impresión, y al elegir impresora se vuelve a preparar el documento.
  // En pantalla están ocultas; se sustituyen al imprimir otro certificado.
  const restaurar = () => { setTimeout(() => { document.title = tituloAntes; }, 1500); window.removeEventListener('afterprint', restaurar); };
  window.addEventListener('afterprint', restaurar);
  await Promise.all([...zona.querySelectorAll('image')].map(im => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = im.getAttribute('href'); })));
  await new Promise(r => setTimeout(r, 50));
  if (!esIOS && !Almacen.leer('avisoPieSafari', false)) {
    Almacen.guardar('avisoPieSafari', true);
    aviso('Si sale la dirección web abajo: en la ventana de imprimir, pulsa «Mostrar detalles» y desmarca «Imprimir encabezados y pies de página». Safari lo recuerda.', 12000);
  }
  window.print();
}

async function descargarPDF(conFirma) {
  const { bytes, nombre } = await crearPDF(conFirma);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  if (estado.descargas) {
    try { await estado.descargas.save({ filename: nombre, data: blob }); aviso('PDF guardado. Ábrelo para imprimirlo.'); return; }
    catch (e) { if (e && e.code === 'declined') return; }
  }
  // Se guarda directamente en la carpeta de descargas
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  aviso('PDF guardado en Descargas.');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------------- ENVIAR POR CORREO ---------------- */
function abrirCorreo() {
  const g = Google.estado();
  if (!g.disponible) {
    aviso(g.configurado ? 'El envío por correo solo funciona en la web de la aplicación.' : 'Falta configurar la conexión con Google.');
    return;
  }
  const cert = CERTIFICADOS.find(c => c.id === estado.certId);
  const f = firmante(), cfg = estado.config;
  const quien = tituloRegistro(actual()).replace('(registro vacío)', '');
  const asunto = `${cert.nombre}${quien ? ' - ' + quien : ''}`;
  const texto = `Buenos días:\n\nLe adjunto el ${cert.nombre.toLowerCase()}${quien ? ' de ' + quien : ''}.\n\nUn saludo,\n\n${f.nombre || ''}\n${f.cargo || ''}\n${cfg.nombre || ''}`;
  const m = document.createElement('div');
  m.className = 'modal'; m.id = 'correo';
  m.innerHTML = `<div class="caja ancha"><h3 style="margin-top:0">Enviar por correo</h3>
    <div class="rejilla">
      <div class="campo" style="grid-column:span 7"><label for="m_para">Para</label><input type="email" id="m_para" placeholder="correo@ejemplo.com" value="${esc(estado.registro.email || '')}"></div>
      <div class="campo" style="grid-column:span 5"><label for="m_cc">CC (opcional)</label><input type="email" id="m_cc"></div>
      <div class="campo" style="grid-column:1/-1"><label for="m_asunto">Asunto</label><input type="text" id="m_asunto" value="${esc(asunto)}"></div>
      <div class="campo" style="grid-column:1/-1"><label for="m_texto">Mensaje</label><textarea id="m_texto" rows="8">${esc(texto)}</textarea></div>
      <label class="check" style="grid-column:1/-1"><input type="checkbox" id="m_firma" checked> Adjuntar el PDF con sello y firma escaneada</label>
    </div>
    <p class="nota">Se envía desde tu cuenta de Gmail${g.usuario ? ` (${esc(g.usuario.email)})` : ''}. La primera vez Google te pedirá permiso para enviar correos.</p>
    <div class="fila" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-cerrar>Cancelar</button><button class="btn prim" id="m_enviar">Enviar</button></div>
  </div>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-cerrar]')) m.remove(); });
  document.body.appendChild(m);
  $('#m_para').focus();
}

async function enviarCorreo(boton) {
  const para = $('#m_para').value.trim(), cc = $('#m_cc').value.trim();
  const valido = s => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(s);
  if (!valido(para)) { aviso('Revisa la dirección de correo.'); $('#m_para').focus(); return; }
  if (cc && !cc.split(/[,;]\s*/).every(valido)) { aviso('Revisa la dirección en copia.'); return; }
  const permiso = Google.prepararGmail(); // dentro del clic, por si Google abre su ventana
  boton.disabled = true; boton.textContent = 'Enviando…';
  try {
    await permiso;
    const { bytes, nombre } = await crearPDF($('#m_firma').checked);
    await Google.enviarCorreo({ para, cc: cc.replace(/;/g, ','), asunto: $('#m_asunto').value, texto: $('#m_texto').value, adjunto: { nombre, bytes } });
    $('#correo')?.remove();
    aviso(`Enviado a ${para}.`);
  } catch (e) {
    console.error(e);
    boton.disabled = false; boton.textContent = 'Enviar';
    aviso('No se pudo enviar: ' + e.message);
  }
}

/* ---------------- DATOS DE LA PARROQUIA ---------------- */
function selectorArchivo(atributos, texto = 'Elegir imagen…') {
  return `<label class="btn archivo"><input type="file" accept="image/*" ${atributos}>${texto}</label>`;
}
function vistaParroquia() {
  const c = estado.config;
  const inp = (k, label, w = 12, ph = '') => `<div class="campo" style="grid-column:span ${w}"><label for="cfg_${k}">${label}</label><input type="text" id="cfg_${k}" data-cfg="${k}" value="${esc(c[k])}" placeholder="${esc(ph)}"></div>`;
  const img = (k, label, ayuda) => `<div class="campo"><label>${label}</label><div class="imgbox"><div class="vista">${c[k] ? `<img src="${c[k]}" alt="">` : 'sin imagen'}</div><div class="imgbox-txt">${selectorArchivo(`data-img="${k}"`)}<div class="nota">${ayuda}</div>${c[k] ? `<button class="btn" data-quitar="${k}">Quitar</button>` : ''}</div></div></div>`;
  return `
  ${cabecera('Datos de la parroquia', '<button class="btn-cab" data-ir="menu">← Volver al menú</button>')}
  <main>
    <div class="config">
      <div class="tarjeta"><h3>Membrete</h3><div class="rejilla">
        ${inp('nombre', 'Nombre de la parroquia', 8)}${inp('nombreCorto', 'Nombre abreviado', 4, 'S. S. Mártir')}
        ${inp('direccion', 'Dirección', 8)}${inp('cp', 'C.P.', 4)}
        ${inp('localidad', 'Localidad', 6)}${inp('provincia', 'Provincia', 6)}
        ${inp('diocesis', 'Diócesis', 6)}${inp('web', 'Web', 6)}
        <div class="campo" style="grid-column:span 4"><label for="cfg_color">Color del membrete</label><input type="color" id="cfg_color" data-cfg="color" value="${esc(c.color)}" style="width:80px;height:38px;padding:2px"></div>
        ${inp('papa', 'Papa (para la Bendición Apostólica)', 8)}
      </div>
      <p class="nota">El nombre abreviado sale en el margen de la partida de bautismo.</p></div>
      <div class="tarjeta"><h3>Imágenes</h3><div class="campos">
        ${img('logo', 'Logo (arriba a la izquierda)', 'PNG o JPG.')}
        ${img('sello', 'Sello (junto a la firma)', 'Solo aparece en «PDF con firma».')}
      </div></div>
      <div class="tarjeta"><h3>Vicaría (para el Alegato V)</h3><div class="rejilla">
        ${inp('diocesisTitulo', 'Arzobispado / Obispado', 12, 'Arzobispado de Madrid')}
        ${inp('vicaria', 'Nombre de la vicaría', 6, 'Vicaría I Norte')}${inp('vicario', 'Nombre del vicario', 6)}
        ${inp('vicarioCargo', 'Cargo del vicario', 6, 'Vicario Episcopal')}${inp('vicariaTelefono', 'Teléfono', 6)}
        ${inp('vicariaCalle', 'Calle', 9)}${inp('vicariaNumero', 'Nº', 3)}
        ${inp('vicariaCP', 'C.P.', 3)}${inp('vicariaCiudad', 'Ciudad', 9)}
        ${inp('vicariaEmail', 'Email', 12)}
      </div>
      <div class="campos" style="margin-top:12px">${img('logoDiocesis', 'Logo de la diócesis', 'Aparece arriba a la izquierda del Alegato V.')}</div></div>
    </div>
  </main>`;
}

/* ---------------- FIRMANTES ---------------- */
function vistaFirmantes() {
  const c = estado.config;
  const firmas = c.firmas.map((f, i) => `
    <div class="tarjeta firmante">
      <div class="rejilla">
        <div class="campo" style="grid-column:span 8"><label>Nombre y apellidos</label><input type="text" data-f="${i}" data-fk="nombre" value="${esc(f.nombre)}"></div>
        <div class="campo" style="grid-column:span 4"><label>Cargo</label><input type="text" data-f="${i}" data-fk="cargo" value="${esc(f.cargo)}" placeholder="Párroco, secretaria…"></div>
      </div>
      <div class="imgbox"><div class="vista ancha">${f.firma ? `<img src="${f.firma}" alt="">` : 'sin firma'}</div>
        <div class="imgbox-txt">${selectorArchivo(`data-firma="${i}"`, f.firma ? 'Cambiar firma…' : 'Subir firma escaneada…')}
          <div class="nota">Mejor en PNG con fondo transparente.</div>
          <div class="fila">${f.firma ? `<button class="btn" data-quitarfirma="${i}">Quitar firma</button>` : ''}${c.firmas.length > 1 ? `<button class="btn" data-borrarf="${i}">Eliminar firmante</button>` : ''}</div>
        </div>
      </div>
    </div>`).join('');
  return `
  ${cabecera('Firmantes', '<button class="btn-cab" data-ir="menu">← Volver al menú</button>')}
  <main>
    <div class="una-columna">${firmas}
      <button class="btn prim" id="anadirFirma">+ Añadir firmante</button>
    </div>
  </main>`;
}

// Convierte cualquier imagen subida a PNG de tamaño razonable
function leerImagen(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        // 700 px bastan para imprimir el sello o la firma a su tamaño; así ocupan poco
        const max = 700, k = Math.min(1, max / Math.max(im.width, im.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        const g = cv.getContext('2d');
        g.drawImage(im, 0, 0, cv.width, cv.height);
        // si no tiene transparencia (foto o escaneo) se guarda en JPEG, que pesa mucho menos
        const px = g.getImageData(0, 0, cv.width, cv.height).data;
        let transparente = false;
        for (let i = 3; i < px.length; i += 16) if (px[i] < 250) { transparente = true; break; }
        res(transparente ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.88));
      };
      im.onerror = rej; im.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

/* ---------------- TAMAÑO DE LETRA ----------------
   Sustituye al zoom del navegador: A− / A+ en la cabecera, y también
   Cmd/Ctrl + y Cmd/Ctrl − y la rueda del ratón con Cmd/Ctrl. */
const ESCALAS = [0.85, 0.92, 1, 1.1, 1.2, 1.32, 1.45, 1.6];
let escala = Almacen.leer('escala', 1);
function aplicarEscala() { document.body.style.zoom = escala === 1 ? '' : String(escala); }
function cambiarEscala(paso) {
  let i = ESCALAS.findIndex(x => Math.abs(x - escala) < 0.01); if (i < 0) i = 2;
  const j = paso === 0 ? 2 : Math.max(0, Math.min(ESCALAS.length - 1, i + paso));
  if (ESCALAS[j] === escala) { aviso(paso > 0 ? 'Es el tamaño más grande.' : 'Es el tamaño más pequeño.'); return; }
  escala = ESCALAS[j]; Almacen.guardar('escala', escala); aplicarEscala();
}
aplicarEscala();
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  if (e.key === '+' || e.key === '=') { e.preventDefault(); cambiarEscala(1); }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); cambiarEscala(-1); }
  else if (e.key === '0') { e.preventDefault(); cambiarEscala(0); }
});
let _rueda = 0;
window.addEventListener('wheel', e => {
  if (!e.ctrlKey) return; // en Mac, el gesto de pellizcar en el trackpad también llega así
  e.preventDefault();
  _rueda += e.deltaY;
  if (Math.abs(_rueda) > 60) { cambiarEscala(_rueda < 0 ? 1 : -1); _rueda = 0; }
}, { passive: false });
['gesturestart', 'gesturechange'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false })); // pellizco en iPhone/iPad

/* ---------------- TABULADOR ----------------
   En cada pantalla el cursor empieza en el primer campo vacío y el tabulador
   salta de campo en campo (de izquierda a derecha y de arriba abajo), sin
   detenerse en el día, mes y año de las fechas. Varón/Mujer es una sola parada. */
function camposNavegables() {
  return [...document.querySelectorAll('main .tarjeta input:not([type=file]):not([type=color]):not([type=checkbox]), main .tarjeta select, main .tarjeta textarea, main .tarjeta .sexo button.on')]
    .filter(el => !el.disabled && el.offsetParent !== null && !el.closest('.tareas, .callejero'));
}
function enfocar(el) {
  if (!el) return;
  el.focus({ preventScroll: false });
  if (el.select && /^(text|email|number|)$/.test(el.type || '') && el.tagName !== 'SELECT') { try { el.select(); } catch (e) {} }
  el.scrollIntoView({ block: 'nearest' });
}
function irAlPrimerVacio() {
  if (!window.matchMedia('(pointer: fine)').matches) return; // en móvil no se abre el teclado solo
  if (document.querySelector('.modal')) return;
  const vacio = camposNavegables().find(el =>
    el.id !== 'selFirma' && el.id !== 'fechaDoc' && el.tagName !== 'SELECT' && el.tagName !== 'BUTTON' && !String(el.value || '').trim());
  enfocar(vacio);
}
document.addEventListener('keydown', e => {
  // Varón/Mujer con el teclado: espacio, Intro o flechas cambian la elección
  const bs = e.target.closest && e.target.closest('.sexo button');
  if (bs && [' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    const otro = [...bs.parentElement.querySelectorAll('button')].find(b => b !== bs);
    otro.click(); otro.focus();
    return;
  }
  if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return;
  const lista = camposNavegables();
  const i = lista.indexOf(document.activeElement);
  if (i < 0) return; // fuera de los campos: comportamiento normal
  const j = i + (e.shiftKey ? -1 : 1);
  if (j >= 0 && j < lista.length) { e.preventDefault(); enfocar(lista[j]); return; }
  if (j >= lista.length) {
    const siguiente = document.querySelector('[data-imprimir="1"]:not(:disabled)');
    if (siguiente) { e.preventDefault(); siguiente.focus(); }
  }
});

/* ---------------- EVENTOS ---------------- */
document.addEventListener('click', async e => {
  Google.renovarSiHaceFalta();
  const sumario = e.target.closest('details.seccion-exp > summary');
  if (sumario && !e.target.closest('.resuelto') && sumario.parentElement.dataset.estado !== 'resuelto') { e.preventDefault(); return; }
  if (e.target.closest('summary .resuelto')) { e.stopPropagation(); if (e.target.tagName !== 'INPUT') { e.preventDefault(); e.target.closest('.resuelto').querySelector('input').click(); } return; }
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.tareaBorrar) { if (await confirmar('¿Eliminar esta tarea?', 'Eliminar')) { cambiarTarea(t.dataset.tareaBorrar, { borrada: true }); pintarTareas(); } return; }
  if (t.dataset.tareasLimpiar !== undefined) { (estado.config.tareas || []).filter(x => x.hecha && !x.borrada).forEach(x => Object.assign(x, { borrada: true, actualizado: ahora() })); guardarConfig(); pintarTareas(); return; }
  if (t.dataset.tam) cambiarEscala(+t.dataset.tam);
  else if (t.dataset.ir) irA(t.dataset.ir);
  else if (t.id === 'previa') abrirAmpliada();
  else if ((t.dataset.abrir || t.dataset.registro) && sinFirma()) aviso('Primero elige quién firma.');
  else if (t.dataset.abrir) { if (t.dataset.abrir !== 'expediente' && estado.certId !== 'expediente') estado.volverA = null; estado.certId = t.dataset.abrir; irA('form'); }
  else if (t.dataset.pestana) {
    estado.pestanaExp = t.dataset.pestana;
    estado.parteExp = (PESTANAS_EXP.find(p => p.id === t.dataset.pestana) || {}).parte || 'todo';
    render(); window.scrollTo(0, 0);
  }
  else if (t.dataset.otroDoc) {
    const [id, feligres] = t.dataset.otroDoc.split(':');
    if (feligres) { estado.registro.feligres = feligres; guardarRegistro(); }
    estado.volverA = 'expediente'; estado.certId = id; irA('form');
  }
  else if (t.closest('[data-opcion]')) {
    estado.registro[t.closest('[data-opcion]').dataset.opcion] = t.dataset.v; guardarRegistro(); render();
  }
  else if (t.dataset.registro) {
    const a = t.dataset.registro;
    if (a === 'nuevo') crearRegistro();
    else if (a === 'buscar') abrirBusqueda();
    else if (a === 'eliminar') eliminarRegistro();
    else moverRegistro(a === 'anterior' ? -1 : 1);
  }
  else if (t.dataset.google) {
    const a = t.dataset.google;
    if (a === 'conectar') Google.conectar();
    else if (a === 'reconectar') Google.reconectar();
    else if (a === 'desconectar') { if (await confirmar('¿Desconectar Google Drive en este navegador? Los datos siguen guardados en tu Drive.', 'Desconectar')) Google.desconectar(); }
    else if (a === 'menu') menuDrive();
  }
  else if (t.dataset.imprimir) {
    t.disabled = true;
    try { await imprimir(t.dataset.imprimir === '1'); } catch (err) { console.error(err); aviso('No se pudo preparar la impresión.'); }
    t.disabled = false;
  }
  else if (t.dataset.pdf) {
    t.disabled = true;
    try { await descargarPDF(t.dataset.pdf === '1'); } catch (err) { console.error(err); aviso('No se pudo generar el PDF.'); }
    t.disabled = false;
  }
  else if (t.hasAttribute('data-correo')) abrirCorreo();
  else if (t.id === 'm_enviar') enviarCorreo(t);
  else if (t.closest('[data-sexo]')) {
    estado.registro.sexo = t.dataset.v; estado.registro.sexo_manual = '1'; guardarRegistro();
    t.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === t));
    actualizarPrevia();
  }
  else if (t.id === 'anadirFirma') { estado.config.firmas.push({ nombre: '', cargo: '', firma: '' }); guardarConfig(); render(); }
  else if (t.dataset.borrarf) {
    if (await confirmar('¿Eliminar este firmante?', 'Eliminar')) {
      const k = +t.dataset.borrarf;
      estado.config.firmas.splice(k, 1);
      if (estado.firma === k) estado.firma = null; else if (estado.firma > k) estado.firma--;
      guardarConfig(); render();
    }
  }
  else if (t.dataset.quitar) { estado.config[t.dataset.quitar] = ''; guardarConfig(); render(); }
  else if (t.dataset.quitarfirma) { estado.config.firmas[+t.dataset.quitarfirma].firma = ''; guardarConfig(); render(); }
});

// Sexo automático a partir del nombre (salvo que se haya elegido a mano)
function sexoAutomatico() {
  const d = estado.registro;
  if (d.sexo_manual) return;
  const s = Sexo.adivinar(d.nombre);
  if (!s || s === d.sexo) return;
  d.sexo = s;
  document.querySelectorAll('[data-sexo] button').forEach(b => b.classList.toggle('on', b.dataset.v === s));
}

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.tarea) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; return; }
  if (el.dataset.k && cuentaDe(el.dataset.k)) {
    const max = cuentaDe(el.dataset.k).max;
    if (el.value.length > max) el.value = el.value.slice(0, max);
    estado.registro[el.dataset.k] = el.value;
    refrescarContador(el.dataset.k);
  }
  if (el.dataset.k) {
    estado.registro[el.dataset.k] = el.value;
    if (el.dataset.k === 'nombre') sexoAutomatico();
    const m = /^(novio|novia)_apellido[12]$/.exec(el.dataset.k);
    if (m) estado.registro[m[1] + '_apellidos'] = [estado.registro[m[1] + '_apellido1'], estado.registro[m[1] + '_apellido2']].filter(x => x && x.trim()).join(' ');
    guardarRegistro(); actualizarPrevia();
  }
  else if (el.id === 'fechaDoc') { estado.fechaDocumento = el.value; actualizarPrevia(); }
  else if (el.dataset.cfg) { estado.config[el.dataset.cfg] = el.value; guardarConfig(); }
  else if (el.dataset.f !== undefined && el.dataset.fk) { estado.config.firmas[+el.dataset.f][el.dataset.fk] = el.value; guardarConfig(); }
});

document.addEventListener('toggle', e => {
  const det = e.target;
  if (!det.classList || !det.classList.contains('seccion-exp')) return;
  const pref = det.dataset.pref, i = +det.dataset.i;
  if (estadoBloque(pref, i) !== 'resuelto') { if (det.open !== abiertoBloque(pref, i)) det.open = abiertoBloque(pref, i); return; }
  const set = bloquesAbiertos(pref);
  if (det.open) set.add(i); else set.delete(i);
}, true);

document.addEventListener('submit', e => {
  if (!e.target.matches('[data-tarea-form]')) return;
  e.preventDefault();
  const inp = $('#tareaNueva'), texto = inp.value.trim(); if (!texto) return;
  const t = ahora();
  (estado.config.tareas = estado.config.tareas || []).push({ id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), texto, hecha: false, creada: t, actualizado: t, autor: autorTarea() });
  guardarConfig(); inp.value = ''; pintarTareas(); $('#tareaNueva').focus();
});

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.tareaHecha) { cambiarTarea(el.dataset.tareaHecha, { hecha: el.checked }); pintarTareas(); return; }
  if (el.dataset.tarea) {
    const v = el.value.trim();
    if (!v) { cambiarTarea(el.dataset.tarea, { borrada: true }); pintarTareas(); }
    else cambiarTarea(el.dataset.tarea, { texto: v, autor: autorTarea() || undefined });
    return;
  }
  if (/(_ex_|^t[12]_)juramento$/.test(el.dataset.k || '')) {
    const pref = el.dataset.k.replace(/juramento$/, '');
    estado.registro[el.dataset.k] = el.value;
    setTimeout(() => { aplicarBloques(pref); const det = document.querySelector(`details.seccion-exp[data-pref="${pref}"][data-estado="actual"]`); if (det && el.value) det.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }
  if (el.id === 'selFirma') { estado.firma = +el.value; if (estado.vista === 'menu') render(); else actualizarPrevia(); }
  else if (el.id === 'parteExp') { estado.parteExp = el.value; actualizarPrevia(); }
  else if (el.dataset.resuelto) {
    estado.registro[el.dataset.resuelto] = el.checked ? '1' : ''; guardarRegistro();
    const det = el.closest('details'), pref = det.dataset.pref, i = +det.dataset.i;
    bloquesAbiertos(pref).delete(i);
    aplicarBloques(pref);
    const sig = document.querySelector(`details.seccion-exp[data-pref="${pref}"][data-estado="actual"]`);
    if (el.checked && sig) sig.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  else if (el.dataset.img || el.dataset.firma !== undefined) {
    const f = el.files && el.files[0]; if (!f) return;
    try {
      const url = await leerImagen(f);
      if (el.dataset.img) estado.config[el.dataset.img] = url; else estado.config.firmas[+el.dataset.firma].firma = url;
      guardarConfig(); render();
    } catch (err) { aviso('No se pudo leer la imagen.'); }
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && e.target.dataset && e.target.dataset.tarea) { e.preventDefault(); e.target.blur(); return; }
  if (e.key === 'Escape') ['#ampliada', '#busqueda', '#correo'].forEach(s => { const m = $(s); if (m) m.remove(); });
  if (e.key === 'Enter' && e.target.closest('#busqueda')) { const r = $('#resultados .resultado'); if (r) r.click(); }
});
window.addEventListener('focus', () => Google.refrescar());

/* ---------------- ARRANQUE ---------------- */
(async () => {
  await Motor.iniciar();
  render();
  // Si la página se abre dentro de Claude, usa su sistema de descargas
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then(d => { estado.descargas = d; }).catch(() => {});
  }
  // Si este navegador ya se conectó a Google Drive, se conecta solo
  Google.autoconectar().catch(e => console.error(e));
  // El script de Google carga aparte: cuando llega, se repinta el indicador
  const espera = setInterval(() => { if (Google.estado().disponible) { clearInterval(espera); pintarChip(); } }, 300);
  setTimeout(() => clearInterval(espera), 15000);
})();

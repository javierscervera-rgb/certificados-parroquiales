/* ============================================================
   EXPEDIENTES VICARÍA (beta) · la web de la Vicaría
   Tres pantallas:
     GENERAL   (#/)        lista de los expedientes que llegan, con su estado
     DETALLE   (#/e/<id>)  el expediente por pestañas, con márgenes para las notas
     REVISIÓN  (#/r/<id>)  el expediente sobre el impreso, como un libro
   En DETALLE y REVISIÓN, al pulsar un dato se puede rectificar el texto o
   añadir una nota. Cada cambio se guarda al momento en el buzón de la Vicaría.
   ============================================================ */

Motor.rutaBase = '../';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const util = { ahora: () => new Date().toISOString(), id: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8) };
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const leer = (k, d) => { try { const v = localStorage.getItem('vicaria.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const guardar = (k, v) => { try { localStorage.setItem('vicaria.' + k, JSON.stringify(v)); } catch (e) {} };

const V = {
  vista: 'general', id: null,
  sesion: null,        // { token, email, admin, caduca }
  entrando: false, avisoSesion: '',
  lista: null, errorLista: '',
  orden: leer('orden', { por: 'llegada', inv: false }), archivados: false,
  exp: null, errorExp: '', pestana: 'datos',
  spread: 0, paginas: null, girando: false,
  cola: [], enviando: false, estadoGuardado: '',
  config: null, configLocal: false,   // mis datos de la Vicaría (Alegato V); configLocal: el buzón aún no sabe guardarlos
  configPara: null,                   // datos de la Vicaría del titular del expediente abierto
  accesos: [], buzones: [],           // a quién doy acceso · de quién veo los expedientes (yo incluido)
  todo: VicariaServicio.modoPrueba(), // administradores: ver todo el buzón
};

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
    (document.fullscreenElement || document.body).appendChild(m);
  });
}
const fechaHora = iso => { const d = new Date(iso); return iso && !isNaN(d) ? d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''; };
const fechaCorta = iso => { const d = new Date(iso); return iso && !isNaN(d) ? d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''; };

/* ---------------- SESIÓN (cuenta de Google de la Vicaría) ---------------- */
function guardarSesion(s) { V.sesion = s; try { s ? sessionStorage.setItem('vicaria.sesion', JSON.stringify(s)) : sessionStorage.removeItem('vicaria.sesion'); } catch (e) {} }
async function comprobarSesion(token, caduca) {
  const q = await VicariaServicio.quien(token);
  if (!q.email) { guardarSesion(null); V.avisoSesion = 'No se pudo comprobar la cuenta de Google.'; return false; }
  guardarSesion({ token, email: q.email, admin: !!q.admin, caduca });
  V.buzones = q.buzones || [q.email]; V.accesos = q.accesos || [];
  return true;
}
function entrarGoogle() {
  if (!(window.google && google.accounts && google.accounts.oauth2)) { aviso('El inicio de sesión de Google aún no ha cargado. Prueba en unos segundos.'); return; }
  V.entrando = true; V.avisoSesion = ''; pintar();
  const cliente = google.accounts.oauth2.initTokenClient({
    client_id: window.GOOGLE_CLIENT_ID, scope: SCOPE,
    callback: async r => {
      if (r.error) { V.entrando = false; V.avisoSesion = 'No se pudo entrar: ' + (r.error_description || r.error); pintar(); return; }
      try { await comprobarSesion(r.access_token, Date.now() + (Number(r.expires_in) || 3600) * 1000); }
      catch (e) { V.avisoSesion = e.message; }
      V.entrando = false; ir();
      procesarCola();   // lo que quedó sin guardar al caducar la sesión
    },
    error_callback: e => { V.entrando = false; V.avisoSesion = e && e.type === 'popup_closed' ? '' : 'Se canceló el acceso a Google.'; pintar(); },
  });
  cliente.requestAccessToken();
}
const token = () => (VicariaServicio.modoPrueba() ? 'prueba' : V.sesion && V.sesion.token);
const miCorreo = () => (VicariaServicio.modoPrueba() ? VicariaServicio.correoPrueba() : (V.sesion && V.sesion.email) || '');
const esAdmin = () => VicariaServicio.modoPrueba() || !!(V.sesion && V.sesion.admin);
function sesionLista() {
  if (VicariaServicio.modoPrueba()) return true;
  return !!(V.sesion && V.sesion.email && V.sesion.caduca > Date.now() + 30000);
}
// Si el buzón dice «no autorizado» la sesión ha caducado: se vuelve a pedir
function errorDeSesion(e) {
  if (/no autorizado/i.test(e.message)) { guardarSesion(null); V.avisoSesion = 'La sesión ha caducado. Vuelve a entrar.'; pintar(); return true; }
  return false;
}

/* ---------------- CABECERA ---------------- */
const ICO = {
  libro: '<svg viewBox="0 0 24 24"><path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/></svg>',
  lista: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
  ojo: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  devolver: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  tel: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  alegato: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 15l2 2 4-4"/></svg>',
  imprimir: '<svg viewBox="0 0 24 24"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
  archivo: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/></svg>',
  pantalla: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  ant: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  sig: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  actualizar: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
};
function cabecera(titulo, sub = '') {
  const s = V.sesion, prueba = VicariaServicio.modoPrueba();
  const quien = prueba ? `<button class="chip aviso" data-acc="salir-prueba" title="Los expedientes se guardan solo en este navegador. Entras como ${esc(VicariaServicio.correoPrueba())}, el último correo al que se envió desde Certificados. Pulsa para salir del modo de prueba.">Modo de prueba · ${esc(VicariaServicio.correoPrueba())}</button>`
    : s ? `<button class="chip ok" data-acc="salir" title="Cerrar sesión">☁ ${esc(s.email)}</button>` : '';
  const g = V.estadoGuardado;
  return `<header class="barra vc-barra">
    <div class="marca"><button class="marca-inicio" data-ir="#/" title="Ir a la lista de expedientes"><span class="parroquia">Expedientes Vicaría <em class="beta">beta</em></span></button><h1>${titulo}</h1>${sub}</div>
    <div class="cab-der">${g ? `<span class="chip ${g === 'error' ? 'aviso' : ''}" id="guardado">${g === 'guardando' ? 'Guardando…' : g === 'error' ? 'No se pudo guardar · reintentando' : '✓ Guardado'}</span>` : ''}
      <button class="modo" type="button" data-acc="modo" title="Modo día / noche" aria-label="Cambiar entre modo día y modo noche"><svg class="luna" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><svg class="sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>
      ${sesionLista() ? `<button class="btn-cab" data-ir="#/datos" title="Quién tiene acceso a tus expedientes y datos de la Vicaría para el Alegato V">⚙ Mi buzón</button>` : ''}
      ${quien}</div>
  </header>`;
}

/* ---------------- ENTRADA ---------------- */
function vistaEntrada() {
  const conf = VicariaServicio.configurado();
  return `${cabecera('Bienvenido')}
  <main><div class="tarjeta vc-entrada">
    <h2>Bienvenido</h2>
    <p>Aquí llegan los expedientes matrimoniales que las parroquias envían desde <strong>Certificados</strong> con el botón «Enviar a Vicaría».</p>
    ${conf ? `<p>Entra con la cuenta de Google del correo al que las parroquias te envían los expedientes (o de alguien que te haya dado acceso). Solo verás los tuyos.</p>
      ${V.avisoSesion ? `<p class="vc-error">${esc(V.avisoSesion)}</p>` : ''}
      <button class="btn prim grande" data-acc="entrar" ${V.entrando ? 'disabled' : ''}>${V.entrando ? 'Entrando…' : 'Entrar con Google'}</button>`
    : `<p class="vc-error">El buzón de la Vicaría aún no está instalado (falta su dirección en <code>config.js</code>).</p>
      <p class="nota">Puedes probarlo ya en <strong>modo de prueba</strong>: los expedientes se guardan solo en este navegador. Envía uno desde Certificados (en este mismo navegador, también en modo de prueba) y aparecerá aquí.</p>`}
    <div class="fila" style="margin-top:14px"><button class="btn" data-acc="prueba">Probar en modo de prueba</button><a class="btn" href="../">Abrir Certificados</a></div>
  </div></main>`;
}

/* ---------------- GENERAL ---------------- */
const ORDENES = [['llegada', 'Llegada'], ['estado', 'Estado'], ['novio', 'Apellidos novio'], ['novia', 'Apellidos novia']];
function ordenar(lista) {
  const { por, inv } = V.orden, cmp = (a, b) => String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base' });
  const f = {
    llegada: (a, b) => cmp(a.llegada, b.llegada),
    estado: (a, b) => VIC.orden(a.estado) - VIC.orden(b.estado) || cmp(a.llegada, b.llegada),
    novio: (a, b) => cmp(a.novio_apellidos, b.novio_apellidos) || cmp(a.llegada, b.llegada),
    novia: (a, b) => cmp(a.novia_apellidos, b.novia_apellidos) || cmp(a.llegada, b.llegada),
  }[por];
  const r = lista.slice().sort(f);
  return inv ? r.reverse() : r;
}
function vistaGeneral() {
  if (!V.lista) return `${cabecera('Expedientes recibidos')}<main><div class="tarjeta vc-cargando">${V.errorLista ? `<p class="vc-error">${esc(V.errorLista)}</p><button class="btn prim" data-acc="actualizar">Reintentar</button>` : 'Cargando expedientes…'}</div></main>`;
  const activos = V.lista.filter(e => e.estado !== 'archivado'), archivados = V.lista.filter(e => e.estado === 'archivado');
  const conPara = V.todo || new Set(V.lista.map(e => e.para || '')).size > 1 || V.buzones.length > 1;
  const visibles = ordenar(V.archivados ? archivados : activos);
  const cuenta = id => activos.filter(e => e.estado === id).length;
  const chips = VIC.ESTADOS.filter(s => s.id !== 'archivado' && cuenta(s.id)).map(s => `<span class="vc-chip est-${s.id}">${cuenta(s.id)} · ${esc(s.corto)}</span>`).join('');
  const filas = visibles.map(e => `<tr class="est-${e.estado}" data-ir="#/e/${esc(e.id)}" tabindex="0">
      <td class="vc-fecha">${esc(fechaHora(e.llegada))}</td>
      <td><strong>${esc(e.novio_apellidos || '—')}</strong><small>${esc(e.novio_nombre)}</small></td>
      <td><strong>${esc(e.novia_apellidos || '—')}</strong><small>${esc(e.novia_nombre)}</small></td>
      <td class="vc-parroquia">${esc(e.parroquia)}<small>${esc(e.localidad)}</small></td>
      ${conPara ? `<td class="vc-para">${esc(e.para || '(sin destinatario)')}</td>` : ''}
      <td><span class="vc-estado est-${e.estado}">${esc(VIC.estado(e.estado).nombre)}</span>${e.avisos ? `<span class="vc-punto" title="${e.avisos} ${e.avisos === 1 ? 'respuesta' : 'respuestas'} de la parroquia"></span>` : ''}</td>
    </tr>`).join('');
  return `${cabecera('Expedientes recibidos')}
  <main>
    <section class="tarjeta vc-bienvenida">
      <div><h2>Bienvenido</h2><p>Expedientes matrimoniales enviados por las parroquias ${V.todo ? '(<strong>todo el buzón</strong>)' : `a <strong>${esc(V.buzones.join(', ') || miCorreo())}</strong>`}. Pulsa uno para revisarlo.</p></div>
      <div class="vc-chips">${chips || '<span class="nota">No hay expedientes pendientes.</span>'}</div>
    </section>
    <section class="tarjeta">
      <div class="vc-herramientas">
        <div class="vc-orden" role="group" aria-label="Ordenar"><span>Ordenar por</span>${ORDENES.map(([id, n]) => `<button class="${V.orden.por === id ? 'on' : ''}" data-orden="${id}">${n}${V.orden.por === id ? (V.orden.inv ? ' ↑' : ' ↓') : ''}</button>`).join('')}</div>
        <div class="fila">${esAdmin() ? `<button class="btn ${V.todo ? 'prim' : ''}" data-acc="todo" title="Eres administrador del buzón">${V.todo ? 'Ver solo los míos' : 'Ver todo el buzón'}</button>` : ''}<button class="btn ${V.archivados ? 'prim' : ''}" data-acc="archivados">${ICO.archivo}${V.archivados ? 'Volver a los activos' : `Ver archivados (${archivados.length})`}</button>
          <button class="btn" data-acc="actualizar" title="Actualizar">${ICO.actualizar}Actualizar</button></div>
      </div>
      ${V.archivados ? '<p class="nota vc-solo-archivados">Mostrando solo los expedientes archivados.</p>' : ''}
      ${visibles.length ? `<div class="vc-tabla-caja"><table class="vc-tabla">
        <thead><tr><th>Fecha de llegada</th><th>Apellidos novio</th><th>Apellidos novia</th><th>Parroquia</th>${conPara ? '<th>Para</th>' : ''}<th>Estado</th></tr></thead>
        <tbody>${filas}</tbody></table></div>`
      : `<p class="nota" style="padding:20px 4px">${V.archivados ? 'No hay expedientes archivados.' : `Todavía no ha llegado ningún expediente${V.todo ? '' : ` a ${esc(V.buzones.join(', ') || miCorreo())}`}. Las parroquias lo envían desde Certificados escribiendo este correo en «Enviar a Vicaría».`}</p>`}
    </section>
  </main>`;
}

/* ---------------- DETALLE Y REVISIÓN: parte común ---------------- */
const etiqueta = k => VIC_CAMPOS.etiqueta(k);
const ver = (k, v) => VIC_CAMPOS.mostrar(k, v);
function cabExpediente() {
  const e = V.exp, est = e.estado;
  const btn = (acc, ico, txt, on, clase = '') => `<button class="btn ${clase}" data-acc="${acc}" ${on ? '' : 'disabled'}>${ico}${txt}</button>`;
  const enVicaria = ['pendiente_revision', 'devuelto_parroquia', 'revisado_parroquia'].includes(est);
  const avisos = VIC.avisosVicaria(e).length;
  const tel = l => e.datos[l + '_telefono'] ? `<a href="tel:${esc(String(e.datos[l + '_telefono']).replace(/[^\d+]/g, ''))}">${ICO.tel}<span>${l === 'novio' ? 'Novio' : 'Novia'} · ${esc(e.datos[l + '_nombre'] || '')}</span><strong>${esc(e.datos[l + '_telefono'])}</strong></a>` : '';
  return `<div class="vc-cab-exp">
    <div class="vc-cab-fila">
      <button class="btn" data-ir="#/">${ICO.ant}Expedientes</button>
      <div class="vc-cab-tit"><h2>${esc(VIC.titulo(e))}</h2>
        <div class="nota">${esc(e.parroquia.nombre || '')}${e.parroquia.localidad ? ' · ' + esc(e.parroquia.localidad) : ''} · Llegó el ${esc(fechaHora(e.llegada))}${e.para ? ` para <strong>${esc(e.para)}</strong>` : ''}${e.parroquia.email ? ` · <a href="mailto:${esc(e.parroquia.email)}">${esc(e.parroquia.email)}</a>` : ''}</div></div>
      <span class="vc-estado grande est-${est}">${esc(VIC.estado(est).nombre)}</span>
    </div>
    ${est === 'devuelto_parroquia' && avisos ? `<div class="vc-aviso-rojo">La parroquia ha respondido o corregido ${avisos} ${avisos === 1 ? 'dato' : 'datos'}: están marcados con un punto rojo.</div>` : ''}
    ${est === 'aprobado_contactar' ? `<div class="vc-telefonos"><span>Contactar con los novios</span>${tel('novio')}${tel('novia')}</div>` : ''}
    <div class="vc-acciones">
      <div class="vc-vistas" role="tablist">
        <a class="${V.vista === 'detalle' ? 'on' : ''}" href="#/e/${esc(e.id)}">${ICO.lista}Detalle</a>
        <a class="${V.vista === 'revision' ? 'on' : ''}" href="#/r/${esc(e.id)}">${ICO.libro}Revisión</a>
      </div>
      <div class="vc-botones">
        ${btn('aprobar', ICO.ok, 'Aprobado', enVicaria, 'verde')}
        ${btn('devolver', ICO.devolver, 'Devolver a Parroquia', ['pendiente_revision', 'devuelto_parroquia'].includes(est), 'rojo')}
        ${btn('avisados', ICO.tel, 'Novios avisados', est === 'aprobado_contactar')}
        ${btn('recogido', ICO.alegato, 'Alegato V recogido', est === 'aprobado_alegato')}
        ${btn('imprimir', ICO.imprimir, 'Imprimir expediente', true)}
        ${est === 'archivado' ? btn('desarchivar', ICO.archivo, 'Sacar del archivo', true) : btn('archivar', ICO.archivo, 'Archivar', true)}
      </div>
    </div>
  </div>`;
}

// Cómo se ve un dato con sus marcas: texto, rectificación (tachado y nuevo debajo)
function valorHTML(k) {
  const e = V.exp, c = VIC.cambio(e, k), v = e.datos[k];
  const vacio = '<span class="vc-vacio">—</span>';
  if (!c) return esc(ver(k, v)) || vacio;
  const tag = c.de === 'parroquia' ? 'Corregido por la parroquia' : c.estado === 'aceptada' ? 'Rectificación aceptada por la parroquia' : 'Rectificación de la Vicaría · pendiente de la parroquia';
  return `<del>${esc(ver(k, c.original)) || '(vacío)'}</del><div class="vc-nuevo">${esc(ver(k, c.texto)) || '(vacío)'}</div><span class="vc-tag ${c.de === 'parroquia' || c.estado === 'aceptada' ? 'ok' : ''}">${tag}</span>`;
}
const marcasDe = keys => keys.flatMap(k => VIC.marcas(V.exp, k));
const pendiente = keys => keys.some(k => VIC.hiloPendiente(V.exp, k, 'vicaria'));

/* ---------------- DETALLE ---------------- */
function campoDet(c, lado) {
  const k = c.k, notas = VIC.notas(V.exp, k), cambio = VIC.cambio(V.exp, k);
  const clases = ['vc-campo', notas.length ? 'con-nota' : '', cambio ? 'con-cambio' : '', pendiente([k]) ? 'pendiente' : '', /_telefono$/.test(k) && V.exp.estado === 'aprobado_contactar' ? 'destacado' : ''].filter(Boolean).join(' ');
  if (/^vic_/.test(k)) {
    const v = V.exp.datos[k] || '';
    const ctl = c.tipo === 'textarea' ? `<textarea data-vic="${k}" rows="2">${esc(v)}</textarea>` : `<input data-vic="${k}" type="${c.tipo === 'date' ? 'date' : 'text'}" value="${esc(v)}" autocomplete="off">`;
    return `<div class="vc-campo vc-relleno" style="grid-column:span ${c.w || 12}"><label class="vc-etq">${esc(c.label)}</label>${ctl}</div>`;
  }
  return `<div class="${clases}" data-k="${k}" data-lado="${lado}" style="grid-column:span ${c.w && c.w < 12 && !notas.length && !cambio ? c.w : 12}" tabindex="0" title="Pulsa para rectificar o añadir una nota">
    <div class="vc-etq">${esc(c.label)}</div><div class="vc-valor">${valorHTML(k)}</div></div>`;
}
function vistaDetalle() {
  const est = VIC_CAMPOS.estructura(), pest = V.pestana;
  const cuenta = p => (est[p] || []).flatMap(b => VIC_CAMPOS.campos(b)).filter(c => VIC.marcas(V.exp, c.k).length).length;
  const avisa = p => (est[p] || []).flatMap(b => VIC_CAMPOS.campos(b)).some(c => VIC.hiloPendiente(V.exp, c.k, 'vicaria'));
  const pestanas = `<div class="pestanas vc-pestanas">${VIC_CAMPOS.PESTANAS.map(p => `<button class="${p.id === pest ? 'on' : ''}" data-pestana="${p.id}">${esc(p.nombre)}${cuenta(p.id) ? `<span class="vc-n${avisa(p.id) ? ' rojo' : ''}">${cuenta(p.id)}</span>` : ''}</button>`).join('')}</div>`;
  if (pest === 'alegato') return `${cabecera('Detalle del expediente')}<main class="vc-main-ancho">${cabExpediente()}${pestanas}${vistaAlegato()}</main>`;
  const bloques = est[pest].map(b => {
    if (b.pareja) return `<div class="vc-pareja">${b.pareja.map((col, i) => `<div class="vc-col"><h4>${esc(col.titulo)}</h4><div class="rejilla">${col.campos.map(c => campoDet(c, i ? 'der' : 'izq')).join('')}</div></div>`).join('')}</div>`;
    return `<div class="vc-bloque" ${b.color ? `style="--color:${b.color}"` : ''}>${b.titulo ? `<h4>${esc(b.titulo)}</h4>` : ''}<div class="rejilla">${b.campos.map(c => campoDet(c, 'der')).join('')}</div></div>`;
  }).join('');
  const notas = [];
  est[pest].forEach(b => (b.pareja ? b.pareja.map((col, i) => [col.campos, i ? 'der' : 'izq']) : [[b.campos, 'der']]).forEach(([cs, lado]) => cs.forEach(c => {
    if (VIC.notas(V.exp, c.k).length) notas.push(tarjetaNota(c.k, lado));
  })));
  return `${cabecera('Detalle del expediente')}
  <main class="vc-main-ancho">
    ${cabExpediente()}
    ${pestanas}
    <div class="vc-hoja" id="hoja">
      <div class="vc-margen izq"></div>
      <div class="vc-doc">${pest === 'vicaria' ? '<p class="nota" style="margin:0 0 12px">Parte inferior de la última página del expediente. Se guarda sola y sale en el impreso (vista Revisión e Imprimir expediente).</p>' : ''}${bloques}</div>
      <div class="vc-margen der"></div>
      ${notas.join('')}
      <svg class="vc-lineas" id="lineas"></svg>
    </div>
  </main>`;
}
function hiloHTML(k) {
  return VIC.notas(V.exp, k).map(n => `<div class="vc-msj de-${n.de}"><b>${n.de === 'vicaria' ? 'Vicaría' : 'Parroquia'}</b> <small>${esc(fechaHora(n.fecha))}</small><div>${esc(n.texto)}</div></div>`).join('');
}
function tarjetaNota(k, lado) {
  return `<div class="vc-nota ${lado}${VIC.hiloPendiente(V.exp, k, 'vicaria') ? ' pendiente' : ''}${VIC.resuelto(V.exp, k) ? ' resuelta' : ''}" data-nota="${k}" data-lado="${lado}" tabindex="0">
    <div class="vc-nota-cab">${esc(VIC_CAMPOS.campo(k).label.length > 38 ? VIC_CAMPOS.campo(k).label.slice(0, 36) + '…' : VIC_CAMPOS.campo(k).label)}<span class="vc-punto"></span></div>${hiloHTML(k)}</div>`;
}
// Coloca las notas en los márgenes, a la altura de su campo, y dibuja la línea hasta él
function colocarNotas() {
  const hoja = $('#hoja'); if (!hoja) return;
  const H0 = hoja.getBoundingClientRect(), lineas = $('#lineas');
  const anchoM = hoja.querySelector('.vc-margen.izq').getBoundingClientRect();
  const derM = hoja.querySelector('.vc-margen.der').getBoundingClientRect();
  let svg = '';
  ['izq', 'der'].forEach(lado => {
    let abajo = 0;
    const tarjetas = [...hoja.querySelectorAll(`.vc-nota[data-lado="${lado}"]`)].map(n => ({ n, campo: hoja.querySelector(`.vc-campo[data-k="${n.dataset.nota}"]`) }))
      .filter(x => x.campo).map(x => ({ ...x, r: x.campo.getBoundingClientRect() })).sort((a, b) => a.r.top - b.r.top);
    tarjetas.forEach(({ n, r }) => {
      const M = lado === 'izq' ? anchoM : derM;
      const top = Math.max(r.top - H0.top, abajo);
      n.style.top = top + 'px'; n.style.left = (M.left - H0.left + 8) + 'px'; n.style.width = (M.width - 16) + 'px';
      abajo = top + n.offsetHeight + 10;
      const ny = top + 14, fy = r.top - H0.top + 14;
      const nx = lado === 'izq' ? M.right - H0.left - 8 : M.left - H0.left + 8;
      const fx = lado === 'izq' ? r.left - H0.left : r.right - H0.left;
      const mx = (nx + fx) / 2;
      svg += `<path d="M${nx},${ny} C${mx},${ny} ${mx},${fy} ${fx},${fy}" class="${n.classList.contains('pendiente') ? 'pendiente' : ''}${n.classList.contains('resuelta') ? ' resuelta' : ''}"/><circle cx="${fx}" cy="${fy}" r="3"/>`;
    });
    hoja.style.minHeight = '';
    if (abajo > hoja.offsetHeight) hoja.style.minHeight = abajo + 'px';
  });
  lineas.innerHTML = svg;
}

/* ---------------- ALEGATO V ----------------
   Los mismos campos y el mismo modelo que «Alegato V» en Certificados (plantillas.js, motor.js).
   Cada dato sale del expediente (con sus rectificaciones). Lo que se cambia aquí se guarda solo para
   el Alegato (datos.vic_alegato = { clave: valor }): el expediente de la parroquia no se toca. */
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function camposAlegato() {
  const cert = CERTIFICADOS.find(c => c.id === 'alegato');
  const lado = l => (cert.camposPareja || []).filter(f => !f.solo || f.solo === l).map(f => ({ ...f, k: f.clave ? f.clave(l) : `${l}_${f.k}` }));
  return {
    pareja: [{ titulo: 'El contrayente', campos: lado('novio') }, { titulo: 'La contrayente', campos: lado('novia') }],
    campos: [...cert.campos, { k: 'fecha', label: 'Fecha del Alegato (año del libro y edad)', tipo: 'date', w: 6 }],
  };
}
function alGuardados() { try { const o = JSON.parse(V.exp.datos.vic_alegato || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
// lo guardado + lo que se está escribiendo (V.alProv, aún sin guardar)
const alPropios = () => Object.assign(alGuardados(), V.alProv || {});
const alBase = k => (k === 'fecha' ? hoyISO() : VIC.valor(V.exp, k));
const alValor = k => { const o = alPropios(); return k in o ? String(o[k]) : alBase(k); };
function alDatos() {
  const d = VIC.datosEfectivos(V.exp), o = alPropios();
  Object.keys(o).forEach(k => { if (k !== 'fecha') d[k] = String(o[k]); });
  ['novio', 'novia'].forEach(l => { d[l + '_apellidos'] = [d[l + '_apellido1'], d[l + '_apellido2']].filter(x => x && String(x).trim()).join(' ') || d[l + '_apellidos'] || ''; });
  return d;
}
// Datos de la Vicaría: los guardados, y si faltan, los habituales
// Datos de la Vicaría del titular del expediente: si es mío (o llegó sin destinatario), los míos, que son los
// más recientes; si no, los que manda el buzón con el expediente.
const tieneDatos = c => !!c && Object.keys(c).some(k => c[k]);
const expMio = () => !!V.exp && (!V.exp.para || V.exp.para === miCorreo());
function configVicaria() {
  const c = (expMio() && tieneDatos(V.config) ? V.config : null) || (tieneDatos(V.configPara) ? V.configPara : null) || V.config || {}, r = { diocesisTitulo: 'Arzobispado de Madrid', vicarioCargo: 'Vicario Episcopal', vicaria: (V.exp && V.exp.parroquia && V.exp.parroquia.vicaria) || '' };
  Object.keys(c).forEach(k => { if (c[k]) r[k] = c[k]; });
  return r;
}
const ctxAlegato = () => ({ config: { ...configVicaria(), nombre: (V.exp.parroquia && V.exp.parroquia.nombre) || '' }, fechaDocumento: alValor('fecha') || hoyISO() });
function campoAlegato(c) {
  const k = c.k, v = alValor(k), o = alPropios(), cambiado = k in o && String(o[k]) !== alBase(k) && k !== 'fecha';
  const id = 'al_' + k, tipo = c.tipo === 'date' ? 'date' : c.tipo === 'tel' ? 'tel' : 'text';
  return `<div class="campo vc-al-campo${cambiado ? ' cambiado' : ''}" style="grid-column:span ${c.w || 6}" data-al-caja="${k}">
    <label for="${id}">${esc(c.label)}</label><input id="${id}" data-al="${k}" type="${tipo}" value="${esc(v)}" placeholder="${esc(c.ph || '')}" autocomplete="off">
    ${cambiado ? `<div class="vc-al-orig">Solo en el Alegato · en el expediente: <span>${esc(ver(k, alBase(k))) || '(vacío)'}</span> <button type="button" class="btn enlace" data-al-quitar="${k}">Restablecer</button></div>` : ''}</div>`;
}
function vistaAlegato() {
  const A = camposAlegato(), cfg = configVicaria(), aprobado = VIC.fueAprobado(V.exp) || VIC.APROBADOS.includes(V.exp.estado);
  const faltan = ['vicaria', 'vicario', 'vicariaCiudad'].filter(k => !cfg[k]);
  return `<div class="vc-alegato">
    <div class="vc-doc">
      <p class="nota" style="margin:0 0 12px">Los datos salen del expediente, con sus rectificaciones. Lo que cambies aquí <strong>solo cambia el Alegato V</strong>; el expediente de la parroquia no se toca.</p>
      ${aprobado ? '' : '<p class="vc-aviso-naranja">El expediente aún no está aprobado.</p>'}
      ${faltan.length ? `<p class="vc-aviso-naranja">Faltan datos de la Vicaría (${faltan.map(k => ({ vicaria: 'nombre de la vicaría', vicario: 'vicario', vicariaCiudad: 'ciudad' })[k]).join(', ')}). ${expMio() ? '<a href="#/datos">Rellénalos en «Mi buzón»</a>: valen para todos tus Alegatos.' : `Los pone el titular del buzón (${esc(V.exp.para || '—')}) en «Mi buzón».`}</p>` : ''}
      <div class="vc-pareja vc-al-pareja">${A.pareja.map(col => `<div class="vc-col"><h4>${esc(col.titulo)}</h4><div class="rejilla">${col.campos.map(campoAlegato).join('')}</div></div>`).join('')}</div>
      <div class="vc-bloque"><h4>Alegato</h4><div class="rejilla">${A.campos.map(campoAlegato).join('')}</div></div>
    </div>
    <aside class="vc-al-lado">
      <button class="btn prim grande" data-acc="imprimir-alegato">${ICO.imprimir}Imprimir Alegato V</button>
      <div class="vc-al-previa" id="alPrevia"><div class="vc-cargando">Preparando…</div></div>
      <p class="nota">Pulsa una página para verla en grande.</p>
    </aside>
  </div>`;
}
let _alPend = null, _alSVG = [];
function previaAlegato() {
  clearTimeout(_alPend);
  _alPend = setTimeout(async () => {
    const caja = $('#alPrevia'); if (!caja || !V.exp) return;
    try {
      const res = await Motor.maquetarAlegato(alDatos(), ctxAlegato());
      _alSVG = Motor.paginas(res).map(p => Motor.aSVG(p));
      caja.innerHTML = _alSVG.map((s, i) => `<button type="button" class="vc-al-pag" data-acc="ampliar-alegato" title="Página ${i + 1}: pulsa para ampliar">${s}</button>`).join('');
    } catch (e) { console.error(e); caja.innerHTML = '<p class="vc-error">No se pudo preparar la vista previa.</p>'; }
  }, 120);
}
function ampliarAlegato() {
  const m = document.createElement('div');
  m.className = 'modal ampliada';
  m.innerHTML = `<div class="hoja-grande">${_alSVG.join('')}</div><button class="cerrar" aria-label="Cerrar">✕</button>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('.cerrar')) m.remove(); });
  document.body.appendChild(m);
}
// Guarda lo propio del Alegato: si un dato vuelve a ser igual que en el expediente, deja de ser propio
function guardarAlegato(k, v, repintar) {
  if (V.alProv) delete V.alProv[k];
  const o = alPropios();
  if (v === alBase(k) && k !== 'fecha') delete o[k]; else o[k] = v;
  const json = Object.keys(o).length ? JSON.stringify(o) : '';
  if (json === (V.exp.datos.vic_alegato || '')) return;
  cambiar([{ op: 'vic', k: 'vic_alegato', v: json }], repintar);
}
function repintarCampoAlegato(k) {
  const caja = document.querySelector(`[data-al-caja="${k}"]`); if (!caja) return;
  const c = [...camposAlegato().pareja.flatMap(x => x.campos), ...camposAlegato().campos].find(x => x.k === k);
  const t = document.createElement('div'); t.innerHTML = campoAlegato(c); caja.replaceWith(t.firstElementChild);
}

/* ---------------- DATOS DE LA VICARÍA (para el Alegato V) ---------------- */
async function cargarConfig() {
  try {
    const r = await VicariaServicio.configuracion(token());
    V.config = r.config || {}; V.accesos = r.accesos || []; V.buzones = r.buzones || [miCorreo()]; V.configLocal = false;
  }
  catch (e) {
    if (errorDeSesion(e)) return;
    // buzón instalado antes de existir esta opción: se guardan en este navegador hasta que se actualice
    V.config = leer('config', {}); V.configLocal = true;
  }
  if (V.vista === 'datos') pintar();
  else if (V.vista === 'detalle' && V.pestana === 'alegato') previaAlegato();
}
function vistaDatos() {
  const c = V.config;
  if (!c) return `${cabecera('Mi buzón')}<main><div class="tarjeta vc-cargando">Cargando…</div></main>`;
  const otros = V.buzones.filter(b => b !== miCorreo());
  const inp = (k, label, w = 12, ph = '') => `<div class="campo" style="grid-column:span ${w}"><label for="cfg_${k}">${label}</label><input type="text" id="cfg_${k}" data-cfg="${k}" value="${esc(c[k] || '')}" placeholder="${esc(ph)}" autocomplete="off"></div>`;
  return `${cabecera('Mi buzón')}
  <main>
  <div class="tarjeta vc-datos vc-accesos">
    <h3>Tu correo</h3>
    <p class="vc-correo">${esc(miCorreo())}</p>
    <p class="nota">Las parroquias te envían los expedientes escribiendo este correo en «Enviar a Vicaría».${otros.length ? ` También ves los de: <strong>${otros.map(esc).join(', ')}</strong>.` : ''}</p>
    <h3 style="margin-top:18px">Personas con acceso a tus expedientes</h3>
    <p class="nota" style="margin-top:0">Pueden verlos, anotarlos, aprobarlos e imprimirlos. Solo tú puedes añadir o quitar personas. Tienen que entrar con una cuenta de Google con ese correo.</p>
    ${V.configLocal ? '<p class="vc-aviso-naranja">El buzón es de una versión anterior y aún no permite dar acceso a otros correos.</p>' : `
    <ul class="vc-lista-accesos">${V.accesos.length ? V.accesos.map(a => `<li><span>${esc(a)}</span><button class="btn" data-quitar-acceso="${esc(a)}">Quitar</button></li>`).join('') : '<li class="nota">Nadie más tiene acceso.</li>'}</ul>
    <div class="fila vc-nuevo-acceso"><input type="email" id="nuevoAcceso" placeholder="correo@ejemplo.org" autocomplete="off"><button class="btn prim" data-acc="anadir-acceso">Dar acceso</button></div>`}
  </div>
  <div class="tarjeta vc-datos" style="margin-top:18px">
    <h3>Datos de la Vicaría</h3>
    <p class="nota" style="margin:0 0 14px">Salen en el <strong>Alegato V</strong> de los expedientes dirigidos a ti (los mismos datos que en Certificados → Datos de la parroquia → Vicaría).</p>
    ${V.configLocal ? '<p class="vc-aviso-naranja">El buzón de la Vicaría es de una versión anterior: estos datos se guardan solo en este navegador hasta que se actualice (vicaria/README.md).</p>' : ''}
    <div class="rejilla">
      ${inp('diocesisTitulo', 'Arzobispado / Obispado', 12, 'Arzobispado de Madrid')}
      ${inp('vicaria', 'Nombre de la vicaría', 6, 'Vicaría I Norte')}${inp('vicario', 'Nombre del vicario', 6)}
      ${inp('vicarioCargo', 'Cargo del vicario', 6, 'Vicario Episcopal')}${inp('vicariaTelefono', 'Teléfono', 6)}
      ${inp('vicariaCalle', 'Calle', 9)}${inp('vicariaNumero', 'Nº', 3)}
      ${inp('vicariaCP', 'C.P.', 3)}${inp('vicariaCiudad', 'Ciudad (para «Dado en …»)', 9)}
      ${inp('vicariaEmail', 'Email', 12)}
      <div class="campo" style="grid-column:1/-1"><label>Logo de la diócesis (arriba a la izquierda del Alegato V)</label>
        <div class="imgbox"><div class="vista">${c.logoDiocesis ? `<img src="${c.logoDiocesis}" alt="">` : 'sin imagen'}</div>
          <div class="imgbox-txt"><label class="btn archivo"><input type="file" accept="image/*" data-logo>Elegir imagen…</label>${c.logoDiocesis ? '<button class="btn" data-acc="quitar-logo">Quitar</button>' : ''}<div class="nota">PNG o JPG.</div></div></div></div>
    </div>
    <div class="fila" style="justify-content:flex-end;margin-top:16px"><button class="btn" data-acc="volver">Volver</button><button class="btn prim" data-acc="guardar-config">Guardar datos</button></div>
  </div></main>`;
}
function leerFormConfig() {
  const c = { ...(V.config || {}) };
  document.querySelectorAll('[data-cfg]').forEach(el => { c[el.dataset.cfg] = el.value.trim(); });
  return c;
}
async function guardarConfigVicaria(b) {
  const c = leerFormConfig();
  b.disabled = true;
  try {
    if (V.configLocal) { V.config = VIC.limpiarConfig(c); guardar('config', V.config); }
    else V.config = await VicariaServicio.guardarConfig(token(), c);
    if (expMio()) V.configPara = V.config;
    aviso('Datos de la Vicaría guardados.');
    history.length > 1 ? history.back() : (location.hash = '#/');
  } catch (e) { if (!errorDeSesion(e)) aviso('No se pudieron guardar: ' + e.message, 6000); }
  b.disabled = false;
}
async function cambiarAccesos(lista, b) {
  if (b) b.disabled = true;
  try { V.accesos = await VicariaServicio.guardarAccesos(token(), lista); pintar(); const i = $('#nuevoAcceso'); if (i) i.focus(); }
  catch (e) { if (!errorDeSesion(e)) aviso('No se pudo cambiar: ' + e.message, 6000); if (b) b.disabled = false; }
}
function anadirAcceso(b) {
  const i = $('#nuevoAcceso'), c = VIC.correo(i && i.value);
  if (!c) { aviso('Escribe un correo válido.'); i && i.focus(); return; }
  if (c === miCorreo()) { aviso('Ese es tu propio correo.'); return; }
  if (V.accesos.includes(c)) { aviso('Ya tiene acceso.'); return; }
  cambiarAccesos([...V.accesos, c], b);
}

// Imagen subida → PNG/JPEG de 700 px como mucho (como en Certificados)
function leerImagen(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 700 / Math.max(im.width, im.height)), cv = document.createElement('canvas');
        cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        const g = cv.getContext('2d'); g.drawImage(im, 0, 0, cv.width, cv.height);
        const px = g.getImageData(0, 0, cv.width, cv.height).data;
        let transparente = false; for (let i = 3; i < px.length; i += 16) if (px[i] < 250) { transparente = true; break; }
        res(transparente ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.88));
      };
      im.onerror = rej; im.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

/* ---------------- REVISIÓN: el impreso como un libro ---------------- */
const PLIEGOS = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, null]];
function ctxImpreso(paraRevision) {
  const e = V.exp;
  return { config: Object.assign({}, e.parroquia || {}, e.sello ? { sello: e.sello } : {}), firmante: e.firmante || {}, fechaDocumento: e.fechaDocumento || (e.llegada || '').slice(0, 10), parteExpediente: 'todo', vicaria: paraRevision };
}
async function prepararPaginas() {
  const res = await Motor.maquetarExpediente(VIC.datosEfectivos(V.exp), ctxImpreso(true), 'todo');
  V.paginas = Motor.paginas(res).map((ops, i) => paginaSVG(ops, i + 1));
}
function paginaSVG(ops, n) {
  const zonas = [], textos = [], finales = {};
  ops.forEach(o => {
    if (o.tipo === 'zona') zonas.push(o);
    else if (o.tipo === 'txt') {
      const w = Motor.ancho(o.t, o.tam, o.negrita, o.fuente);
      textos.push(`<text x="${o.x.toFixed(2)}" y="${o.y.toFixed(2)}" font-size="${o.tam}"${o.negrita ? ' font-weight="bold"' : ''} fill="${o.color || '#111'}" textLength="${w.toFixed(2)}" lengthAdjust="spacingAndGlyphs"${o.alinear === 'centro' ? '' : ''}>${esc(o.t)}</text>`);
      if (o.k) finales[o.k] = Math.max(finales[o.k] || 0, o.x + w);
    }
  });
  const vistas = new Set(), iconos = [];
  const rects = zonas.map(z => {
    const keys = z.k.split(' '), anot = marcasDe(keys).length > 0, vic = /^vic_/.test(keys[0]);
    const vacia = !keys.some(k => String(VIC.valor(V.exp, k) || '').trim());
    if (anot && !vistas.has(z.k)) {
      vistas.add(z.k);
      const x = Math.min(Math.max(finales[z.k] || z.x, z.x) + 9, 585), y = z.y + z.h / 2;
      iconos.push(`<g class="vc-icono${pendiente(keys) ? ' pendiente' : ''}" data-k="${esc(z.k)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><title>Ver notas y cambios</title>
        <circle r="7.5"/><path d="M-3.6 -2.6h7.2v4.4h-3.4l-2.2 2v-2h-1.6z"/>${pendiente(keys) ? '<circle class="punto" cx="6" cy="-6" r="3.2"/>' : ''}</g>`);
    }
    return `<rect class="vc-zona${anot ? ' anotada' : ''}${vic ? ' vic' : ''}${vacia ? ' vacia' : ''}" data-k="${esc(z.k)}" x="${z.x.toFixed(1)}" y="${z.y.toFixed(1)}" width="${Math.max(z.w, 12).toFixed(1)}" height="${z.h.toFixed(1)}" rx="2"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${A4.w} ${A4.h}" font-family="Helvetica, Arial, sans-serif" class="vc-svg" data-pagina="${n}">
    <rect width="100%" height="100%" fill="#fff"/><image href="../fondos/expediente-${String(n).padStart(2, '0')}.jpg" x="0" y="0" width="${A4.w}" height="${A4.h}"/>
    <g class="vc-zonas">${rects.join('')}</g><g class="vc-textos">${textos.join('')}</g><g>${iconos.join('')}</g></svg>`;
}
const paginaHTML = n => n ? V.paginas[n - 1] : '<div class="vc-pag-vacia">Fin del expediente</div>';
function vistaRevision() {
  return `${cabecera('Revisión del expediente')}
  <main class="vc-main-ancho">
    ${cabExpediente()}
    <div class="vc-libro-marco" id="marco">
      <div class="vc-libro-barra">
        <button class="btn" data-acc="anterior" ${V.spread ? '' : 'disabled'}>${ICO.ant}Anterior</button>
        <span class="vc-paginas-txt" id="paginasTxt"></span>
        <button class="btn" data-acc="siguiente" ${V.spread < PLIEGOS.length - 1 ? '' : 'disabled'}>Siguiente${ICO.sig}</button>
        <button class="btn" data-acc="pantalla" title="Pantalla completa">${ICO.pantalla}<span>${document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa'}</span></button>
      </div>
      <div class="vc-libro" id="libro">${V.paginas ? '' : '<div class="vc-cargando">Montando el expediente sobre el impreso…</div>'}</div>
      <p class="nota vc-ayuda-libro">Pasa el cursor por el texto y pulsa para rectificarlo o añadir una nota. Los datos con notas se ven en amarillo con un icono; el punto rojo marca las respuestas de la parroquia. En la última página se rellena la aprobación.</p>
    </div>
  </main>`;
}
function medirLibro() {
  const marco = $('#marco'), libro = $('#libro'); if (!marco || !libro) return;
  const lleno = document.fullscreenElement === marco;
  const ancho = marco.clientWidth - (lleno ? 40 : 0);
  const alto = lleno ? window.innerHeight - 90 : Math.max(560, window.innerHeight - 150);
  const pw = Math.floor(Math.min((ancho - 8) / 2, alto / (A4.h / A4.w), 760));
  libro.style.setProperty('--pw', pw + 'px');
  libro.style.setProperty('--ph', Math.round(pw * A4.h / A4.w) + 'px');
}
function pintarLibro() {
  const libro = $('#libro'); if (!libro || !V.paginas) return;
  const [a, b] = PLIEGOS[V.spread];
  libro.innerHTML = `<div class="vc-pag izq">${paginaHTML(a)}</div><div class="vc-pag der">${paginaHTML(b)}</div>`;
  $('#paginasTxt').textContent = b ? `Páginas ${a} y ${b} de 11` : `Página ${a} de 11`;
  document.querySelector('[data-acc="anterior"]').disabled = V.spread === 0;
  document.querySelector('[data-acc="siguiente"]').disabled = V.spread === PLIEGOS.length - 1;
  medirLibro();
}
// Pasar la hoja: la página gira sobre el lomo, con su dorso, como en un libro
function pasar(paso) {
  const destino = V.spread + paso;
  if (V.girando || destino < 0 || destino >= PLIEGOS.length) return;
  cerrarPop();
  const libro = $('#libro'), [a, b] = PLIEGOS[V.spread], [c, d] = PLIEGOS[destino];
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { V.spread = destino; pintarLibro(); return; }
  V.girando = true;
  const adelante = paso > 0;
  // debajo: lo que queda a la vista mientras gira
  libro.innerHTML = adelante
    ? `<div class="vc-pag izq">${paginaHTML(a)}</div><div class="vc-pag der">${paginaHTML(d)}</div>`
    : `<div class="vc-pag izq">${paginaHTML(c)}</div><div class="vc-pag der">${paginaHTML(b)}</div>`;
  const hoja = document.createElement('div');
  hoja.className = 'vc-gira ' + (adelante ? 'adelante' : 'atras');
  hoja.innerHTML = adelante
    ? `<div class="cara frente">${paginaHTML(b)}</div><div class="cara dorso">${paginaHTML(c)}</div>`
    : `<div class="cara frente">${paginaHTML(a)}</div><div class="cara dorso">${paginaHTML(d)}</div>`;
  libro.appendChild(hoja);
  hoja.getBoundingClientRect();
  requestAnimationFrame(() => hoja.classList.add('girando'));
  let hecho = false;
  const fin = () => { if (hecho) return; hecho = true; V.spread = destino; V.girando = false; pintarLibro(); };
  hoja.addEventListener('transitionend', e => { if (e.propertyName === 'transform') fin(); });
  setTimeout(fin, 1300);
}
async function pantallaCompleta() {
  const marco = $('#marco');
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await marco.requestFullscreen(); }
  catch (e) { aviso('El navegador no permite la pantalla completa aquí.'); }
}
document.addEventListener('fullscreenchange', () => {
  const b = document.querySelector('[data-acc="pantalla"] span'); if (b) b.textContent = document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa';
  cerrarPop(); medirLibro();
});
// Al pasar el cursor por un dato se resaltan todas sus partes (p. ej. un dato en dos líneas)
document.addEventListener('mouseover', e => {
  const z = e.target.closest && e.target.closest('.vc-zona');
  document.querySelectorAll('.vc-zona.encima').forEach(x => { if (!z || x.dataset.k !== z.dataset.k) x.classList.remove('encima'); });
  if (z) document.querySelectorAll(`.vc-zona[data-k="${CSS.escape(z.dataset.k)}"]`).forEach(x => x.classList.add('encima'));
});

/* ---------------- VENTANA PARA RECTIFICAR, ANOTAR O RELLENAR ---------------- */
let _pop = null;
function cerrarPop() { if (_pop) { _pop.remove(); _pop = null; } }
function control(k, v, id) {
  const c = VIC_CAMPOS.campo(k);
  if (c.tipo === 'textarea' || String(v || '').length > 60) return `<textarea id="${id}" data-pk="${k}" rows="3">${esc(v)}</textarea>`;
  if (c.tipo === 'select') return `<select id="${id}" data-pk="${k}">${c.opciones.map(o => `<option ${o === (v || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  if (c.tipo === 'sino') return `<select id="${id}" data-pk="${k}"><option value="" ${v !== '1' ? 'selected' : ''}>No</option><option value="1" ${v === '1' ? 'selected' : ''}>Sí</option></select>`;
  return `<input id="${id}" data-pk="${k}" type="${c.tipo === 'date' ? 'date' : 'text'}" value="${esc(v)}" autocomplete="off">`;
}
function abrirPop(keys, ancla, modo = 'menu') {
  cerrarPop();
  const e = V.exp, k0 = keys[0], vic = /^vic_/.test(k0);
  if (vic) modo = 'rellenar';
  const p = document.createElement('div');
  p.className = 'vc-pop'; p.dataset.keys = keys.join(' ');
  const titulo = vic ? 'Aprobación para la celebración' : keys.map(etiqueta).join(' / ');
  const cambios = keys.map(k => [k, VIC.cambio(e, k)]).filter(([, c]) => c);
  const notas = VIC.notas(e, k0).length || keys.slice(1).some(k => VIC.notas(e, k).length);
  let cuerpo = '';
  if (modo === 'menu') {
    cuerpo = `<div class="vc-pop-valor">${keys.map(k => `<div>${keys.length > 1 ? `<small>${esc(VIC_CAMPOS.campo(k).label)}</small>` : ''}${valorHTML(k)}</div>`).join('')}</div>
      ${cambios.filter(([, c]) => c.de === 'vicaria' && c.estado === 'propuesta').map(([k, c]) => `<button class="btn enlace" data-pop="retirar" data-k="${k}" data-id="${esc(c.id)}">Retirar la rectificación${keys.length > 1 ? ' de ' + esc(VIC_CAMPOS.campo(k).label) : ''}</button>`).join('')}
      ${notas ? `<div class="vc-pop-hilo">${keys.map(k => hiloHTML(k)).join('')}</div>
        <textarea id="popResp" rows="2" placeholder="Responder o añadir otra nota…"></textarea>` : ''}
      <div class="vc-pop-acc">
        <button class="btn" data-pop="editar">✎ Editar texto</button>
        ${notas ? `<button class="btn prim" data-pop="guardar-nota">Añadir nota</button>${pendiente(keys) ? `<button class="btn verde" data-pop="resolver">✓ Resuelto</button>` : ''}`
          : `<button class="btn prim" data-pop="nota">💬 Crear nota</button>`}
      </div>`;
  } else if (modo === 'editar' || modo === 'rellenar') {
    cuerpo = `<div class="vc-pop-campos">${keys.map((k, i) => `<label for="pk${i}">${esc(VIC_CAMPOS.campo(k).label)}</label>${control(k, VIC.valor(e, k), 'pk' + i)}`).join('')}</div>
      ${modo === 'editar' ? '<p class="nota">El texto original seguirá visible, tachado, y la parroquia podrá aprobar la rectificación.</p>' : ''}
      <div class="vc-pop-acc"><button class="btn" data-pop="${modo === 'editar' ? 'menu' : 'cerrar'}">Cancelar</button><button class="btn prim" data-pop="${modo === 'editar' ? 'guardar-cambio' : 'guardar-vic'}">${modo === 'editar' ? 'Guardar rectificación' : 'Guardar'}</button></div>`;
  } else if (modo === 'nota') {
    cuerpo = `<textarea id="popResp" rows="4" placeholder="Escribe la nota para la parroquia…"></textarea>
      <div class="vc-pop-acc"><button class="btn" data-pop="menu">Cancelar</button><button class="btn prim" data-pop="guardar-nota">Guardar nota</button></div>`;
  }
  p.innerHTML = `<button class="vc-pop-x" data-pop="cerrar" aria-label="Cerrar">✕</button><div class="vc-pop-tit">${esc(titulo)}</div>${cuerpo}`;
  (document.fullscreenElement || document.body).appendChild(p);
  _pop = p; p._ancla = ancla;
  const r = ancla.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight;
  let x = r.right + 10, y = r.top - 8;
  if (x + pw > window.innerWidth - 10) x = Math.max(10, r.left - pw - 10);
  if (x < 10) x = Math.min(window.innerWidth - pw - 10, Math.max(10, r.left));
  if (y + ph > window.innerHeight - 10) y = Math.max(10, window.innerHeight - ph - 10);
  // en pantalla completa va fija; si no, se mueve con la página
  if (document.fullscreenElement) { p.style.position = 'fixed'; p.style.left = x + 'px'; p.style.top = y + 'px'; }
  else { p.style.position = 'absolute'; p.style.left = (x + window.scrollX) + 'px'; p.style.top = (y + window.scrollY) + 'px'; }
  const foco = p.querySelector('textarea, input, select');
  if (foco && modo !== 'menu') { foco.focus(); if (foco.select && foco.tagName !== 'SELECT') foco.select(); }
}
async function accionPop(t) {
  const a = t.dataset.pop, keys = _pop.dataset.keys.split(' '), ancla = _pop._ancla, k0 = keys[0];
  const valor = id => (_pop.querySelector('#' + id) || {}).value || '';
  if (a === 'cerrar') return cerrarPop();
  if (a === 'menu' || a === 'editar' || a === 'nota') return abrirPop(keys, ancla, a);
  if (a === 'guardar-nota') {
    const txt = valor('popResp').trim(); if (!txt) { _pop.querySelector('#popResp').focus(); return; }
    cerrarPop(); return cambiar([{ op: 'nota', k: k0, texto: txt, nid: util.id() }]);
  }
  if (a === 'resolver') { cerrarPop(); return cambiar(keys.filter(k => VIC.hiloPendiente(V.exp, k, 'vicaria')).map(k => ({ op: 'resolver', k }))); }
  if (a === 'retirar') { cerrarPop(); return cambiar([{ op: 'borrar', k: t.dataset.k, id: t.dataset.id }]); }
  if (a === 'guardar-cambio' || a === 'guardar-vic') {
    const ops = [];
    keys.forEach((k, i) => {
      const v = valor('pk' + i);
      if (a === 'guardar-vic') { if (v !== (V.exp.datos[k] || '')) ops.push({ op: 'vic', k, v }); }
      else if (v !== VIC.valor(V.exp, k)) ops.push({ op: 'cambio', k, texto: v, nid: util.id() });
    });
    cerrarPop();
    if (ops.length) return cambiar(ops);
  }
}

/* ---------------- GUARDAR (cola de cambios hacia el buzón) ---------------- */
function cambiar(ops, repintar = true) {
  if (!ops.length) return;
  VIC.aplicar(V.exp, ops, 'vicaria', util);
  V.cola.push({ id: V.exp.id, ops });
  if (repintar) repintarExp();
  procesarCola();
}
async function procesarCola() {
  if (V.enviando || !V.cola.length) return;
  V.enviando = true; marcarGuardado('guardando');
  const { id, ops } = V.cola[0];
  try {
    const r = await VicariaServicio.ops(token(), id, ops);
    V.cola.shift();
    if (!V.cola.length && V.exp && V.exp.id === id) { V.exp = r.expediente; repintarExp(true); }
    marcarGuardado(V.cola.length ? 'guardando' : 'ok');
    const fila = V.lista && V.lista.find(x => x.id === id);
    if (fila) { Object.assign(fila, VIC.resumen(r.expediente)); if (V.vista === 'general') pintar(); }
    V.enviando = false;
    if (V.cola.length) procesarCola();
  } catch (e) {
    V.enviando = false;
    if (errorDeSesion(e)) return;
    marcarGuardado('error'); console.error(e);
    setTimeout(procesarCola, 8000);
  }
}
function marcarGuardado(s) {
  V.estadoGuardado = s;
  const el = $('#guardado');
  if (el) { el.textContent = s === 'guardando' ? 'Guardando…' : s === 'error' ? 'No se pudo guardar · reintentando' : '✓ Guardado'; el.classList.toggle('aviso', s === 'error'); }
  else if (s) pintarCabecera();
}
function pintarCabecera() { const h = $('header.barra'); if (h) { const t = document.createElement('div'); t.innerHTML = cabecera(h.querySelector('h1').textContent); h.replaceWith(t.firstElementChild); } }
async function repintarExp(silencioso) {
  // la respuesta del buzón trae lo mismo que ya se ve: no se repinta si se está escribiendo o con una ventana abierta
  if (silencioso && (_pop || /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName))) return;
  if (V.vista === 'detalle') {
    const y = window.scrollY;
    pintar(); window.scrollTo(0, y);
  } else if (V.vista === 'revision') {
    await prepararPaginas();
    const marco = $('#marco');
    if (marco && !V.girando) { const c = $('.vc-cab-exp'); const t = document.createElement('div'); t.innerHTML = cabExpediente(); c.replaceWith(t.firstElementChild); pintarLibro(); }
  }
}

/* ---------------- ESTADOS ---------------- */
async function cambiarEstado(acc) {
  const e = V.exp, n = Object.keys(e.marcas || {}).filter(k => VIC.marcas(e, k).some(m => m.de === 'vicaria')).length;
  const pasos = {
    aprobar: ['aprobado_contactar', '¿Aprobar el expediente? Pasará a «Aprobado pendiente contactar novios».'],
    devolver: ['revisado_parroquia', n ? `¿Devolver el expediente a la parroquia con ${n} ${n === 1 ? 'dato anotado' : 'datos anotados'}? La parroquia verá el botón «Revisión».` : 'No hay notas ni rectificaciones. ¿Devolver igualmente a la parroquia?'],
    avisados: ['aprobado_alegato', '¿Ya se ha avisado a los novios? Pasará a «Aprobado pendiente de recoger Alegato V».'],
    recogido: ['recogido_alegato', '¿Han recogido el Alegato V?'],
    archivar: ['archivado', '¿Archivar el expediente? Dejará de verse en la lista principal.'],
  };
  if (acc === 'desarchivar') {
    const antes = [...(e.historial || [])].reverse().find(h => h.estado !== 'archivado');
    return cambiar([{ op: 'estado', estado: antes ? antes.estado : 'pendiente_revision' }]);
  }
  const [estado, msg] = pasos[acc];
  if (acc === 'aprobar' && !e.datos.vic_celebrar_en && !await confirmar('Aún no está rellena la aprobación de la última página (pestaña «Vicaría»). ¿Aprobar igualmente?', 'Aprobar')) return;
  if (acc !== 'aprobar' && !await confirmar(msg, 'Sí')) return;
  if (acc === 'aprobar' && e.datos.vic_celebrar_en && !await confirmar(msg, 'Aprobar')) return;
  cambiar([{ op: 'estado', estado }]);
  aviso(`Estado: ${VIC.estado(estado).nombre}.`);
  if (estado === 'archivado') location.hash = '#/';
}

/* ---------------- IMPRIMIR ---------------- */
async function imprimir(b, alegato) {
  b.disabled = true;
  try {
    const res = alegato ? await Motor.maquetarAlegato(alDatos(), ctxAlegato()) : await Motor.maquetarExpediente(VIC.datosEfectivos(V.exp), ctxImpreso(false), 'todo');
    const bytes = await Motor.aPDF(res, (alegato ? 'Alegato V - ' : 'Expediente matrimonial - ') + VIC.titulo(V.exp));
    document.getElementById('marcoImpresion')?.remove();
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const marco = document.createElement('iframe');
    marco.id = 'marcoImpresion'; marco.setAttribute('aria-hidden', 'true');
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    marco.onload = () => setTimeout(() => { try { marco.contentWindow.focus(); marco.contentWindow.print(); } catch (e) { window.open(url, '_blank'); } }, 250);
    marco.src = url; document.body.appendChild(marco);
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60000);
  } catch (e) { console.error(e); aviso('No se pudo preparar la impresión.'); }
  b.disabled = false;
}

/* ---------------- NAVEGACIÓN Y CARGA ---------------- */
async function cargarLista() {
  try { const r = await VicariaServicio.listar(token(), V.todo); V.lista = r.lista; V.buzones = r.buzones || V.buzones; V.errorLista = ''; }
  catch (e) { if (errorDeSesion(e)) return; V.errorLista = 'No se pudo cargar la lista: ' + e.message; }
  if (V.vista === 'general') pintar();
}
async function cargarExp(id, silencioso) {
  try {
    const r = await VicariaServicio.expediente(token(), id), exp = r.expediente;
    if (V.cola.length) return;                    // hay cambios propios sin guardar: se respeta lo de aquí
    if (silencioso && V.exp && V.exp.id === id && V.exp.version === exp.version) return;
    V.exp = exp; V.configPara = r.config || null; V.errorExp = '';
    if (V.vista === 'revision') await prepararPaginas();
  } catch (e) { if (errorDeSesion(e)) return; V.errorExp = e.message; }
  if (V.id === id) pintar();
}
function ir() {
  cerrarPop();
  const m = /^#\/(e|r)\/([\w-]+)/.exec(location.hash);
  if (!sesionLista()) { V.vista = 'entrada'; pintar(); return; }
  if (!V.config && !V._cargandoConfig) { V._cargandoConfig = true; cargarConfig().finally(() => { V._cargandoConfig = false; }); }
  if (location.hash === '#/datos') { V.vista = 'datos'; pintar(); window.scrollTo(0, 0); return; }
  if (!m) { V.vista = 'general'; V.id = null; pintar(); cargarLista(); return; }
  const nueva = m[2] !== V.id;
  V.vista = m[1] === 'e' ? 'detalle' : 'revision'; V.id = m[2];
  if (nueva) { V.exp = null; V.paginas = null; V.spread = 0; V.pestana = 'datos'; V.errorExp = ''; V.alProv = {}; }
  pintar(); window.scrollTo(0, 0);
  if (!V.exp) cargarExp(V.id);
  else if (V.vista === 'revision') prepararPaginas().then(() => { if (V.vista === 'revision') { pintar(); } });
}
function pintar() {
  const app = $('#app');
  if (V.vista === 'entrada') app.innerHTML = vistaEntrada();
  else if (V.vista === 'general') app.innerHTML = vistaGeneral();
  else if (V.vista === 'datos') app.innerHTML = vistaDatos();
  else if (!V.exp) app.innerHTML = `${cabecera('Expediente')}<main><div class="tarjeta vc-cargando">${V.errorExp ? `<p class="vc-error">${esc(V.errorExp)}</p><a class="btn" href="#/">Volver a la lista</a>` : 'Abriendo el expediente…'}</div></main>`;
  else if (V.vista === 'detalle') { app.innerHTML = vistaDetalle(); if (V.pestana === 'alegato') previaAlegato(); else requestAnimationFrame(colocarNotas); }
  else { app.innerHTML = vistaRevision(); if (V.paginas) pintarLibro(); else prepararPaginas().then(() => { if (V.vista === 'revision') pintarLibro(); }); }
}

/* ---------------- EVENTOS ---------------- */
document.addEventListener('click', async e => {
  const t = e.target;
  if (_pop && !t.closest('.vc-pop') && !t.closest('[data-k]') && !t.closest('[data-nota]')) cerrarPop();
  const pop = t.closest('[data-pop]'); if (pop) { accionPop(pop); return; }
  const irA = t.closest('[data-ir]'); if (irA) { location.hash = irA.dataset.ir; return; }
  const ord = t.closest('[data-orden]');
  if (ord) { const por = ord.dataset.orden; V.orden = { por, inv: V.orden.por === por ? !V.orden.inv : false }; guardar('orden', V.orden); pintar(); return; }
  const pes = t.closest('[data-pestana]'); if (pes) { V.pestana = pes.dataset.pestana; pintar(); return; }
  const qa = t.closest('[data-quitar-acceso]');
  if (qa) { if (await confirmar(`¿Quitar el acceso de ${qa.dataset.quitarAcceso} a tus expedientes?`, 'Quitar')) cambiarAccesos(V.accesos.filter(x => x !== qa.dataset.quitarAcceso)); return; }
  const quitar = t.closest('[data-al-quitar]'); if (quitar) { guardarAlegato(quitar.dataset.alQuitar, alBase(quitar.dataset.alQuitar), true); return; }
  // pulsar un dato (detalle), una nota del margen o un dato del impreso (revisión)
  const icono = t.closest('.vc-icono'), zona = t.closest('.vc-zona'), campo = t.closest('.vc-campo[data-k]'), nota = t.closest('[data-nota]');
  if (icono || zona) { if (!V.girando) abrirPop((icono || zona).dataset.k.split(' '), icono || zona); return; }
  if (campo) { abrirPop([campo.dataset.k], campo); return; }
  if (nota) { abrirPop([nota.dataset.nota], nota); return; }
  const b = t.closest('[data-acc]'); if (!b || b.disabled) return;
  const a = b.dataset.acc;
  if (a === 'entrar') entrarGoogle();
  else if (a === 'prueba') { VicariaServicio.activarPrueba(true); V.todo = true; aviso('Modo de prueba: los expedientes se guardan en este navegador.'); ir(); }
  else if (a === 'salir-prueba') { if (await confirmar('¿Salir del modo de prueba?', 'Salir')) { VicariaServicio.activarPrueba(false); V.lista = null; V.todo = false; V.config = null; ir(); } }
  else if (a === 'salir') { if (await confirmar('¿Cerrar la sesión de la Vicaría en este navegador?', 'Cerrar sesión')) { try { google.accounts.oauth2.revoke(V.sesion.token, () => {}); } catch (x) {} guardarSesion(null); Object.assign(V, { lista: null, config: null, accesos: [], buzones: [], todo: false, exp: null, id: null }); ir(); } }
  else if (a === 'modo') HSTema.cambiar();
  else if (a === 'actualizar') { V.lista = null; pintar(); cargarLista(); }
  else if (a === 'archivados') { V.archivados = !V.archivados; pintar(); }
  else if (a === 'imprimir') imprimir(b);
  else if (a === 'imprimir-alegato') imprimir(b, true);
  else if (a === 'ampliar-alegato') ampliarAlegato();
  else if (a === 'guardar-config') guardarConfigVicaria(b);
  else if (a === 'anadir-acceso') anadirAcceso(b);
  else if (a === 'todo') { V.todo = !V.todo; V.lista = null; pintar(); cargarLista(); }
  else if (a === 'quitar-logo') { V.config = { ...leerFormConfig(), logoDiocesis: '' }; pintar(); }
  else if (a === 'volver') history.length > 1 ? history.back() : (location.hash = '#/');
  else if (a === 'anterior') pasar(-1);
  else if (a === 'siguiente') pasar(1);
  else if (a === 'pantalla') pantallaCompleta();
  else if (['aprobar', 'devolver', 'avisados', 'recogido', 'archivar', 'desarchivar'].includes(a)) cambiarEstado(a);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarPop();
  if (e.key === 'Enter' && e.target.id === 'nuevoAcceso') { e.preventDefault(); anadirAcceso(); return; }
  const escribiendo = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName);
  if (e.key === 'Enter' && !escribiendo) {
    const f = e.target.closest && (e.target.closest('tr[data-ir]') || e.target.closest('.vc-campo[data-k]') || e.target.closest('[data-nota]'));
    if (f) { e.preventDefault(); f.click(); }
  }
  if (V.vista === 'revision' && !escribiendo && !_pop) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); pasar(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); pasar(-1); }
  }
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && _pop) { const p = _pop.querySelector('.vc-pop-acc .prim'); if (p) p.click(); }
});
// Campos de las pestañas «Vicaría» y «Alegato V»: se guardan al salir de cada uno
document.addEventListener('change', async e => {
  const el = e.target; if (!el.dataset) return;
  if (el.dataset.logo !== undefined) {
    const f = el.files && el.files[0]; if (!f) return;
    try { V.config = { ...leerFormConfig(), logoDiocesis: await leerImagen(f) }; pintar(); } catch (x) { aviso('No se pudo leer la imagen.'); }
    return;
  }
  if (!V.exp) return;
  if (el.dataset.vic) { if (el.value !== (V.exp.datos[el.dataset.vic] || '')) cambiar([{ op: 'vic', k: el.dataset.vic, v: el.value }], false); return; }
  if (el.dataset.al) { guardarAlegato(el.dataset.al, el.value, false); repintarCampoAlegato(el.dataset.al); previaAlegato(); }
});
// Mientras se escribe en el Alegato, la vista previa se actualiza sola
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset || !el.dataset.al || !V.exp) return;
  (V.alProv = V.alProv || {})[el.dataset.al] = el.value;   // provisional: al salir del campo se guarda de verdad
  previaAlegato();
});
window.addEventListener('resize', () => { if (V.vista === 'detalle') colocarNotas(); if (V.vista === 'revision') medirLibro(); cerrarPop(); });
window.addEventListener('hashchange', ir);
// Al volver a la pestaña, trae lo que haya cambiado (respuestas de las parroquias, expedientes nuevos)
let _ultimaVuelta = 0;
function refrescar() {
  if (!sesionLista() || Date.now() - _ultimaVuelta < 20000) return;
  _ultimaVuelta = Date.now();
  if (V.vista === 'general') cargarLista();
  else if (V.id && !V.cola.length && !_pop) cargarExp(V.id, true);
}
window.addEventListener('focus', refrescar);
setInterval(() => { if (!document.hidden) { _ultimaVuelta = 0; refrescar(); } }, 90000);

/* ---------------- ARRANQUE ---------------- */
(async () => {
  try { const s = JSON.parse(sessionStorage.getItem('vicaria.sesion') || 'null'); if (s && s.caduca > Date.now() + 30000) V.sesion = s; } catch (e) {}
  await Motor.iniciar();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (V.vista === 'detalle') colocarNotas(); });
  ir();
})();

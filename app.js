/* ============================================================
   APLICACIÓN: menú, pantallas de datos, configuración
   Prototipo: guarda la configuración y el registro actual en este
   navegador. En la versión final esto irá al Google Drive de la parroquia.
   ============================================================ */

const CONFIG_DEFECTO = {
  nombre: 'Parroquia de Ejemplo',
  direccion: 'c/ Mayor, 1',
  localidad: 'Villanueva',
  cp: '28000',
  provincia: 'Madrid',
  web: 'www.parroquiadeejemplo.es',
  papa: 'León XIV',
  color: '#a8322d',
  logo: '', sello: '',
  firmas: [
    { nombre: 'Nombre del Párroco', cargo: 'Párroco', firma: '' },
    { nombre: 'Nombre de la Secretaria', cargo: 'secretaria', firma: '' },
  ],
  firmaActual: 0,
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

const estado = {
  config: Object.assign(structuredClone(CONFIG_DEFECTO), Almacen.leer('config', {})),
  registro: Almacen.leer('registro', {}),
  fechaDocumento: hoyISO(),
  vista: 'menu',
  certId: null,
  descargas: null,
};

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function aviso(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(aviso._t); aviso._t = setTimeout(() => t.classList.remove('on'), 3200);
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
function guardarConfig() { if (!Almacen.guardar('config', estado.config)) aviso('No se pudo guardar en este navegador (imágenes demasiado grandes).'); }
function guardarRegistro() { Almacen.guardar('registro', estado.registro); }
function firmante() { return estado.config.firmas[estado.config.firmaActual] || estado.config.firmas[0] || {}; }

/* ---------------- ICONOS ---------------- */
const ICONOS = {
  catequesis: `<svg viewBox="0 0 48 48"><circle cx="24" cy="9" r="5" fill="#f3ead2"/><path d="M12 17h24c0 8-5 13-12 13S12 25 12 17z" fill="#c9a65a"/><rect x="22" y="30" width="4" height="8" fill="#c9a65a"/><path d="M15 42c0-3 4-4 9-4s9 1 9 4z" fill="#c9a65a"/><path d="M24 19v8M21 22h6" stroke="#7a4f12" stroke-width="1.6"/></svg>`,
  bautismo: `<svg viewBox="0 0 48 48"><path d="M24 40C12 40 6 30 8 20c6-1 11-8 16-12 5 4 10 11 16 12 2 10-4 20-16 20z" fill="#efe2c4"/><path d="M24 12v26M17 16l4 22M31 16l-4 22M11 22l9 16M37 22l-9 16" stroke="#c9a65a" stroke-width="1.2" fill="none"/><path d="M24 20v8M21 23h6" stroke="#7a4f12" stroke-width="1.8"/></svg>`,
  matrimonio: `<svg viewBox="0 0 48 48"><path d="M24 42S6 31 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 13-18 24-18 24z" fill="#efe2c4"/><circle cx="20" cy="24" r="6.5" fill="none" stroke="#c9a65a" stroke-width="3"/><circle cx="28" cy="24" r="6.5" fill="none" stroke="#e0b84e" stroke-width="3"/></svg>`,
  confirmacion: `<svg viewBox="0 0 48 48"><path d="M24 14c-4 0-6 3-6 6l-13-5c2 7 7 11 13 12l-3 9 9-6 9 6-3-9c6-1 11-5 13-12l-13 5c0-3-2-6-6-6z" fill="#f3ead2"/><circle cx="24" cy="10" r="3" fill="#f3ead2"/><path d="M14 40l4-6M34 40l-4-6M24 42v-6" stroke="#c9a65a" stroke-width="2.4" stroke-linecap="round"/></svg>`,
};
const IC = {
  menu: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  pdf: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M12 10v7M9 14l3 3 3-3"/></svg>',
  pluma: '<svg viewBox="0 0 24 24"><path d="M4 20h16"/><path d="M14 4l4 4-9 9H5v-4z"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
};

/* ---------------- RENDER GENERAL ---------------- */
function render() {
  const app = $('#app');
  if (estado.vista === 'menu') app.innerHTML = vistaMenu();
  else if (estado.vista === 'config') app.innerHTML = vistaConfig();
  else app.innerHTML = vistaFormulario();
  window.scrollTo(0, 0);
  if (estado.vista === 'form') actualizarPrevia();
}

/* ---------------- MENÚ PRINCIPAL ---------------- */
function vistaMenu() {
  const cfg = estado.config;
  const opcFirmas = cfg.firmas.map((f, i) => `<option value="${i}" ${i == cfg.firmaActual ? 'selected' : ''}>${esc(f.nombre)} — ${esc(f.cargo)}</option>`).join('');
  const grupos = GRUPOS.map(g => {
    const botones = CERTIFICADOS.filter(c => c.grupo === g.id).map(c =>
      `<button class="cert ${c.estado === 'pendiente' ? 'pend' : ''}" data-abrir="${c.id}">${c.estado === 'pendiente' ? '<span class="pill">pendiente</span>' : ''}${esc(c.nombre)}</button>`).join('');
    return `<div class="grupo"><div><div class="icono">${ICONOS[g.id]}</div><div class="etq">${g.nombre}</div></div><div class="botones">${botones}</div></div>`;
  }).join('');
  const hayRegistro = Object.values(estado.registro).some(v => v && String(v).trim());
  return `
  <header class="barra"><h1>Certificados</h1><button class="btn-cab" data-ir="config">⚙ Datos de la parroquia</button></header>
  <main>
    <div class="menu-top">
      <div class="tarjeta">
        <h3>Firma</h3>
        <div class="fila"><select id="selFirma">${opcFirmas}</select><button class="btn" data-ir="config">Firmas</button></div>
        <div class="fila" style="margin-top:12px">
          <button class="btn prim" id="nuevoRegistro">Nuevo registro</button>
          <span class="nota" style="margin:0">${hayRegistro ? 'Hay datos de un registro en curso: se rellenan solos en cada certificado.' : 'Empieza un registro nuevo para cada persona o pareja.'}</span>
        </div>
      </div>
      <div class="tarjeta busqueda">
        <h3>Búsqueda</h3>
        <div class="campos" style="grid-template-columns:1fr 1fr;display:grid;gap:8px">
          <input type="text" placeholder="nombre esposo/padre" disabled>
          <input type="text" placeholder="apellidos esposo/padre" disabled>
          <input type="text" placeholder="nombre esposa/madre" disabled>
          <input type="text" placeholder="apellidos esposa/madre" disabled>
        </div>
        <div class="nota">La búsqueda llegará cuando los registros se guarden en el Google Drive de la parroquia.</div>
      </div>
    </div>
    <div class="tarjeta">${grupos}
      <div class="leyenda"><span>Modelo listo</span><span class="p">Falta el modelo (PDF de ejemplo)</span></div>
    </div>
  </main>`;
}

/* ---------------- PANTALLA DE DATOS ---------------- */
function campoHTML(c) {
  const v = estado.registro[c.k] ?? '';
  const id = 'c_' + c.k;
  let ctl;
  if (c.tipo === 'sexo') {
    const s = v || 'M';
    ctl = `<div class="sexo" data-sexo><button type="button" data-v="M" class="${s === 'M' ? 'on' : ''}">Varón</button><button type="button" data-v="F" class="${s === 'F' ? 'on' : ''}">Mujer</button></div>`;
  } else if (c.tipo === 'textarea') ctl = `<textarea id="${id}" data-k="${c.k}" rows="3">${esc(v)}</textarea>`;
  else if (c.tipo === 'select') ctl = `<select id="${id}" data-k="${c.k}"><option value=""></option>${c.opciones.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  else ctl = `<input id="${id}" data-k="${c.k}" type="${c.tipo || 'text'}" value="${esc(v)}" placeholder="${esc(c.ph || '')}" autocomplete="off">`;
  return `<div class="campo"><label for="${id}">${esc(c.label)}</label>${ctl}</div>`;
}

function vistaFormulario() {
  const cert = CERTIFICADOS.find(c => c.id === estado.certId);
  const listo = cert.estado === 'listo';
  const cfg = estado.config;
  const opcFirmas = cfg.firmas.map((f, i) => `<option value="${i}" ${i == cfg.firmaActual ? 'selected' : ''}>${esc(f.nombre)}</option>`).join('');
  // agrupa los campos cortos (libro/folio/nº) de tres en tres
  let html = '', cortos = [];
  const vaciar = () => { if (cortos.length) { html += `<div class="dos">${cortos.join('')}</div>`; cortos = []; } };
  cert.campos.forEach(c => { if (c.corto) { cortos.push(campoHTML(c)); if (cortos.length === 3) vaciar(); } else { vaciar(); html += campoHTML(c); } });
  vaciar();
  if (!cert.campos.length) html = '<p class="nota">Esta pantalla todavía no está hecha. Cuando me pases la captura y un PDF de ejemplo, la monto.</p>';

  return `
  <header class="barra"><h1>${esc(cert.titulo)}</h1></header>
  <main>
    <div class="form-layout">
      <div class="tarjeta">
        <div class="campos">
          <div class="campo"><label for="selFirma">Firma</label><select id="selFirma">${opcFirmas}</select></div>
          <div class="campo"><label for="fechaDoc">Fecha del documento</label><input type="date" id="fechaDoc" value="${estado.fechaDocumento}"></div>
          <hr class="sep">
          ${html}
        </div>
      </div>
      <div class="previa" id="previa"></div>
      <div class="acciones">
        <button class="acc" data-ir="menu">${IC.menu}Menú principal</button>
        <button class="acc prim" data-pdf="1" ${listo ? '' : 'disabled'}>${IC.pluma}<span>PDF con firma<small>Con sello y firma escaneada</small></span></button>
        <button class="acc" data-pdf="0" ${listo ? '' : 'disabled'}>${IC.pdf}<span>PDF sin firma<small>Para firmar a mano</small></span></button>
        <button class="acc" disabled title="Llegará con la conexión a Google">${IC.mail}<span>Enviar por mail<small>Próximamente</small></span></button>
      </div>
    </div>
  </main>`;
}

let _previaPend = null;
function actualizarPrevia() {
  clearTimeout(_previaPend);
  _previaPend = setTimeout(async () => {
    const caja = $('#previa'); if (!caja) return;
    const cert = CERTIFICADOS.find(c => c.id === estado.certId);
    if (cert.estado !== 'listo') {
      caja.innerHTML = `<div class="pendiente-aviso"><strong>Falta el modelo de este certificado</strong>Las pantallas ya recogen los datos. Pásame un PDF de ejemplo generado por FileMaker y dejo el texto igual que el original.</div>`;
      return;
    }
    const ops = await Motor.maquetar(cert, estado.registro, ctx(), true);
    caja.innerHTML = Motor.aSVG(ops);
  }, 60);
}
function ctx() { return { config: estado.config, firmante: firmante(), fechaDocumento: estado.fechaDocumento }; }

async function generarPDF(conFirma) {
  const cert = CERTIFICADOS.find(c => c.id === estado.certId);
  const ops = await Motor.maquetar(cert, estado.registro, ctx(), conFirma);
  const bytes = await Motor.aPDF(ops, cert.titulo);
  const quien = [estado.registro.apellidos || estado.registro.novio_apellidos, estado.registro.nombre || estado.registro.novio_nombre].filter(Boolean).join(' ');
  const nombre = `${cert.nombre}${quien ? ' - ' + quien : ''}.pdf`.replace(/[\\/:*?"<>|]/g, '');
  const blob = new Blob([bytes], { type: 'application/pdf' });

  if (estado.descargas) {
    try { await estado.descargas.save({ filename: nombre, data: blob }); aviso('PDF guardado. Ábrelo para imprimirlo.'); return; }
    catch (e) { if (e && e.code === 'declined') return; }
  }
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) { const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------------- CONFIGURACIÓN ---------------- */
function vistaConfig() {
  const c = estado.config;
  const inp = (k, label, ph = '') => `<div class="campo"><label for="cfg_${k}">${label}</label><input type="text" id="cfg_${k}" data-cfg="${k}" value="${esc(c[k])}" placeholder="${esc(ph)}"></div>`;
  const img = (k, label, ayuda) => `<div class="campo"><label>${label}</label><div class="imgbox"><div class="vista">${c[k] ? `<img src="${c[k]}" alt="">` : 'sin imagen'}</div><div><input type="file" accept="image/*" data-img="${k}"><div class="nota">${ayuda}</div>${c[k] ? `<button class="btn" data-quitar="${k}" style="margin-top:6px">Quitar</button>` : ''}</div></div></div>`;
  const firmas = c.firmas.map((f, i) => `
    <div class="firmante">
      <div class="fila"><input type="text" data-f="${i}" data-fk="nombre" value="${esc(f.nombre)}" placeholder="Nombre y apellidos"><input type="text" data-f="${i}" data-fk="cargo" value="${esc(f.cargo)}" placeholder="Cargo (Párroco, secretaria…)" style="max-width:180px"></div>
      <div class="imgbox"><div class="vista">${f.firma ? `<img src="${f.firma}" alt="">` : 'sin firma'}</div><div><input type="file" accept="image/*" data-firma="${i}"><div class="nota">Firma escaneada, mejor en PNG con fondo transparente.</div>
      <div class="fila" style="margin-top:6px">${f.firma ? `<button class="btn" data-quitarfirma="${i}">Quitar firma</button>` : ''}${c.firmas.length > 1 ? `<button class="btn" data-borrarf="${i}">Eliminar firmante</button>` : ''}</div></div></div>
    </div>`).join('');
  return `
  <header class="barra"><h1>Datos de la parroquia</h1><button class="btn-cab" data-ir="menu">← Volver al menú</button></header>
  <main>
    <div class="config">
      <div class="tarjeta"><h3>Membrete</h3><div class="campos">
        ${inp('nombre', 'Nombre de la parroquia')}${inp('direccion', 'Dirección')}${inp('localidad', 'Localidad')}
        <div class="dos" style="grid-template-columns:1fr 2fr">${inp('cp', 'C.P.')}${inp('provincia', 'Provincia')}</div>
        ${inp('web', 'Web')}
        <div class="campo"><label for="cfg_color">Color del membrete</label><input type="color" id="cfg_color" data-cfg="color" value="${esc(c.color)}" style="width:80px;height:38px;padding:2px"></div>
        ${inp('papa', 'Papa (para la Bendición Apostólica)')}
      </div></div>
      <div class="tarjeta"><h3>Imágenes</h3><div class="campos">
        ${img('logo', 'Logo (arriba a la izquierda)', 'PNG o JPG.')}
        ${img('sello', 'Sello (junto a la firma)', 'Solo aparece en «PDF con firma».')}
      </div></div>
      <div class="tarjeta"><h3>Firmantes</h3>${firmas}<button class="btn" id="anadirFirma">+ Añadir firmante</button></div>
    </div>
    <p class="nota" style="margin-top:16px">En este prototipo los datos se guardan solo en este navegador. En la versión final se guardarán en el Google Drive de la parroquia.</p>
  </main>`;
}

// Convierte cualquier imagen subida a PNG de tamaño razonable
function leerImagen(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const max = 900, k = Math.min(1, max / Math.max(im.width, im.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        res(cv.toDataURL('image/png'));
      };
      im.onerror = rej; im.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

/* ---------------- EVENTOS ---------------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.ir) { estado.vista = t.dataset.ir; render(); }
  else if (t.dataset.abrir) { estado.certId = t.dataset.abrir; estado.vista = 'form'; render(); }
  else if (t.dataset.pdf) {
    t.disabled = true;
    try { await generarPDF(t.dataset.pdf === '1'); } catch (err) { console.error(err); aviso('No se pudo generar el PDF.'); }
    t.disabled = false;
  }
  else if (t.id === 'nuevoRegistro') {
    if (await confirmar('¿Empezar un registro nuevo? Se borrarán los datos que hay escritos ahora en las pantallas.', 'Empezar nuevo')) {
      estado.registro = {}; guardarRegistro(); render(); aviso('Registro nuevo.');
    }
  }
  else if (t.closest('[data-sexo]')) {
    estado.registro.sexo = t.dataset.v; guardarRegistro();
    t.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === t));
    actualizarPrevia();
  }
  else if (t.id === 'anadirFirma') { estado.config.firmas.push({ nombre: '', cargo: '', firma: '' }); guardarConfig(); render(); }
  else if (t.dataset.borrarf) {
    if (await confirmar('¿Eliminar este firmante?', 'Eliminar')) {
      estado.config.firmas.splice(+t.dataset.borrarf, 1);
      estado.config.firmaActual = 0; guardarConfig(); render();
    }
  }
  else if (t.dataset.quitar) { estado.config[t.dataset.quitar] = ''; guardarConfig(); render(); }
  else if (t.dataset.quitarfirma) { estado.config.firmas[+t.dataset.quitarfirma].firma = ''; guardarConfig(); render(); }
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.k) { estado.registro[el.dataset.k] = el.value; guardarRegistro(); actualizarPrevia(); }
  else if (el.id === 'fechaDoc') { estado.fechaDocumento = el.value; actualizarPrevia(); }
  else if (el.dataset.cfg) { estado.config[el.dataset.cfg] = el.value; guardarConfig(); }
  else if (el.dataset.f !== undefined && el.dataset.fk) { estado.config.firmas[+el.dataset.f][el.dataset.fk] = el.value; guardarConfig(); }
});

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.id === 'selFirma') { estado.config.firmaActual = +el.value; guardarConfig(); actualizarPrevia(); }
  else if (el.dataset.img || el.dataset.firma !== undefined) {
    const f = el.files && el.files[0]; if (!f) return;
    try {
      const url = await leerImagen(f);
      if (el.dataset.img) estado.config[el.dataset.img] = url; else estado.config.firmas[+el.dataset.firma].firma = url;
      guardarConfig(); render();
    } catch (err) { aviso('No se pudo leer la imagen.'); }
  }
});

/* ---------------- ARRANQUE ---------------- */
(async () => {
  await Motor.iniciar();
  render();
  // Si la página se abre dentro de Claude, usa su sistema de descargas
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then(d => { estado.descargas = d; }).catch(() => {});
  }
})();

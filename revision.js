/* ============================================================
   VICARÍA (beta) · LADO DE LA PARROQUIA
   - «Enviar a Vicaría» en la pantalla del expediente matrimonial: manda el
     expediente completo del registro al buzón de la Vicaría.
   - Consulta cómo van los expedientes enviados. Si la Vicaría devuelve uno,
     aparece el botón rojo «Revisión» junto a «Expediente prematrimonial».
   - Pantalla «Revisión de expediente»: notas y rectificaciones de la Vicaría,
     con respuesta, aprobación o corrección, y «Devolver a la vicaría».
   El expediente va al correo que se elige al enviar (por defecto, el email de la Vicaría en
   «Datos de la parroquia»): en «Expedientes Vicaría» lo ven esa cuenta de Google y a quien ella dé acceso.
   El enlace con la Vicaría se guarda en el propio registro (vicaria_id, vicaria_clave,
   vicaria_enviado, vicaria_para), así lo ven todos los ordenadores de la parroquia por Google Drive.
   Se carga antes que app.js y solo usa sus funciones cuando se le llama.
   ============================================================ */

const Vicaria = (() => {
  let _st = null;
  const S = () => _st || (_st = {
    estados: Almacen.leer('vicaria.estados', {}),  // id → { estado, version, pendientes, aprobado }
    exp: null, expDe: null, cargando: false, error: '',
    pestana: 'datos', otraForma: new Set(), respuestas: {}, ultima: 0,
  });
  const util = { ahora: () => new Date().toISOString(), id: () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
  const ICV = {
    enviar: '<svg viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-3-6z"/><path d="M11 14l9-10"/></svg>',
    revision: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13l2 2 4-4"/></svg>',
    vicaria: '<svg viewBox="0 0 24 24"><path d="M4 21V10l8-6 8 6v11"/><path d="M9 21v-6h6v6"/><path d="M12 4V1M10.5 2.5h3"/></svg>',
  };

  /* ---------- Enlace de cada registro con la Vicaría ---------- */
  const enlace = r => (r && r.datos.vicaria_id && r.datos.vicaria_clave) ? { id: r.datos.vicaria_id, clave: r.datos.vicaria_clave } : null;
  const enviados = () => estado.registros.filter(enlace);
  const estadoDe = r => { const e = enlace(r); return e ? S().estados[e.id] || null : null; };
  const devueltos = () => enviados().filter(r => (estadoDe(r) || {}).estado === 'revisado_parroquia');
  const ep = info => VIC.estadoParroquia(info && info.estado, info && info.aprobado);
  const quienes = r => [r.datos.novio_nombre, r.datos.novia_nombre].filter(Boolean).join(' y ') || tituloRegistro(r);

  /* ---------- Enviar ---------- */
  function datosEnvio(r) {
    const d = {};
    // van también las firmas a distancia (fd_novio, fd_novia, fd_t1, fd_t2), pero no sus enlaces secretos
    Object.entries(r.datos).forEach(([k, v]) => { if (!/^vicaria_/.test(k) && !/^fd_.+_(token|enviada|caducado|email)$/.test(k) && v != null && v !== '') d[k] = String(v); });
    return d;
  }
  function modal(html, clase = '') {
    const m = document.createElement('div');
    m.className = 'modal ' + clase;
    m.innerHTML = `<div class="caja ancha vic-modal">${html}</div>`;
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-cerrar]')) m.remove(); });
    document.body.appendChild(m);
    return m;
  }
  function sinConfigurar() {
    const m = modal(`<h3>Buzón de la Vicaría sin configurar</h3>
      <p>Para enviar expedientes, la Vicaría tiene que instalar su buzón (un Apps Script en su cuenta de Google) y poner su dirección en <code>config.js</code>.</p>
      <p>Mientras tanto puedes <strong>probarlo en modo de prueba</strong>: los envíos se guardan solo en este navegador y se ven en la web <a href="vicaria/" target="_blank" rel="noopener">Expedientes Vicaría</a> abierta en este mismo navegador.</p>
      <div class="fila" style="justify-content:flex-end"><button class="btn" data-cerrar>Cerrar</button><button class="btn prim" data-prueba>Activar modo de prueba</button></div>`);
    m.querySelector('[data-prueba]').addEventListener('click', () => { VicariaServicio.activarPrueba(true); m.remove(); aviso('Modo de prueba activado en este navegador.'); preguntarEnvio(); });
  }
  function preguntarEnvio() {
    const r = actual(), d = r.datos, info = estadoDe(r), yaEnviado = !!enlace(r);
    if (!(d.novio_nombre || d.novio_apellidos) || !(d.novia_nombre || d.novia_apellidos)) { aviso('Faltan los nombres de los novios.'); return; }
    if (yaEnviado && info && !['pendiente_revision', 'devuelto_parroquia', 'desconocido'].includes(info.estado)) {
      if (info.estado === 'revisado_parroquia') { aviso('La Vicaría lo ha devuelto: respóndele desde «Revisión».'); abrir(r.id); }
      else aviso(`La Vicaría ya lo ha revisado (${ep(info).nombre.toLowerCase()}): no se puede volver a enviar.`);
      return;
    }
    const prueba = VicariaServicio.modoPrueba();
    // A quién va: se puede elegir mientras la Vicaría no lo haya empezado a revisar
    const cambiaPara = !yaEnviado || !info || info.estado === 'pendiente_revision' || info.estado === 'desconocido';
    const paraActual = d.vicaria_para || (info && info.para) || '';
    const paraSugerido = paraActual || Almacen.leer('vicaria.para', '') || estado.config.vicariaEmail || '';
    const m = modal(`<h3>Enviar a Vicaría <em class="beta">beta</em></h3>
      <p>Se enviará el <strong>expediente matrimonial completo</strong> de <strong>${esc(quienes(r))}</strong>: datos de los novios, exámenes de los novios y los testigos y diligencias.</p>
      ${cambiaPara ? `<div class="campo vic-para"><label for="vicPara">Enviar a (correo de la Vicaría)</label>
          <input type="email" id="vicPara" value="${esc(paraSugerido)}" placeholder="vicaria@ejemplo.org" autocomplete="email">
          <small class="nota">Lo verá quien entre en <a href="vicaria/" target="_blank" rel="noopener">Expedientes Vicaría</a> con esa cuenta de Google (o a quien ella dé acceso). ${estado.config.vicariaEmail ? '' : 'Puedes dejarlo fijo en Datos de la parroquia → Vicaría → Email.'}</small></div>`
        : `<p class="nota">Va a <strong>${esc(paraActual || '—')}</strong>.</p>`}
      ${yaEnviado ? `<p class="nota">Ya se envió el ${esc(fechaHora(d.vicaria_enviado))}. Se mandarán los datos actuales en su lugar; las notas de la Vicaría se conservan.</p>` : ''}
      ${prueba ? '<p class="nota"><strong>Modo de prueba:</strong> se guarda solo en este navegador. <button type="button" class="btn enlace" data-quitar-prueba>Desactivar</button></p>' : ''}
      <div class="fila" style="justify-content:flex-end"><button class="btn" data-cerrar>Cancelar</button><button class="btn prim" data-confirmar>${yaEnviado ? 'Volver a enviar' : 'Enviar a la Vicaría'}</button></div>`);
    m.querySelector('[data-quitar-prueba]')?.addEventListener('click', () => { VicariaServicio.activarPrueba(false); m.remove(); aviso('Modo de prueba desactivado.'); });
    m.querySelector('#vicPara')?.focus();
    m.querySelector('[data-confirmar]').addEventListener('click', async e => {
      const b = e.currentTarget, campo = m.querySelector('#vicPara');
      const para = campo ? campo.value.trim().toLowerCase() : paraActual;
      if (campo && !/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/.test(para)) { aviso('Escribe el correo de la Vicaría al que va el expediente.'); campo.focus(); return; }
      b.disabled = true; b.textContent = 'Enviando…';
      try { await enviar(r, para); m.remove(); }
      catch (err) { console.error(err); b.disabled = false; b.textContent = 'Reintentar'; aviso('No se pudo enviar: ' + err.message, 6000); }
    });
  }
  // Firma o sello demasiado grandes para el buzón: se reducen (como mucho «max» px; JPEG si no tiene transparencia)
  function reducirImagen(src, max, limite) {
    return new Promise(res => {
      if (!src || src.length <= limite) return res(src || '');
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)), cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
        const g = cv.getContext('2d'); g.drawImage(im, 0, 0, cv.width, cv.height);
        let out = cv.toDataURL('image/png');
        if (out.length > limite) {
          const px = g.getImageData(0, 0, cv.width, cv.height).data;
          let transparente = false; for (let i = 3; i < px.length; i += 16) if (px[i] < 250) { transparente = true; break; }
          if (!transparente) out = cv.toDataURL('image/jpeg', 0.85);
        }
        res(out.length < src.length ? out : src);
      };
      im.onerror = () => res(src);   // si no se puede leer, va tal cual (el buzón descarta lo que no sea una imagen válida)
      im.src = src;
    });
  }
  async function enviar(r, para) {
    const cfg = estado.config, e = enlace(r), f = firmante(), g = Google.estado();
    const clave = e ? e.clave : VicariaServicio.nuevaClave();
    const datos = datosEnvio(r);
    for (const k of Object.keys(datos)) if (/^data:image\//.test(datos[k])) datos[k] = await reducirImagen(datos[k], 600, 150000);
    const res = await VicariaServicio.enviar({
      clave, id: e ? e.id : undefined,
      envio: {
        para, datos, fechaDocumento: estado.fechaDocumento,
        firmante: { nombre: f.nombre || '', cargo: f.cargo || '', firma: await reducirImagen(f.firma, 700, 350000) },   // con su firma escaneada
        sello: await reducirImagen(cfg.sello, 700, 500000),
        parroquia: { nombre: cfg.nombre, nombreCorto: cfg.nombreCorto, direccion: cfg.direccion, localidad: cfg.localidad, cp: cfg.cp, provincia: cfg.provincia, diocesis: cfg.diocesis, web: cfg.web, vicaria: cfg.vicaria, email: (g.usuario && g.usuario.email) || '' },
      },
    });
    Object.assign(r.datos, { vicaria_id: res.id, vicaria_clave: clave, vicaria_enviado: ahora(), vicaria_para: res.para || para || '' });
    if (para) Almacen.guardar('vicaria.para', para);
    S().estados[res.id] = { estado: res.estado, version: res.version, pendientes: 0, para: res.para || para };
    Almacen.guardar('vicaria.estados', S().estados);
    if (r.id === estado.actualId) guardarRegistro();
    else { r.actualizado = ahora(); Almacen.guardar('registros', registrosGuardables()); Google.cambiado('registros'); }
    aviso(e ? 'Expediente actualizado en la Vicaría.' : `Expediente enviado a ${res.para || para}.`);
    render();
  }

  /* ---------- Consultar cómo van ---------- */
  async function consultar(forzar = false) {
    const st = S();
    if (!VicariaServicio.configurado()) return;
    const lista = enviados().map(enlace);
    if (!lista.length || (!forzar && Date.now() - st.ultima < 30000)) return;
    st.ultima = Date.now();
    try {
      const r = await VicariaServicio.estados(lista);
      const antes = JSON.stringify(st.estados);
      Object.assign(st.estados, r.estados);
      if (JSON.stringify(st.estados) === antes) return;
      Almacen.guardar('vicaria.estados', st.estados);
      repintar();
    } catch (e) { console.warn('Vicaría:', e.message); }
  }
  function repintar() {
    const activo = document.activeElement;
    if (activo && activo.closest && activo.closest('main') && /INPUT|TEXTAREA|SELECT/.test(activo.tagName)) return;   // no molestar mientras se escribe
    if (estado.vista === 'menu') render();
    else if (estado.vista === 'form' && estado.certId === 'expediente') { const g = $('#grupoVicaria'); if (g) g.outerHTML = grupoExpediente(); }
  }
  function iniciar() {
    consultar(true);
    setInterval(() => consultar(), 5 * 60000);
    window.addEventListener('focus', () => consultar());
  }

  /* ---------- Botones en el menú y en el expediente ---------- */
  function botonMenu() {
    const n = devueltos().length;
    if (!n) return '';
    return `<button class="cert revision-vic" data-vic="revision" title="La Vicaría ha devuelto ${n === 1 ? 'un expediente' : n + ' expedientes'} para revisar">Revisión${n > 1 ? `<span class="pill">${n}</span>` : ''}<small>Expediente devuelto por la Vicaría</small></button>`;
  }
  function grupoExpediente() {
    const r = actual(), e = enlace(r), info = estadoDe(r);
    const est = info && (info.estado === 'desconocido' ? { id: 'archivado', nombre: 'No está en la Vicaría' } : ep(info));
    const devuelto = info && info.estado === 'revisado_parroquia';
    return `<div class="grupo-acc grupo-vicaria" id="grupoVicaria"><span>${ICV.vicaria}Vicaría <em class="beta">beta</em></span>
      ${e ? `<div class="vic-estado vic-${est ? est.id : 'aprobacion'}">${esc(est ? est.nombre : 'Enviado')}</div>
             <small class="vic-enviado">Enviado el ${esc(fechaHora(r.datos.vicaria_enviado))}${r.datos.vicaria_para || (info && info.para) ? ` a ${esc(r.datos.vicaria_para || info.para)}` : ''}</small>` : ''}
      ${e && !['pendiente_revision', 'devuelto_parroquia', 'desconocido'].includes(info && info.estado) && info ? '' :
        `<button class="acc ${e ? '' : 'prim'}" data-vic="enviar">${ICV.enviar}<span>Enviar a Vicaría (beta)<small>${e ? 'Volver a enviar los datos actuales' : 'El expediente completo'}</small></span></button>`}
      ${e ? `<button class="acc ${devuelto ? 'rojo' : ''}" data-vic="abrir">${ICV.revision}<span>${devuelto ? 'Revisión' : 'Ver revisión'}<small>${devuelto ? 'Notas y rectificaciones de la Vicaría' : 'Notas de la Vicaría y estado'}</small></span></button>` : ''}
    </div>`;
  }

  /* ---------- Pantalla «Revisión de expediente» ---------- */
  const claveBorrador = id => 'vicaria.borrador.' + id;
  const borrador = () => { const e = enlace(actual()); return e ? Almacen.leer(claveBorrador(e.id), []) : []; };
  const guardarBorrador = ops => { const e = enlace(actual()); if (e) Almacen.guardar(claveBorrador(e.id), ops); };
  const editable = () => S().exp && S().exp.estado === 'revisado_parroquia';
  function local() {   // el expediente con lo preparado aquí y aún sin enviar
    const st = S();
    if (!st.exp) return null;
    const copia = structuredClone(st.exp);
    VIC.aplicar(copia, borrador(), 'parroquia', util);
    return copia;
  }

  async function abrir(id) {
    const r = estado.registros.find(x => x.id === id);
    if (!r || !enlace(r)) return;
    estado.actualId = r.id; Almacen.guardar('actual', r.id);
    const st = S();
    if (st.expDe !== r.id) { st.exp = null; st.otraForma.clear(); st.respuestas = {}; st.pestana = 'datos'; }
    estado.vista = 'revision'; render(); window.scrollTo(0, 0);
    await cargar();
  }
  async function cargar() {
    const st = S(), r = actual(), e = enlace(r);
    if (!e) return;
    st.cargando = true; st.error = ''; if (estado.vista === 'revision') render();
    try {
      st.exp = await VicariaServicio.leerParroquia(e.id, e.clave); st.expDe = r.id;
      st.estados[e.id] = { estado: st.exp.estado, version: st.exp.version, pendientes: VIC.pendientesParroquia(st.exp).length, aprobado: VIC.fueAprobado(st.exp) };
      Almacen.guardar('vicaria.estados', st.estados);
      // si la Vicaría ya no espera respuesta, lo preparado aquí ya no sirve
      if (st.exp.estado !== 'revisado_parroquia') guardarBorrador([]);
    } catch (err) { st.error = err.message; }
    st.cargando = false;
    if (estado.vista === 'revision') render();
  }
  function elegirDevuelto() {
    const lista = devueltos();
    if (lista.length === 1) return abrir(lista[0].id);
    const m = modal(`<h3>Expedientes devueltos por la Vicaría</h3>
      <div class="resultados">${lista.map(r => `<button class="resultado" data-abrir-rev="${r.id}"><strong>${esc(tituloRegistro(r))}</strong><span>Enviado el ${esc(fechaHora(r.datos.vicaria_enviado))}</span></button>`).join('')}</div>
      <div class="fila" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-cerrar>Cerrar</button></div>`);
    m.addEventListener('click', e => { const b = e.target.closest('[data-abrir-rev]'); if (b) { m.remove(); abrir(b.dataset.abrirRev); } });
  }

  function fecha(iso) { return iso ? fechaHora(iso) : ''; }
  function notaHTML(n, sinEnviar) {
    return `<div class="rev-nota de-${n.de}${sinEnviar ? ' borrador' : ''}"><div class="rev-nota-cab"><strong>${n.de === 'vicaria' ? 'Vicaría' : 'Parroquia'}</strong><span>${sinEnviar ? 'sin enviar' : esc(fecha(n.fecha))}</span>
      ${sinEnviar ? `<button type="button" class="btn enlace" data-vic="quitar-nota" data-lid="${esc(n.lid)}">Quitar</button>` : ''}</div>${esc(n.texto)}</div>`;
  }
  function control(c, v, ok) {
    const id = 'vk_' + c.k, dis = ok ? '' : 'disabled';
    if (c.tipo === 'textarea') return `<textarea id="${id}" data-vk="${c.k}" rows="3" ${dis}>${esc(v)}</textarea>`;
    if (c.tipo === 'select') return `<select id="${id}" data-vk="${c.k}" ${dis}>${c.opciones.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    if (c.tipo === 'sino') return `<select id="${id}" data-vk="${c.k}" ${dis}><option value="" ${v !== '1' ? 'selected' : ''}>No</option><option value="1" ${v === '1' ? 'selected' : ''}>Sí</option></select>`;
    return `<input id="${id}" data-vk="${c.k}" type="${c.tipo === 'date' ? 'date' : 'text'}" value="${esc(v)}" autocomplete="off" ${dis}>`;
  }
  function campoRev(c, L, ops) {
    const st = S(), ok = editable(), k = c.k;
    const orig = st.exp.datos[k] == null ? '' : String(st.exp.datos[k]);
    const prop = VIC.cambio(st.exp, k);                  // rectificación de la Vicaría (tal como llegó)
    const propuesta = prop && prop.de === 'vicaria' && prop.estado === 'propuesta' ? prop : null;
    const aceptada = propuesta && ops.some(o => o.op === 'aceptar' && o.k === k);
    const miCambio = ops.find(o => o.op === 'cambio' && o.k === k);
    const valorLocal = L.datos[k] == null ? '' : String(L.datos[k]);
    const notas = VIC.notas(st.exp, k), misNotas = ops.filter(o => o.op === 'nota' && o.k === k);
    const pendiente = ok && ((propuesta && !aceptada && !miCambio) || VIC.hiloPendiente(L, k, 'parroquia'));
    let cuerpo;
    const ver = v => esc(VIC_CAMPOS.mostrar(k, v)) || '<em>(vacío)</em>';
    if (propuesta && !st.otraForma.has(k) && !miCambio) {
      cuerpo = `<div class="rev-rect ${aceptada ? 'aceptada' : ''}">
        <div class="rev-rect-txt"><del>${ver(propuesta.original)}</del><ins>${ver(propuesta.texto)}</ins></div>
        <div class="rev-rect-pie">${aceptada
          ? `<span class="rev-ok">✓ Rectificación aprobada · se enviará al devolver</span>${ok ? `<button type="button" class="btn" data-vic="deshacer-aceptar" data-k="${k}">Deshacer</button>` : ''}`
          : ok ? `<span>Rectificación propuesta por la Vicaría</span><button type="button" class="btn prim" data-vic="aceptar" data-k="${k}" data-id="${esc(propuesta.id)}">✓ Aprobar rectificación</button><button type="button" class="btn" data-vic="otra" data-k="${k}">Corregir de otra forma</button>`
          : '<span>Rectificación propuesta por la Vicaría</span>'}</div></div>`;
    } else {
      const anterior = miCambio ? orig : null;
      const aceptadaAntes = !miCambio && prop && prop.estado === 'aceptada' ? prop : null;
      cuerpo = control(c, valorLocal, ok) +
        (miCambio ? `<div class="rev-antes">Antes: <del>${ver(anterior)}</del> <button type="button" class="btn enlace" data-vic="deshacer-cambio" data-k="${k}">Deshacer</button></div>` : '') +
        (aceptadaAntes ? `<div class="rev-antes">Rectificado${aceptadaAntes.de === 'parroquia' ? ' por la parroquia' : ''}: antes <del>${ver(aceptadaAntes.original)}</del></div>` : '') +
        (propuesta && (st.otraForma.has(k) || miCambio) ? `<div class="rev-antes">La Vicaría proponía: <ins>${ver(propuesta.texto)}</ins></div>` : '');
    }
    const hilo = notas.length || misNotas.length ? `<div class="rev-notas">${notas.map(n => notaHTML(n)).join('')}${misNotas.map(n => notaHTML({ ...n, de: 'parroquia' }, true)).join('')}
      ${ok && notas.length ? `<div class="rev-responder"><textarea rows="2" data-vr="${k}" placeholder="Responder a la Vicaría…">${esc(st.respuestas[k] || '')}</textarea><button type="button" class="btn" data-vic="responder" data-k="${k}">Responder</button></div>` : ''}</div>` : '';
    const ancho = c.w && c.w < 12 && !hilo && !propuesta ? c.w : 12;
    return `<div class="campo rev-campo${pendiente ? ' pendiente' : ''}${hilo || propuesta ? ' anotado' : ''}" style="grid-column:span ${ancho}" id="rev_${k}">
      <label for="vk_${k}">${esc(c.label)}</label>${cuerpo}${hilo}</div>`;
  }
  function bloqueRev(b, L, ops) {
    const campos = cs => cs.map(c => campoRev(c, L, ops)).join('');
    if (b.pareja) return `<div class="pareja">${b.pareja.map(col => `<div class="columna-pareja"><h4>${esc(col.titulo)}</h4><div class="rejilla">${campos(col.campos)}</div></div>`).join('')}</div>`;
    return `<div class="rev-bloque" style="grid-column:1/-1${b.color ? `;--color:${b.color}` : ''}">${b.titulo ? `<h4 class="rev-bloque-tit">${esc(b.titulo)}</h4>` : ''}<div class="rejilla">${campos(b.campos)}</div></div>`;
  }

  function vista() {
    const st = S(), r = actual(), e = enlace(r);
    const cab = cabecera('Revisión de expediente');
    if (!e) return `${cab}<main><div class="tarjeta"><p>Este registro no se ha enviado a la Vicaría.</p><button class="btn" data-ir="menu">Menú principal</button></div></main>`;
    if (!st.exp || st.expDe !== r.id) {
      return `${cab}<main><div class="tarjeta rev-cargando">${st.error ? `<p><strong>No se pudo abrir el expediente.</strong> ${esc(st.error)}</p><div class="fila"><button class="btn prim" data-vic="recargar">Reintentar</button><button class="btn" data-ir="menu">Menú principal</button></div>` : '<p>Abriendo el expediente de la Vicaría…</p>'}</div></main>`;
    }
    const ops = borrador(), L = local(), est = VIC.estadoParroquia(st.exp.estado, VIC.fueAprobado(st.exp)), ok = editable();
    const pend = ok ? VIC.pendientesParroquia(L) : [];
    const porPestana = {}; pend.forEach(k => { const p = VIC_CAMPOS.campo(k).pestana; porPestana[p] = (porPestana[p] || 0) + 1; });
    const conMarcas = Object.keys(st.exp.marcas || {}).filter(k => VIC.marcas(st.exp, k).some(m => m.de === 'vicaria'));
    const pestanas = VIC_CAMPOS.PESTANAS.filter(p => !p.soloVicaria);
    if (!pestanas.some(p => p.id === st.pestana)) st.pestana = 'datos';
    const cuerpo = VIC_CAMPOS.estructura()[st.pestana].map(b => bloqueRev(b, L, ops)).join('');
    const devuelta = [...(st.exp.historial || [])].reverse().find(h => h.estado === 'revisado_parroquia');
    const lista = conMarcas.length ? `<div class="rev-resumen"><strong>${ok ? (pend.length ? `La Vicaría espera respuesta en ${pend.length} ${pend.length === 1 ? 'dato' : 'datos'}` : 'Todo respondido. Ya puedes devolverlo a la Vicaría.') : 'Anotaciones de la Vicaría'}</strong>
      <div class="rev-saltos">${conMarcas.map(k => `<button type="button" class="${pend.includes(k) ? 'pend' : ''}" data-vic="ir" data-k="${k}">${esc(VIC_CAMPOS.etiqueta(k))}</button>`).join('')}</div></div>` : '';
    return `${cab}
    <main class="revision-exp">
      ${accionesArriba(false)}
      <div class="form-layout">
        <div class="tarjeta">
          <div class="rev-cab">
            <div><h2 class="rev-titulo">${esc(VIC.titulo(st.exp))}</h2>
              <div class="nota">Enviado a la Vicaría el ${esc(fecha(st.exp.llegada))}${devuelta ? ` · Devuelto a la parroquia el ${esc(fecha(devuelta.fecha))}` : ''}</div></div>
            <span class="vic-estado vic-${est.id} grande">${esc(est.nombre)}</span>
          </div>
          ${lista}
          <div class="pestanas" role="tablist">${pestanas.map(p => `<button role="tab" class="${p.id === st.pestana ? 'on' : ''}" data-vic="pestana" data-p="${p.id}">${esc(p.nombre)}${porPestana[p.id] ? `<span class="rev-cuenta">${porPestana[p.id]}</span>` : ''}</button>`).join('')}</div>
          <div class="rejilla">${cuerpo}</div>
        </div>
        <div class="lateral">
          <button class="acc" data-ir="menu">${IC.menu}Menú principal</button>
          <button class="acc" data-vic="expediente">${IC.ant}Volver al expediente</button>
          <div class="grupo-acc grupo-vicaria"><span>${ICV.vicaria}Vicaría <em class="beta">beta</em></span>
            <div class="vic-estado vic-${est.id}">${esc(est.nombre)}</div>
            ${ok ? `<small class="vic-enviado" id="revPreparados">${preparados(ops)}</small>
              <button class="acc prim" data-vic="devolver">${ICV.enviar}<span>Devolver a la vicaría<small>Con tus respuestas y correcciones</small></span></button>
              <button class="acc" data-vic="descartar" id="revDescartar" ${ops.length ? '' : 'hidden'}>${IC.papelera}<span>Descartar cambios</span></button>`
            : `<small class="vic-enviado">${est.id === 'aprobacion' ? 'La Vicaría lo está revisando.' : est.id === 'aprobado' ? 'La Vicaría ha aprobado el expediente.' : ''}</small>`}
            <button class="acc" data-vic="recargar">${IC.buscar}<span>Actualizar</span></button>
          </div>
        </div>
      </div>
    </main>`;
  }

  const preparados = ops => ops.length ? `${ops.length} ${ops.length === 1 ? 'cambio preparado' : 'cambios preparados'} sin enviar` : 'Responde a las notas, aprueba las rectificaciones o corrige los datos.';

  /* ---------- Acciones ---------- */
  function cambiarBorrador(f) { const ops = f(borrador()); guardarBorrador(ops); render(); }
  function irACampo(k) {
    const c = VIC_CAMPOS.campo(k);
    S().pestana = VIC_CAMPOS.PESTANAS.some(p => p.id === c.pestana && !p.soloVicaria) ? c.pestana : 'datos';
    render();
    const el = document.getElementById('rev_' + k);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('destello'); setTimeout(() => el.classList.remove('destello'), 1600); }
  }
  async function devolver(boton) {
    const st = S(), r = actual(), e = enlace(r), ops = borrador();
    const pend = VIC.pendientesParroquia(local());
    const msg = pend.length ? `Quedan ${pend.length} ${pend.length === 1 ? 'anotación' : 'anotaciones'} de la Vicaría sin responder. ¿Devolver el expediente igualmente?`
      : `¿Devolver el expediente a la Vicaría${ops.length ? ` con ${ops.length} ${ops.length === 1 ? 'cambio' : 'cambios'}` : ''}?`;
    if (!await confirmar(msg, 'Devolver a la vicaría')) return;
    boton.disabled = true;
    try {
      const res = await VicariaServicio.devolver(e.id, e.clave, ops.map(({ lid, ...o }) => o));
      // las correcciones y rectificaciones aprobadas pasan también al registro de la parroquia
      ops.forEach(o => {
        if (o.op === 'cambio') r.datos[o.k] = o.texto;
        if (o.op === 'aceptar') { const c = VIC.marcas(st.exp, o.k).find(m => m.id === o.id); if (c) r.datos[o.k] = c.texto; }
      });
      ['novio', 'novia'].forEach(l => { if (ops.some(o => o.k === `${l}_apellido1` || o.k === `${l}_apellido2`)) r.datos[`${l}_apellidos`] = [r.datos[`${l}_apellido1`], r.datos[`${l}_apellido2`]].filter(x => x && String(x).trim()).join(' '); });
      guardarRegistro();
      guardarBorrador([]); st.respuestas = {}; st.otraForma.clear();
      st.exp = res.expediente;
      st.estados[e.id] = { estado: st.exp.estado, version: st.exp.version, pendientes: 0, aprobado: VIC.fueAprobado(st.exp) };
      Almacen.guardar('vicaria.estados', st.estados);
      aviso(res.errores && res.errores.length ? 'Devuelto a la Vicaría (algún cambio ya no se pudo aplicar).' : 'Expediente devuelto a la Vicaría.');
      render(); window.scrollTo(0, 0);
    } catch (err) { console.error(err); boton.disabled = false; aviso('No se pudo devolver: ' + err.message, 6000); }
  }

  function clic(t) {
    const a = t.dataset.vic, k = t.dataset.k, st = S();
    if (a === 'enviar') { if (!VicariaServicio.configurado()) sinConfigurar(); else preguntarEnvio(); }
    else if (a === 'revision') elegirDevuelto();
    else if (a === 'abrir') abrir(estado.actualId);
    else if (a === 'expediente') { estado.certId = 'expediente'; estado.pestanaExp = 'datos'; estado.parteExp = 'portada'; irA('form'); }
    else if (a === 'recargar') { cargar(); consultar(true); }
    else if (a === 'pestana') { st.pestana = t.dataset.p; render(); }
    else if (a === 'ir') irACampo(k);
    else if (!editable()) return;
    else if (a === 'aceptar') cambiarBorrador(ops => ops.filter(o => !(o.k === k && (o.op === 'aceptar' || o.op === 'cambio'))).concat({ op: 'aceptar', k, id: t.dataset.id, lid: util.id() }));
    else if (a === 'deshacer-aceptar') cambiarBorrador(ops => ops.filter(o => !(o.op === 'aceptar' && o.k === k)));
    else if (a === 'otra') { st.otraForma.add(k); render(); setTimeout(() => document.getElementById('vk_' + k)?.focus(), 0); }
    else if (a === 'deshacer-cambio') { st.otraForma.delete(k); cambiarBorrador(ops => ops.filter(o => !(o.op === 'cambio' && o.k === k))); }
    else if (a === 'responder') {
      const texto = (st.respuestas[k] || '').trim();
      if (!texto) { document.querySelector(`[data-vr="${k}"]`)?.focus(); return; }
      delete st.respuestas[k];
      cambiarBorrador(ops => ops.concat({ op: 'nota', k, texto, lid: util.id() }));
    }
    else if (a === 'quitar-nota') cambiarBorrador(ops => ops.filter(o => o.lid !== t.dataset.lid));
    else if (a === 'descartar') confirmar('¿Descartar todo lo preparado y no enviado?', 'Descartar').then(si => { if (si) { st.otraForma.clear(); st.respuestas = {}; cambiarBorrador(() => []); } });
    else if (a === 'devolver') devolver(t);
  }

  // Campos de la pantalla de revisión (no tocan el registro hasta «Devolver a la vicaría»)
  document.addEventListener('change', e => {
    const el = e.target;
    if (!el.dataset || !el.dataset.vk || !editable()) return;
    const k = el.dataset.vk, st = S(), orig = st.exp.datos[k] == null ? '' : String(st.exp.datos[k]);
    const v = el.value;
    const resto = borrador().filter(o => !(o.op === 'cambio' && o.k === k));
    const ops = v === orig && !st.otraForma.has(k) ? resto : resto.concat({ op: 'cambio', k, texto: v, lid: util.id() });
    guardarBorrador(ops);
    // Solo se repinta este campo: si se ha pulsado un botón, sigue en su sitio y recibe el clic
    const caja = document.getElementById('rev_' + k), L = local();
    if (caja) { const t = document.createElement('div'); t.innerHTML = campoRev(VIC_CAMPOS.campo(k), L, ops); caja.replaceWith(t.firstElementChild); }
    const p = document.getElementById('revPreparados'); if (p) p.textContent = preparados(ops);
    const d = document.getElementById('revDescartar'); if (d) d.hidden = !ops.length;
  });
  document.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.vr) S().respuestas[el.dataset.vr] = el.value; });

  return { botonMenu, grupoExpediente, vista, clic, iniciar, consultar, abrir };
})();

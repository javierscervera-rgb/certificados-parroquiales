/* ============================================================
   FIRMAS A DISTANCIA (expediente matrimonial)
   Después de leer sus respuestas en el despacho, el novio, la novia y los
   testigos reciben por correo un enlace personal a una página en blanco
   (firma/?t=…) donde firman con el dedo. La firma vuelve sola al expediente
   (bajo «Firma del contrayente / del testigo y fecha») y el enlace se borra.
   El enlace pasa por el servicio de mensajes (Apps Script, MENSAJES_URL).
   En el registro: fd_<quien> (firma PNG), fd_<quien>_fecha, fd_<quien>_token,
   fd_<quien>_enviada, fd_<quien>_email.
   ============================================================ */
const Firmas = (() => {
  const PERSONAS = [
    { id: 'novio', etiqueta: 'Novio', email: 'novio_email', pestana: 'datos', nombre: d => H.persona(d, 'novio') },
    { id: 'novia', etiqueta: 'Novia', email: 'novia_email', pestana: 'datos', nombre: d => H.persona(d, 'novia') },
    { id: 't1', etiqueta: 'Testigo 1', email: 't1_email', pestana: 't1', nombre: d => [d.t1_nombre, d.t1_apellidos].filter(Boolean).join(' ') },
    { id: 't2', etiqueta: 'Testigo 2', email: 't2_email', pestana: 't2', nombre: d => [d.t2_nombre, d.t2_apellidos].filter(Boolean).join(' ') },
  ];
  const URL_FIRMA = () => new URL('firma/', location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '')).href;
  const valido = s => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(String(s || '').trim());
  const nuevoToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const llamar = async datos => {
    if (!window.MENSAJES_URL) throw new Error('Falta el servicio de firmas');
    const r = await fetch(window.MENSAJES_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos) });
    return r.json();
  };
  const enviando = new Set();

  function estadoDe(d, p) {
    if (d['fd_' + p.id]) return 'firmado';
    if (d['fd_' + p.id + '_token']) return 'pendiente';
    if (d['fd_' + p.id + '_caducado']) return 'caducado';
    return valido(d[p.email]) ? 'listo' : 'sin-email';
  }

  /* ---------- Pestaña «Firmas» del expediente ---------- */
  // Estado, botones y recuadro de la firma de una persona (se repinta solo, sin tocar el campo del email)
  function estadoHTML(d, p) {
    const e = estadoDe(d, p);
    const fecha = k => esc(H.fechaCorta(String(d['fd_' + p.id + k] || '').slice(0, 10)));
    let info = '', botones = '';
    if (e === 'firmado') {
      info = `Firmado el ${fecha('_fecha')}`;
      botones = `<button class="btn" data-fd-quitar="${p.id}">Quitar firma</button>`;
    } else if (e === 'pendiente') {
      info = `Enlace enviado el ${fecha('_enviada')} a ${esc(d['fd_' + p.id + '_email'] || d[p.email] || '')}. Esperando la firma…`;
      botones = `<button class="btn" data-fd-enviar="${p.id}" ${enviando.has(p.id) || !valido(d[p.email]) ? 'disabled' : ''}>Reenviar enlace</button>`;
    } else if (e === 'sin-email') {
      info = 'Escribe su email para poder enviarle el enlace.';
    } else {
      info = e === 'caducado' ? 'El enlace caducó sin firmar: envía otro.' : 'Listo para enviar el enlace.';
      botones = `<button class="btn prim" data-fd-enviar="${p.id}" ${enviando.has(p.id) ? 'disabled' : ''}>${enviando.has(p.id) ? 'Enviando…' : 'Enviar enlace para firmar'}</button>`;
    }
    return `<div class="fd-recuadro">${d['fd_' + p.id] ? `<img src="${d['fd_' + p.id]}" alt="Firma de ${esc(p.etiqueta)}">` : '<span>Sin firma</span>'}</div>
      <p class="fd-info">${info}</p><div class="fila">${botones}</div>`;
  }
  function pestanaHTML() {
    const d = estado.registro;
    const tarjeta = p => `<div class="fd-tarjeta fd-${estadoDe(d, p)}" data-fd-tarjeta="${p.id}">
        <h4>${p.etiqueta}${p.nombre(d) ? `<span>${esc(p.nombre(d))}</span>` : ''}</h4>
        <div class="campo"><label for="c_${p.email}">Email</label><input id="c_${p.email}" data-k="${p.email}" type="email" value="${esc(d[p.email] || '')}" placeholder="correo@ejemplo.com" autocomplete="off"></div>
        <div class="fd-estado" data-fd-estado="${p.id}">${estadoHTML(d, p)}</div>
      </div>`;
    const pendientes = PERSONAS.filter(p => ['listo', 'caducado'].includes(estadoDe(d, p))).length;
    // orden del tabulador: primero la columna izquierda (novio, testigo 1) y luego la derecha (novia, testigo 2)
    return `<div class="fd-pestana" id="firmasDistancia">
      <div class="intro-exp"><h4>Firmas a distancia</h4>
        <p>Cuando hayan leído sus respuestas, envía a cada uno un enlace a su email para firmar desde el móvil. La firma llega sola y sale en su página del expediente, bajo «Firma del contrayente / del testigo y fecha».</p></div>
      <div class="fd-columnas">
        <div class="fd-columna">${tarjeta(PERSONAS[0])}${tarjeta(PERSONAS[2])}</div>
        <div class="fd-columna">${tarjeta(PERSONAS[1])}${tarjeta(PERSONAS[3])}</div>
      </div>
      <div class="fila fd-todos">${pendientes > 1 ? `<button class="btn prim" data-fd-todos>${IC.mail}Enviar el enlace a todos (${pendientes})</button>` : ''}</div>
    </div>`;
  }
  function repintar() {
    if (estado.vista !== 'form' || estado.certId !== 'expediente' || estado.pestanaExp !== 'firmas') return;
    const d = estado.registro;
    PERSONAS.forEach(p => {
      const caja = document.querySelector(`[data-fd-estado="${p.id}"]`); if (!caja) return;
      caja.innerHTML = estadoHTML(d, p);
      caja.closest('.fd-tarjeta').className = `fd-tarjeta fd-${estadoDe(d, p)}`;
    });
    const todos = document.querySelector('.fd-todos');
    if (todos) { const n = PERSONAS.filter(p => ['listo', 'caducado'].includes(estadoDe(d, p))).length; todos.innerHTML = n > 1 ? `<button class="btn prim" data-fd-todos>${IC.mail}Enviar el enlace a todos (${n})</button>` : ''; }
    actualizarPrevia();
  }
  // al escribir un email cambia lo que se puede hacer (después de que la app lo guarde)
  document.addEventListener('input', e => { if (/^(novio|novia|t1|t2)_email$/.test((e.target.dataset || {}).k || '')) setTimeout(repintar, 0); });

  /* ---------- Enviar el enlace ---------- */
  async function enviar(ids) {
    const g = Google.estado();
    if (!g.disponible || !g.usuario) { aviso('Conéctate con Google para enviar los enlaces desde tu Gmail.'); return; }
    const d = estado.registro, r = actual(), cfg = estado.config, f = firmante();
    const personas = PERSONAS.filter(p => ids.includes(p.id) && valido(d[p.email]));
    if (!personas.length) { aviso('Falta un email válido.'); return; }
    const permiso = Google.prepararGmail(); // dentro del clic, por si Google abre su ventana
    personas.forEach(p => enviando.add(p.id)); repintar();
    let bien = 0;
    try {
      await permiso;
      for (const p of personas) {
        const token = nuevoToken(), nombre = p.nombre(d) || p.etiqueta, para = String(d[p.email]).trim();
        try {
          const res = await llamar({ accion: 'firma_crear', token, nombre, quien: p.etiqueta, parroquia: cfg.nombre || '' });
          if (!res.ok) throw new Error(res.error || 'servicio');
          const url = URL_FIRMA() + '?t=' + token;
          const pareja = [H.persona(d, 'novio'), H.persona(d, 'novia')].filter(Boolean).join(' y ');
          await Google.enviarCorreo({
            para, asunto: `Firma para el expediente matrimonial · ${cfg.nombre || 'Parroquia'}`,
            texto: `Hola, ${nombre}:\n\nComo vimos en la parroquia, para completar el expediente matrimonial${pareja ? ' de ' + pareja : ''} necesitamos tu firma (${p.etiqueta.toLowerCase()}).\n\nAbre este enlace en el móvil y firma con el dedo:\n${url}\n\nEl enlace es personal. Se desactiva en cuanto recibimos la firma y, si no se usa, caduca a los 30 días.\n\nUn saludo,\n\n${f.nombre || ''}\n${f.cargo || ''}\n${cfg.nombre || ''}`.replace(/\n{3,}/g, '\n\n'),
          });
          // el enlace anterior (si lo había) deja de valer
          const viejo = r.datos['fd_' + p.id + '_token'];
          if (viejo) llamar({ accion: 'firma_borrar', token: viejo }).catch(() => {});
          Object.assign(r.datos, { ['fd_' + p.id + '_token']: token, ['fd_' + p.id + '_enviada']: ahora(), ['fd_' + p.id + '_email']: para, ['fd_' + p.id + '_caducado']: '' });
          bien++;
        } catch (e) { console.error(e); aviso(`No se pudo enviar el enlace a ${p.etiqueta.toLowerCase()}: ${e.message}`); }
      }
      if (bien) { guardarRegistro(); aviso(bien === 1 ? 'Enlace enviado.' : `${bien} enlaces enviados.`); }
    } catch (e) { console.error(e); aviso('No se pudo enviar: ' + e.message); }
    finally { personas.forEach(p => enviando.delete(p.id)); repintar(); programar(); }
  }

  /* ---------- Recoger las firmas ---------- */
  let ocupado = false, temporizador = null, ultima = 0;
  function pendientes() {
    const lista = [];
    estado.registros.forEach(r => PERSONAS.forEach(p => { const t = r.datos['fd_' + p.id + '_token']; if (t && !r.datos['fd_' + p.id]) lista.push({ r, p, t }); }));
    return lista;
  }
  async function revisar() {
    const lista = pendientes();
    if (!lista.length || ocupado || !window.MENSAJES_URL) return;
    ocupado = true; ultima = Date.now();
    try {
      const res = await llamar({ accion: 'firma_recoger', tokens: lista.map(x => x.t) });
      if (!res.ok) return;
      let cambios = 0;
      for (const x of lista) {
        const fir = (res.firmas || []).find(f => f.token === x.t);
        if (fir) {
          Object.assign(x.r.datos, { ['fd_' + x.p.id]: fir.firma, ['fd_' + x.p.id + '_fecha']: fir.fecha || ahora(), ['fd_' + x.p.id + '_token']: '' });
          x.r.actualizado = ahora(); cambios++;
          llamar({ accion: 'firma_borrar', token: x.t }).catch(() => {});
          aviso(`Ha llegado la firma de ${x.p.etiqueta.toLowerCase()}${x.p.nombre(x.r.datos) ? ' (' + x.p.nombre(x.r.datos) + ')' : ''}.`, 6000);
        } else if (Array.isArray(res.existen) && !res.existen.includes(x.t)) {
          // caducado o borrado en el servicio
          Object.assign(x.r.datos, { ['fd_' + x.p.id + '_token']: '', ['fd_' + x.p.id + '_caducado']: '1' });
          x.r.actualizado = ahora(); cambios++;
        }
      }
      if (cambios) {
        Almacen.guardar('registros', registrosGuardables());
        Google.cambiado('registros');
        repintar();
      }
    } catch (e) { console.warn('Firmas a distancia:', e); }
    finally { ocupado = false; programar(); }
  }
  // Se mira cada 20 s con el expediente abierto, cada 2 min si no, y al volver a la pestaña
  function programar() {
    clearTimeout(temporizador);
    if (!pendientes().length) return;
    const viendo = estado.vista === 'form' && estado.certId === 'expediente' && !document.hidden;
    temporizador = setTimeout(revisar, viendo ? 20000 : 120000);
  }
  function iniciar() {
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - ultima > 10000) revisar(); });
    setTimeout(revisar, 3000);
  }

  /* ---------- Clics ---------- */
  async function clic(t) {
    if (t.dataset.fdEnviar) return enviar([t.dataset.fdEnviar]);
    if (t.hasAttribute('data-fd-todos')) {
      const d = estado.registro;
      return enviar(PERSONAS.filter(p => ['listo', 'caducado'].includes(estadoDe(d, p))).map(p => p.id));
    }
    if (t.dataset.fdQuitar) {
      const p = PERSONAS.find(x => x.id === t.dataset.fdQuitar);
      if (await confirmar(`¿Quitar la firma de ${p.etiqueta.toLowerCase()}? Podrás enviarle otro enlace.`, 'Quitar')) {
        ['', '_fecha', '_token', '_enviada'].forEach(s => { estado.registro['fd_' + p.id + s] = ''; });
        guardarRegistro(); repintar();
      }
    }
  }

  return { pestanaHTML, clic, revisar, iniciar, programar, PERSONAS };
})();

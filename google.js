/* ============================================================
   GOOGLE: inicio de sesión, Google Drive y Gmail
   - Cada parroquia entra con su cuenta de Google.
   - En su Drive se crea la carpeta "Certificados parroquiales" con:
       · "Registros de certificados" (hoja de cálculo, una fila por registro)
       · "configuracion.json" (membrete, firmantes, logo, sello)
   - Permisos: drive.file (solo los archivos que crea esta aplicación)
     y, al enviar el primer correo, gmail.send (solo enviar).
   ============================================================ */

const Google = (() => {
  const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.file';
  const SCOPE_GMAIL = 'https://www.googleapis.com/auth/gmail.send';
  const CARPETA = 'Certificados parroquiales';
  const HOJA = 'Registros de certificados';
  const CONFIG = 'configuracion.json';

  const st = {
    token: null, expira: 0, scopes: new Set(),
    usuario: null,           // { email, nombre }
    ids: {},                 // { carpeta, hoja, config }
    estado: 'desconectado',  // desconectado | conectando | ok | guardando | error | caducado
    mensaje: '',
    pendiente: { config: false, registros: false },
    temporizador: null,
  };
  let alCambiar = () => {};          // la app se suscribe para repintar el indicador
  let proveedor = null;              // { obtenerDatos(), aplicarDatos(config, registros) }

  const configurado = () => !!window.GOOGLE_CLIENT_ID;
  const disponible = () => configurado() && !!(window.google && google.accounts && google.accounts.oauth2);
  const recordar = (k, v) => { try { v === undefined ? localStorage.removeItem('certificados.g.' + k) : localStorage.setItem('certificados.g.' + k, JSON.stringify(v)); } catch (e) {} };
  const recuerdo = k => { try { return JSON.parse(localStorage.getItem('certificados.g.' + k)); } catch (e) { return null; } };

  function fijarEstado(estado, mensaje = '') { st.estado = estado; st.mensaje = mensaje; alCambiar(); }

  /* ---------- Permisos (token de acceso) ---------- */
  // Debe llamarse dentro de un clic: Google abre una ventana si hace falta
  function pedirToken(scopes, { silencioso = false } = {}) {
    return new Promise((res, rej) => {
      if (!disponible()) return rej(new Error('Google no está disponible en esta página.'));
      const cliente = google.accounts.oauth2.initTokenClient({
        client_id: window.GOOGLE_CLIENT_ID,
        scope: scopes.join(' '),
        include_granted_scopes: true,
        login_hint: st.usuario?.email || recuerdo('email') || undefined,
        prompt: silencioso ? '' : undefined,
        callback: r => {
          if (r.error) return rej(new Error(r.error_description || r.error));
          guardarToken(r.access_token, r.expires_in, r.scope);
          res(r);
        },
        error_callback: e => rej(new Error(e?.message || e?.type || 'Se canceló el acceso a Google.')),
      });
      cliente.requestAccessToken();
    });
  }
  const tokenVivo = () => st.token && Date.now() < st.expira - 60000;
  function guardarToken(token, expiraEn, scopes) {
    st.token = token;
    st.expira = Date.now() + (Number(expiraEn) || 3600) * 1000;
    String(scopes || '').split(' ').filter(Boolean).forEach(x => st.scopes.add(x));
    recordar('scopes', [...st.scopes]);
    try { sessionStorage.setItem('certificados.g.token', JSON.stringify({ t: st.token, e: st.expira, s: [...st.scopes] })); } catch (e) {}
  }

  /* ---------- Conexión automática al abrir la aplicación ----------
     Si este navegador ya se conectó antes, la página va directamente a Google
     (sin ventana emergente, que los navegadores bloquean si no hay un clic).
     Con la sesión de Google abierta y el permiso ya dado, Google devuelve el
     acceso sin mostrar nada y la página vuelve conectada. */
  const SS = { estado: 'certificados.g.state', intento: 'certificados.g.intentado' };
  const vuelta = () => location.origin + location.pathname;
  function irAGoogle(scopes) {
    const aleatorio = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem(SS.estado, aleatorio); sessionStorage.setItem(SS.intento, '1'); } catch (e) {}
    const p = new URLSearchParams({
      client_id: window.GOOGLE_CLIENT_ID, redirect_uri: vuelta(), response_type: 'token',
      scope: scopes.join(' '), include_granted_scopes: 'true', prompt: 'none', state: aleatorio,
    });
    const email = recuerdo('email'); if (email) p.set('login_hint', email);
    location.replace('https://accounts.google.com/o/oauth2/v2/auth?' + p.toString());
  }
  function leerVuelta() {
    const h = location.hash || '';
    if (!/access_token=|error=/.test(h)) return null;
    const p = new URLSearchParams(h.slice(1));
    history.replaceState(null, '', location.pathname + location.search);
    let esperado = null; try { esperado = sessionStorage.getItem(SS.estado); } catch (e) {}
    if (!esperado || p.get('state') !== esperado) return { error: 'state' };
    if (p.get('error')) return { error: p.get('error') };
    return { token: p.get('access_token'), expira: p.get('expires_in'), scope: p.get('scope') };
  }
  async function autoconectar() {
    if (!configurado()) return false;
    const r = leerVuelta();
    if (r && !r.error) { guardarToken(r.token, r.expira, r.scope); await completarConexion(); return true; }
    if (r && r.error) { fijarEstado('desconectado'); return false; } // p. ej. hay que elegir cuenta: se hará con el botón
    // ¿queda un acceso válido de esta misma pestaña?
    try {
      const g = JSON.parse(sessionStorage.getItem('certificados.g.token') || 'null');
      if (g && Date.now() < g.e - 60000) { st.token = g.t; st.expira = g.e; g.s.forEach(x => st.scopes.add(x)); await completarConexion(); return true; }
    } catch (e) {}
    let intentado = false; try { intentado = !!sessionStorage.getItem(SS.intento); } catch (e) {}
    if (recuerdo('conectado') && !intentado) {
      fijarEstado('conectando', 'Conectando con Google Drive…');
      const scopes = (recuerdo('scopes') || [SCOPE_DRIVE]).filter(x => x === SCOPE_DRIVE || x === SCOPE_GMAIL);
      irAGoogle(scopes.length ? scopes : [SCOPE_DRIVE]);
      return true;
    }
    return false;
  }

  async function api(url, opciones = {}) {
    if (!tokenVivo()) { fijarEstado('caducado', 'La sesión de Google ha caducado. Pulsa para reconectar.'); throw new Error('caducado'); }
    const r = await fetch(url, { ...opciones, headers: { Authorization: 'Bearer ' + st.token, ...(opciones.headers || {}) } });
    if (r.status === 401) { st.token = null; fijarEstado('caducado', 'La sesión de Google ha caducado. Pulsa para reconectar.'); throw new Error('caducado'); }
    if (!r.ok) { const t = await r.text(); throw new Error(`Google ${r.status}: ${t.slice(0, 200)}`); }
    const tipo = r.headers.get('content-type') || '';
    return tipo.includes('json') ? r.json() : r.text();
  }

  /* ---------- Drive ---------- */
  const DRIVE = 'https://www.googleapis.com/drive/v3/files';
  const SUBIDA = 'https://www.googleapis.com/upload/drive/v3/files';
  const q = s => encodeURIComponent(s);

  async function buscar(nombre, mime, padre) {
    let consulta = `name = '${nombre.replace(/'/g, "\\'")}' and trashed = false`;
    if (mime) consulta += ` and mimeType = '${mime}'`;
    if (padre) consulta += ` and '${padre}' in parents`;
    const r = await api(`${DRIVE}?q=${q(consulta)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&spaces=drive`);
    return r.files && r.files[0] ? r.files[0].id : null;
  }
  async function crear(metadatos) {
    const r = await api(`${DRIVE}?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metadatos) });
    return r.id;
  }
  async function crearJSON(nombre, padre, datos) {
    const limite = 'limite' + Date.now();
    const cuerpo = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nombre, parents: [padre], mimeType: 'application/json' })}\r\n` +
      `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(datos)}\r\n--${limite}--`;
    const r = await api(`${SUBIDA}?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: cuerpo });
    return r.id;
  }
  const leerJSON = async id => { const t = await api(`${DRIVE}/${id}?alt=media`); return typeof t === 'string' ? JSON.parse(t || '{}') : t; };
  const escribirJSON = (id, datos) => api(`${SUBIDA}/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(datos) });

  /* ---------- Hoja de registros ---------- */
  const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
  function etiquetas() {
    const m = { id: 'Id', creado: 'Creado', actualizado: 'Actualizado' };
    (typeof CERTIFICADOS !== 'undefined' ? CERTIFICADOS : []).forEach(c => {
      c.campos.forEach(f => { if (!m[f.k]) m[f.k] = f.label; });
      (c.camposPareja || []).forEach(f => [['novio', 'Novio'], ['novia', 'Novia']].forEach(([l, L]) => {
        const k = f.clave ? f.clave(l) : `${l}_${f.k}`; if (!m[k]) m[k] = `${L}: ${f.label}`;
      }));
    });
    if (typeof EXPEDIENTE !== 'undefined') {
      const corto = t => (t.length > 60 ? t.slice(0, 57) + '…' : t);
      [['novio_ex_', 'Examen novio', EXPEDIENTE.contrayente('novio')], ['novia_ex_', 'Examen novia', EXPEDIENTE.contrayente('novia')],
       ['t1_', 'Testigo 1', EXPEDIENTE.testigo], ['t2_', 'Testigo 2', EXPEDIENTE.testigo]].forEach(([pref, L, secs]) => {
        m[pref + 'juramento'] = `${L}: juramento`;
        secs.forEach(sec => sec.preguntas.forEach(q => { if (!m[pref + q.k]) m[pref + q.k] = `${L}: ${corto(q.label)}`; }));
      });
    }
    return m;
  }
  function aFilas(registros) {
    const et = etiquetas();
    const claves = ['id', 'creado', 'actualizado'];
    Object.keys(et).forEach(k => { if (!claves.includes(k)) claves.push(k); });
    registros.forEach(r => Object.keys(r.datos).forEach(k => { if (!claves.includes(k)) claves.push(k); }));
    const cabecera = claves.map(k => `${et[k] || k} [${k}]`);
    const filas = registros.map(r => claves.map(k => k === 'id' || k === 'creado' || k === 'actualizado' ? (r[k] || '') : (r.datos[k] ?? '')));
    return [cabecera, ...filas];
  }
  function deFilas(valores) {
    if (!valores || valores.length < 2) return [];
    const claves = valores[0].map(c => { const m = /\[([^\]]+)\]\s*$/.exec(c); return m ? m[1] : c; });
    return valores.slice(1).filter(f => f.some(Boolean)).map(f => {
      const r = { datos: {} };
      claves.forEach((k, i) => {
        const v = f[i] ?? '';
        if (k === 'id' || k === 'creado' || k === 'actualizado') r[k] = v;
        else if (v !== '') r.datos[k] = v;
      });
      if (!r.id) r.id = 'r' + Math.random().toString(36).slice(2);
      return r;
    });
  }
  async function leerRegistros() {
    const r = await api(`${SHEETS}/${st.ids.hoja}/values/A1:ZZ?majorDimension=ROWS`);
    return deFilas(r.values);
  }
  async function escribirRegistros(registros) {
    const filas = aFilas(registros);
    await api(`${SHEETS}/${st.ids.hoja}/values/A1:ZZ:clear`, { method: 'POST' });
    await api(`${SHEETS}/${st.ids.hoja}/values/A1?valueInputOption=RAW`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: filas })
    });
  }

  /* ---------- Unir datos locales y de Drive ---------- */
  // Huella de la configuración sin las listas que se unen solas (tareas, eliminados) ni la fecha
  function huella(c) {
    if (!c) return '';
    const { tareas, amonestaciones, eliminados, modificado, ...resto } = c;
    const t = JSON.stringify(resto);
    let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return t.length + ':' + (h >>> 0).toString(36);
  }
  // «Base»: cómo estaban los datos la última vez que este ordenador y Drive coincidían.
  // Sirve para saber quién ha cambiado algo desde entonces: si han cambiado los dos, se pregunta.
  const claveBase = () => 'base:' + (st.usuario ? st.usuario.email : '');
  function guardarBase(datos) {
    const reg = {}; datos.registros.forEach(r => { reg[r.id] = r.actualizado || ''; });
    recordar(claveBase(), { registros: reg, config: huella(datos.config) });
  }
  const mismosDatos = (a, b) => JSON.stringify(a.datos || {}) === JSON.stringify(b.datos || {});

  function unirRegistros(locales, remotos) {
    const m = new Map();
    [...remotos, ...locales].forEach(r => {
      const otro = m.get(r.id);
      if (!otro || (r.actualizado || '') > (otro.actualizado || '')) m.set(r.id, r);
    });
    return [...m.values()].sort((a, b) => (a.creado || '').localeCompare(b.creado || ''));
  }

  /* ---------- Conectar y sincronizar ---------- */
  async function preparar() {
    const yo = await api('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)');
    st.usuario = { email: yo.user.emailAddress, nombre: yo.user.displayName };
    recordar('email', st.usuario.email);
    const guardados = recuerdo('ids:' + st.usuario.email) || {};
    st.ids.carpeta = guardados.carpeta || await buscar(CARPETA, 'application/vnd.google-apps.folder');
    if (!st.ids.carpeta) st.ids.carpeta = await crear({ name: CARPETA, mimeType: 'application/vnd.google-apps.folder' });
    st.ids.hoja = guardados.hoja || await buscar(HOJA, 'application/vnd.google-apps.spreadsheet', st.ids.carpeta);
    let nuevaHoja = false;
    if (!st.ids.hoja) { st.ids.hoja = await crear({ name: HOJA, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [st.ids.carpeta] }); nuevaHoja = true; }
    st.ids.config = guardados.config || await buscar(CONFIG, null, st.ids.carpeta);
    recordar('ids:' + st.usuario.email, st.ids);
    return nuevaHoja;
  }

  async function descargarYUnir() {
    const inicio = st.cambios || 0;
    const local = proveedor.obtenerDatos();
    const remotos = await leerRegistros();
    const base = recuerdo(claveBase()) || { registros: {}, config: null };
    const conflictos = [];
    const decididos = new Map();   // id → registro que se queda (cuando solo cambió un lado)

    // Registros que existen en los dos sitios y no coinciden
    const mapaRemotos = new Map(remotos.map(r => [r.id, r]));
    local.registros.forEach(r => {
      const rem = mapaRemotos.get(r.id);
      if (!rem || mismosDatos(r, rem)) return;
      const b = base.registros[r.id];
      const cambioAqui = b === undefined || (r.actualizado || '') !== b;
      const cambioDrive = b === undefined || (rem.actualizado || '') !== b;
      if (cambioAqui && cambioDrive) conflictos.push({ tipo: 'registro', id: r.id, titulo: proveedor.tituloRegistro(r), aqui: r.actualizado, drive: rem.actualizado, _l: r, _r: rem });
      else decididos.set(r.id, cambioAqui ? r : rem);
    });

    // Configuración (membrete, firmantes, sello…)
    let config = local.config, remota = null, configLocalGana = false;
    if (st.ids.config) {
      remota = await leerJSON(st.ids.config);
      if (remota && remota.nombre !== undefined) {
        config = remota;
        const hl = huella(local.config), hr = huella(remota);
        if ((st.cambios || 0) !== inicio || st.pendiente.config) configLocalGana = true;   // se cambió algo mientras se descargaba
        else if (hl !== hr && !proveedor.configSinTocar(local.config)) {
          if (base.config && hl === base.config) configLocalGana = false;                 // solo cambió Drive
          else if (base.config && hr === base.config) configLocalGana = true;             // solo cambió este ordenador
          else conflictos.push({ tipo: 'config', id: 'config', titulo: 'Datos de la parroquia y firmantes', aqui: local.config.modificado, drive: remota.modificado, _l: local.config, _r: remota });
        }
      }
    } else {
      st.ids.config = await crearJSON(CONFIG, st.ids.carpeta, local.config);
      recordar('ids:' + st.usuario.email, st.ids);
    }

    // Si hay que elegir, se pregunta antes de tocar nada
    if (conflictos.length) {
      st.resolviendo = true;
      fijarEstado('conectando', 'Hay datos distintos aquí y en Google Drive: elige cuáles se quedan');
      let elecciones;
      try { elecciones = await proveedor.resolverConflictos(conflictos.map(({ _l, _r, ...c }) => ({ ...c, cambios: proveedor.diferencias ? proveedor.diferencias(c.tipo, _l, _r) : [] }))); }
      finally { st.resolviendo = false; }
      conflictos.forEach(c => {
        const queda = elecciones[c.id] === 'aqui' ? 'aqui' : 'drive';
        if (c.tipo === 'config') configLocalGana = queda === 'aqui';
        else {
          // el elegido se marca como cambiado ahora, para que se suba y gane en los demás ordenadores
          const r = queda === 'aqui' ? { ...c._l, actualizado: new Date().toISOString() } : c._r;
          decididos.set(c.id, r);
        }
      });
    }

    const ahoraLocal = proveedor.obtenerDatos();
    if (configLocalGana) { config = { ...ahoraLocal.config, tareas: (remota && remota.tareas) || [], amonestaciones: (remota && remota.amonestaciones) || [] }; st.pendiente.config = true; }
    let registros = unirRegistros(ahoraLocal.registros, remotos).map(r => decididos.get(r.id) || r);

    const final = proveedor.aplicarDatos(config, registros);
    // si había cambios locales que Drive no tenía (registros nuevos, elegidos o eliminados), se suben
    const lista = final.registros;
    if (final.configPendiente) st.pendiente.config = true;
    if (lista.length !== remotos.length || lista.some(r => !remotos.find(x => x.id === r.id && x.actualizado === r.actualizado))) st.pendiente.registros = true;
    if (st.pendiente.config || st.pendiente.registros) await subir();
    else guardarBase(proveedor.obtenerDatos());
  }

  async function completarConexion() {
    fijarEstado('conectando', 'Conectando con Google Drive…');
    try {
      try { await preparar(); }
      catch (e) {
        if (e.message === 'caducado') throw e;
        // los identificadores guardados pueden ser de archivos borrados: se buscan de nuevo
        recordar('ids:' + (st.usuario?.email || ''), undefined); st.ids = {};
        await preparar();
      }
      await descargarYUnir();
      recordar('conectado', true);
      try { sessionStorage.removeItem(SS.intento); } catch (e) {}
      fijarEstado('ok', 'Guardado en Google Drive');
    } catch (e) {
      console.error(e);
      if (e.message !== 'caducado') fijarEstado('error', 'No se pudo conectar: ' + e.message);
    }
  }

  async function conectar() {
    if (!disponible()) { fijarEstado('error', configurado() ? 'No se pudo cargar el inicio de sesión de Google.' : 'Falta configurar la conexión con Google.'); return; }
    fijarEstado('conectando', 'Conectando con Google Drive…');
    const peticion = pedirToken([SCOPE_DRIVE]); // dentro del clic
    try { await peticion; }
    catch (e) { fijarEstado('error', 'No se pudo conectar: ' + e.message); return; }
    await completarConexion();
  }

  async function reconectar() {
    const peticion = pedirToken([...st.scopes].length ? [...st.scopes] : [SCOPE_DRIVE]);
    try { await peticion; fijarEstado('ok', 'Guardado en Google Drive'); await descargarYUnir(); await subir(); }
    catch (e) { fijarEstado('error', 'No se pudo reconectar: ' + e.message); }
  }

  function desconectar() {
    if (st.token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(st.token, () => {});
    st.token = null; st.usuario = null; st.ids = {}; st.scopes.clear();
    recordar('conectado', undefined);
    try { sessionStorage.removeItem('certificados.g.token'); } catch (e) {}
    fijarEstado('desconectado');
  }

  // La app avisa de cambios; se guardan en Drive a los 2 segundos
  function cambiado(que) {
    st.pendiente[que] = true;
    st.cambios = (st.cambios || 0) + 1;
    if (!st.usuario) return;
    clearTimeout(st.temporizador);
    st.temporizador = setTimeout(subir, 2000);
  }
  async function subir() {
    if (!st.usuario || !tokenVivo() || st.resolviendo) return;
    if (!st.pendiente.config && !st.pendiente.registros) return;
    fijarEstado('guardando', 'Guardando en Google Drive…');
    const datos = proveedor.obtenerDatos();
    try {
      if (st.pendiente.config) { st.pendiente.config = false; await escribirJSON(st.ids.config, datos.config); }
      if (st.pendiente.registros) { st.pendiente.registros = false; await escribirRegistros(datos.registros); }
      if (!st.pendiente.config && !st.pendiente.registros) guardarBase(datos);
      fijarEstado('ok', 'Guardado en Google Drive');
    } catch (e) {
      console.error(e);
      if (e.message !== 'caducado') fijarEstado('error', 'No se pudo guardar en Drive. Se reintentará.');
      st.pendiente.config = true; st.pendiente.registros = true;
      clearTimeout(st.temporizador); st.temporizador = setTimeout(subir, 15000);
    }
  }

  // Al volver a la pestaña, trae lo que hayan cambiado desde otro ordenador
  async function refrescar() {
    if (!st.usuario || !tokenVivo() || st.resolviendo || st.pendiente.config || st.pendiente.registros || st.estado === 'guardando') return;
    try { await descargarYUnir(); fijarEstado('ok', 'Guardado en Google Drive'); } catch (e) { console.error(e); }
  }

  // Si quedan menos de 5 minutos de sesión, se renueva aprovechando un clic
  function renovarSiHaceFalta() {
    if (st.usuario && st.token && st.expira - Date.now() < 5 * 60000) {
      pedirToken([...st.scopes], { silencioso: true }).catch(() => {});
    }
  }

  /* ---------- Gmail ---------- */
  const b64 = bytes => { let s = ''; const k = 0x8000; for (let i = 0; i < bytes.length; i += k) s += String.fromCharCode.apply(null, bytes.subarray(i, i + k)); return btoa(s); };
  const utf8 = s => new TextEncoder().encode(s);
  const cabecera = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(utf8(s))}?=`;
  const lineas76 = s => s.replace(/.{1,76}/g, '$&\r\n');

  // Llamar dentro del clic de "Enviar": pide permiso de Gmail la primera vez
  function prepararGmail() {
    if (!disponible()) return Promise.reject(new Error('Google no está disponible en esta página.'));
    if (tokenVivo() && st.scopes.has(SCOPE_GMAIL)) return Promise.resolve();
    return pedirToken([SCOPE_DRIVE, SCOPE_GMAIL]).then(() => {
      if (!st.scopes.has(SCOPE_GMAIL)) throw new Error('No se concedió el permiso para enviar correos.');
    });
  }

  async function enviarCorreo({ para, cc, asunto, texto, adjunto }) {
    const limite = 'limite_' + Date.now().toString(36);
    const partes = [
      `To: ${para}`, cc ? `Cc: ${cc}` : null, `Subject: ${cabecera(asunto)}`,
      'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${limite}"`, '',
      `--${limite}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '',
      lineas76(b64(utf8(texto))),
      `--${limite}`, `Content-Type: application/pdf; name="${cabecera(adjunto.nombre)}"`,
      `Content-Disposition: attachment; filename="${cabecera(adjunto.nombre)}"`, 'Content-Transfer-Encoding: base64', '',
      lineas76(b64(adjunto.bytes)), `--${limite}--`
    ].filter(x => x !== null).join('\r\n');
    const raw = btoa(partes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return api('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw })
    });
  }

  return {
    estado: () => ({ ...st, configurado: configurado(), disponible: disponible(), recordado: !!recuerdo('conectado') }),
    suscribir: f => { alCambiar = f; },
    usarProveedor: p => { proveedor = p; },
    conectar, reconectar, desconectar, autoconectar, cambiado, refrescar, renovarSiHaceFalta,
    prepararGmail, enviarCorreo,
    urlCarpeta: () => st.ids.carpeta ? `https://drive.google.com/drive/folders/${st.ids.carpeta}` : null,
    urlHoja: () => st.ids.hoja ? `https://docs.google.com/spreadsheets/d/${st.ids.hoja}` : null,
  };
})();

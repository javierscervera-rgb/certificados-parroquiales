/* ============================================================
   MENSAJES DE CERTIFICADOS (Google Apps Script)
   Se instala en la cuenta del administrador y se publica como
   aplicación web («Ejecutar como: yo», «Acceso: cualquier usuario»).
   - Cualquiera puede ENVIAR un mensaje: se guarda en la hoja
     «Mensajes de Certificados» del Drive del administrador.
   - Solo el administrador puede LISTAR y BORRAR: la app manda su
     sesión de Google y aquí se comprueba de quién es.
   - FIRMAS A DISTANCIA (expediente matrimonial): la parroquia crea un
     enlace secreto por persona (novio, novia, testigos); la persona firma
     en su móvil; la parroquia recoge la firma y el enlace se borra.
     Lo que no se recoge se borra solo a los 30 días. Pestaña «Firmas».
   ============================================================ */
const ADMIN = 'sansebastianmartir@gmail.com';
const NOMBRE_HOJA = 'Mensajes de Certificados';
const CABECERA = ['id', 'fecha', 'nombre', 'email', 'parroquia', 'mensaje', 'web'];

function libro_() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty('HOJA_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(NOMBRE_HOJA);
    ss.getSheets()[0].appendRow(CABECERA);
    ss.getSheets()[0].setFrozenRows(1);
    props.setProperty('HOJA_ID', ss.getId());
  }
  return ss;
}
function hoja_() { return libro_().getSheets()[0]; }

/* ---------- Firmas a distancia ---------- */
const CAB_FIRMAS = ['token', 'creada', 'nombre', 'quien', 'parroquia', 'firma', 'firmada'];
const DIAS_FIRMA = 30;
function hojaFirmas_() {
  const ss = libro_();
  let sh = ss.getSheetByName('Firmas');
  if (!sh) { sh = ss.insertSheet('Firmas'); sh.appendRow(CAB_FIRMAS); sh.setFrozenRows(1); }
  return sh;
}
const tokenValido_ = t => /^[A-Za-z0-9_-]{24,80}$/.test(String(t || ''));
// fila (1-based) del token, o 0; de paso borra lo caducado
function buscarFirma_(sh, token) {
  const v = sh.getDataRange().getValues();
  const limite = Date.now() - DIAS_FIRMA * 864e5;
  let fila = 0;
  for (let i = v.length - 1; i >= 1; i--) {
    const creada = v[i][1] instanceof Date ? v[i][1].getTime() : Date.parse(v[i][1]);
    if (!v[i][0] || (creada && creada < limite)) { sh.deleteRow(i + 1); continue; }
    if (v[i][0] === token) fila = i + 1;
  }
  if (!fila) return 0;
  // tras borrar filas de más abajo la posición no cambia; de más arriba sí: se vuelve a buscar
  const t = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 1; i < t.length; i++) if (t[i][0] === token) return i + 1;
  return 0;
}
function accionFirma_(d) {
  const sh = hojaFirmas_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (d.accion === 'firma_recoger') {
      const pedidos = (d.tokens || []).filter(tokenValido_).slice(0, 40);
      const v = sh.getDataRange().getValues();
      const firmas = v.slice(1).filter(r => pedidos.indexOf(r[0]) >= 0 && r[5]).map(r => ({
        token: r[0], firma: r[5], fecha: r[6] instanceof Date ? r[6].toISOString() : String(r[6]) }));
      const existen = v.slice(1).map(r => r[0]).filter(t => pedidos.indexOf(t) >= 0);
      return { ok: true, firmas, existen };
    }
    if (!tokenValido_(d.token)) return { ok: false, error: 'enlace' };
    const fila = buscarFirma_(sh, d.token);
    if (d.accion === 'firma_crear') {
      if (fila) sh.deleteRow(fila);
      sh.appendRow([d.token, new Date(), corta_(d.nombre, 200), corta_(d.quien, 60), corta_(d.parroquia, 200), '', '']);
      return { ok: true };
    }
    if (!fila) return { ok: false, error: 'no existe' };
    const r = sh.getRange(fila, 1, 1, CAB_FIRMAS.length).getValues()[0];
    if (d.accion === 'firma_ver') return { ok: true, nombre: r[2], quien: r[3], parroquia: r[4], firmada: !!r[5] };
    if (d.accion === 'firma_enviar') {
      const f = String(d.firma || '');
      if (!/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(f) || f.length > 48000) return { ok: false, error: 'firma' };
      sh.getRange(fila, 6, 1, 2).setValues([[f, new Date()]]);
      return { ok: true };
    }
    if (d.accion === 'firma_borrar') { sh.deleteRow(fila); return { ok: true }; }
    return { ok: false, error: 'acción' };
  } finally { lock.releaseLock(); }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// La app manda su token de Google; se pregunta a Google de quién es
function esAdmin_(token) {
  if (!token) return false;
  try {
    const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
      headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true,
    });
    if (r.getResponseCode() !== 200) return false;
    return String(JSON.parse(r.getContentText()).user.emailAddress).toLowerCase() === ADMIN;
  } catch (e) { return false; }
}

const corta_ = (v, n) => String(v == null ? '' : v).slice(0, n).trim();

function doPost(e) {
  let d = {};
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ ok: false, error: 'formato' }); }
  if (/^firma_/.test(d.accion || '')) return json_(accionFirma_(d));
  const sh = hoja_();

  if (d.accion === 'enviar') {
    if (d.web2) return json_({ ok: true });                 // trampa para robots
    const mensaje = corta_(d.mensaje, 5000);
    if (!mensaje) return json_({ ok: false, error: 'vacío' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      sh.appendRow([Utilities.getUuid(), new Date(), corta_(d.nombre, 200), corta_(d.email, 200), corta_(d.parroquia, 200), mensaje, corta_(d.web, 200)]);
    } finally { lock.releaseLock(); }
    return json_({ ok: true });
  }

  if (!esAdmin_(d.token)) return json_({ ok: false, error: 'no autorizado' });

  if (d.accion === 'listar') {
    const v = sh.getDataRange().getValues();
    v.shift();
    const mensajes = v.filter(r => r[0]).map(r => ({
      id: r[0], fecha: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
      nombre: r[2], email: r[3], parroquia: r[4], mensaje: r[5],
    })).reverse();
    return json_({ ok: true, mensajes });
  }

  if (d.accion === 'borrar') {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const ids = sh.getRange(1, 1, Math.max(1, sh.getLastRow()), 1).getValues();
      for (let i = ids.length - 1; i >= 1; i--) if (ids[i][0] === d.id) sh.deleteRow(i + 1);
    } finally { lock.releaseLock(); }
    return json_({ ok: true });
  }

  return json_({ ok: false, error: 'acción' });
}

function doGet() { return json_({ ok: true, servicio: NOMBRE_HOJA }); }

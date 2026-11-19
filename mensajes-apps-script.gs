/* ============================================================
   MENSAJES DE CERTIFICADOS (Google Apps Script)
   Se instala en la cuenta del administrador y se publica como
   aplicación web («Ejecutar como: yo», «Acceso: cualquier usuario»).
   - Cualquiera puede ENVIAR un mensaje: se guarda en la hoja
     «Mensajes de Certificados» del Drive del administrador.
   - Solo el administrador puede LISTAR y BORRAR: la app manda su
     sesión de Google y aquí se comprueba de quién es.
   ============================================================ */
const ADMIN = 'sansebastianmartir@gmail.com';
const NOMBRE_HOJA = 'Mensajes de Certificados';
const CABECERA = ['id', 'fecha', 'nombre', 'email', 'parroquia', 'mensaje', 'web'];

function hoja_() {
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
  return ss.getSheets()[0];
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

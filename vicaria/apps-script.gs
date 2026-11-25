/* ============================================================
   EXPEDIENTES VICARÍA · BUZÓN DE LA VICARÍA (Google Apps Script)
   Se instala UNA vez en la cuenta de Google de la Vicaría y se publica
   como aplicación web («Ejecutar como: yo», «Quién tiene acceso: cualquier usuario»).
   - Buzón central: las parroquias envían sus expedientes desde Certificados
     (botón «Enviar a Vicaría») al correo que eligen. Cada envío lleva una
     clave secreta: solo esa parroquia puede consultarlo y responder.
   - En la web «Expedientes Vicaría» cualquiera entra con su cuenta de Google
     (aquí se comprueba de quién es) y solo ve los expedientes dirigidos a su
     correo o a quien le haya dado acceso. Cada titular gestiona su lista de
     accesos y sus datos de la Vicaría para el Alegato V.
   - Administradores del buzón: la cuenta que instala el script y las de
     Configuración del proyecto → Propiedades del script → ADMINS (correos
     separados por comas). Pueden pedir ver todos los expedientes.
   - Todo se guarda en la carpeta «Expedientes Vicaría» de este Google Drive:
     indice.json, un archivo expediente-<id>.json por expediente,
     accesos.json y configuraciones.json.
   Pasos de instalación: vicaria/README.md
   ============================================================ */

const CARPETA_ = 'Expedientes Vicaría';
const props_ = () => PropertiesService.getScriptProperties();

function carpeta_() {
  const p = props_(), id = p.getProperty('CARPETA_ID');
  if (id) { try { const c = DriveApp.getFolderById(id); if (!c.isTrashed()) return c; } catch (e) {} }
  const c = DriveApp.createFolder(CARPETA_);
  p.setProperty('CARPETA_ID', c.getId());
  return c;
}
function buscar_(nombre) {
  const p = props_(), id = p.getProperty('F_' + nombre);
  if (id) { try { const f = DriveApp.getFileById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const it = carpeta_().getFilesByName(nombre);
  if (it.hasNext()) { const f = it.next(); p.setProperty('F_' + nombre, f.getId()); return f; }
  return null;
}
function leerJSON_(nombre) {
  const f = buscar_(nombre);
  if (!f) return null;
  const t = f.getBlob().getDataAsString('UTF-8');
  return t ? JSON.parse(t) : null;
}
function escribirJSON_(nombre, obj) {
  const t = JSON.stringify(obj), f = buscar_(nombre);
  if (f) f.setContent(t);
  else props_().setProperty('F_' + nombre, carpeta_().createFile(nombre, t, MimeType.PLAIN_TEXT).getId());
}
function sal_() {
  const p = props_();
  let s = p.getProperty('SAL');
  if (!s) { s = Utilities.getUuid(); p.setProperty('SAL', s); }
  return s;
}
function hash_(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal_() + ':' + texto, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}
// La web manda su sesión de Google; se pregunta a Google de quién es
function emailDe_(token) {
  if (!token || typeof token !== 'string' || token.length > 4096) return '';
  const cache = CacheService.getScriptCache(), ck = 'tk' + hash_(token).slice(0, 40);
  const c = cache.get(ck);
  if (c !== null) return c;
  let email = '';
  try {
    const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
      headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true,
    });
    if (r.getResponseCode() === 200) email = String(JSON.parse(r.getContentText()).user.emailAddress || '').toLowerCase();
  } catch (e) {}
  cache.put(ck, email, email ? 1800 : 60);
  return email;
}
function admins_() {
  const lista = String(props_().getProperty('ADMINS') || '').split(/[,;\s]+/).filter(Boolean).map(x => x.toLowerCase());
  const yo = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (yo) lista.push(yo);
  return lista;
}

// Se prepara al primer uso (VIC está al final de este archivo)
let _atender = null;
function atender_(p) {
  if (!_atender) _atender = VIC.servidor(adaptador_());
  return _atender(p);
}
const adaptador_ = () => ({
  indice: () => leerJSON_('indice.json') || {},
  guardarIndice: ind => escribirJSON_('indice.json', ind),
  leer: id => /^[a-z0-9]{6,40}$/i.test(String(id)) ? leerJSON_('expediente-' + id + '.json') : null,
  guardar: exp => escribirJSON_('expediente-' + exp.id + '.json', exp),
  hash: hash_,
  bloquear: f => { const l = LockService.getScriptLock(); l.waitLock(25000); try { return f(); } finally { l.releaseLock(); } },
  emailDe: emailDe_,
  esAdmin: email => admins_().indexOf(String(email).toLowerCase()) >= 0,
  util: { ahora: () => new Date().toISOString(), id: () => Utilities.getUuid().replace(/-/g, '').slice(0, 20) },
  porDefecto: () => Session.getEffectiveUser().getEmail(),
  leerAparte: nombre => leerJSON_(nombre + '.json'),
  guardarAparte: (nombre, obj) => escribirJSON_(nombre + '.json', obj),
});

const json_ = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

function doPost(e) {
  let p;
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ ok: false, error: 'formato' }); }
  return json_(atender_(p));
}
function doGet() { return json_({ ok: true, servicio: 'Expedientes Vicaría' }); }

// Ejecútalo una vez desde el editor (botón «Ejecutar») para dar permisos y crear la carpeta en Drive
function instalar() {
  const c = carpeta_();
  if (!buscar_('indice.json')) escribirJSON_('indice.json', {});
  Logger.log('Carpeta lista: ' + c.getUrl());
  Logger.log('Cuentas de la Vicaría: ' + admins_().join(', '));
}

/* ============================================================
   NÚCLEO COMÚN — copia exacta de vicaria/nucleo.js (no cambiar aquí:
   se cambia allí y se vuelve a copiar entero en este archivo)
   ============================================================ */
/* ============================================================
   EXPEDIENTES VICARÍA · NÚCLEO COMÚN
   Lo usan tres sitios, que deben llevar exactamente este mismo código:
     - Certificados (la parroquia): envía y responde.
     - La web «Expedientes Vicaría» (vicaria/): revisa, anota y aprueba.
     - El Apps Script de la cuenta de la Vicaría (vicaria/apps-script.gs),
       que guarda los expedientes en su Google Drive.
   Sin nada del navegador: solo datos.

   Un expediente:
   {
     id, version, llegada, actualizado, estado,
     para: correo al que la parroquia dirige el expediente (lo ven esa cuenta y a quien ella dé acceso),
     historial: [{ fecha, estado, de }],
     parroquia: { nombre, localidad, email, … },  firmante: { nombre, cargo },  fechaDocumento,
     datos: { clave: valor, … }      ← los mismos campos del registro de Certificados
                                       (+ vic_*: lo que rellena la Vicaría en la última página)
     marcas: { clave: [ marca, … ] }  ← notas y rectificaciones de cada campo
     resueltas: { clave: fecha }      ← hilos de notas que la Vicaría da por resueltos
   }
   Una marca: { id, tipo: 'nota' | 'cambio', de: 'vicaria' | 'parroquia', texto, fecha,
                original (solo cambios), estado (solo cambios): 'propuesta' | 'aceptada' | 'sustituida' }
   ============================================================ */

var VIC = (function () {
  var ESTADOS = [
    { id: 'pendiente_revision', nombre: 'Pendiente revisión', corto: 'Pendiente revisión' },
    { id: 'revisado_parroquia', nombre: 'Revisado y pendiente de respuesta parroquia', corto: 'Esperando a la parroquia' },
    { id: 'devuelto_parroquia', nombre: 'Devuelto por parroquia pendiente revisión', corto: 'Devuelto por parroquia' },
    { id: 'aprobado_contactar', nombre: 'Aprobado pendiente contactar novios', corto: 'Aprobado · contactar novios' },
    { id: 'aprobado_alegato', nombre: 'Aprobado pendiente de recoger Alegato V', corto: 'Aprobado · recoger Alegato V' },
    { id: 'recogido_alegato', nombre: 'Recogido Alegato V', corto: 'Recogido Alegato V' },
    { id: 'archivado', nombre: 'Archivado', corto: 'Archivado' },
  ];
  var APROBADOS = ['aprobado_contactar', 'aprobado_alegato', 'recogido_alegato'];

  function estado(id) {
    for (var i = 0; i < ESTADOS.length; i++) if (ESTADOS[i].id === id) return ESTADOS[i];
    return { id: id, nombre: id || '—', corto: id || '—' };
  }
  function orden(id) { for (var i = 0; i < ESTADOS.length; i++) if (ESTADOS[i].id === id) return i; return 99; }

  // Lo que ve la parroquia: e = estado en la Vicaría; aprobado = si la Vicaría llegó a aprobarlo
  function estadoParroquia(e, aprobado) {
    if (e === 'revisado_parroquia') return { id: 'revision', nombre: 'Pendiente de revisión' };
    if (e === 'pendiente_revision' || e === 'devuelto_parroquia') return { id: 'aprobacion', nombre: 'Pendiente de aprobación' };
    if (APROBADOS.indexOf(e) >= 0 || (e === 'archivado' && aprobado)) return { id: 'aprobado', nombre: 'Aprobado' };
    if (e === 'archivado') return { id: 'archivado', nombre: 'Archivado' };
    return { id: 'aprobacion', nombre: 'Pendiente de aprobación' };
  }
  function fueAprobado(exp) {
    return ((exp && exp.historial) || []).some(function (h) { return APROBADOS.indexOf(h.estado) >= 0; });
  }

  /* ---------- Consultas ---------- */
  function marcas(exp, k) { return (exp.marcas && exp.marcas[k]) || []; }
  function notas(exp, k) { return marcas(exp, k).filter(function (m) { return m.tipo === 'nota'; }); }
  // La rectificación que está en vigor en un campo (propuesta por la Vicaría o ya aceptada)
  function cambio(exp, k) {
    var l = marcas(exp, k);
    for (var i = l.length - 1; i >= 0; i--) if (l[i].tipo === 'cambio' && (l[i].estado === 'propuesta' || l[i].estado === 'aceptada')) return l[i];
    return null;
  }
  // Valor que se ve e imprime: el corregido si hay rectificación, si no el original
  function valor(exp, k) {
    var c = cambio(exp, k);
    if (c) return c.texto;
    var v = exp.datos ? exp.datos[k] : '';
    return v == null ? '' : String(v);
  }
  function datosEfectivos(exp) {
    var d = {}, k;
    for (k in exp.datos || {}) d[k] = exp.datos[k];
    for (k in exp.marcas || {}) { var c = cambio(exp, k); if (c) d[k] = c.texto; }
    apellidos(d);
    return d;
  }
  // ¿Espera respuesta? Para la parroquia: hay una nota de la Vicaría posterior a lo último que hizo la parroquia en
  // ese campo (responder o corregirlo). Para la Vicaría: la parroquia ha respondido o corregido después de lo último
  // de la Vicaría y no se ha dado por resuelto.
  function ultimaFecha(l, f) { var r = ''; l.forEach(function (m) { if (f(m) && m.fecha > r) r = m.fecha; }); return r; }
  function hiloPendiente(exp, k, para) {
    var l = marcas(exp, k);
    if (para === 'parroquia') {
      var v = ultimaFecha(l, function (m) { return m.de === 'vicaria' && m.tipo === 'nota'; });
      return !!v && v > ultimaFecha(l, function (m) { return m.de === 'parroquia'; });
    }
    var p = ultimaFecha(l, function (m) { return m.de === 'parroquia'; });
    if (!p || p <= ultimaFecha(l, function (m) { return m.de === 'vicaria'; })) return false;
    return !(exp.resueltas && exp.resueltas[k] && exp.resueltas[k] >= p);
  }
  function resuelto(exp, k) {
    var u = ultimaFecha(marcas(exp, k), function () { return true; });
    return !!(u && exp.resueltas && exp.resueltas[k] && exp.resueltas[k] >= u);
  }
  // Campos con algo para la parroquia: rectificaciones propuestas o notas de la Vicaría sin contestar
  function pendientesParroquia(exp) {
    var r = [];
    for (var k in exp.marcas || {}) {
      var c = cambio(exp, k);
      if ((c && c.estado === 'propuesta') || hiloPendiente(exp, k, 'parroquia')) r.push(k);
    }
    return r;
  }
  function avisosVicaria(exp) {
    var r = [];
    for (var k in exp.marcas || {}) if (hiloPendiente(exp, k, 'vicaria')) r.push(k);
    return r;
  }
  function apellidos(d) {
    ['novio', 'novia'].forEach(function (l) {
      var a = d[l + '_apellido1'], b = d[l + '_apellido2'];
      if (a !== undefined || b !== undefined) d[l + '_apellidos'] = [a, b].filter(function (x) { return x && String(x).trim(); }).join(' ');
    });
  }
  function titulo(exp) {
    var d = exp.datos || {};
    var a = function (l) { return String(d[l + '_apellidos'] || [d[l + '_apellido1'], d[l + '_apellido2']].filter(Boolean).join(' ') || '').trim(); };
    return [a('novio') || '—', a('novia') || '—'].join(' — ');
  }
  function resumen(exp) {
    var d = exp.datos || {};
    return {
      id: exp.id, version: exp.version || 0, llegada: exp.llegada, actualizado: exp.actualizado, estado: exp.estado,
      para: exp.para || '',
      novio_nombre: d.novio_nombre || '', novio_apellidos: d.novio_apellidos || '',
      novia_nombre: d.novia_nombre || '', novia_apellidos: d.novia_apellidos || '',
      parroquia: (exp.parroquia && exp.parroquia.nombre) || '', localidad: (exp.parroquia && exp.parroquia.localidad) || '',
      avisos: avisosVicaria(exp).length,
    };
  }

  /* ---------- Cambios ----------
     Todo lo que se hace sobre un expediente es una lista de operaciones:
       { op: 'nota', k, texto, nid? }      nota en un campo (o respuesta a las que ya hay); nid: identificador propuesto
       { op: 'cambio', k, texto }          Vicaría: propone rectificar el texto · Parroquia: corrige el campo
       { op: 'aceptar', k, id }            la parroquia aprueba la rectificación propuesta
       { op: 'borrar', k, id }             quitar una nota o rectificación propia
       { op: 'resolver', k }               la Vicaría da por resuelto el hilo de notas de un campo
       { op: 'vic', k, v }                 dato de la Vicaría (claves vic_*)
       { op: 'estado', estado }            la Vicaría cambia el estado
       { op: 'datos', datos }              la parroquia vuelve a enviar los datos del registro
     util: { ahora: () => ISO, id: () => 'único' } */
  var VALEN = {
    vicaria: ['nota', 'cambio', 'borrar', 'resolver', 'vic', 'estado'],
    parroquia: ['nota', 'cambio', 'aceptar', 'borrar', 'datos'],
  };
  var LARGO = 4000;
  function texto(v) { return String(v == null ? '' : v).slice(0, LARGO); }
  // Identificador de una marca nueva: el que propone quien la crea (así coincide en su pantalla) si es válido y no se repite
  function nuevoId(exp, o, util) {
    if (typeof o.nid === 'string' && /^[a-z0-9]{6,32}$/i.test(o.nid)) {
      var usado = false;
      for (var k in exp.marcas) exp.marcas[k].forEach(function (m) { if (m.id === o.nid) usado = true; });
      if (!usado) return o.nid;
    }
    return util.id();
  }

  function aplicar(exp, ops, de, util) {
    var errores = [];
    exp.marcas = exp.marcas || {}; exp.datos = exp.datos || {}; exp.historial = exp.historial || []; exp.resueltas = exp.resueltas || {};
    (ops || []).forEach(function (o) {
      if (!o || VALEN[de].indexOf(o.op) < 0) { errores.push('operación no permitida: ' + (o && o.op)); return; }
      var k = o.k == null ? '' : String(o.k);
      if (o.op !== 'estado' && o.op !== 'datos' && !/^[a-z0-9_]{1,60}$/i.test(k)) { errores.push('campo no válido'); return; }
      var lista = exp.marcas[k] || [];
      var ahora = util.ahora();
      if (o.op === 'nota') {
        var t = texto(o.texto).trim(); if (!t) return;
        lista.push({ id: nuevoId(exp, o, util), tipo: 'nota', de: de, texto: t, fecha: ahora });
      } else if (o.op === 'cambio') {
        var nuevo = texto(o.texto), actual = exp.datos[k] == null ? '' : String(exp.datos[k]);
        // lo que había propuesto antes la Vicaría en este campo queda sustituido
        lista.forEach(function (m) { if (m.tipo === 'cambio' && m.estado === 'propuesta') m.estado = 'sustituida'; });
        if (nuevo !== actual) {
          if (de === 'vicaria') lista.push({ id: nuevoId(exp, o, util), tipo: 'cambio', de: de, original: actual, texto: nuevo, estado: 'propuesta', fecha: ahora });
          else {
            lista.push({ id: nuevoId(exp, o, util), tipo: 'cambio', de: de, original: actual, texto: nuevo, estado: 'aceptada', fecha: ahora });
            exp.datos[k] = nuevo;
          }
        }
      } else if (o.op === 'aceptar') {
        var c = null; lista.forEach(function (m) { if (m.id === o.id && m.tipo === 'cambio' && m.estado === 'propuesta') c = m; });
        if (!c) { errores.push('la rectificación ya no está pendiente'); return; }
        c.estado = 'aceptada'; c.aceptada = ahora;
        exp.datos[k] = c.texto;
      } else if (o.op === 'borrar') {
        lista = lista.filter(function (m) { return !(m.id === o.id && m.de === de); });
      } else if (o.op === 'resolver') {
        exp.resueltas[k] = ahora;
      } else if (o.op === 'vic') {
        if (!/^vic_/.test(k)) { errores.push('campo de la Vicaría no válido'); return; }
        exp.datos[k] = texto(o.v);
      } else if (o.op === 'estado') {
        if (orden(o.estado) === 99) { errores.push('estado no válido'); return; }
        if (o.estado !== exp.estado) { exp.estado = o.estado; exp.historial.push({ fecha: ahora, estado: o.estado, de: de }); }
      } else if (o.op === 'datos') {
        var vic = {}, x;
        for (x in exp.datos) if (/^vic_/.test(x)) vic[x] = exp.datos[x];
        var nuevos = {};
        for (x in o.datos || {}) if (!/^vic_/.test(x)) nuevos[x] = texto(o.datos[x]);
        for (x in vic) nuevos[x] = vic[x];
        exp.datos = nuevos;
      }
      if (o.op !== 'estado' && o.op !== 'datos' && o.op !== 'vic') { if (lista.length) exp.marcas[k] = lista; else delete exp.marcas[k]; }
      apellidos(exp.datos);
    });
    if (errores.length < (ops || []).length || !(ops || []).length) {
      exp.version = (exp.version || 0) + 1;
      exp.actualizado = util.ahora();
    }
    return errores;
  }

  // Correo válido en minúsculas, o ''
  function correo(v) {
    var c = String(v == null ? '' : v).trim().toLowerCase();
    return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/.test(c) && c.length <= 120 ? c : '';
  }

  // Expediente nuevo con lo que manda la parroquia
  function crear(envio, util) {
    var ahora = util.ahora();
    var exp = {
      id: util.id(), version: 1, llegada: ahora, actualizado: ahora, estado: 'pendiente_revision',
      para: correo(envio.para),
      historial: [{ fecha: ahora, estado: 'pendiente_revision', de: 'parroquia' }],
      parroquia: envio.parroquia || {}, firmante: envio.firmante || {}, fechaDocumento: envio.fechaDocumento || '',
      datos: {}, marcas: {}, resueltas: {},
    };
    aplicar(exp, [{ op: 'datos', datos: envio.datos || {} }], 'parroquia', util);
    exp.version = 1;
    return exp;
  }

  // Lo que se le devuelve a la parroquia (sin nada interno de la Vicaría)
  function paraParroquia(exp) {
    var copia = JSON.parse(JSON.stringify(exp));
    delete copia.resueltas;
    return copia;
  }

  /* ---------- Servidor (buzón central) ----------
     Atiende las peticiones de las parroquias y de las cuentas de la Vicaría. Lo usan el Apps Script
     (con Google Drive) y el modo de prueba (con el almacenamiento del navegador).
     - Cada expediente va dirigido a un correo («para»): lo ven esa cuenta de Google (el titular) y las
       cuentas a las que el titular da acceso. Solo el titular cambia su lista de accesos y sus datos.
     - Los administradores del buzón (quien lo instaló y los de ADMINS) pueden pedir verlo todo.
     A = adaptador:
       indice() / guardarIndice(ind)   índice { id: entrada }   ·   leer(id) / guardar(exp)   expediente completo
       leerAparte(nombre) / guardarAparte(nombre, obj)   'accesos' { titular: [correos] } y 'configuraciones' { titular: datos }
       hash(clave)   ·   bloquear(fn)   ·   emailDe(token): correo de la cuenta de Google ('' si no vale)
       esAdmin(email)   ·   porDefecto(): titular de lo que llega sin destinatario (versiones anteriores)   ·   util { ahora, id } */
  var CAMBIAN_PARROQUIA = ['pendiente_revision', 'devuelto_parroquia'];
  var CLAVES_CONFIG = ['diocesisTitulo', 'vicaria', 'vicario', 'vicarioCargo', 'vicariaCalle', 'vicariaNumero', 'vicariaCP',
    'vicariaCiudad', 'vicariaEmail', 'vicariaTelefono', 'logoDiocesis'];
  function limpiarConfig(c) {
    var r = {};
    CLAVES_CONFIG.forEach(function (k) {
      var v = c && c[k] != null ? String(c[k]) : '';
      if (k === 'logoDiocesis') r[k] = /^data:image\/(png|jpeg);base64,[a-z0-9+\/=]+$/i.test(v) && v.length < 600000 ? v : '';
      else r[k] = v.slice(0, 300);
    });
    return r;
  }
  function servidor(A) {
    function entrada(exp, claveHash) {
      var r = resumen(exp);
      r.clave = claveHash;
      r.pendientesParroquia = pendientesParroquia(exp).length;
      r.aprobado = fueAprobado(exp);
      return r;
    }
    function publica(e) { var r = {}; for (var x in e) if (x !== 'clave') r[x] = e[x]; return r; }
    function deParroquia(ind, id, clave) {
      var e = ind[id];
      if (!e || !clave || e.clave !== A.hash(clave)) throw new Error('No se encuentra este expediente en la Vicaría.');
      return e;
    }
    function quien(p) {
      var email = correo(A.emailDe(p.token));
      if (!email) throw new Error('no autorizado');
      return email;
    }
    var accesos = function () { var a = A.leerAparte('accesos'); return a && typeof a === 'object' ? a : {}; };
    // Titulares cuyos expedientes puede ver este correo: el suyo y los que le han dado acceso
    function buzones(email, acc) {
      var r = [email];
      for (var t in acc) if (t !== email && (acc[t] || []).indexOf(email) >= 0) r.push(t);
      return r;
    }
    var defecto = function () { return correo(A.porDefecto ? A.porDefecto() : ''); };
    function puedeVer(email, para, acc, todo) { return (todo && A.esAdmin(email)) || buzones(email, acc).indexOf(para || defecto()) >= 0; }
    function guardar(ind, exp, claveHash) {
      A.guardar(exp);
      ind[exp.id] = entrada(exp, claveHash);
      A.guardarIndice(ind);
    }
    function expedienteVisible(p) {
      var email = quien(p), ind = A.indice(), e = ind[p.id];
      if (!e || !puedeVer(email, e.para, accesos(), true)) throw new Error('No tienes acceso a este expediente.');
      return { email: email, ind: ind, entrada: e };
    }
    var acciones = {
      // Parroquia: envía (o vuelve a enviar) el expediente al correo que elige.
      // La parroquia no manda su sesión de Google (daría acceso a sus archivos de Certificados):
      // el correo de la parroquia es el de la cuenta con la que está conectada, tal como lo indica ella.
      enviar: function (p) {
        var envio = p.envio || {};
        if (!envio.datos || typeof envio.datos !== 'object') throw new Error('Faltan los datos del expediente.');
        if (Object.keys(envio.datos).length > 1500) throw new Error('Demasiados datos.');
        if (String(p.clave || '').length < 20) throw new Error('Falta la clave del expediente.');
        envio.parroquia = envio.parroquia && typeof envio.parroquia === 'object' ? envio.parroquia : {};
        for (var x in envio.parroquia) envio.parroquia[x] = texto(envio.parroquia[x]).slice(0, 300);
        var para = correo(envio.para) || defecto();   // Certificados antiguo: sin destinatario, va al titular del buzón
        return A.bloquear(function () {
          var ind = A.indice(), exp;
          if (p.id && ind[p.id]) {
            var e = deParroquia(ind, p.id, p.clave);
            if (CAMBIAN_PARROQUIA.indexOf(e.estado) < 0) throw new Error('La Vicaría ya ha revisado este expediente: no se puede volver a enviar.' + (e.estado === 'revisado_parroquia' ? ' Responde desde «Revisión».' : ''));
            exp = A.leer(p.id);
            aplicar(exp, [{ op: 'datos', datos: envio.datos }], 'parroquia', A.util);
            exp.parroquia = envio.parroquia; exp.firmante = envio.firmante || exp.firmante; exp.fechaDocumento = envio.fechaDocumento || exp.fechaDocumento;
            // mientras nadie lo ha revisado, la parroquia puede cambiar a quién va
            if (para && exp.estado === 'pendiente_revision') exp.para = para;
            exp.historial.push({ fecha: A.util.ahora(), estado: exp.estado, de: 'parroquia', reenvio: true });
            guardar(ind, exp, e.clave);
          } else {
            if (!para) throw new Error('Indica el correo de la Vicaría al que va el expediente.');
            envio.para = para;
            exp = crear(envio, A.util);
            guardar(ind, exp, A.hash(p.clave));
          }
          return { id: exp.id, estado: exp.estado, version: exp.version, llegada: exp.llegada, para: exp.para };
        });
      },
      // Parroquia: estado de sus expedientes
      estados: function (p) {
        var ind = A.indice(), r = {};
        (p.lista || []).slice(0, 500).forEach(function (x) {
          var e = ind[x.id];
          if (e && x.clave && e.clave === A.hash(x.clave)) r[x.id] = { estado: e.estado, version: e.version, actualizado: e.actualizado, pendientes: e.pendientesParroquia || 0, aprobado: !!e.aprobado, para: e.para || '' };
          else if (x.id) r[x.id] = { estado: 'desconocido' };
        });
        return { estados: r };
      },
      // Parroquia: el expediente con las notas y rectificaciones de la Vicaría
      leer: function (p) {
        deParroquia(A.indice(), p.id, p.clave);
        return { expediente: paraParroquia(A.leer(p.id)) };
      },
      // Parroquia: «Devolver a la vicaría» con sus respuestas, aprobaciones y correcciones
      devolver: function (p) {
        return A.bloquear(function () {
          var ind = A.indice(), e = deParroquia(ind, p.id, p.clave);
          if (e.estado !== 'revisado_parroquia') throw new Error('Este expediente no está pendiente de la parroquia.');
          var exp = A.leer(p.id);
          var errores = aplicar(exp, p.ops || [], 'parroquia', A.util);
          exp.version = (exp.version || 0) + 1; exp.actualizado = A.util.ahora();
          exp.estado = 'devuelto_parroquia';
          exp.historial.push({ fecha: A.util.ahora(), estado: 'devuelto_parroquia', de: 'parroquia' });
          guardar(ind, exp, e.clave);
          return { expediente: paraParroquia(exp), errores: errores };
        });
      },
      // Vicaría: cualquiera puede entrar con su cuenta de Google; solo ve lo que va a su correo
      // (o a quien le ha dado acceso)
      quien: function (p) {
        var email = correo(A.emailDe(p.token));
        if (!email) return { email: '', admin: false };
        var acc = accesos();
        return { email: email, admin: !!A.esAdmin(email), buzones: buzones(email, acc), accesos: acc[email] || [] };
      },
      listar: function (p) {
        var email = quien(p), acc = accesos(), todo = !!p.todo && A.esAdmin(email), ind = A.indice(), lista = [];
        for (var id in ind) if (puedeVer(email, ind[id].para, acc, todo)) lista.push(publica(ind[id]));
        return { lista: lista, buzones: buzones(email, acc) };
      },
      expediente: function (p) {
        var v = expedienteVisible(p), exp = A.leer(p.id);
        if (!exp) throw new Error('No existe ese expediente.');
        var cfgs = A.leerAparte('configuraciones') || {};
        return { expediente: exp, config: limpiarConfig(cfgs[exp.para || defecto()] || {}) };
      },
      ops: function (p) {
        return A.bloquear(function () {
          var v = expedienteVisible(p), exp = A.leer(p.id);
          var errores = aplicar(exp, p.ops || [], 'vicaria', A.util);
          guardar(v.ind, exp, v.entrada.clave);
          return { expediente: exp, errores: errores };
        });
      },
      // Datos de la Vicaría (Alegato V) y lista de accesos: los del titular que entra
      configuracion: function (p) {
        var email = quien(p), cfgs = A.leerAparte('configuraciones') || {}, acc = accesos();
        return { config: limpiarConfig(cfgs[email] || {}), accesos: acc[email] || [], buzones: buzones(email, acc) };
      },
      guardarConfig: function (p) {
        var email = quien(p), c = limpiarConfig(p.config);
        A.bloquear(function () { var cfgs = A.leerAparte('configuraciones') || {}; cfgs[email] = c; A.guardarAparte('configuraciones', cfgs); });
        return { config: c };
      },
      guardarAccesos: function (p) {
        var email = quien(p), lista = [];
        (p.lista || []).forEach(function (x) { var c = correo(x); if (c && c !== email && lista.indexOf(c) < 0 && lista.length < 50) lista.push(c); });
        A.bloquear(function () { var acc = accesos(); if (lista.length) acc[email] = lista; else delete acc[email]; A.guardarAparte('accesos', acc); });
        return { accesos: lista };
      },
    };
    return function atender(p) {
      try {
        var f = acciones[p && p.accion];
        if (!f) return { ok: false, error: 'acción desconocida' };
        var r = f(p); r.ok = true; return r;
      } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
    };
  }

  return {
    ESTADOS: ESTADOS, APROBADOS: APROBADOS, estado: estado, orden: orden, estadoParroquia: estadoParroquia, fueAprobado: fueAprobado,
    marcas: marcas, notas: notas, cambio: cambio, valor: valor, datosEfectivos: datosEfectivos,
    hiloPendiente: hiloPendiente, resuelto: resuelto, pendientesParroquia: pendientesParroquia, avisosVicaria: avisosVicaria,
    titulo: titulo, resumen: resumen, aplicar: aplicar, crear: crear, paraParroquia: paraParroquia, servidor: servidor,
    CLAVES_CONFIG: CLAVES_CONFIG, limpiarConfig: limpiarConfig, correo: correo,
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = VIC;

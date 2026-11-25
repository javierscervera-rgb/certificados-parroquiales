/* ============================================================
   EXPEDIENTES VICARÍA · CONEXIÓN CON EL BUZÓN DE LA VICARÍA
   - Normal: el Apps Script publicado desde la cuenta de Google de la Vicaría
     (dirección en config.js → window.VICARIA_URL).
   - Modo de prueba: sin Apps Script; los expedientes se guardan en este
     navegador y los ven a la vez Certificados y la web de la Vicaría
     (misma dirección web). Sirve para enseñarlo y probarlo.
   Lo usan Certificados (index.html) y la web de la Vicaría (vicaria/).
   ============================================================ */

const VicariaServicio = (() => {
  const MODO = 'vicaria.modo';
  const BD = 'vicaria.prueba';
  const leerLS = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };

  const url = () => String(window.VICARIA_URL || '').trim();
  const modoPrueba = () => { try { return localStorage.getItem(MODO) === 'prueba'; } catch (e) { return false; } };
  function activarPrueba(si) { try { si ? localStorage.setItem(MODO, 'prueba') : localStorage.removeItem(MODO); } catch (e) {} }
  const configurado = () => modoPrueba() || /^https:\/\//.test(url());

  /* ---------- Modo de prueba: el mismo servidor, guardando en este navegador ---------- */
  let _simulado = null;
  function simulado() {
    if (_simulado) return _simulado;
    const bd = () => leerLS(BD, { indice: {}, expedientes: {} });
    const escribir = b => localStorage.setItem(BD, JSON.stringify(b));
    const hash = s => { let h = 5381; const t = 'vic:' + s; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return 'h' + (h >>> 0).toString(36) + t.length; };
    _simulado = VIC.servidor({
      indice: () => bd().indice,
      guardarIndice: ind => { const b = bd(); b.indice = ind; escribir(b); },
      leer: id => { const e = bd().expedientes[id]; return e ? JSON.parse(JSON.stringify(e)) : null; },
      guardar: exp => { const b = bd(); b.expedientes[exp.id] = exp; escribir(b); },
      hash, bloquear: f => f(),
      emailDe: () => 'modo.prueba@ejemplo.org',   // la Vicaría, en modo de prueba, siempre entra
      esAdmin: () => true,
      util: { ahora: () => new Date().toISOString(), id: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8) },
      leerConfig: () => bd().config || {},
      guardarConfig: c => { const b = bd(); b.config = c; escribir(b); },
    });
    return _simulado;
  }

  async function llamar(accion, datos = {}) {
    let r;
    if (modoPrueba()) {
      await new Promise(res => setTimeout(res, 200));   // como si fuera por internet
      r = simulado()({ accion, ...JSON.parse(JSON.stringify(datos)) });
    } else {
      if (!configurado()) throw new Error('El buzón de la Vicaría no está configurado.');
      let resp;
      try {
        resp = await fetch(url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ accion, ...datos }) });
      } catch (e) { throw new Error('No hay conexión con la Vicaría. Revisa internet y vuelve a intentarlo.'); }
      if (!resp.ok) throw new Error('La Vicaría no responde (' + resp.status + ').');
      try { r = await resp.json(); } catch (e) { throw new Error('Respuesta no válida de la Vicaría.'); }
    }
    if (!r || !r.ok) throw new Error((r && r.error) || 'Error en la Vicaría.');
    return r;
  }

  // Clave secreta de cada expediente: solo la tienen la parroquia que lo envía y (cifrada) la Vicaría
  function nuevaClave() {
    const a = new Uint8Array(24); crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
  }

  return {
    configurado, modoPrueba, activarPrueba, nuevaClave,
    // Parroquia
    enviar: (p) => llamar('enviar', p),
    estados: (lista) => llamar('estados', { lista }),
    leerParroquia: (id, clave) => llamar('leer', { id, clave }).then(r => r.expediente),
    devolver: (id, clave, ops) => llamar('devolver', { id, clave, ops }),
    // Vicaría
    quien: (token) => llamar('quien', { token }),
    listar: (token) => llamar('listar', { token }).then(r => r.lista),
    expediente: (token, id) => llamar('expediente', { token, id }).then(r => r.expediente),
    ops: (token, id, ops) => llamar('ops', { token, id, ops }),
    configuracion: (token) => llamar('configuracion', { token }).then(r => r.config),
    guardarConfig: (token, config) => llamar('guardarConfig', { token, config }).then(r => r.config),
  };
})();

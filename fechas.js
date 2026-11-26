/* ============================================================
   FECHAS ESCRITAS dd/mm/aaaa
   Todos los campos de fecha de la aplicación (input type="date") se convierten
   en un campo de texto donde se escribe la fecha seguida: «17051994» se
   convierte en «17/05/1994» (también valen 17/5/94, 17-5-1994, 17.5.1994).
   El resto de la aplicación sigue viendo la fecha como siempre (aaaa-mm-dd):
   el campo devuelve ese valor en .value, así que nada más cambia.
   ============================================================ */
(() => {
  const nativo = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  const ver = el => nativo.get.call(el), poner = (el, v) => nativo.set.call(el, v);
  const dos = n => String(n).padStart(2, '0');
  const aTexto = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const valida = (d, m, a) => { const f = new Date(Date.UTC(a, m - 1, d)); return a >= 1000 && f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d; };
  const siglo = a2 => { const hoy = new Date().getFullYear() % 100; return a2 + (a2 > hoy + 10 ? 1900 : 2000); };
  // Texto → aaaa-mm-dd ('' si no es una fecha completa). final: al salir del campo se aceptan años de 2 cifras
  function leer(t, final) {
    t = String(t || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) { const [a, mes, d] = t.split('-').map(Number); return valida(d, mes, a) ? t : ''; }
    let m = /^(\d{1,2})[\/.\-\s](\d{1,2})[\/.\-\s](\d{2}|\d{4})$/.exec(t) || /^(\d{2})(\d{2})(\d{4})$/.exec(t.replace(/\D/g, '').length === 8 && /^\d+$/.test(t) ? t : '');
    if (!m) return '';
    let [d, mes, a] = [+m[1], +m[2], m[3]];
    if (a.length === 2) { if (!final) return ''; a = siglo(+a); } else a = +a;
    return valida(d, mes, a) ? `${a}-${dos(mes)}-${dos(d)}` : '';
  }
  // Mientras se escribe solo con números se ponen las barras: 1705 → 17/05, 17051994 → 17/05/1994
  function barras(t) {
    if (!/^\d+$/.test(t)) return t;
    const n = t.slice(0, 8);
    return n.length <= 2 ? n : n.length <= 4 ? `${n.slice(0, 2)}/${n.slice(2)}` : `${n.slice(0, 2)}/${n.slice(2, 4)}/${n.slice(4)}`;
  }

  function convertir(el) {
    if (el._fechaTexto) return;
    el._fechaTexto = true;
    let iso = ver(el);
    el.type = 'text';
    el.inputMode = 'numeric';
    el.autocomplete = 'off';
    el.maxLength = 10;
    el.placeholder = 'dd/mm/aaaa';
    el.classList.add('fecha-texto');
    poner(el, aTexto(iso));
    Object.defineProperty(el, 'value', {
      configurable: true,
      get: () => iso,
      set: v => { iso = /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : leer(v, true); poner(el, aTexto(iso)); el.classList.remove('fecha-mal'); },
    });
    // va antes que los avisos de la aplicación (que escuchan en el documento): cuando llegan, .value ya es aaaa-mm-dd
    el.addEventListener('input', e => {
      let t = ver(el);
      const alFinal = el.selectionStart === t.length;
      // solo si se escribe con números seguidos (las barras, si las hay, en su sitio); si se escriben las barras a mano, se respeta
      const auto = /^[\d/]+$/.test(t) && [...t].every((c, i) => c !== '/' || i === 2 || i === 5);
      if (alFinal && auto && !(e.inputType || '').startsWith('delete')) { const b = barras(t.replace(/\//g, '')); if (b !== t) { t = b; poner(el, t); } }
      iso = t.trim() ? leer(t, false) : '';
      el.classList.remove('fecha-mal');
    });
    el.addEventListener('blur', () => {
      const t = ver(el).trim();
      if (!t) { if (iso) { iso = ''; el.dispatchEvent(new Event('input', { bubbles: true })); } return; }
      const final = leer(t, true);
      if (final) {
        const cambia = final !== iso;
        iso = final; poner(el, aTexto(iso));
        if (cambia) { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
      } else el.classList.add('fecha-mal');
    });
  }
  const repasar = raiz => (raiz.querySelectorAll ? raiz.querySelectorAll('input[type=date]') : []).forEach(convertir);
  new MutationObserver(cambios => cambios.forEach(c => c.addedNodes.forEach(n => {
    if (n.nodeType !== 1) return;
    if (n.matches && n.matches('input[type=date]')) convertir(n); else repasar(n);
  }))).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => repasar(document));
  window.FechaTexto = { leer, convertir };
})();

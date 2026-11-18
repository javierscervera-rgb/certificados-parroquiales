/* ============================================================
   MOTOR DE MAQUETACIÓN
   Calcula la posición de cada elemento del certificado (A4, en puntos)
   una sola vez, y con ese resultado dibuja:
     - la vista previa (SVG en pantalla)
     - el PDF definitivo (pdf-lib)
   Así lo que ves en pantalla es exactamente lo que se imprime.
   ============================================================ */

const A4 = { w: 595.28, h: 841.89 };
const M = { izq: 96, der: 508, cuerpo: 12, interlinea: 32 };

const Motor = {
  fuentes: null,       // fuentes de pdf-lib para medir texto
  imagenes: new Map(), // dataURL -> {w, h}

  async iniciar() {
    const doc = await PDFLib.PDFDocument.create();
    this.fuentes = {
      normal: await doc.embedFont(PDFLib.StandardFonts.Helvetica),
      negrita: await doc.embedFont(PDFLib.StandardFonts.HelveticaBold),
    };
  },

  // Quita caracteres que la fuente estándar no puede imprimir
  limpiar(texto, negrita) {
    const f = negrita ? this.fuentes.negrita : this.fuentes.normal;
    let s = String(texto ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\t/g, ' ');
    try { f.encodeText(s); return s; } catch (e) {
      return [...s].map(c => { try { f.encodeText(c); return c; } catch (e2) { return '?'; } }).join('');
    }
  },

  // Ancho del texto letra a letra, sin "kerning": así coincide con cómo se dibuja en el PDF
  _anchos: { normal: new Map(), negrita: new Map() },
  ancho(texto, tam, negrita) {
    const f = negrita ? this.fuentes.negrita : this.fuentes.normal;
    const cache = this._anchos[negrita ? 'negrita' : 'normal'];
    let total = 0;
    for (const c of String(texto)) {
      let w = cache.get(c);
      if (w === undefined) { try { w = f.widthOfTextAtSize(c, 1000); } catch (e) { w = 500; } cache.set(c, w); }
      total += w;
    }
    return total * tam / 1000;
  },

  async medirImagen(src) {
    if (!src) return null;
    if (this.imagenes.has(src)) return this.imagenes.get(src);
    const dims = await new Promise(res => {
      const im = new Image();
      im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => res(null);
      im.src = src;
    });
    this.imagenes.set(src, dims);
    return dims;
  },

  // Ajusta una imagen dentro de una caja manteniendo la proporción
  async encajar(src, x, y, w, h) {
    const d = await this.medirImagen(src);
    if (!d) return null;
    const k = Math.min(w / d.w, h / d.h);
    const ww = d.w * k, hh = d.h * k;
    return { tipo: 'img', src, x: x + (w - ww) / 2, y: y + (h - hh) / 2, w: ww, h: hh };
  },

  // Divide un texto en palabras con su estilo (los **asteriscos** marcan negrita)
  palabras(texto, negritaBase = false) {
    const res = [];
    let neg = negritaBase;
    let antes = '';
    String(texto ?? '').split('**').forEach((trozo, i) => {
      if (i > 0) neg = !neg;
      // "**Nombre**, hijo": la coma va pegada; "que **nació**" no, porque había espacio antes
      const pegado = res.length && trozo && !/^\s/.test(trozo) && !/\s$/.test(antes);
      if (trozo) antes = trozo;
      trozo.split(/\s+/).filter(Boolean).forEach((t, j) => res.push({ t: this.limpiar(t, neg), neg, pegado: pegado && j === 0 }));
    });
    return res;
  },

  // Corta un texto en líneas de un ancho máximo (sin justificar)
  cortar(texto, tam, ancho, negrita = false) {
    const lineas = [];
    String(texto ?? '').split('\n').forEach(parrafo => {
      let actual = '';
      parrafo.split(/\s+/).filter(Boolean).forEach(p => {
        p = this.limpiar(p, negrita);
        const prueba = actual ? actual + ' ' + p : p;
        if (actual && this.ancho(prueba, tam, negrita) > ancho) { lineas.push(actual); actual = p; }
        else actual = prueba;
      });
      lineas.push(actual);
    });
    return lineas;
  },

  /* Párrafo: devuelve operaciones de texto palabra a palabra */
  parrafo(texto, y, o = {}) {
    const { sangria = 0, justificar = true, x0 = M.izq, x1 = M.der, tam = M.cuerpo, interlinea = M.interlinea, negrita = false } = o;
    const ops = [];
    const palabras = this.palabras(texto, negrita).map(p => ({ ...p, w: this.ancho(p.t, tam, p.neg) }));
    const esp = this.ancho(' ', tam);
    let linea = [], anchoLinea = 0, primera = true;
    const volcar = (ultima) => {
      const xi = x0 + (primera ? sangria : 0);
      const huecos = linea.length - 1;
      const extra = (!ultima && justificar && huecos > 0) ? esp + (x1 - xi - anchoLinea) / huecos : esp;
      let x = xi;
      linea.forEach((p, k) => {
        if (k > 0 && p.pegado) x -= extra;
        ops.push({ tipo: 'txt', t: p.t, x, y, tam, negrita: p.neg });
        x += p.w + extra;
      });
      y += interlinea; primera = false; linea = []; anchoLinea = 0;
    };
    for (const p of palabras) {
      const xi = x0 + (primera ? sangria : 0);
      const sep = p.pegado ? 0 : esp;
      const nuevo = linea.length ? anchoLinea + sep + p.w : p.w;
      if (linea.length && xi + nuevo > x1) volcar(false);
      anchoLinea = linea.length ? anchoLinea + sep + p.w : p.w;
      linea.push(p);
    }
    if (linea.length) volcar(true);
    return { ops, y: y - interlinea }; // y = línea base de la última línea
  },

  texto(t, x, y, tam, { negrita = false, alinear = 'izq', color } = {}) {
    t = this.limpiar(t, negrita);
    const w = this.ancho(t, tam, negrita);
    if (alinear === 'der') x -= w;
    if (alinear === 'centro') x -= w / 2;
    return { tipo: 'txt', t, x, y, tam, negrita, color };
  },

  /* Línea suelta con **negritas**, alineada a la izquierda o centrada; opcionalmente subrayada */
  lineaRica(texto, y, { x0 = M.izq, x1 = M.der, tam = M.cuerpo, centrar = false, negrita = false, subrayado = false, color, interlinea = M.interlinea } = {}) {
    const pal = this.palabras(texto, negrita).map(p => ({ ...p, w: this.ancho(p.t, tam, p.neg) }));
    const esp = this.ancho(' ', tam);
    const maximo = centrar ? A4.w - 2 * 50 : x1 - x0;
    // reparte en líneas que quepan
    const lineas = [[]]; let ancho = 0;
    pal.forEach(p => {
      const sep = lineas[lineas.length - 1].length && !p.pegado ? esp : 0;
      if (lineas[lineas.length - 1].length && ancho + sep + p.w > maximo) { lineas.push([]); ancho = 0; }
      const l = lineas[lineas.length - 1];
      ancho += (l.length && !p.pegado ? esp : 0) + p.w; l.push(p);
    });
    const ops = [];
    lineas.forEach((l, k) => {
      const total = l.reduce((a, p, j) => a + p.w + (j && !p.pegado ? esp : 0), 0);
      let x = centrar ? (A4.w - total) / 2 : x0;
      const yy = y + k * interlinea;
      if (subrayado && l.length) ops.push({ tipo: 'linea', x1: x, y1: yy + 2, x2: x + total, y2: yy + 2, color: color || '#111111', grosor: 0.6 });
      l.forEach((p, j) => { if (j && !p.pegado) x += esp; ops.push({ tipo: 'txt', t: p.t, x, y: yy, tam, negrita: p.neg, color }); x += p.w; });
    });
    return { ops, y: y + (lineas.length - 1) * interlinea };
  },

  /* Pie del exhorto: certificación de la parroquia que publica las amonestaciones */
  pieExhorto(texto) {
    const gris = '#555555', ops = [];
    ops.push({ tipo: 'linea', x1: 40, y1: 618, x2: 555, y2: 618, color: '#bbbbbb', grosor: 0.8 });
    const r = this.parrafo(texto, 638, { x0: 44, x1: 545, tam: 10.5, interlinea: 15, justificar: false });
    r.ops.forEach(o => { o.color = gris; ops.push(o); });
    ops.push(this.texto('En ________________ a ____ de ______________ de ______', 545, 712, 10.5, { alinear: 'der', color: gris }));
    ops.push(this.texto('(Firma y sello)', 44, 742, 10.5, { color: gris }));
    return ops;
  },

  /* Columna izquierda de la partida de bautismo */
  margenPartida(m, y0) {
    const ops = [], x = 24, ancho = m.ancho || 92;
    let y = y0;
    const grupo = (lineas, tam, lead, negrita = false) => {
      lineas.forEach(l => this.cortar(l, tam, ancho, negrita).forEach(t => { ops.push(this.texto(t, x, y, tam, { negrita })); y += lead; }));
    };
    const tam = m.tam || 7.5, lead = m.lead || 10;
    grupo(m.parroquia, tam, lead); y += 6;
    m.lugar.forEach(l => { grupo([l], tam, lead); y += 6; });
    y += 6; grupo(m.libro, Math.max(tam, 9.5), Math.max(lead, 12)); y += 12;
    grupo([m.etiquetaNotas || 'NOTAS:'], Math.max(tam, 9.5), Math.max(lead, 12)); y += 8;
    if (m.notas) grupo([m.notas], 8.5, 11);
    return { ops, y };
  },

  /* Tabla de trámites al pie de la comunicación de matrimonio */
  tablaComunicacion() {
    const cols = [
      ['Se envía a la Diócesis de destino', '(Sello del Obispado)'],
      ['Vista esta comunicación pase para su cumplimiento a la parroquia de destino', '(Sello del Obispado de destino)'],
      ['Cumplimentado en la Parroquia de destino', '(Firma y sello de la Parroquia de destino)'],
      ['Devuélvase a la Diócesis de destino', '(Sello del Obispado remitente)'],
      ['Se devuelve a la Parroquia de origen', '(Sello del Obispado)'],
    ];
    const x0 = 40, x1 = 555, y0 = 742, y1 = 814, w = (x1 - x0) / cols.length;
    const ops = [{ tipo: 'rect', x: x0, y: y0, w: x1 - x0, h: y1 - y0, color: '#333333', grosor: 0.8 }];
    cols.forEach(([arriba, abajo], i) => {
      const cx = x0 + w * i + w / 2;
      if (i) ops.push({ tipo: 'linea', x1: x0 + w * i, y1: y0, x2: x0 + w * i, y2: y1, color: '#333333', grosor: 0.8 });
      this.cortar(arriba, 6.5, w - 8, true).forEach((l, j) => ops.push(this.texto(l, cx, y0 + 10 + j * 8, 6.5, { negrita: true, alinear: 'centro' })));
      const ab = this.cortar(abajo, 6.5, w - 8);
      ab.forEach((l, j) => ops.push(this.texto(l, cx, y1 - 6 - (ab.length - 1 - j) * 8, 6.5, { alinear: 'centro' })));
    });
    return ops;
  },


  /* ---------- Formularios con líneas de puntos (Alegato V) ---------- */
  // partes: textos fijos y huecos {v: valor, w: fracción del espacio libre}; el último hueco sin w ocupa el resto
  lineaPuntos(partes, y, { x0 = 48, x1 = 556, tam = 12 } = {}) {
    const ops = [], gris = '#777777';
    const ancho = (t, n) => this.ancho(this.limpiar(t, n), tam, n);
    const punto = this.ancho('.', tam);
    const fijos = partes.filter(p => typeof p === 'string').reduce((a, t) => a + ancho(t), 0);
    const libre = Math.max(0, (x1 - x0) - fijos);
    let x = x0;
    partes.forEach((p, i) => {
      if (typeof p === 'string') { if (p) { ops.push(this.texto(p, x, y, tam)); x += ancho(p); } return; }
      const resto = partes.slice(i + 1).some(q => typeof q !== 'string');
      let hueco = p.w != null ? libre * p.w : (resto ? libre * 0.3 : x1 - x - partes.slice(i + 1).reduce((a, t) => a + (typeof t === 'string' ? ancho(t) : 0), 0));
      const v = (p.v ?? '').toString().trim();
      let xv = x;
      if (v) {
        const wv = ancho(' ' + v + ' ', true);
        ops.push(this.texto(v, x + ancho(' '), y, tam, { negrita: true }));
        xv = x + wv; hueco = Math.max(hueco, wv);
      }
      const n = Math.max(0, Math.floor((x + hueco - xv) / punto));
      if (n) ops.push(this.texto('.'.repeat(n), xv, y, tam, { color: gris }));
      x += hueco;
    });
    return ops;
  },

  // Texto en párrafo normal sin justificar, con interlineado propio
  bloqueTexto(texto, y, { x0 = 48, x1 = 556, tam = 12, interlinea = 17, justificar = true } = {}) {
    return this.parrafo(texto, y, { x0, x1, tam, interlinea, justificar });
  },

  async maquetarAlegato(d, ctx) {
    const cfg = ctx.config, x0 = 48, x1 = 556, IL = 19.5;
    const gris = '#8a8a8a';
    const nombre = l => [d[l + '_nombre'], d[l + '_apellido1'], d[l + '_apellido2']].filter(x => x && x.trim()).join(' ') ||
      [d[l + '_nombre'], d[l + '_apellidos']].filter(x => x && x.trim()).join(' ');
    const f = v => v ? H.fecha(v) : '';
    const anio = (/^(\d{4})/.exec(ctx.fechaDocumento || '') || [])[1] || String(new Date().getFullYear());

    // ---------- Página 1: autorización ----------
    const p1 = [];
    p1.push(this.texto(cfg.nombre || '', 311, 26, 12.5, { negrita: true, color: gris }));
    p1.push(this.texto(`${cfg.vicaria || 'Vicaría'}   Nº ${d.num_expediente || ''}`, 311, 41, 12.5, { negrita: true, color: gris }));
    p1.push(this.texto(`Libro ${anio}`, 558, 41, 12.5, { negrita: true, alinear: 'der', color: gris }));
    if (cfg.logoDiocesis) { const im = await this.encajar(cfg.logoDiocesis, 62, 38, 66, 54); if (im) p1.push(im); }
    p1.push(this.texto((cfg.diocesisTitulo || 'ARZOBISPADO').toUpperCase(), A4.w / 2 + 2, 73, 19, { negrita: true, alinear: 'centro' }));
    p1.push(this.texto('AUTORIZACIÓN DE MATRIMONIO', A4.w / 2 + 2, 104, 14.5, { alinear: 'centro', color: '#333333' }));

    p1.push(...this.lineaPuntos(['Al Rvdo. Sr. Cura Párroco de', { v: d.parroquia_boda }, '.'], 139, { x0, x1 }));
    const intro = this.bloqueTexto('En esta Vicaría General y por el infrascrito Notario se ha seguido expediente, aprobado con fecha de hoy, para el matrimonio que pretenden contraer:', 171, { x0, x1, interlinea: 17.5 });
    p1.push(...intro.ops);

    const contrayente = (l, y) => {
      const M = l === 'novio';
      const o = M ? 'o' : 'a';
      const parroquiaBau = [d[l + '_parroquia_bau'], d[l + '_ciudad_bau'] ? `(${d[l + '_ciudad_bau']})` : ''].filter(Boolean).join(' ');
      const domicilio = [d[l + '_domicilio'], d[l + '_parroquia_domicilio'] ? `(parroquia ${d[l + '_parroquia_domicilio']})` : ''].filter(Boolean).join(' ');
      const lineas = [
        [M ? 'DON' : 'DOÑA', { v: nombre(l) }],
        [`nacid${o} en`, { v: d[l + '_lugar_nac'], w: .55 }, ', el día', { v: f(d[l + '_f_nac']) }],
        [`bautizad${o} en la parroquia`, { v: parroquiaBau }],
        ['de la Diócesis de', { v: d[l + '_diocesis_bau'] }],
        ['el día', { v: f(d[l + '_f_bau']) }],
        ['libro', { v: d[l + '_libro_bau'], w: .2 }, ' folio', { v: d[l + '_folio_bau'], w: .2 }, ' nº', { v: d[l + '_num_bau'] }],
        ['de', { v: H.edad(d[l + '_f_nac'], ctx.fechaDocumento), w: .3 }, ' años de edad, de estado', { v: d[l + '_estado_civil'] }],
        [`hij${o} de`, { v: H.padre(d, l), w: .5 }, ' y', { v: H.madre(d, l) }],
        [`domiciliad${o} en`, { v: domicilio }],
        ['D.N.I.', { v: d[l + '_dni'] }],
        ['Registro civil', { v: d[l + '_registro_civil'], w: .45 }, ', tomo', { v: d[l + '_tomo_rc'], w: .2 }, ', página', { v: d[l + '_pagina_rc'] }],
      ];
      lineas.forEach((ln, i) => p1.push(...this.lineaPuntos(ln, y + i * IL, { x0, x1 })));
    };
    contrayente('novio', 224);
    contrayente('novia', 454);

    p1.push(...this.bloqueTexto('y no resultando impedimento alguno, damos el presente despacho para que, ante Vd. u otro sacerdote o diácono, con delegación suya, puedan contraer matrimonio canónico.', 676, { x0, x1, interlinea: 17.5 }).ops);
    p1.push(...this.lineaPuntos([`Dado en ${cfg.vicariaCiudad || '__________'} a`, { v: '', w: .12 }, ' de', { v: '', w: .4 }, ' de', { v: '', w: .25 }], 722, { x0, x1: 360 }));
    const centroIzq = 205, centroDer = 455;
    p1.push(this.texto(cfg.vicario || '', centroIzq, 799, 11.5, { alinear: 'centro' }));
    p1.push(this.texto(cfg.vicarioCargo || 'Vicario Episcopal', centroIzq, 812, 11.5, { alinear: 'centro' }));
    p1.push(this.texto('Por mandato', centroDer, 799, 11.5, { alinear: 'centro' }));
    p1.push(this.texto('El Notario', centroDer, 812, 11.5, { alinear: 'centro' }));
    const pie = [cfg.vicaria, [[cfg.vicariaCalle, cfg.vicariaNumero].filter(Boolean).join(', '), [cfg.vicariaCP, cfg.vicariaCiudad].filter(Boolean).join(' ')].filter(Boolean).join(' – '),
      cfg.vicariaEmail ? 'Email: ' + cfg.vicariaEmail : '', cfg.vicariaTelefono ? 'Teléfono ' + cfg.vicariaTelefono : ''].filter(Boolean).join('   ');
    if (pie) p1.push(this.texto(pie, A4.w / 2, 833, 8, { negrita: true, alinear: 'centro' }));

    // ---------- Página 2: reverso ----------
    const p2 = [], X0 = 47, X1 = 554, L = 21.5;
    const titulo = (t, y) => p2.push(this.texto(t, X0, y, 11.5, { color: '#222222' }));
    const parroco = (y) => { p2.push(this.texto('El Párroco', A4.w / 2, y, 11.5, { alinear: 'centro' })); p2.push(this.texto('(Sello)', A4.w / 2, y + 13, 11.5, { alinear: 'centro', color: '#444444' })); };
    const fechaLugar = (y) => p2.push(...this.lineaPuntos([{ v: '', w: .3 }, ', a', { v: '', w: .14 }, ' de', { v: '', w: .3 }, ' de', { v: '' }], y, { x0: 152, x1: 445, tam: 11.5 }));

    titulo('EN CASO DE DELEGACIÓN', 40);
    p2.push(this.texto('Para que pueda asistir lícita y válidamente a la celebración de este matrimonio dentro de los límites', X0, 62, 11.5));
    p2.push(...this.lineaPuntos(['de esta parroquia, delegamos, conforme al c. 1111, 1º, al Rvdo. D.', { v: d.delegado }], 62 + L, { x0: X0, x1: X1, tam: 11.5 }));
    p2.push(...this.lineaPuntos([{ v: '' }], 62 + 2 * L, { x0: X0, x1: X1, tam: 11.5 }));
    fechaLugar(62 + 3 * L);
    parroco(62 + 4 * L + 2);

    titulo('CONSTANCIA DE LA CELEBRACIÓN', 226);
    p2.push(...this.lineaPuntos(['Este matrimonio se celebró en la parroquia de', { v: d.parroquia_boda }], 245, { x0: X0, x1: X1, tam: 11.5 }));
    p2.push(...this.lineaPuntos(['el día', { v: '', w: .25 }, ' de', { v: '', w: .32 }, ' de', { v: '' }, ' asistiendo a la celebración'], 266, { x0: X0, x1: X1, tam: 11.5 }));
    p2.push(...this.lineaPuntos(['el Rvdo. D.', { v: '' }, ' y siendo testigos'], 287, { x0: X0, x1: X1, tam: 11.5 }));
    p2.push(...this.lineaPuntos(['D.', { v: '' }], 308, { x0: X0, x1: X1, tam: 11.5 }));
    p2.push(...this.lineaPuntos(['y D.', { v: '' }], 329, { x0: X0, x1: X1, tam: 11.5 }));
    [['El Párroco o', 134], ['El contrayente', 278], ['La contrayente', 470]].forEach(([t, x]) => p2.push(this.texto(t, x, 343, 11.5, { alinear: 'centro' })));
    p2.push(this.texto('sacerdote delegado', 134, 356, 11.5, { alinear: 'centro' }));
    p2.push(this.texto('Testigo', 263, 410, 11.5, { alinear: 'centro' }));
    p2.push(this.texto('Testigo', 453, 410, 11.5, { alinear: 'centro' }));

    titulo('INSCRIPCIÓN DEL MATRIMONIO CELEBRADO', 497);
    p2.push(...this.lineaPuntos(['Este matrimonio ha quedado registrado en el libro', { v: '', w: .34 }, ' folio', { v: '', w: .3 }, ' número', { v: '' }], 517, { x0: X0, x1: X1, tam: 11.5 }));
    p2.push(this.texto('de esta parroquia.', X0, 537, 11.5));
    parroco(550);

    titulo('NOTIFICACIÓN DE LA CELEBRACIÓN DEL MATRIMONIO', 648);
    p2.push(...this.lineaPuntos(['Con fecha de', { v: '', w: .3 }, ' de', { v: '', w: .3 }, ' de', { v: '' }, ' se ha comunicado la celebración de este matri-'], 668, { x0: X0, x1: X1, tam: 11.5 }));
    p2.push(this.texto('monio a las parroquias en las que fueron bautizados los contrayentes.', X0, 688, 11.5));
    parroco(702);

    return { paginas: [p1, p2] };
  },


  /* ---------- EXPEDIENTE MATRIMONIAL: datos sobre el impreso oficial ---------- */
  _fondos: new Map(),
  async fondo(n, impreso = 'expediente') {
    const clave = impreso + n;
    if (this._fondos.has(clave)) return this._fondos.get(clave);
    const p = fetch(`fondos/${impreso}-${String(n).padStart(2, '0')}.jpg`).then(r => r.blob()).then(b => new Promise(res => {
      const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b);
    }));
    this._fondos.set(clave, p);
    return p;
  },

  // Escribe un dato en gris en su sitio; si no cabe, reduce la letra y, si puede, usa más líneas
  dato(ops, valor, pos, { tam = 10, color = '#707070', negrita = false, minTam = 6.5 } = {}) {
    const t = String(valor ?? '').replace(/\s+/g, ' ').trim();
    if (!t || !pos) return;
    const [x, base, x1 = 548, lineas = 1, ld = 11] = pos;
    let sz = tam, filas;
    while (sz >= minTam) {
      filas = this.cortar(t, sz, x1 - x, negrita);
      if (filas.length <= lineas) break;
      sz -= 0.5;
    }
    if (filas.length > lineas) { filas = filas.slice(0, lineas); filas[lineas - 1] = filas[lineas - 1].replace(/.{0,2}$/, '…'); }
    filas.forEach((f, i) => ops.push(this.texto(f, x, base - 0.21 * sz + i * ld, sz, { color, negrita })));
  },

  async maquetarExpediente(d, ctx, parte = 'todo') {
    const cfg = ctx.config, f = ctx.firmante || {}, E = EXPEDIENTE;
    const corta = v => H.fechaCorta(v);
    const firma = (ops, pos, tam = 10) => {
      if (!pos) return;
      const [, x, base] = pos.length === 3 ? pos : [0, pos[0], pos[1]];
      if (f.nombre) ops.push(this.texto(f.nombre, x, base - 0.21 * tam, tam, { alinear: 'centro', color: '#707070' }));
      if (f.cargo) ops.push(this.texto(f.cargo, x, base - 0.21 * tam + tam + 1, tam, { alinear: 'centro', color: '#707070' }));
    };
    const paginas = {};
    const pagina = n => (paginas[n] = paginas[n] || []);

    // 1. Portada
    {
      const o = pagina(1), j = (...a) => a.filter(x => x && String(x).trim()).join(' ');
      const linea = (t, base) => o.push(this.texto(t, 301.5, base - 3.8, 18, { alinear: 'centro', color: '#000000' }));
      linea('Don ' + j(d.novio_nombre, d.novio_apellido1 || d.novio_apellidos), 448.8);
      linea('y', 469.8);
      linea('Doña ' + j(d.novia_nombre, d.novia_apellido1 || d.novia_apellidos), 490.8);
      if (d.novio_telefono) o.push(this.texto(d.novio_telefono, 477, 440, 12, { color: '#707070' }));
      if (d.novia_telefono) o.push(this.texto(d.novia_telefono, 477, 483, 12, { color: '#707070' }));
      const etiqueta = (t, x, base) => {
        const ancho = this.ancho(t, 14, true), punto = this.ancho('.', 14, true);
        o.push(this.texto(t + '.'.repeat(Math.max(0, Math.floor((484.6 - x - ancho) / punto))), x, base - 3, 14, { negrita: true, color: '#000000' }));
      };
      etiqueta('PARROQUIA ', 49, 549); etiqueta('MUNICIPIO ', 49, 573);
      o.push(this.texto('AÑO.......................NÚMERO DE EXPEDIENTE ...............................', 64.6, 594, 14, { negrita: true, color: '#000000' }));
      this.dato(o, (cfg.nombre || '').replace(/^parroquia( de)?\s+/i, ''), [155, 547, 480], { tam: 14, color: '#000000' });
      this.dato(o, cfg.localidad, [137, 571, 480], { tam: 14, color: '#000000' });
      if (d.num_expediente) {
        this.dato(o, (/^(\d{4})/.exec(ctx.fechaDocumento || '') || [])[1], [105, 595, 190], { tam: 14, color: '#000000' });
        this.dato(o, d.num_expediente, [400, 595, 487], { tam: 14, color: '#000000' });
      }
      o.push(this.texto('DOCUMENTOS QUE SE ADJUNTAN', 301.5, 657, 20, { negrita: true, alinear: 'centro', color: '#000000' }));
      String(d.documentos ?? E.DOCUMENTOS).split('\n').filter(x => x.trim()).slice(0, 8)
        .forEach((l, i) => this.dato(o, l, [52.3, 697.5 + i * 14, 470], { tam: 12 }));
    }

    // 2. Datos de los contrayentes
    {
      const o = pagina(2);
      const valor = (k, l) => {
        if (k === 'padre') return H.padre(d, l);
        if (k === 'madre') return H.madre(d, l);
        const v = d[l + '_' + k];
        return /^f_/.test(k) ? corta(v) : v;
      };
      Object.entries(E.datos).forEach(([k, [izq, der]]) => {
        this.dato(o, valor(k, 'novio'), [izq[0], izq[1], izq[2] || 300, izq[3], izq[4]]);
        this.dato(o, valor(k, 'novia'), [der[0], der[1], der[2] || 548, der[3], der[4]]);
      });
      this.dato(o, [d.parroquia_cursillo, d.fecha_cursillo].filter(Boolean).join(', '), [74, 649, 548]);
      this.dato(o, [d.parroquia_boda, corta(d.f_mat)].filter(Boolean).join(', '), [74, 679, 548]);
      this.dato(o, d.domicilio_boda, [74, 710, 548]);
    }

    // 3-10. Exámenes de los contrayentes y de los testigos
    [['novio', 'novio_ex_'], ['novia', 'novia_ex_'], ['t1', 't1_'], ['t2', 't2_']].forEach(([quien, pref]) => {
      Object.entries(E.examen[quien]).forEach(([k, pos]) => {
        const o = pagina(pos[0]);
        if (k === 'firma') return firma(o, pos);
        this.dato(o, d[pref + k], pos.slice(1));
      });
    });

    // 11. Diligencias
    {
      const o = pagina(11);
      if (!AMON.dispensa(d)) {
        // Esta parroquia: fechas de quien se amonesta aquí. Otras parroquias: nombre y fechas de quien se amonesta fuera.
        const lados = AMON.lados(d, cfg), quien = x => (x.l === 'novio' ? 'el novio' : 'la novia');
        const aqui = lados.filter(x => x.aqui && (x.desde || x.hasta)), fuera = lados.filter(x => !x.aqui && (x.parroquia || x.desde));
        const igual = aqui.length === 2 && aqui[0].desde === aqui[1].desde && aqui[0].hasta === aqui[1].hasta;
        this.dato(o, igual || aqui.length === 1 && !fuera.length ? AMON.rango(aqui[0]) : aqui.map(x => `${quien(x)} ${AMON.rango(x)}`).join('; '), [68, 144, 548]);
        this.dato(o, fuera.map(x => `${x.parroquia || '___'} (${quien(x)}${AMON.rango(x) ? ', ' + AMON.rango(x) : ''})`).join('; ') || (d.proclamas_parroquias || ''), [68, 162, 548]);
      } else if (d.dispensa_motivo) {
        // empieza tras «por» y sigue en la línea de puntos de abajo
        const primera = this.cortar(d.dispensa_motivo, 10, 548 - 408);
        this.dato(o, primera[0], [408, 276, 548]);
        this.dato(o, primera.slice(1).join(' '), [68, 290, 548]);
      }
      firma(o, [302.5, 203.7], 8);
      firma(o, [469.5, 316.7], 8);
      if (d.otra_parroquia) {
        this.dato(o, d.otra_parroquia, [364, 460, 548, 2, 11]);
        this.dato(o, d.motivo_otra_parroquia, [257, 488, 548]);
        firma(o, [469.5, 515.7], 8);
      }
    }

    const parteDef = E.partes.find(p => p.id === parte) || E.partes[0];
    const res = [];
    for (const n of parteDef.paginas) {
      const fondo = await this.fondo(n);
      res.push([{ tipo: 'img', src: fondo, x: 0, y: 0, w: A4.w, h: A4.h }, ...(paginas[n] || [])]);
    }
    return { paginas: res };
  },


  /* ---------- EDICTO DE AMONESTACIONES (varias parejas) ---------- */
  async maquetarEdicto(ctx, conFirma) {
    const cfg = ctx.config, color = cfg.color || '#a8322d', firmante = ctx.firmante || {};
    const parejas = ctx.edicto || [];
    const X0 = 43, X1 = 552, TAM = 11.5, IL = 17;
    const paginas = [];
    const nueva = async (primera) => {
      const ops = [];
      if (cfg.logo) { const im = await this.encajar(cfg.logo, 34, 8, 112, 126); if (im) ops.push(im); }
      ops.push({ tipo: 'linea', x1: cfg.logo ? 242 : 43, y1: 83, x2: 559, y2: 83, color, grosor: 1.2 });
      [cfg.nombre, cfg.direccion, cfg.localidad, [cfg.cp, (cfg.provincia || '').toUpperCase()].filter(Boolean).join(' '), cfg.web]
        .filter(Boolean).forEach((l, i) => ops.push(this.texto(l, 43, 152 + i * 10, 7, { color })));
      const cx = 340;
      ops.push(this.texto('EDICTO AMONESTACIONES', cx, 118, 17, { negrita: true, alinear: 'centro' }));
      ops.push(this.texto('MATRIMONIALES', cx, 145, 17, { negrita: true, alinear: 'centro' }));
      ops.push(this.texto(primera ? 'Pretenden contraer matrimonio' : 'Pretenden contraer matrimonio (continuación)', cx, 172, 11, { alinear: 'centro' }));
      paginas.push(ops);
      return { ops, y: 222 };
    };
    let { ops, y } = await nueva(true);
    const hijo = (x, o) => {
      const p = [x.padre, x.madre].map(v => (v || '').trim()).filter(Boolean);
      return p.length ? `, hij${o} de ${p.join(' y ')}` : '';
    };
    for (const pa of parejas) {
      // se mide la pareja antes de colocarla para no partirla entre dos hojas
      const bloques = [
        `**${(pa.novio_nombre + ' ' + (pa.novio_apellidos || '')).trim()}**${hijo({ padre: pa.novio_padre, madre: pa.novio_madre }, 'o')} con`,
        `**${(pa.novia_nombre + ' ' + (pa.novia_apellidos || '')).trim()}**${hijo({ padre: pa.novia_padre, madre: pa.novia_madre }, 'a')}`,
      ];
      const medir = (yy) => {
        const res = [];
        bloques.forEach(b => { const r = this.parrafo(b, yy, { x0: X0, x1: X1, tam: TAM, interlinea: IL, justificar: false }); res.push(...r.ops); yy = r.y + IL; });
        const fechas = AMON.rango(pa);
        if (fechas) { res.push(this.texto('Desde ' + fechas.replace(/^del /, '').replace(' al ', ' a '), X0, yy, TAM)); yy += IL; }
        return { res, yy };
      };
      let m = medir(y);
      if (m.yy > 790) { ({ ops, y } = await nueva(false)); m = medir(y); }
      ops.push(...m.res); y = m.yy + IL * 0.9;
    }
    if (!parejas.length) { ops.push(this.texto('No hay parejas seleccionadas.', X0, y, TAM, { color: '#888888' })); y += IL * 2; }

    // Aviso y firma, al pie de la última hoja (o en una hoja más si no caben)
    const AVISO = 'SI ALGUNA PERSONA SUPIERA ALGÚN IMPEDIMENTO ESTÁ OBLIGADA A MANIFESTARLO CUANTO ANTES AL SR. CURA PÁRROCO DURANTE LAS DOS SEMANAS SIGUIENTES A LA PUBLICACIÓN DEL PRESENTE EDICTO, conforme al canon 1069 del Código de Derecho Canónico.';
    const yAviso = 640;
    if (y > yAviso - 10) ({ ops, y } = await nueva(false));
    const r = this.parrafo(AVISO, yAviso, { x0: X0, x1: X1, tam: 11, interlinea: 18, justificar: false });
    ops.push(...r.ops);
    const yFdo = Math.max(r.y + 70, 772);
    if (conFirma) {
      if (cfg.sello) { const im = await this.encajar(cfg.sello, 185, yFdo - 92, 128, 138); if (im) ops.unshift(im); }
      if (firmante.firma) { const im = await this.encajar(firmante.firma, 330, yFdo - 112, 180, 104); if (im) ops.push(im); }
    }
    ops.push(this.texto('Fdo. ' + (firmante.nombre || '______________________'), M.der, yFdo, M.cuerpo, { alinear: 'der' }));
    if (firmante.cargo) ops.push(this.texto(firmante.cargo, M.der, yFdo + 16, M.cuerpo, { alinear: 'der' }));
    return { paginas };
  },


  /* ---------- CERTIFICACIÓN PARA EL REGISTRO CIVIL (4 ejemplares sobre el impreso oficial) ---------- */
  async maquetarRegistroCivil(d, ctx, conFirma) {
    const cfg = ctx.config, f = ctx.firmante || {};
    const MAY = v => String(v || '').toLocaleUpperCase('es');
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const partes = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); return m ? { d: String(+m[3]), m: MESES[+m[2] - 1], a: m[1] } : { d: '', m: '', a: '' }; };
    const parroquia = (cfg.nombre || '').replace(/^parroquia( de)?\s+/i, '');
    const v = {
      firmante: f.nombre, parroquia,
      iglesia: d.iglesia_boda || 'parroquial', parroquia_boda: parroquia,
      residencia_municipio: MAY(d.residencia_municipio), residencia_provincia: MAY(d.residencia_provincia),
    };
    ['novio', 'novia'].forEach(l => {
      const n = partes(d[l + '_f_nac']);
      const insc = [MAY(d[l + '_registro_civil']), d[l + '_tomo_rc'] && 't. ' + d[l + '_tomo_rc'], d[l + '_pagina_rc'] && 'p. ' + d[l + '_pagina_rc']].filter(Boolean).join(', ');
      Object.assign(v, {
        [l + '_nombre']: MAY(H.persona(d, l)), [l + '_dni']: MAY(d[l + '_dni']), [l + '_estado']: MAY(d[l + '_estado_civil']),
        [l + '_padre']: MAY(H.padre(d, l)), [l + '_madre']: MAY(H.madre(d, l)),
        [l + '_dia']: n.d, [l + '_mes']: MAY(n.m), [l + '_anio']: n.a,
        [l + '_lugar']: MAY(d[l + '_lugar_nac']), [l + '_prov_nac']: MAY(d[l + '_provincia_nac']),
        [l + '_inscrito']: insc, [l + '_nacionalidad']: MAY(d[l + '_nacionalidad']),
        [l + '_calle']: MAY(d[l + '_res_calle']), [l + '_num']: MAY(d[l + '_res_num']),
        [l + '_municipio']: MAY(d[l + '_res_municipio']), [l + '_provincia']: MAY(d[l + '_res_provincia']),
        [l + '_profesion']: MAY(d[l + '_profesion']),
      });
    });
    v.novio_derecho = MAY(d.novio_derecho);
    const b = partes(d.f_mat);
    Object.assign(v, { boda_anio: b.a, boda_mes: b.m, boda_dia: b.d, boda_hora: d.hora_boda || '' });
    // observaciones: lo que no cabe en la primera línea sigue en la segunda
    const obs = String(d.observaciones_rc || '').replace(/\s+/g, ' ').trim();

    const res = [];
    for (let n = 1; n <= 4; n++) {
      const P = REGISTRO_CIVIL.paginas[n - 1];
      const ops = [{ tipo: 'img', src: await this.fondo(n, 'registro-civil'), x: 0, y: 0, w: A4.w, h: A4.h }];
      Object.entries(v).forEach(([k, val]) => { if (P[k]) this.dato(ops, val, P[k], { tam: 8, color: '#555555', minTam: /^residencia_/.test(k) ? 5 : 6.5 }); });
      if (obs) {
        const [x, , x1] = P.observaciones, primera = this.cortar(obs, 8, x1 - x);
        this.dato(ops, primera[0], P.observaciones, { tam: 8, color: '#555555' });
        this.dato(ops, primera.slice(1).join(' '), P.observaciones2, { tam: 8, color: '#555555' });
      }
      if (conFirma) {
        const [fx, fy] = P.firma;
        if (cfg.sello) { const im = await this.encajar(cfg.sello, fx - 8, fy - 46, 78, 80); if (im) ops.push(im); }
        if (f.firma) { const im = await this.encajar(f.firma, fx + 10, fy - 38, 110, 62); if (im) ops.push(im); }
      }
      res.push(ops);
    }
    return { paginas: res };
  },

  /* Maqueta completa de un certificado */
  async maquetar(cert, datos, ctx, conFirma) {
    const cfg = ctx.config;
    const doc = cert.documento(datos, ctx);
    if (doc.formato === 'alegato') return this.maquetarAlegato(datos, ctx);
    if (doc.formato === 'expediente') return this.maquetarExpediente(datos, ctx, ctx.parteExpediente);
    if (doc.formato === 'edicto') return this.maquetarEdicto(ctx, conFirma);
    if (doc.formato === 'registro_civil') return this.maquetarRegistroCivil(datos, ctx, conFirma);
    const color = cfg.color || '#a8322d';
    const IL = doc.interlinea || M.interlinea;
    const partida = doc.formato === 'partida';
    const cuerpo = partida ? { x0: 140, x1: 545, tam: 10.5, interlinea: 14, justificar: false, ...(doc.cuerpo || {}) } : { interlinea: IL, ...(doc.cuerpo || {}) };
    const ops = [];

    // --- Cabecera
    if (cfg.logo) { const im = await this.encajar(cfg.logo, 34, 8, 112, 126); if (im) ops.push(im); }
    ops.push({ tipo: 'linea', x1: cfg.logo ? 242 : 43, y1: 83, x2: 559, y2: 83, color, grosor: 1.2 });
    const lineasParroquia = [cfg.nombre, cfg.direccion, cfg.localidad,
      [cfg.cp, (cfg.provincia || '').toUpperCase()].filter(Boolean).join(' '), cfg.web].filter(Boolean);
    lineasParroquia.forEach((l, i) => ops.push(this.texto(l, 43, 152 + i * 10, 7, { color })));
    ops.push(this.texto(cfg.localidad || '', 518, 157, 10, { alinear: 'der' }));
    ops.push(this.texto(H.fechaCorta(ctx.fechaDocumento), 518, 171, 10, { alinear: 'der' }));

    // --- Título o destinatario
    let y;
    if (doc.destinatario) {
      y = 190;
      doc.destinatario.forEach((l, i) => ops.push(this.texto(l, A4.w / 2, y + i * 17, 12, { negrita: true, alinear: 'centro' })));
      y += (doc.destinatario.length - 1) * 17 + 33;
      ops.push(this.texto(doc.saludo, A4.w / 2, y, 12, { alinear: 'centro' }));
      y += IL;
    } else {
      const lineas = doc.titulo.split('\n');
      const tam = doc.tituloTam || (doc.tituloNegrita ? 16 : 17);
      y = doc.tituloY || (lineas.length > 2 ? 232 : lineas.length > 1 ? 240 : 251);
      lineas.forEach((l, i) => ops.push(this.texto(l, A4.w / 2, y + i * 22, tam, { negrita: doc.tituloNegrita, alinear: 'centro' })));
      y += (lineas.length - 1) * 22 + (doc.tituloHueco || 51);
    }
    const yCuerpo = y;

    // --- Cuerpo
    doc.bloques.forEach((b, i) => {
      if (i > 0) y += cuerpo.interlinea * (b.espacio ?? ((doc.bloques[i - 1].linea !== undefined || doc.bloques[i - 1].centro !== undefined) ? 1 : 2));
      else if (b.linea !== undefined && !doc.tituloHueco) y -= 16;
      if (b.linea !== undefined || b.centro !== undefined) {
        const r = this.lineaRica(b.linea ?? b.centro, y, { x0: cuerpo.x0 || M.izq, x1: cuerpo.x1 || M.der, tam: cuerpo.tam || M.cuerpo, centrar: b.centro !== undefined, negrita: b.negrita, subrayado: b.subrayado, interlinea: cuerpo.interlinea });
        ops.push(...r.ops); y = r.y;
        return;
      }
      const r = this.parrafo(b.p, y, { ...cuerpo, sangria: b.sangria ? 36 : 0, justificar: b.justificar ?? cuerpo.justificar ?? true });
      ops.push(...r.ops); y = r.y;
    });

    // --- Columna del margen (partida)
    if (partida) {
      const r = this.margenPartida(doc.margen, yCuerpo - 2);
      ops.push(...r.ops);
      ops.push({ tipo: 'linea', x1: doc.margen.linea || 128, y1: yCuerpo - 14, x2: doc.margen.linea || 128, y2: Math.max(y, r.y) + 20, color: '#bbbbbb', grosor: 0.6 });
    }

    // --- Cierre y firma (se compacta si el texto es largo)
    const centrado = doc.cierreCentrado;
    const huecoCierre = (doc.cierreEspacio ?? (centrado ? 1.5 : 4)) * IL;
    const huecoFirma = (doc.firmaEspacio ?? (centrado ? 3 : 4)) * (partida ? 14 : IL);
    const huecoCargo = doc.cargoEspacio ?? (partida ? 18 : 32);
    const limite = doc.limiteFirma ?? (doc.pie ? 715 : 800);
    let yCierre = doc.cierre ? y + huecoCierre : y;
    let yFdo = yCierre + huecoFirma;
    const exceso = yFdo + huecoCargo - limite;
    if (exceso > 0) { yCierre -= Math.min(exceso * 0.4, huecoCierre - IL); yFdo -= exceso; }
    if (doc.cierre) ops.push(centrado
      ? this.texto(doc.cierre, A4.w / 2, yCierre, M.cuerpo, { alinear: 'centro' })
      : this.texto(doc.cierre, M.izq, yCierre, M.cuerpo));

    const firmante = ctx.firmante || {};
    if (conFirma && !doc.sinFirmante) {
      if (cfg.sello) { const im = await this.encajar(cfg.sello, 185, yFdo - 92, 128, 138); if (im) ops.unshift(im); }
      if (firmante.firma) { const im = await this.encajar(firmante.firma, 330, yFdo - 112, 180, 104); if (im) ops.push(im); }
    }
    if (!doc.sinFirmante) {
      ops.push(this.texto('Fdo. ' + (firmante.nombre || '______________________'), M.der, yFdo, M.cuerpo, { alinear: 'der' }));
      if (firmante.cargo) ops.push(this.texto(firmante.cargo, M.der, yFdo + huecoCargo, M.cuerpo, { alinear: 'der' }));
    }
    if (doc.firmaIzquierda) ops.push(this.texto(doc.firmaIzquierda, M.izq, yFdo, M.cuerpo));
    if (doc.firmaVicario) {
      ops.push({ tipo: 'linea', x1: 200, y1: 770, x2: 430, y2: 770, color: '#bbbbbb', grosor: 0.6 });
      doc.firmaVicario.filter(Boolean).forEach((t, i) => ops.push(this.texto(t, 190, 770 + i * 13, 10, { alinear: 'der' })));
    }

    if (doc.pie === 'tablaComunicacion') ops.push(...this.tablaComunicacion());
    if (doc.pie === 'exhorto') ops.push(...this.pieExhorto(doc.pieTexto));
    return ops;
  },

  /* ---------- Dibujo en pantalla (SVG) ---------- */
  aSVG(ops) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const partes = ops.map(o => {
      if (o.tipo === 'txt') return `<text x="${o.x.toFixed(2)}" y="${o.y.toFixed(2)}" font-size="${o.tam}"${o.negrita ? ' font-weight="bold"' : ''} fill="${o.color || '#111'}" textLength="${this.ancho(o.t, o.tam, o.negrita).toFixed(2)}" lengthAdjust="spacingAndGlyphs">${esc(o.t)}</text>`;
      if (o.tipo === 'linea') return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${o.color}" stroke-width="${o.grosor}"/>`;
      if (o.tipo === 'rect') return `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="none" stroke="${o.color}" stroke-width="${o.grosor}"/>`;
      if (o.tipo === 'img') return `<image href="${o.src}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}"/>`;
      return '';
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${A4.w} ${A4.h}" font-family="Helvetica, Arial, sans-serif" class="hoja">
      <rect width="100%" height="100%" fill="#fff"/>${partes.join('')}</svg>`;
  },

  /* ---------- Dibujo en PDF ---------- */
  // ops: una página (lista de operaciones) o {paginas: [...]}
  paginas(r) { return Array.isArray(r) ? [r] : r.paginas; },

  async aPDF(resultado, titulo) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdf = await PDFDocument.create();
    pdf.setTitle(titulo || 'Certificado');
    const f = { normal: await pdf.embedFont(StandardFonts.Helvetica), negrita: await pdf.embedFont(StandardFonts.HelveticaBold) };
    const col = hex => {
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '#111111');
      return m ? rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255) : rgb(0, 0, 0);
    };
    const cache = new Map();
    for (const ops of this.paginas(resultado)) {
    const page = pdf.addPage([A4.w, A4.h]);
    for (const o of ops) {
      if (o.tipo === 'txt') page.drawText(o.t, { x: o.x, y: A4.h - o.y, size: o.tam, font: o.negrita ? f.negrita : f.normal, color: col(o.color) });
      else if (o.tipo === 'linea') page.drawLine({ start: { x: o.x1, y: A4.h - o.y1 }, end: { x: o.x2, y: A4.h - o.y2 }, thickness: o.grosor, color: col(o.color) });
      else if (o.tipo === 'rect') page.drawRectangle({ x: o.x, y: A4.h - o.y - o.h, width: o.w, height: o.h, borderColor: col(o.color), borderWidth: o.grosor });
      else if (o.tipo === 'img') {
        if (!cache.has(o.src)) {
          const bytes = Uint8Array.from(atob(o.src.split(',')[1]), c => c.charCodeAt(0));
          cache.set(o.src, o.src.startsWith('data:image/png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes));
        }
        page.drawImage(cache.get(o.src), { x: o.x, y: A4.h - o.y - o.h, width: o.w, height: o.h });
      }
    }
    }
    return pdf.save();
  }
};

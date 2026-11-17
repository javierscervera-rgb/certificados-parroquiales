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

  ancho(texto, tam, negrita) {
    return (negrita ? this.fuentes.negrita : this.fuentes.normal).widthOfTextAtSize(texto, tam);
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
    String(texto ?? '').split('**').forEach((trozo, i) => {
      if (i > 0) neg = !neg;
      const pegado = res.length && trozo && !/^\s/.test(trozo); // "**Nombre**, hijo": la coma va pegada
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
    const ops = [], x = 24, ancho = 92;
    let y = y0;
    const grupo = (lineas, tam, lead, negrita = false) => {
      lineas.forEach(l => this.cortar(l, tam, ancho, negrita).forEach(t => { ops.push(this.texto(t, x, y, tam, { negrita })); y += lead; }));
    };
    grupo(m.parroquia, 7.5, 10); y += 6;
    m.lugar.forEach(l => { grupo([l], 7.5, 10); y += 6; });
    y += 6; grupo(m.libro, 9.5, 12); y += 12;
    grupo(['NOTAS:'], 9.5, 12); y += 8;
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

  /* Maqueta completa de un certificado */
  async maquetar(cert, datos, ctx, conFirma) {
    const cfg = ctx.config;
    const doc = cert.documento(datos, ctx);
    const color = cfg.color || '#a8322d';
    const IL = doc.interlinea || M.interlinea;
    const partida = doc.formato === 'partida';
    const cuerpo = partida ? { x0: 140, x1: 545, tam: 10.5, interlinea: 14, justificar: false } : { interlinea: IL, ...(doc.cuerpo || {}) };
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
      ops.push({ tipo: 'linea', x1: 128, y1: yCuerpo - 14, x2: 128, y2: Math.max(y, r.y) + 20, color: '#bbbbbb', grosor: 0.6 });
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
    if (conFirma) {
      if (cfg.sello) { const im = await this.encajar(cfg.sello, 185, yFdo - 92, 128, 138); if (im) ops.unshift(im); }
      if (firmante.firma) { const im = await this.encajar(firmante.firma, 330, yFdo - 112, 180, 104); if (im) ops.push(im); }
    }
    ops.push(this.texto('Fdo. ' + (firmante.nombre || '______________________'), M.der, yFdo, M.cuerpo, { alinear: 'der' }));
    if (firmante.cargo) ops.push(this.texto(firmante.cargo, M.der, yFdo + huecoCargo, M.cuerpo, { alinear: 'der' }));

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
  async aPDF(ops, titulo) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdf = await PDFDocument.create();
    pdf.setTitle(titulo || 'Certificado');
    const f = { normal: await pdf.embedFont(StandardFonts.Helvetica), negrita: await pdf.embedFont(StandardFonts.HelveticaBold) };
    const page = pdf.addPage([A4.w, A4.h]);
    const col = hex => {
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '#111111');
      return m ? rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255) : rgb(0, 0, 0);
    };
    const cache = new Map();
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
    return pdf.save();
  }
};

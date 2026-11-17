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
    let s = String(texto).replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
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

  /* Párrafo justificado: devuelve operaciones de texto palabra a palabra */
  parrafo(texto, y, { sangria = 0, justificar = true } = {}) {
    const ops = [];
    const tam = M.cuerpo;
    const palabras = this.limpiar(texto).split(/\s+/).filter(Boolean);
    const esp = this.ancho(' ', tam);
    let linea = [], anchoLinea = 0, primera = true;
    const volcar = (ultima) => {
      const x0 = M.izq + (primera ? sangria : 0);
      const disponible = M.der - x0;
      const huecos = linea.length - 1;
      const extra = (!ultima && justificar && huecos > 0) ? esp + (disponible - anchoLinea) / huecos : esp;
      let x = x0;
      for (const p of linea) {
        ops.push({ tipo: 'txt', t: p.t, x, y, tam });
        x += p.w + extra;
      }
      y += M.interlinea; primera = false; linea = []; anchoLinea = 0;
    };
    for (const t of palabras) {
      const w = this.ancho(t, tam);
      const x0 = M.izq + (primera ? sangria : 0);
      const nuevo = linea.length ? anchoLinea + esp + w : w;
      if (linea.length && x0 + nuevo > M.der) volcar(false);
      anchoLinea = linea.length ? anchoLinea + esp + w : w;
      linea.push({ t, w });
    }
    if (linea.length) volcar(true);
    return { ops, y: y - M.interlinea }; // y = línea base de la última línea
  },

  texto(t, x, y, tam, { negrita = false, alinear = 'izq', color } = {}) {
    t = this.limpiar(t, negrita);
    const w = this.ancho(t, tam, negrita);
    if (alinear === 'der') x -= w;
    if (alinear === 'centro') x -= w / 2;
    return { tipo: 'txt', t, x, y, tam, negrita, color };
  },

  /* Maqueta completa de un certificado */
  async maquetar(cert, datos, ctx, conFirma) {
    const cfg = ctx.config;
    const doc = cert.documento(datos, ctx);
    const color = cfg.color || '#a8322d';
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
      y += M.interlinea;
    } else {
      const lineas = doc.titulo.split('\n');
      y = lineas.length > 1 ? 240 : 251;
      lineas.forEach((l, i) => ops.push(this.texto(l, A4.w / 2, y + i * 22, 17, { alinear: 'centro' })));
      y += (lineas.length - 1) * 22 + 51;
    }

    // --- Cuerpo
    doc.bloques.forEach((b, i) => {
      if (i > 0) y += M.interlinea * (b.espacio ?? (doc.bloques[i - 1].linea ? 1 : 2));
      else if (b.linea) y -= 16;
      if (b.linea) { ops.push(this.texto(b.linea, M.izq, y, M.cuerpo)); return; }
      const r = this.parrafo(b.p, y, { sangria: b.sangria ? 36 : 0 });
      ops.push(...r.ops); y = r.y;
    });

    // --- Cierre y firma (se compacta si el texto es largo)
    const huecoCierre = doc.cierreCentrado ? 48 : 128;
    const huecoFirma = doc.cierreCentrado ? 96 : 128;
    let yCierre = y + huecoCierre, yFdo = yCierre + huecoFirma;
    const exceso = yFdo + 32 - 800;
    if (exceso > 0) { yCierre -= exceso * 0.4; yFdo -= exceso; }
    ops.push(doc.cierreCentrado
      ? this.texto(doc.cierre, A4.w / 2, yCierre, M.cuerpo, { alinear: 'centro' })
      : this.texto(doc.cierre, M.izq, yCierre, M.cuerpo));

    const firmante = ctx.firmante || {};
    if (conFirma) {
      if (cfg.sello) { const im = await this.encajar(cfg.sello, 185, yFdo - 92, 128, 138); if (im) ops.unshift(im); }
      if (firmante.firma) { const im = await this.encajar(firmante.firma, 330, yFdo - 112, 180, 104); if (im) ops.push(im); }
    }
    ops.push(this.texto('Fdo. ' + (firmante.nombre || '______________________'), M.der, yFdo, M.cuerpo, { alinear: 'der' }));
    if (firmante.cargo) ops.push(this.texto(firmante.cargo, M.der, yFdo + 32, M.cuerpo, { alinear: 'der' }));
    return ops;
  },

  /* ---------- Dibujo en pantalla (SVG) ---------- */
  aSVG(ops) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const partes = ops.map(o => {
      if (o.tipo === 'txt') return `<text x="${o.x.toFixed(2)}" y="${o.y.toFixed(2)}" font-size="${o.tam}"${o.negrita ? ' font-weight="bold"' : ''} fill="${o.color || '#111'}" textLength="${this.ancho(o.t, o.tam, o.negrita).toFixed(2)}" lengthAdjust="spacingAndGlyphs">${esc(o.t)}</text>`;
      if (o.tipo === 'linea') return `<line x1="${o.x1}" y1="${o.y1}" x2="${o.x2}" y2="${o.y2}" stroke="${o.color}" stroke-width="${o.grosor}"/>`;
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

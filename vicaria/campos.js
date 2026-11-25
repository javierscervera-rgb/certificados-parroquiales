/* ============================================================
   EXPEDIENTES VICARÍA · CAMPOS DEL EXPEDIENTE
   Los mismos campos y pestañas de la pantalla «Expediente matrimonial»
   de Certificados (plantillas.js y expediente.js), ordenados para
   revisarlos. Lo usan la pantalla de revisión de la parroquia y la web de la Vicaría.
   ============================================================ */

const VIC_CAMPOS = (() => {
  const PESTANAS = [
    { id: 'datos', nombre: 'Datos generales' },
    { id: 'novio', nombre: 'Novio' },
    { id: 'novia', nombre: 'Novia' },
    { id: 't1', nombre: 'Testigo 1' },
    { id: 't2', nombre: 'Testigo 2' },
    { id: 'ultima', nombre: 'Última página' },
    { id: 'vicaria', nombre: 'Vicaría', soloVicaria: true },
    { id: 'alegato', nombre: 'Alegato V', soloVicaria: true, propia: true },   // pantalla propia en la web de la Vicaría
  ];
  const JURAMENTO = '¿Acepta Vd. responder a las siguientes preguntas bajo juramento?';

  let _est = null, _mapa = null;
  // { pestaña: [bloque] } · bloque: { titulo, color, pareja: [{titulo, campos}, {titulo, campos}] } o { titulo, color, campos }
  function estructura() {
    if (_est) return _est;
    const cert = CERTIFICADOS.find(c => c.id === 'expediente');
    const lado = l => CAMPOS_PAREJA.map(f => ({ k: `${l}_${f.k}`, label: f.label, tipo: f.tipo === 'date' ? 'date' : f.tipo === 'tel' ? 'tel' : 'text', w: f.w || 6, sep: f.sep }));
    const examen = (pref, secciones, juramento) => [
      { titulo: 'Juramento', campos: [{ k: pref + 'juramento', label: JURAMENTO, tipo: 'select', opciones: ['', 'JURO', 'PROMETO'], w: 12 }] },
      ...secciones.map((s, i) => ({ titulo: `${i + 1}. ${s.seccion}`, color: s.color, campos: s.preguntas.map(q => ({ k: pref + q.k, label: q.label, tipo: q.tipo === 'textarea' ? 'textarea' : 'text', w: q.w || 12 })) })),
    ];
    const amon = l => [
      { k: `amon_${l}_lugar`, label: `Amonestaciones ${l}: dónde`, tipo: 'select', opciones: ['Aquí', 'Fuera'], w: 4 },
      { k: `amon_${l}_parroquia`, label: 'Parroquia (si es fuera)', w: 8 },
      { k: `amon_${l}_desde`, label: 'Fecha de inicio', tipo: 'date', w: 6 },
      { k: `amon_${l}_hasta`, label: 'Fecha final', tipo: 'date', w: 6 },
    ];
    _est = {
      datos: [
        { pareja: [{ titulo: 'El contrayente', campos: lado('novio') }, { titulo: 'La contrayente', campos: lado('novia') }] },
        { titulo: 'Boda y documentos', campos: cert.campos.map(c => ({ k: c.k, label: c.label, tipo: c.tipo === 'date' ? 'date' : c.tipo === 'textarea' ? 'textarea' : 'text', w: c.w || 6 })) },
      ],
      novio: examen('novio_ex_', EXPEDIENTE.contrayente('novio')),
      novia: examen('novia_ex_', EXPEDIENTE.contrayente('novia')),
      t1: examen('t1_', EXPEDIENTE.testigo),
      t2: examen('t2_', EXPEDIENTE.testigo),
      ultima: [
        { titulo: '1) Proclamas matrimoniales', campos: [
          { k: 'dispensa', label: 'Dispensa de amonestaciones', tipo: 'sino', w: 12 },
          { k: 'dispensa_motivo', label: 'Los contrayentes solicitan dispensa de las proclamas matrimoniales por', w: 12 },
        ] },
        { pareja: [{ titulo: 'Amonestaciones novio', campos: amon('novio') }, { titulo: 'Amonestaciones novia', campos: amon('novia') }] },
        { titulo: '2) Matrimonio en otra parroquia', campos: [
          { k: 'otra_parroquia', label: 'Los contrayentes solicitan la celebración de su matrimonio en', w: 12 },
          { k: 'motivo_otra_parroquia', label: 'Motivo', w: 12 },
        ] },
      ],
      vicaria: [
        { titulo: '3) Aprobación para la celebración', campos: [
          { k: 'vic_celebrar_en', label: 'Visto este expediente, lo aprobamos para que el matrimonio pueda celebrarse en', tipo: 'textarea', w: 12 },
          { k: 'vic_acordado_en', label: 'Lo acordó y firmó el Vicario General en', w: 8 },
          { k: 'vic_fecha', label: 'Fecha (a … de … de …)', tipo: 'date', w: 4 },
        ] },
      ],
    };
    return _est;
  }

  function campos(bloque) { return bloque.pareja ? bloque.pareja.flatMap(c => c.campos) : bloque.campos; }
  function mapa() {
    if (_mapa) return _mapa;
    _mapa = {};
    const est = estructura();
    Object.keys(est).forEach(p => est[p].forEach(b => campos(b).forEach(c => { _mapa[c.k] = { ...c, pestana: p, seccion: b.titulo || '' }; })));
    // claves que salen en el impreso pero se rellenan juntas
    _mapa.novio_apellidos = _mapa.novio_apellidos || { k: 'novio_apellidos', label: 'Apellidos', pestana: 'datos' };
    _mapa.novia_apellidos = _mapa.novia_apellidos || { k: 'novia_apellidos', label: 'Apellidos', pestana: 'datos' };
    return _mapa;
  }
  const campo = k => mapa()[k] || { k, label: k, tipo: 'text', pestana: 'datos' };
  // «Novio · Nombre padre», «Testigo 1 · ¿Desde cuándo…?»
  function etiqueta(k) {
    const c = campo(k), p = PESTANAS.find(x => x.id === c.pestana);
    const quien = /^novio_/.test(k) ? 'Novio' : /^novia_/.test(k) ? 'Novia' : /^t1_/.test(k) ? 'Testigo 1' : /^t2_/.test(k) ? 'Testigo 2' : (p ? p.nombre : '');
    return `${quien} · ${c.label}`;
  }
  // Cómo se lee un valor (fechas en dd/mm/aaaa, sí/no…)
  function mostrar(k, v) {
    const c = campo(k);
    if (v == null || v === '') return '';
    if (c.tipo === 'date') return H.fecha(v);
    if (c.tipo === 'sino') return v === '1' ? 'Sí' : 'No';
    return String(v);
  }

  return { PESTANAS, estructura, campos, mapa, campo, etiqueta, mostrar };
})();

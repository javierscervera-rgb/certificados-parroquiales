/* ============================================================
   PLANTILLAS DE CERTIFICADOS
   Cada certificado define:
     - id, nombre (botón del menú), titulo (cabecera de la pantalla), grupo
     - estado: 'listo' | 'pendiente'
     - campos: los datos que pide la pantalla. Las claves se comparten
       entre certificados: lo que escribes en uno aparece en los demás.
       w = ancho en la rejilla (de 12 columnas); nueva = empieza fila nueva
     - documento(d, ctx): devuelve el contenido del certificado
       (texto entre **asteriscos** = negrita)
   ============================================================ */

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
  'septiembre','octubre','noviembre','diciembre'];

const H = {
  // 2025-03-28 -> 28/03/2025
  fecha(v) {
    if (!v) return '____/____/______';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
  },
  // 2025-06-21 -> 21 de junio de 2025
  fechaLarga(v) {
    if (!v) return '____ de __________ de ______';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return m ? `${+m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}` : v;
  },
  // fecha de cabecera: 1/4/2025
  fechaCorta(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? `${+m[3]}/${+m[2]}/${m[1]}` : (v || '');
  },
  t(v, hueco = '__________') { return (v && String(v).trim()) ? String(v).trim() : hueco; },
  nombre(d, n = 'nombre', a = 'apellidos') {
    const s = [d[n], d[a]].filter(x => x && x.trim()).join(' ').trim();
    return s || '______________________';
  },
  novio(d) { return H.nombre(d, 'novio_nombre', 'novio_apellidos'); },
  // Nombre completo de un contrayente ('novio' o 'novia') con 1º y 2º apellido
  persona(d, l) {
    const j = (...a) => a.filter(x => x && String(x).trim()).join(' ').trim();
    return j(d[l + '_nombre'], d[l + '_apellido1'], d[l + '_apellido2']) || j(d[l + '_nombre'], d[l + '_apellidos']);
  },
  // Padre y madre de un contrayente (nombre y apellidos por separado; se admite el campo antiguo de nombre completo)
  padre(d, l) { return [d[l + '_padre_nombre'], d[l + '_padre_apellidos']].filter(x => x && x.trim()).join(' ').trim() || (d['padre_' + l] || ''); },
  madre(d, l) { return [d[l + '_madre_nombre'], d[l + '_madre_apellidos']].filter(x => x && x.trim()).join(' ').trim() || (d['madre_' + l] || ''); },
  novia(d) { return H.nombre(d, 'novia_nombre', 'novia_apellidos'); },
  // nacido / nacida, hijo / hija...
  g(d, masc, fem) { return d.sexo === 'F' ? fem : masc; },
  edad(nac, refISO) {
    const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nac || ''), b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(refISO || '');
    if (!a || !b) return '';
    let e = +b[1] - +a[1];
    if (+b[2] < +a[2] || (+b[2] === +a[2] && +b[3] < +a[3])) e--;
    return e >= 0 ? String(e) : '';
  },
  anios(n) {
    const pal = ['cero','un','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez'];
    const k = parseInt(n, 10);
    if (isNaN(k)) return '____ años';
    return (k <= 10 ? pal[k] : k) + (k === 1 ? ' año' : ' años');
  }
};

const CIERRE_CERTIFICO = 'y para que así conste, lo firmo con fecha ut supra';
const A_QUIEN = 'A QUIEN LE PUEDA INTERESAR';

/* Campos que se repiten en varias pantallas */
const C = {
  nombre: { k: 'nombre', label: 'Nombre', w: 4 },
  apellidos: { k: 'apellidos', label: 'Apellidos', w: 5 },
  sexo: { k: 'sexo', label: 'Sexo', tipo: 'sexo', w: 3 },
  dni: { k: 'dni', label: 'DNI', w: 3 },
  f_nac: { k: 'f_nac', label: 'F. nacimiento', tipo: 'date', w: 3 },
  f_bau: { k: 'f_bau', label: 'F. bautismo', tipo: 'date', w: 3 },
  libro_bau: { k: 'libro_bau', label: 'Libro baut.', w: 2 },
  folio_bau: { k: 'folio_bau', label: 'Folio baut.', w: 2 },
  num_bau: { k: 'num_bau', label: 'Nº baut.', w: 2 },
  f_conf: { k: 'f_conf', label: 'F. confirmación', tipo: 'date', w: 3 },
  ministro_conf: { k: 'ministro_conf', label: 'Ministro de la confirmación', ph: 'Sr. D. …, Obispo Auxiliar de …', w: 9 },
  novio_nombre: { k: 'novio_nombre', label: 'Nombre novio', w: 4, nueva: true },
  novio_apellidos: { k: 'novio_apellidos', label: 'Apellidos novio', w: 5 },
  novia_nombre: { k: 'novia_nombre', label: 'Nombre novia', w: 4, nueva: true },
  novia_apellidos: { k: 'novia_apellidos', label: 'Apellidos novia', w: 5 },
  f_mat: { k: 'f_mat', label: 'Fecha matrimonio', tipo: 'date', w: 3, nueva: true },
};
const con = (campo, cambios) => Object.assign({}, campo, cambios);

// Datos de cada contrayente: los mismos en el Alegato V, el Expediente, el Atestado y la Fe de vida.
// Clave real: novio_<k> o novia_<k>.
const CAMPOS_PAREJA = [
  { k: 'nombre', label: 'Nombre', w: 12 },
  { k: 'apellido1', label: '1º Apellido', w: 6 }, { k: 'apellido2', label: '2º Apellido', w: 6 },
  { k: 'telefono', label: 'Teléfono', w: 6, tipo: 'tel' },
  { k: 'lugar_nac', label: 'Lugar de nacimiento', w: 8, sep: true, nueva: true }, { k: 'f_nac', label: 'Fecha nacimiento', tipo: 'date', w: 4 },
  { k: 'padre_nombre', label: 'Nombre padre', w: 5 }, { k: 'padre_apellidos', label: 'Apellidos padre', w: 7 },
  { k: 'madre_nombre', label: 'Nombre madre', w: 5 }, { k: 'madre_apellidos', label: 'Apellidos madre', w: 7 },
  { k: 'registro_civil', label: 'Registro civil', w: 12, sep: true },
  { k: 'tomo_rc', label: 'Tomo reg. civil', w: 6 }, { k: 'pagina_rc', label: 'Página reg. civil', w: 6 },
  { k: 'religion', label: 'Religión', w: 12 },
  { k: 'f_bau', label: 'Fecha bautismo', tipo: 'date', w: 5, sep: true }, { k: 'ciudad_bau', label: 'Ciudad bautismo', w: 7 },
  { k: 'parroquia_bau', label: 'Parroquia bautismo', w: 12 },
  { k: 'diocesis_bau', label: 'Diócesis bautismo', w: 12 },
  { k: 'libro_bau', label: 'Libro', w: 4 }, { k: 'folio_bau', label: 'Folio', w: 4 }, { k: 'num_bau', label: 'Número', w: 4 },
  { k: 'confirmacion', label: 'Confirmación', w: 12, sep: true, ph: 'No / fecha y parroquia' },
  { k: 'estado_civil', label: 'Estado civil', w: 6, sep: true, ph: 'SOLTERO/A' }, { k: 'nacionalidad', label: 'Nacionalidad', w: 6 },
  { k: 'dni', label: 'DNI', w: 6 },
  { k: 'domicilio', label: 'Domicilio', w: 12 },
  { k: 'tiempo_domicilio', label: 'Tiempo en domicilio', w: 6, ph: '5 años' },
  { k: 'parroquia_domicilio', label: 'Parroquia domicilio', w: 12 },
];

// Certificado para ser padrino/madrina (bautismo o confirmación)
function padrinoDe(id, grupo, sacramento) {
  return {
    id, grupo, estado: 'listo',
    nombre: 'Autorización para ser padrino', titulo: `Autorización para ser padrino de ${sacramento}`,
    campos: [C.nombre, C.apellidos, C.sexo, con(C.dni, { nueva: true })],
    documento: (d) => ({
      titulo: `CERTIFICADO\nPARA SER ${H.g(d, 'PADRINO', 'MADRINA')} DE ${sacramento.toUpperCase()}`,
      bloques: [
        { linea: A_QUIEN },
        { p: `Certifico que ${H.nombre(d)} ha realizado la preparación suficiente y conoce las obligaciones que se derivan de su condición de ${H.g(d, 'padrino', 'madrina')} de ${sacramento}.`, espacio: 1 },
        { p: 'Estimamos por el conocimiento que tenemos que está en condiciones y tiene intención de cumplir estas obligaciones.', espacio: 1 },
      ],
      cierre: CIERRE_CERTIFICO, cierreEspacio: 2
    })
  };
}

// Declaración responsable de fe de vida y estado (un contrayente)
function feDeVida(d, ctx, l) {
  const f = ctx.firmante || {}, cfg = ctx.config, M = l === 'novio';
  const parroquia = (cfg.nombre || '').replace(/^parroquia( de)?\s+/i, '');
  const estado = (d[l + '_estado_civil'] || '__________').toUpperCase();
  return {
    titulo: 'DECLARACIÓN RESPONSABLE\nDE FE DE VIDA Y ESTADO',
    cuerpo: { tam: 11, interlinea: 20 },
    bloques: [
      { p: `Ante ${H.t(f.nombre)}, ${H.t(f.cargo, '')} de la Parroquia de ${H.t(parroquia)}, ${H.t(cfg.localidad)}` },
      { p: `Comparece ${M ? 'D.' : 'Dña.'} ${H.t(H.persona(d, l), '______________________')}, natural de ${H.t(d[l + '_lugar_nac'])}, ${M ? 'nacido' : 'nacida'} el ${H.fecha(d[l + '_f_nac'])}, con domicilio en ${H.t(d[l + '_domicilio'])}, que exhibe el DNI/NIE nº ${H.t(d[l + '_dni'])} el cual declara solemnemente y bajo su responsabilidad, previas las advertencias y prevenciones legales pertinentes, que vive en el día de la fecha y que su estado civil es el de **${estado}**` },
      { p: 'lo que declara a los efectos oportunos para que sea tenido en cuenta en el trámite del matrimonio que pretende contraer.' },
    ],
    cierre: null, firmaEspacio: 5,
    firmaIzquierda: 'Fdo. ' + (H.persona(d, l) || '______________________'),
  };
}

// Atestado de libertad (para la Vicaría): toma los datos de los dos contrayentes
function atestado(d, ctx) {
  const cfg = ctx.config;
  const uno = l => {
    const M = l === 'novio', o = M ? 'o' : 'a';
    const bau = [d[l + '_ciudad_bau'], d[l + '_diocesis_bau']].filter(Boolean).join(', ');
    return [
      { p: `${M ? 'Don' : 'Doña'} ${H.t(H.persona(d, l))}, domiciliad${o} en ${H.t(d[l + '_domicilio'])}, que **nació** en ${H.t(d[l + '_lugar_nac'])}, el día ${H.fecha(d[l + '_f_nac'])},`, espacio: 1.6 },
      { p: `**bautizad${o}** en ${H.t(bau)}, parroquia de ${H.t(d[l + '_parroquia_bau'])} el día ${H.fecha(d[l + '_f_bau'])}, libro ${H.t(d[l + '_libro_bau'], '___')}, folio ${H.t(d[l + '_folio_bau'], '___')}, nº ${H.t(d[l + '_num_bau'], '___')},`, espacio: 1 },
      { p: `**confirmad${o}** ${H.t(d[l + '_confirmacion'], '_____')}, de **estado** ${H.t(d[l + '_estado_civil'], '_____')}.`, espacio: 1 },
      { p: `Es hij${o} de D. ${H.t(H.padre(d, l))} y de Dª ${H.t(H.madre(d, l))}, con DNI/NIE ${H.t(d[l + '_dni'])}, Registro civil de ${H.t(d[l + '_registro_civil'])}, tomo ${H.t(d[l + '_tomo_rc'], '___')}, página ${H.t(d[l + '_pagina_rc'], '___')}.`, espacio: 1 },
    ];
  };
  const dias = [d.proclamas_desde, d.proclamas_hasta].filter(Boolean).map(H.fecha);
  const estados = [d.novio_estado_civil, d.novia_estado_civil].map(x => (x || '').toLowerCase());
  const solteros = estados.every(x => /^solter/.test(x)) ? 'solteros' : estados.filter(Boolean).join(' y ') || '__________';
  const bloques = [
    { centro: 'Salud y gracia en Nuestro Señor Jesucristo' },
    ...uno('novio'), ...uno('novia'),
    { p: `Que han sido amonestados en las parroquias de ${H.t(d.proclamas_parroquias, '______________')} ${dias.length > 1 ? `del ${dias[0]} al ${dias[1]}` : `el día ${dias[0] || '__________'}`}.`, espacio: 2 },
    { p: `En su virtud se declara a los contrayentes ${solteros} y libres para su proyectado matrimonio en la Parroquia de ${H.t(d.parroquia_boda)} el día ${H.fecha(d.f_mat)}.`, espacio: 2 },
    { p: 'Y para ello se concede Licencia y anuencia de jurisdicción en cuanto fuera posible.', espacio: 1.4 },
  ];
  bloques[1].espacio = 2;
  bloques[5].espacio = 2;
  return {
    titulo: `ATESTADO DE LIBERTAD\nAL ILMO. SR. VICARIO GENERAL DE ${(cfg.diocesis || '').toUpperCase()}`, tituloNegrita: true, tituloTam: 14,
    interlinea: 17, cuerpo: { tam: 10.5, interlinea: 17 },
    bloques,
    cierre: null, sinFirmante: true,
    firmaVicario: [`Firma ${cfg.vicarioCargo || 'Vicario Episcopal'}`, cfg.vicaria || ''],
  };
}

const CERTIFICADOS = [
  /* ---------------- CATEQUESIS ---------------- */
  {
    id: 'catequesis', grupo: 'catequesis', estado: 'listo',
    nombre: 'Certificado de catequesis',
    titulo: 'Certificado de haber cursado catequesis aquí',
    campos: [C.nombre, C.apellidos, { k: 'anios_cateq', label: 'Años de catequesis', tipo: 'number', w: 3 }],
    documento: (d) => ({
      titulo: 'CERTIFICADO HABER CURSADO\nCATEQUESIS EN LA PARROQUIA',
      bloques: [
        { p: `Certifico que ${H.nombre(d)} ha asistido a la catequesis preparatoria para la primera comunión durante ${H.anios(d.anios_cateq)}.` }
      ],
      cierre: CIERRE_CERTIFICO
    })
  },

  /* ---------------- BAUTISMO ---------------- */
  {
    id: 'bautismo', grupo: 'bautismo', estado: 'listo',
    nombre: 'Certificado de bautismo',
    titulo: 'Certificado de bautismo',
    campos: [C.nombre, C.apellidos, C.sexo, C.f_nac, C.f_bau, C.libro_bau, C.folio_bau, C.num_bau],
    documento: (d) => ({
      titulo: 'CERTIFICADO DE BAUTISMO',
      bloques: [
        { p: `Certifico que ${H.nombre(d)} ${H.g(d, 'nacido', 'nacida')} el ${H.fecha(d.f_nac)} recibió el Sacramento del bautismo en esta Parroquia el día ${H.fecha(d.f_bau)} tal y como consta en los archivos de nuestra Parroquia en el tomo ${H.t(d.libro_bau, '___')}, folio ${H.t(d.folio_bau, '___')}, nº ${H.t(d.num_bau, '___')}.` }
      ],
      cierre: CIERRE_CERTIFICO
    })
  },
  {
    id: 'partida_bautismo', grupo: 'bautismo', estado: 'listo',
    nombre: 'Partida de bautismo', titulo: 'Partida de bautismo',
    campos: [C.nombre, C.apellidos, C.sexo,
      C.f_bau, C.libro_bau, C.folio_bau, C.num_bau, C.f_nac,
      { k: 'lugar_nac', label: 'Lugar de nacimiento', w: 4, nueva: true }, { k: 'provincia_nac', label: 'Provincia', w: 4 },
      { k: 'diocesis_nac', label: 'Diócesis', w: 4 },
      { k: 'padre', label: 'Nombre completo padre', w: 8, nueva: true, sep: true }, { k: 'padre_lugar', label: 'Lugar de nacimiento', w: 4 },
      { k: 'madre', label: 'Nombre completo madre', w: 8 }, { k: 'madre_lugar', label: 'Lugar de nacimiento', w: 4 },
      { k: 'abuelo_pat', label: 'Abuelo paterno', w: 8, sep: true }, { k: 'abuelo_pat_lugar', label: 'Lugar de nacimiento', w: 4 },
      { k: 'abuela_pat', label: 'Abuela paterna', w: 8 }, { k: 'abuela_pat_lugar', label: 'Lugar de nacimiento', w: 4 },
      { k: 'abuelo_mat', label: 'Abuelo materno', w: 8 }, { k: 'abuelo_mat_lugar', label: 'Lugar de nacimiento', w: 4 },
      { k: 'abuela_mat', label: 'Abuela materna', w: 8 }, { k: 'abuela_mat_lugar', label: 'Lugar de nacimiento', w: 4 },
      { k: 'padrinos', label: 'Padrinos', w: 12, sep: true }, { k: 'ministro_bau', label: 'Ministro del bautismo', w: 12 },
      { k: 'notas_marginales', label: 'Notas marginales', tipo: 'textarea', w: 12, sep: true }],
    documento: (d, ctx) => {
      const f = ctx.firmante || {}, cfg = ctx.config;
      const nat = (lugar) => `natural de ${H.t(lugar)}`;
      return {
        titulo: 'CERTIFICACIÓN DE PARTIDA DE BAUTISMO',
        formato: 'partida',
        margen: {
          parroquia: ['PARROQUIA DE', (cfg.nombreCorto || cfg.nombre || '').replace(/^parroquia( de)?\s+/i, '').toUpperCase()],
          lugar: [(cfg.localidad || '').toUpperCase(), 'DIOC. ' + (cfg.diocesis || '').toUpperCase(), 'PROV. ' + (cfg.provincia || '').toUpperCase()],
          libro: [`LIBRO ${H.t(d.libro_bau, '___')}`, `FOL. ${H.t(d.folio_bau, '___')}`, `Nº ${H.t(d.num_bau, '___')}`],
          notas: d.notas_marginales || ''
        },
        bloques: [
          { p: `REV. D. ${H.t(f.nombre)}, ${H.t(f.cargo, '')} de ${H.t(cfg.nombre)}, diócesis de ${H.t(cfg.diocesis)}` },
          { p: `**CERTIFICA:** Que según consta del acta reseñada al margen, correspondiente al libro de bautismos ${H.nombre(d)}, fue ${H.g(d, 'bautizado', 'bautizada')} el día ${H.fecha(d.f_bau)}.` },
          { p: `Nació el día ${H.fecha(d.f_nac)}, siendo natural de ${H.t(d.lugar_nac)}, diócesis de ${H.t(d.diocesis_nac)}, provincia de ${H.t(d.provincia_nac)}.` },
          { p: `PADRES: D. ${H.t(d.padre)}, ${nat(d.padre_lugar)} y Dña. ${H.t(d.madre)}, ${nat(d.madre_lugar)}.` },
          { p: `ABUELOS PATERNOS: D. ${H.t(d.abuelo_pat)}, ${nat(d.abuelo_pat_lugar)} y Dña. ${H.t(d.abuela_pat)}, ${nat(d.abuela_pat_lugar)}.` },
          { p: `ABUELOS MATERNOS: D. ${H.t(d.abuelo_mat)}, ${nat(d.abuelo_mat_lugar)} y Dña. ${H.t(d.abuela_mat)}, ${nat(d.abuela_mat_lugar)}.` },
          { p: `PADRINOS: ${H.t(d.padrinos)}.` },
          { p: `MINISTRO: ${H.t(d.ministro_bau)}.`, espacio: 1 },
        ],
        cierre: null, firmaEspacio: 8
      };
    }
  },
  {
    id: 'autorizacion_bautismo', grupo: 'bautismo', estado: 'listo',
    nombre: 'Autorización para bautizar',
    titulo: 'Autorización para el bautismo fuera de la parroquia',
    campos: [
      con(C.nombre, { label: 'Nombre del niño/a' }), con(C.apellidos, { label: 'Apellidos del niño/a' }), C.sexo,
      con(C.f_nac, { nueva: true }), { k: 'parroquia_destino', label: 'Parroquia de bautismo', w: 9 },
      { k: 'padre', label: 'Nombre completo del padre', w: 6, nueva: true },
      { k: 'madre', label: 'Nombre completo de la madre', w: 6 }],
    documento: (d) => ({
      titulo: 'AUTORIZACIÓN DE BAUTISMO',
      bloques: [
        { linea: `Al Rev. Cura párroco de ${H.t(d.parroquia_destino, '______________________')}` },
        { p: `Nada obsta para que ${H.nombre(d)} ${H.g(d, 'nacido', 'nacida')} el ${H.fecha(d.f_nac)}, ${H.g(d, 'hijo', 'hija')} de ${H.t(d.padre)} y de ${H.t(d.madre)} sea ${H.g(d, 'bautizado', 'bautizada')} en la parroquia de su digno cargo.`, espacio: 1 },
        { p: 'Aprovecho para saludarle afectuosamente encomendando su parroquia y su persona.' }
      ],
      cierre: CIERRE_CERTIFICO
    })
  },
  padrinoDe('padrino', 'bautismo', 'bautismo'),

  /* ---------------- MATRIMONIO ---------------- */
  {
    id: 'cursillo', grupo: 'matrimonio', estado: 'listo',
    nombre: 'Certificado cursillo prematrimonial', titulo: 'Certificado cursillo prematrimonial',
    campos: [C.novio_nombre, C.novio_apellidos, C.novia_nombre, C.novia_apellidos,
      { k: 'fecha_cursillo', label: 'Fechas del cursillo', ph: '1 a 3 de enero de 2020', w: 6, nueva: true }],
    documento: (d) => ({
      titulo: 'CERTIFICADO\nde asistencia al Cursillo Prematrimonial',
      bloques: [
        { linea: A_QUIEN },
        { p: `Certifico que ${H.novio(d)} y ${H.novia(d)} están participando en el cursillo prematrimonial que se imparte en esta Parroquia entre los días ${H.t(d.fecha_cursillo)}.`, espacio: 1 },
      ],
      cierre: CIERRE_CERTIFICO, cierreEspacio: 3
    })
  },
  {
    id: 'boda', grupo: 'matrimonio', estado: 'listo',
    nombre: 'Certificado matrimonio futuro', titulo: 'Certificado de boda que se va a realizar aquí',
    campos: [C.novio_nombre, C.novio_apellidos, C.novia_nombre, C.novia_apellidos,
      con(C.f_mat, { label: 'Fecha boda' }), { k: 'hora_boda', label: 'Hora de la boda', tipo: 'time', w: 2 }],
    documento: (d) => ({
      titulo: 'CERTIFICADO\nde la celebración del\nSacramento del Matrimonio',
      bloques: [
        { linea: A_QUIEN },
        { p: `Certifico que el próximo día ${H.fechaLarga(d.f_mat)} a las ${H.t(d.hora_boda, '____')} horas van a contraer matrimonio en esta parroquia`, espacio: 1, justificar: false },
        { linea: `${H.novio(d)} con`, espacio: 1 },
        { linea: `${H.novia(d)}.`, espacio: 1 },
      ],
      cierre: CIERRE_CERTIFICO, cierreEspacio: 3
    })
  },
  {
    id: 'matrimonio', grupo: 'matrimonio', estado: 'listo',
    nombre: 'Certificado matrimonio realizado', titulo: 'Certificado de matrimonio realizado aquí',
    campos: [C.novio_nombre, C.novio_apellidos, { k: 'novio_dni', label: 'DNI novio', w: 3 },
      C.novia_nombre, C.novia_apellidos, { k: 'novia_dni', label: 'DNI novia', w: 3 }, C.f_mat],
    documento: (d, ctx) => {
      const f = ctx.firmante || {};
      return {
        titulo: 'CERTIFICADO DE MATRIMONIO', tituloNegrita: true,
        bloques: [
          { linea: 'A QUIEN PUEDA INTERESAR:' },
          { linea: `Yo, ${H.t(f.nombre)}, como ${H.t(f.cargo, '')},`, espacio: 1 },
          { p: `certifico que con fecha ${H.fecha(d.f_mat)} han contraído matrimonio ${H.novio(d)}, con DNI ${H.t(d.novio_dni)}, y ${H.novia(d)}, con DNI ${H.t(d.novia_dni)}, tal y como consta en los archivos de nuestra Parroquia.`, espacio: 1 },
        ],
        cierre: CIERRE_CERTIFICO, cierreEspacio: 2, firmaEspacio: 5
      };
    }
  },
  {
    id: 'bendicion', grupo: 'matrimonio', estado: 'listo',
    nombre: 'Bendición apostólica boda',
    titulo: 'Bendición apostólica del Papa para el matrimonio',
    campos: [{ k: 'motivo_bendicion', label: 'Motivo', tipo: 'select', opciones: ['Matrimonio', 'Bodas de plata', 'Bodas de oro'], w: 4 },
      { k: 'nuncio', label: 'Nombre del nuncio', ph: 'D. …', w: 8 },
      C.novio_nombre, C.novio_apellidos, C.novia_nombre, C.novia_apellidos, C.f_mat],
    documento: (d, ctx) => {
      const aniversario = d.motivo_bendicion && d.motivo_bendicion !== 'Matrimonio';
      const lugar = `${H.t(ctx.config.nombre)} (${H.t(ctx.config.localidad)})`;
      return {
        destinatario: ['Excmo. y Rvdmo. Sr. Nuncio Apostólico', 'Nunciatura Apostólica en España', 'Pío XII, 46'],
        saludo: `Excmo. y Rvdmo. Sr.${d.nuncio && d.nuncio.trim() ? ' ' + d.nuncio.trim() : ''}:`,
        bloques: [
          { p: `Con ocasión ${aniversario ? `de las ${d.motivo_bendicion.toLowerCase()} de un matrimonio` : 'del matrimonio de unos novios'} de nuestra parroquia quisiera solicitarle la Bendición Apostólica de S. S. ${H.t(ctx.config.papa, '________')} para ese día dirigida a ellos y a todos los participantes en la celebración.`, sangria: true },
          { p: `Nombre del contrayente: ${H.novio(d)}`, espacio: 2 },
          { p: `Nombre de la contrayente: ${H.novia(d)}`, espacio: 1 },
          { p: aniversario ? `Celebración del aniversario: ${lugar}` : `Lugar del matrimonio: ${lugar}`, espacio: 1 },
          { p: `Día del matrimonio: ${H.fechaLarga(d.f_mat)}`, espacio: 1 }
        ],
        cierre: 'Con mi más devoto obsequio', cierreCentrado: true
      };
    }
  },
  /* ---------------- EXPEDIENTE MATRIMONIAL (y documentos que salen de él) ---------------- */
  {
    id: 'expediente', grupo: 'matrimonio', estado: 'listo',
    nombre: 'Expediente prematrimonial', titulo: 'Expediente matrimonial',
    formato: 'expediente',
    camposPareja: CAMPOS_PAREJA,
    campos: [
      { k: 'parroquia_cursillo', label: 'Parroquia cursillo', w: 6, sep: true }, { k: 'fecha_cursillo', label: 'Fecha cursillo', ph: '16 a 18 de octubre de 2026', w: 6 },
      { k: 'parroquia_boda', label: 'Lugar boda', w: 6 }, { k: 'f_mat', label: 'Fecha boda', tipo: 'date', w: 3 },
      { k: 'num_expediente', label: 'Nº expediente', w: 3 },
      { k: 'domicilio_boda', label: 'Domicilio después de la boda', w: 12 },
      { k: 'documentos', label: 'Documentos que se adjuntan', tipo: 'textarea', w: 12, defecto: () => EXPEDIENTE.DOCUMENTOS },
    ],
    documento: () => ({ formato: 'expediente' })
  },
  {
    id: 'fe_vida_novio', grupo: 'expediente', estado: 'listo', lado: 'novio',
    nombre: 'Fe de vida y estado (novio)', titulo: 'Declaración responsable de fe de vida y estado · Novio',
    campos: [], camposLado: ['nombre', 'apellido1', 'apellido2', 'lugar_nac', 'f_nac', 'dni', 'estado_civil', 'domicilio'],
    documento: (d, ctx) => feDeVida(d, ctx, 'novio')
  },
  {
    id: 'fe_vida_novia', grupo: 'expediente', estado: 'listo', lado: 'novia',
    nombre: 'Fe de vida y estado (novia)', titulo: 'Declaración responsable de fe de vida y estado · Novia',
    campos: [], camposLado: ['nombre', 'apellido1', 'apellido2', 'lugar_nac', 'f_nac', 'dni', 'estado_civil', 'domicilio'],
    documento: (d, ctx) => feDeVida(d, ctx, 'novia')
  },
  {
    id: 'atestado', grupo: 'expediente', estado: 'listo',
    nombre: 'Atestado de libertad', titulo: 'Atestado de libertad',
    camposPareja: CAMPOS_PAREJA,
    campos: [
      { k: 'proclamas_parroquias', label: 'Amonestados en las parroquias de', w: 6, sep: true },
      { k: 'proclamas_desde', label: 'Proclamas desde el día', tipo: 'date', w: 3 }, { k: 'proclamas_hasta', label: 'Hasta el día', tipo: 'date', w: 3 },
      { k: 'parroquia_boda', label: 'Parroquia de la boda', w: 9 }, { k: 'f_mat', label: 'Fecha boda', tipo: 'date', w: 3 },
    ],
    documento: (d, ctx) => atestado(d, ctx)
  },
  {
    id: 'alegato', grupo: 'matrimonio', estado: 'listo',
    nombre: 'Alegato V', titulo: 'Alegato V · Autorización de matrimonio',
    // Campos de cada contrayente: se muestran en dos columnas (El contrayente / La contrayente).
    // La clave real es novio_<k> o novia_<k>, salvo que se indique otra.
    camposPareja: CAMPOS_PAREJA,
    campos: [
      { k: 'parroquia_boda', label: 'Parroquia de la boda', w: 8, sep: true },
      { k: 'num_expediente', label: 'Nº expediente (Vicaría)', w: 4 },
      { k: 'delegado', label: 'Sacerdote delegado (opcional)', ph: 'Rvdo. D. …', w: 12 },
    ],
    documento: () => ({ formato: 'alegato' })
  },
  { id: 'amonestaciones', grupo: 'matrimonio', estado: 'pendiente', nombre: 'Amonestaciones activas', titulo: 'Amonestaciones activas', campos: [] },
  {
    id: 'exhorto', grupo: 'matrimonio', estado: 'listo',
    nombre: 'Exhorto amonestaciones (fuera)', titulo: 'Exhorto de amonestaciones matrimoniales',
    campos: [{ k: 'parroquia_exhorto', label: 'Parroquia a la que se envía', w: 12 },
      C.novio_nombre, C.novio_apellidos,
      { k: 'novio_padre_nombre', label: 'Nombre padre novio', w: 3, nueva: true }, { k: 'novio_padre_apellidos', label: 'Apellidos padre', w: 3 },
      { k: 'novio_madre_nombre', label: 'Nombre madre novio', w: 3 }, { k: 'novio_madre_apellidos', label: 'Apellidos madre', w: 3 },
      C.novia_nombre, C.novia_apellidos,
      { k: 'novia_padre_nombre', label: 'Nombre padre novia', w: 3, nueva: true }, { k: 'novia_padre_apellidos', label: 'Apellidos padre', w: 3 },
      { k: 'novia_madre_nombre', label: 'Nombre madre novia', w: 3 }, { k: 'novia_madre_apellidos', label: 'Apellidos madre', w: 3 },
      { k: 'feligres', label: 'Feligrés de esa parroquia', tipo: 'select', opciones: ['Novio', 'Novia'], w: 3, nueva: true, sep: true },
      { k: 'novio_domicilio', label: 'Domicilio del novio', w: 6, nueva: true }, { k: 'novio_tiempo_domicilio', label: 'Desde hace', ph: '5 años', w: 3 },
      { k: 'novia_domicilio', label: 'Domicilio de la novia', w: 6, nueva: true }, { k: 'novia_tiempo_domicilio', label: 'Desde hace', ph: '5 años', w: 3 }],
    documento: (d) => {
      const esNovia = d.feligres === 'Novia';
      const lado = esNovia ? 'novia' : 'novio';
      const feligres = esNovia ? H.novia(d) : H.novio(d);
      const vive = d[lado + '_domicilio'] || d.domicilio_feligres, desde = d[lado + '_tiempo_domicilio'] || d.tiempo_feligres;
      return {
        titulo: 'EXHORTO DE AMONESTACIONES\nMATRIMONIALES', tituloNegrita: true, tituloTam: 16, tituloY: 120, tituloHueco: 66,
        cuerpo: { x0: 56, x1: 545, tam: 11.5, interlinea: 22, justificar: false },
        bloques: [
          { linea: `Al Rev. Sr. Cura párroco de ${H.t(d.parroquia_exhorto, '______________________')}.`, subrayado: true },
          { linea: 'Dígnese publicar que pretenden contraer matrimonio:', espacio: 2 },
          { centro: `**${H.novio(d)}**, hijo de ${H.t(H.padre(d, 'novio'))} y ${H.t(H.madre(d, 'novio'))}`, espacio: 1.1 },
          { centro: 'con', espacio: 1.1 },
          { centro: `**${H.novia(d)}**, hija de ${H.t(H.padre(d, 'novia'))} y ${H.t(H.madre(d, 'novia'))}`, espacio: 1.1 },
          { p: `${esNovia ? 'La contrayente es feligresa' : 'El contrayente es feligrés'} en la parroquia de su digno cargo ya que vive en ${H.t(vive)} desde hace ${H.t(desde, '______')}, lo que comunico a Ud. conforme a los cánones 1069 y 1070 del Código de Derecho Canónico.`, espacio: 2.2 },
          { p: 'Hechas estas proclamas o amonestaciones, le ruego me informe de su resultado y de cuanto le conste sobre su libertad y aptitud para el matrimonio que pretenden contraer. Dios guarde a Vd. muchos años.', espacio: 2 },
        ],
        cierre: null, firmaEspacio: 3.2, cargoEspacio: 18, limiteFirma: 600,
        pie: 'exhorto',
        pieTexto: `CERTIFICO que se han publicado las amonestaciones de los contrayentes mencionados, y que no se ha manifestado impedimento canónico ni reparo alguno sobre ${feligres}, que es/ha sido ${esNovia ? 'feligresa' : 'feligrés'} de esta Parroquia.`
      };
    }
  },
  { id: 'registro_civil', grupo: 'matrimonio', estado: 'pendiente', nombre: 'Certificado registro civil', titulo: 'Certificado registro civil', campos: [] },
  {
    id: 'comunicacion_matrimonio', grupo: 'matrimonio', estado: 'listo',
    nombre: 'Comunicación de matrimonio', titulo: 'Comunicación de matrimonio a otras parroquias para inscripción',
    campos: [{ k: 'parroquia_notif', label: 'Parroquia a notificar', w: 6 }, { k: 'diocesis_notif', label: 'Diócesis', w: 3 },
      { k: 'poblacion_notif', label: 'Población', w: 3 },
      C.novio_nombre, C.novio_apellidos, C.novia_nombre, C.novia_apellidos,
      C.f_mat, { k: 'conyuge', label: 'Cónyuge a comunicar', tipo: 'select', opciones: ['Novio', 'Novia'], w: 3 },
      con(C.f_bau, { nueva: true, sep: true }), con(C.libro_bau, { label: 'Libro bautismo' }),
      con(C.folio_bau, { label: 'Folio bautismo' }), con(C.num_bau, { label: 'Nº bautismo' })],
    documento: (d) => {
      const esNovia = d.conyuge === 'Novia';
      return {
        titulo: 'COMUNICACIÓN\nDE MATRIMONIO', tituloNegrita: true,
        interlinea: 24,
        bloques: [
          { p: `Al Rvdo. Sr. Cura Párroco de ${H.t(d.parroquia_notif)}, diócesis de ${H.t(d.diocesis_notif)}, ${H.t(d.poblacion_notif)}` },
          { p: `El día ${H.fecha(d.f_mat)} han contraído matrimonio en esta Parroquia`, espacio: 1 },
          { linea: `D. ${H.novio(d)}  y`, negrita: true, espacio: 1 },
          { linea: `Dña. ${H.novia(d)}`, negrita: true, espacio: 1 },
          { p: `${esNovia ? H.novia(d) : H.novio(d)} fue ${esNovia ? 'bautizada' : 'bautizado'} en esa Parroquia de su digno cargo el ${H.fecha(d.f_bau)}, tal y como consta en el Libro ${H.t(d.libro_bau, '___')}, Folio ${H.t(d.folio_bau, '___')}, número ${H.t(d.num_bau, '___')}.`, espacio: 1 },
          { p: 'Lo que le comunico a Ud. a los efectos de nota marginal a tenor de los cc. 1122, 2 y 535, 2.', espacio: 1 },
        ],
        cierre: CIERRE_CERTIFICO, cierreEspacio: 2.5, firmaEspacio: 4.5,
        pie: 'tablaComunicacion'
      };
    }
  },

  /* ---------------- CONFIRMACIÓN ---------------- */
  {
    id: 'confirmacion', grupo: 'confirmacion', estado: 'listo',
    nombre: 'Certificado de confirmación', titulo: 'Certificado de confirmación',
    campos: [C.nombre, C.apellidos, C.sexo, C.f_nac, C.f_conf,
      { k: 'libro_conf', label: 'Libro confir.', w: 2 }, { k: 'folio_conf', label: 'Folio confir.', w: 2 },
      { k: 'num_conf', label: 'Nº confir.', w: 2 }, con(C.ministro_conf, { w: 12 })],
    documento: (d) => ({
      titulo: 'CERTIFICADO DE CONFIRMACIÓN',
      bloques: [
        { p: `Certifico que ${H.nombre(d)} ${H.g(d, 'nacido', 'nacida')} el ${H.fecha(d.f_nac)} recibió el Sacramento de la confirmación en esta Parroquia el día ${H.fecha(d.f_conf)} siendo ministro del sacramento ${H.t(d.ministro_conf, '______________________')}, tal y como consta en los archivos de nuestra Parroquia en el tomo ${H.t(d.libro_conf, '___')}, folio ${H.t(d.folio_conf, '___')}, nº ${H.t(d.num_conf, '___')}.` }
      ],
      cierre: CIERRE_CERTIFICO
    })
  },
  {
    id: 'comunicacion_confirmacion', grupo: 'confirmacion', estado: 'listo',
    nombre: 'Comunicación confirmación', titulo: 'Comunicación de confirmación',
    campos: [{ k: 'parroquia_bau_orig', label: 'Parroquia de bautismo', w: 7 }, { k: 'diocesis_bau_orig', label: 'Diócesis parroquia baut.', w: 5 },
      con(C.nombre, { nueva: true, sep: true }), C.apellidos, C.sexo,
      C.f_nac, C.f_conf, C.f_bau, con(C.ministro_conf, { w: 12 }),
      con(C.libro_bau, { nueva: true }), C.folio_bau, C.num_bau],
    documento: (d) => ({
      titulo: 'COMUNICACIÓN DE CONFIRMACIÓN',
      bloques: [
        { p: `Al Rvdo. Sr. Cura Párroco de la parroquia ${H.t(d.parroquia_bau_orig)}, diócesis de ${H.t(d.diocesis_bau_orig)}.` },
        { p: `${H.nombre(d)} ${H.g(d, 'nacido', 'nacida')} el ${H.fecha(d.f_nac)} recibió el Sacramento de la confirmación el día ${H.fecha(d.f_conf)} en esta parroquia siendo ministro del sacramento ${H.t(d.ministro_conf, '______________________')}.`, espacio: 1 },
        { p: `Fue ${H.g(d, 'bautizado', 'bautizada')} en la parroquia de su digno cargo el ${H.fecha(d.f_bau)} tal como consta en el libro ${H.t(d.libro_bau, '___')}, folio ${H.t(d.folio_bau, '___')}, nº ${H.t(d.num_bau, '___')}.`, espacio: 1 },
        { p: 'Lo que le comunico a Ud. a los efectos de nota marginal a tenor de los cc. 895 y 535, 2.', espacio: 1 },
      ],
      cierre: CIERRE_CERTIFICO, cierreEspacio: 1.5, firmaEspacio: 4
    })
  },
  padrinoDe('padrino_confirmacion', 'confirmacion', 'confirmación'),
];

const GRUPOS = [
  { id: 'catequesis', nombre: 'Catequesis' },
  { id: 'bautismo', nombre: 'Bautismo' },
  { id: 'matrimonio', nombre: 'Matrimonio' },
  { id: 'confirmacion', nombre: 'Confirmación' },
];

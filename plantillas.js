/* ============================================================
   PLANTILLAS DE CERTIFICADOS
   Cada certificado define:
     - id, nombre (botón del menú), titulo (cabecera de la pantalla), grupo
     - estado: 'listo' | 'pendiente'
     - campos: los datos que pide la pantalla (las claves se comparten
       entre certificados: si escribes el nombre en uno, aparece en otro)
     - documento(d, ctx): devuelve el contenido del certificado
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
  // nacido / nacida, hijo / hija...
  g(d, masc, fem) { return d.sexo === 'F' ? fem : masc; },
  anios(n) {
    const pal = ['cero','un','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez'];
    const k = parseInt(n, 10);
    if (isNaN(k)) return '____ años';
    return (k <= 10 ? pal[k] : k) + (k === 1 ? ' año' : ' años');
  }
};

const CIERRE_CERTIFICO = 'y para que así conste, lo firmo con fecha ut supra';

const CAMPOS = {
  nombre: { k: 'nombre', label: 'Nombre' },
  apellidos: { k: 'apellidos', label: 'Apellidos' },
  sexo: { k: 'sexo', label: 'Sexo', tipo: 'sexo' },
  f_nac: { k: 'f_nac', label: 'F. nacimiento', tipo: 'date' },
  f_bau: { k: 'f_bau', label: 'F. bautismo', tipo: 'date' },
  libro_bau: { k: 'libro_bau', label: 'Libro baut.', corto: true },
  folio_bau: { k: 'folio_bau', label: 'Folio baut.', corto: true },
  num_bau: { k: 'num_bau', label: 'Nº baut.', corto: true },
  novio_nombre: { k: 'novio_nombre', label: 'Nombre novio' },
  novio_apellidos: { k: 'novio_apellidos', label: 'Apellidos novio' },
  novia_nombre: { k: 'novia_nombre', label: 'Nombre novia' },
  novia_apellidos: { k: 'novia_apellidos', label: 'Apellidos novia' },
};

const CERTIFICADOS = [
  /* ---------------- CATEQUESIS ---------------- */
  {
    id: 'catequesis', grupo: 'catequesis', estado: 'listo',
    nombre: 'Certificado de catequesis',
    titulo: 'Certificado de haber cursado catequesis aquí',
    campos: [CAMPOS.nombre, CAMPOS.apellidos,
      { k: 'anios_cateq', label: 'Número años de catequesis', tipo: 'number', corto: true }],
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
    campos: [CAMPOS.nombre, CAMPOS.apellidos, CAMPOS.sexo, CAMPOS.f_nac, CAMPOS.f_bau,
      CAMPOS.libro_bau, CAMPOS.folio_bau, CAMPOS.num_bau],
    documento: (d) => ({
      titulo: 'CERTIFICADO DE BAUTISMO',
      bloques: [
        { p: `Certifico que ${H.nombre(d)} ${H.g(d, 'nacido', 'nacida')} el ${H.fecha(d.f_nac)} recibió el Sacramento del bautismo en esta Parroquia el día ${H.fecha(d.f_bau)} tal y como consta en los archivos de nuestra Parroquia en el tomo ${H.t(d.libro_bau, '___')}, folio ${H.t(d.folio_bau, '___')}, nº ${H.t(d.num_bau, '___')}.` }
      ],
      cierre: CIERRE_CERTIFICO
    })
  },
  {
    id: 'partida_bautismo', grupo: 'bautismo', estado: 'pendiente',
    nombre: 'Partida de bautismo', titulo: 'Partida de bautismo',
    campos: [CAMPOS.nombre, CAMPOS.apellidos, CAMPOS.sexo, CAMPOS.f_bau, CAMPOS.libro_bau,
      CAMPOS.folio_bau, CAMPOS.num_bau, CAMPOS.f_nac,
      { k: 'lugar_nac', label: 'Lugar de nacimiento' }, { k: 'provincia_nac', label: 'Provincia' },
      { k: 'diocesis_nac', label: 'Diócesis' },
      { k: 'padre', label: 'Nombre completo padre' }, { k: 'padre_lugar', label: 'Lugar nac. padre' },
      { k: 'madre', label: 'Nombre completo madre' }, { k: 'madre_lugar', label: 'Lugar nac. madre' },
      { k: 'abuelo_pat', label: 'Abuelo paterno' }, { k: 'abuelo_pat_lugar', label: 'Lugar nac.' },
      { k: 'abuela_pat', label: 'Abuela paterna' }, { k: 'abuela_pat_lugar', label: 'Lugar nac.' },
      { k: 'abuelo_mat', label: 'Abuelo materno' }, { k: 'abuelo_mat_lugar', label: 'Lugar nac.' },
      { k: 'abuela_mat', label: 'Abuela materna' }, { k: 'abuela_mat_lugar', label: 'Lugar nac.' },
      { k: 'padrinos', label: 'Padrinos' }, { k: 'ministro_bau', label: 'Ministro del bautismo' },
      { k: 'notas_marginales', label: 'Notas marginales', tipo: 'textarea' }]
  },
  {
    id: 'autorizacion_bautismo', grupo: 'bautismo', estado: 'listo',
    nombre: 'Autorización para bautizar',
    titulo: 'Autorización para el bautismo fuera de la parroquia',
    campos: [
      { k: 'nombre', label: 'Nombre del niño' }, { k: 'apellidos', label: 'Apellidos del niño' },
      CAMPOS.sexo, CAMPOS.f_nac,
      { k: 'padre', label: 'Nombre completo del padre' },
      { k: 'madre', label: 'Nombre completo de la madre' },
      { k: 'parroquia_destino', label: 'Parroquia de bautismo' }],
    documento: (d) => ({
      titulo: 'AUTORIZACIÓN DE BAUTISMO',
      bloques: [
        { linea: `Al Rev. Cura párroco de ${H.t(d.parroquia_destino, '______________________')}`, sinEspacio: true },
        { p: `Nada obsta para que ${H.nombre(d)} ${H.g(d, 'nacido', 'nacida')} el ${H.fecha(d.f_nac)}, ${H.g(d, 'hijo', 'hija')} de ${H.t(d.padre)} y de ${H.t(d.madre)} sea ${H.g(d, 'bautizado', 'bautizada')} en la parroquia de su digno cargo.` },
        { p: 'Aprovecho para saludarle afectuosamente encomendando su parroquia y su persona.' }
      ],
      cierre: CIERRE_CERTIFICO
    })
  },
  {
    id: 'padrino', grupo: 'bautismo', estado: 'pendiente',
    nombre: 'Autorización para ser padrino', titulo: 'Autorización para ser padrino de bautismo',
    campos: [CAMPOS.nombre, CAMPOS.apellidos, { k: 'dni', label: 'DNI' }]
  },

  /* ---------------- MATRIMONIO ---------------- */
  {
    id: 'cursillo', grupo: 'matrimonio', estado: 'pendiente',
    nombre: 'Certificado cursillo prematrimonial', titulo: 'Certificado cursillo prematrimonial',
    campos: [CAMPOS.novio_nombre, CAMPOS.novio_apellidos, CAMPOS.novia_nombre, CAMPOS.novia_apellidos,
      { k: 'fecha_cursillo', label: 'Fecha cursillo', ph: '1 a 3 de enero de 2020' }]
  },
  {
    id: 'boda', grupo: 'matrimonio', estado: 'pendiente',
    nombre: 'Certificado de boda', titulo: 'Certificado de boda que se va a realizar aquí',
    campos: [CAMPOS.novio_nombre, CAMPOS.novio_apellidos, CAMPOS.novia_nombre, CAMPOS.novia_apellidos,
      { k: 'f_mat', label: 'Fecha boda', tipo: 'date' }, { k: 'hora_boda', label: 'Hora de la boda', tipo: 'time', corto: true }]
  },
  {
    id: 'matrimonio', grupo: 'matrimonio', estado: 'pendiente',
    nombre: 'Certificado de matrimonio', titulo: 'Certificado de matrimonio realizado aquí',
    campos: [CAMPOS.novio_nombre, CAMPOS.novio_apellidos, { k: 'novio_dni', label: 'DNI novio' },
      CAMPOS.novia_nombre, CAMPOS.novia_apellidos, { k: 'novia_dni', label: 'DNI novia' },
      { k: 'f_mat', label: 'Fecha matrimonio', tipo: 'date' }]
  },
  {
    id: 'bendicion', grupo: 'matrimonio', estado: 'listo',
    nombre: 'Bendición apostólica boda',
    titulo: 'Bendición apostólica del Papa para el matrimonio',
    campos: [CAMPOS.novio_nombre, CAMPOS.novio_apellidos, CAMPOS.novia_nombre, CAMPOS.novia_apellidos,
      { k: 'f_mat', label: 'Fecha matrimonio', tipo: 'date' }],
    documento: (d, ctx) => ({
      destinatario: ['Excmo. y Rvdmo. Sr. Nuncio Apostólico', 'Nunciatura Apostólica en España', 'Pío XII, 46'],
      saludo: 'Excmo. y Rvdmo. Sr.:',
      bloques: [
        { p: `Con ocasión del matrimonio de unos novios de nuestra parroquia quisiera solicitarle la Bendición Apostólica de S. S. ${H.t(ctx.config.papa, '________')} para ese día dirigida a ellos y a todos los participantes en la celebración.`, sangria: true },
        { p: `Nombre del contrayente: ${H.nombre(d, 'novio_nombre', 'novio_apellidos')}`, espacio: 2 },
        { p: `Nombre de la contrayente: ${H.nombre(d, 'novia_nombre', 'novia_apellidos')}`, espacio: 1 },
        { p: `Lugar del matrimonio: ${H.t(ctx.config.nombre)} (${H.t(ctx.config.localidad)})`, espacio: 1 },
        { p: `Día del matrimonio: ${H.fechaLarga(d.f_mat)}`, espacio: 1 }
      ],
      cierre: 'Con mi más devoto obsequio', cierreCentrado: true
    })
  },
  { id: 'expediente', grupo: 'matrimonio', estado: 'pendiente', nombre: 'Expediente prematrimonial', titulo: 'Expediente prematrimonial', campos: [] },
  { id: 'alegato', grupo: 'matrimonio', estado: 'pendiente', nombre: 'Alegato V', titulo: 'Alegato V', campos: [] },
  { id: 'amonestaciones', grupo: 'matrimonio', estado: 'pendiente', nombre: 'Amonestaciones activas', titulo: 'Amonestaciones activas', campos: [] },
  { id: 'exhorto', grupo: 'matrimonio', estado: 'pendiente', nombre: 'Exhorto amonestaciones (fuera)', titulo: 'Exhorto de amonestaciones', campos: [] },
  { id: 'registro_civil', grupo: 'matrimonio', estado: 'pendiente', nombre: 'Certificado registro civil', titulo: 'Certificado registro civil', campos: [] },
  {
    id: 'comunicacion_matrimonio', grupo: 'matrimonio', estado: 'pendiente',
    nombre: 'Comunicación de matrimonio', titulo: 'Comunicación de matrimonio a otras parroquias para inscripción',
    campos: [{ k: 'parroquia_notif', label: 'Parroquia a notificar' }, { k: 'diocesis_notif', label: 'Diócesis' },
      { k: 'poblacion_notif', label: 'Población' },
      CAMPOS.novio_nombre, CAMPOS.novio_apellidos, CAMPOS.novia_nombre, CAMPOS.novia_apellidos,
      { k: 'f_mat', label: 'Fecha matrimonio', tipo: 'date' },
      { k: 'conyuge', label: 'Cónyuge a comunicar', tipo: 'select', opciones: ['Novio', 'Novia'] },
      CAMPOS.f_bau, { k: 'libro_bau', label: 'Libro bautismo', corto: true },
      { k: 'folio_bau', label: 'Folio bautismo', corto: true }, { k: 'num_bau', label: 'Número bautismo', corto: true }]
  },

  /* ---------------- CONFIRMACIÓN ---------------- */
  {
    id: 'confirmacion', grupo: 'confirmacion', estado: 'listo',
    nombre: 'Certificado de confirmación', titulo: 'Certificado de confirmación',
    campos: [CAMPOS.nombre, CAMPOS.apellidos, CAMPOS.sexo, CAMPOS.f_nac,
      { k: 'f_conf', label: 'F. confirmación', tipo: 'date' },
      { k: 'ministro_conf', label: 'Ministro', ph: 'Sr. D. …, Obispo Auxiliar de …' },
      { k: 'libro_conf', label: 'Libro confir.', corto: true },
      { k: 'folio_conf', label: 'Folio confir.', corto: true },
      { k: 'num_conf', label: 'Nº confir.', corto: true }],
    documento: (d) => ({
      titulo: 'CERTIFICADO DE CONFIRMACIÓN',
      bloques: [
        { p: `Certifico que ${H.nombre(d)} ${H.g(d, 'nacido', 'nacida')} el ${H.fecha(d.f_nac)} recibió el Sacramento de la confirmación en esta Parroquia el día ${H.fecha(d.f_conf)} siendo ministro del sacramento ${H.t(d.ministro_conf, '______________________')}, tal y como consta en los archivos de nuestra Parroquia en el tomo ${H.t(d.libro_conf, '___')}, folio ${H.t(d.folio_conf, '___')}, nº ${H.t(d.num_conf, '___')}.` }
      ],
      cierre: CIERRE_CERTIFICO
    })
  },
  {
    id: 'comunicacion_confirmacion', grupo: 'confirmacion', estado: 'pendiente',
    nombre: 'Comunicación confirmación', titulo: 'Comunicación de confirmación',
    campos: [{ k: 'parroquia_bau_orig', label: 'Parroquia baut.' }, { k: 'diocesis_bau_orig', label: 'Dióc. parroquia baut.' },
      CAMPOS.nombre, CAMPOS.apellidos, CAMPOS.f_nac, { k: 'f_conf', label: 'F. confirmac.', tipo: 'date' },
      CAMPOS.f_bau, { k: 'ministro_conf', label: 'Ministro' },
      CAMPOS.libro_bau, CAMPOS.folio_bau, CAMPOS.num_bau]
  },
];

const GRUPOS = [
  { id: 'catequesis', nombre: 'Catequesis' },
  { id: 'bautismo', nombre: 'Bautismo' },
  { id: 'matrimonio', nombre: 'Matrimonio' },
  { id: 'confirmacion', nombre: 'Confirmación' },
];

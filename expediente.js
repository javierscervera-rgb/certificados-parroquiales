/* ============================================================
   EXPEDIENTE MATRIMONIAL
   - Preguntas del examen de los contrayentes y de los testigos
     (lo que se ve en pantalla).
   - Posición de cada dato sobre el impreso oficial (fondos/expediente-NN.jpg).
     Coordenadas en puntos A4: x = margen izquierdo del dato, y = línea base,
     x1 = hasta dónde puede llegar, l = líneas máximas, ld = interlineado.
   ============================================================ */

const EXPEDIENTE = (() => {
  // Lados: novio/novia → claves novio_ex_<k> / novia_ex_<k>; testigos → t1_<k> / t2_<k>
  const contrayente = lado => {
    const otro = lado === 'novio' ? 'la contrayente' : 'el otro contrayente';
    const el = lado === 'novio' ? 'la contrayente' : 'el contrayente';
    return [
      { seccion: 'Estado libre', color: '#efe3fb', preguntas: [
        { k: 'el_fuera', label: 'Después de cumplir los dieciséis años, ¿ha vivido durante más de un año fuera de la diócesis en la que actualmente tiene domicilio? ¿Dónde? (Especifíquese el lugar, las fechas y la duración de la estancia)', tipo: 'textarea' },
        { k: 'el_previo', label: '¿Ha contraído previamente matrimonio, incluso meramente civil?' },
        { k: 'el_cuando', label: '¿Cuándo, dónde y con quién?' },
        { k: 'el_hijos', label: '¿Ha tenido hijos?' },
        { k: 'el_cesado', label: '¿Ha cesado este vínculo?' },
        { k: 'el_como', label: '¿Cómo?' },
        { k: 'el_cuando_ceso', label: '¿Cuándo?' },
      ]},
      { seccion: 'Consentimiento matrimonial', color: '#f9e1ea', preguntas: [
        { k: 'c_porque', label: '¿Por qué quiere casarse en la Iglesia?', tipo: 'textarea' },
        { k: 'c_sacramento', label: '¿Cree que el matrimonio es un sacramento?' },
        { k: 'c_dificultad', label: '¿Alguna dificultad para aceptar la enseñanza de la Iglesia sobre el matrimonio y la familia?' },
        { k: 'c_cual', label: '¿Cuál?' },
        { k: 'c_libre', label: 'El matrimonio implica una decisión completamente libre. ¿Se casa por elección personal, libremente y por amor, o bien obligado por alguna necesidad?' },
        { k: 'c_presion', label: '¿Se siente presionado a contraer matrimonio por sus familiares o por los del otro contrayente?' },
        { k: 'c_fidelidad', label: 'El matrimonio es una comunión de toda la vida entre un hombre y una mujer. ¿Quiere que su matrimonio sea único y se compromete a la fidelidad conyugal?' },
        { k: 'c_indisoluble', label: 'Es voluntad de Dios que el vínculo matrimonial dure hasta la muerte de uno de los cónyuges. ¿Quiere que su matrimonio sea indisoluble y, por tanto, excluye disolverlo mediante el divorcio?' },
        { k: 'c_procreacion', label: `El matrimonio está ordenado por su misma naturaleza al bien de los cónyuges y a la procreación y educación de los hijos. ¿Acepta el deber de la ${lado === 'novio' ? 'paternidad' : 'maternidad'}, sin excluir el bien de la procreación?` },
        { k: 'c_educar', label: '¿Tiene intención de educar a sus hijos en la fe católica?' },
        { k: 'c_condiciones', label: '¿Pone condiciones al matrimonio?' },
        { k: 'c_cuales', label: '¿Cuáles?' },
        { k: 'c_otro', label: '¿Acepta el otro contrayente el matrimonio-sacramento como único e indisoluble, o tiene alguna reserva al respecto (infidelidad, divorcio)?' },
        { k: 'c_seguro', label: '¿Está seguro de que contrae matrimonio con Vd. libremente y por amor?' },
      ]},
      { seccion: 'Durante el noviazgo', color: '#fbe0dc', preguntas: [
        { k: 'n_dudar', label: '¿Ha tenido motivos para dudar del éxito del matrimonio?' },
        { k: 'n_madurez', label: `¿Cree Vd. que ${el} ha alcanzado la suficiente madurez para cumplir las obligaciones del matrimonio?` },
        { k: 'n_oculta', label: `¿Oculta a ${otro} alguna cosa que pueda perturbar gravemente la vida conyugal?` },
      ]},
      { seccion: 'Impedimentos y prohibiciones', color: '#fde6dc', preguntas: [
        { k: 'i_consanguinidad', label: `¿Existen vínculos de consanguinidad entre Vd. y ${otro}? (Primos, tíos o sobrinos)` },
        { k: 'i_otros', label: '¿Existen otros impedimentos al matrimonio canónico o prohibiciones para la celebración? (Disparidad de culto, matrimonio mixto, etc.)' },
        { k: 'i_menores', label: 'Menores de 18 años. ¿Saben sus padres que pretende contraer matrimonio? ¿Son favorables al mismo o se oponen a él?' },
        { k: 'i_civil', label: 'Casados civilmente. ¿Por qué contrajo matrimonio civil? ¿Por qué pide ahora casarse en la Iglesia?' },
        { k: 'i_divorcio', label: 'Casados civilmente con otra persona. ¿Ha obtenido ya la sentencia de divorcio?' },
        { k: 'i_deberes', label: '¿Cumple con los deberes naturales derivados de la precedente unión hacia la otra parte y hacia los hijos?' },
      ]},
    ];
  };

  const testigo = [
    { seccion: 'Generales', color: '#efe3fb', preguntas: [
      { k: 'nombre', label: 'Nombre', w: 5 }, { k: 'apellidos', label: 'Apellidos', w: 7 },
      { k: 'nac', label: 'Lugar y fecha de nacimiento', w: 7 }, { k: 'dni', label: 'Nº documento identidad', w: 5 },
      { k: 'domicilio', label: 'Domicilio actual', w: 12 },
      { k: 'email', label: 'Email (para firmar a distancia)', w: 12, tipo: 'email' },
      { k: 'desde', label: '¿Desde cuándo conoce a los contrayentes?' },
      { k: 'trato', label: '¿Qué trato y relación ha tenido y tiene con ellos?' },
    ]},
    { seccion: 'Estado libre', color: '#f9e1ea', preguntas: [
      { k: 'el_donde', label: '¿Dónde han vivido los contrayentes desde los dieciséis años de edad? (Indíquese el lugar, las fechas y la duración de la estancia)', tipo: 'textarea' },
      { k: 'el_contraido', label: '¿Le consta que hayan contraído matrimonio, incluso meramente civil?' },
      { k: 'el_afirmativo', label: 'En caso afirmativo: ¿Cuándo? ¿Dónde? ¿Con quién?' },
      { k: 'el_subsiste', label: '¿Subsiste aún este vínculo?' },
      { k: 'el_negativo', label: 'En caso negativo, ¿cómo ha cesado? ¿Cuándo?' },
      { k: 'el_libres', label: '¿Puede afirmar con seguridad que los contrayentes están libres de todo vínculo matrimonial?' },
    ]},
    { seccion: 'Consentimiento', color: '#fbe0dc', preguntas: [
      { k: 'c_madurez', label: '¿Considera que los contrayentes han alcanzado la suficiente madurez y que son capaces de cumplir las obligaciones del matrimonio?' },
      { k: 'c_cualidad', label: '¿Tienen los contrayentes alguna cualidad que pueda perturbar la vida conyugal?' },
      { k: 'c_fidelidad', label: '¿Le consta que los contrayentes hayan manifestado alguna reserva con relación a la fidelidad conyugal?' },
      { k: 'c_indisolubilidad', label: '¿Y sobre la indisolubilidad del matrimonio?' },
      { k: 'c_generacion', label: '¿Y respecto a la generación y la educación de los hijos?' },
      { k: 'c_comunidad', label: '¿Le consta que los contrayentes entienden el matrimonio como una comunidad de vida y amor?' },
      { k: 'c_condicion', label: '¿Sabe si los contrayentes ponen alguna condición al matrimonio?' },
      { k: 'c_presiones', label: '¿Tiene conocimiento de presiones o amenazas que les coaccionen a celebrar este matrimonio?' },
      { k: 'c_libremente', label: '¿Le consta que los contrayentes acceden libremente al matrimonio?' },
    ]},
    { seccion: 'Impedimentos y prohibiciones', color: '#fde6dc', preguntas: [
      { k: 'i_bautizado', label: '¿Le consta que alguno de los contrayentes no esté bautizado en la Iglesia Católica o haya abandonado notoriamente la fe católica?' },
      { k: 'i_consanguinidad', label: '¿Sabe si hay entre los contrayentes impedimento de consanguinidad? (Primos, tíos o sobrinos)' },
      { k: 'i_normal', label: '¿Este matrimonio es considerado normal o llama la atención?' },
      { k: 'i_porque', label: 'En este caso, ¿por qué?' },
      { k: 'i_anadir', label: '¿Tiene algo que añadir?' },
    ]},
  ];

  /* ---------- Posiciones sobre el impreso ----------
     [página, x, base, x1?, líneas?, interlineado?]  (base = parte inferior del texto, como en el PDF original) */
  const P = {};
  // Portada (pág. 1) y datos de los contrayentes (pág. 2)
  const datos = {
    nombre: [[114, 147], [344, 148]], apellido1: [[128, 164], [358, 164]], apellido2: [[128, 180], [358, 180]],
    lugar_nac: [[123, 198, 300], [353, 198, 548]], f_nac: [[101, 231, 300], [330, 232, 548]],
    padre: [[106, 248, 300], [337, 248, 548]], madre: [[106, 266, 300], [337, 266, 548]],
    registro_civil: [[150, 287, 300], [379, 287, 548]], tomo_rc: [[101, 304, 190], [330, 305, 420]], pagina_rc: [[197, 304, 300], [426, 304, 548]],
    religion: [[114, 338, 300], [343, 338, 548]], f_bau: [[133, 354, 300], [362, 355, 548]], parroquia_bau: [[159, 371, 300], [389, 372, 548]],
    ciudad_bau: [[87, 405, 300], [316, 407, 548]], diocesis_bau: [[128, 421, 300], [357, 423, 548]],
    libro_bau: [[101, 440, 170], [330, 440, 400]], folio_bau: [[177, 440, 262], [408, 440, 495]], num_bau: [[270, 440, 300], [503, 440, 548]],
    confirmacion: [[133, 457, 300], [362, 457, 548]], estado_civil: [[106, 491, 300], [337, 491, 548]], nacionalidad: [[135, 506, 300], [367, 508, 548]],
    dni: [[98, 523, 300], [329, 525, 548]], domicilio: [[121, 541, 300, 2, 11], [352, 542, 548, 2, 11]], parroquia_domicilio: [[166, 575, 300], [396, 575, 548]],
  };
  // Examen del contrayente (novio págs. 3-4, novia págs. 5-6)
  const examen = {
    novio: {
      juramento: [3, 383, 155], el_fuera: [3, 70, 255, 548, 3, 15], el_previo: [3, 378, 298], el_cuando: [3, 211, 315],
      el_hijos: [3, 152, 345, 222], el_cesado: [3, 302, 345, 365], el_como: [3, 390, 345], el_cuando_ceso: [3, 241, 360],
      c_porque: [3, 248, 401, 548, 2, 11], c_sacramento: [3, 500, 429], c_dificultad: [3, 519, 444], c_cual: [3, 105, 462],
      c_libre: [3, 70, 511], c_presion: [3, 509, 525], c_fidelidad: [3, 70, 575], c_indisoluble: [3, 70, 621],
      c_procreacion: [3, 70, 667], c_educar: [3, 332, 682],
      c_condiciones: [4, 232, 100, 330], c_cuales: [4, 70, 115], c_otro: [4, 266, 147], c_seguro: [4, 411, 177],
      n_dudar: [4, 445, 201], n_madurez: [4, 133, 237], n_oculta: [4, 484, 254],
      i_consanguinidad: [4, 485, 298], i_otros: [4, 288, 331], i_menores: [4, 189, 367], i_civil: [4, 109, 403],
      i_divorcio: [4, 459, 435], i_deberes: [4, 98, 471],
      firma: [4, 302.5, 603],
    },
    novia: {
      juramento: [5, 383, 157], el_fuera: [5, 71, 266, 548, 3, 15], el_previo: [5, 374, 311], el_cuando: [5, 207, 327],
      el_hijos: [5, 150, 360, 220], el_cesado: [5, 298, 360, 362], el_como: [5, 386, 360], el_cuando_ceso: [5, 237, 377],
      c_porque: [5, 247, 431, 548, 2, 11], c_sacramento: [5, 501, 448], c_dificultad: [5, 516, 466], c_cual: [5, 100, 484],
      c_libre: [5, 66, 536], c_presion: [5, 511, 552], c_fidelidad: [5, 71, 604], c_indisoluble: [5, 66, 653],
      c_procreacion: [5, 71, 704], c_educar: [5, 333, 722],
      c_condiciones: [6, 234, 122, 330], c_cuales: [6, 72, 137], c_otro: [6, 271, 169], c_seguro: [6, 412, 199],
      n_dudar: [6, 448, 223], n_madurez: [6, 215, 259], n_oculta: [6, 494, 276],
      i_consanguinidad: [6, 506, 320], i_otros: [6, 287, 353], i_menores: [6, 193, 390], i_civil: [6, 109, 426],
      i_divorcio: [6, 467, 458], i_deberes: [6, 102, 494],
      firma: [6, 302.5, 624],
    },
    // Testigos (testigo 1 págs. 7-8, testigo 2 págs. 9-10)
    t1: {
      nombre: [7, 112, 157], apellidos: [7, 120, 177], nac: [7, 210, 196], domicilio: [7, 153, 215], dni: [7, 192, 234],
      juramento: [7, 387, 253], desde: [7, 276, 272], trato: [7, 300, 292],
      el_donde: [7, 72, 396, 548, 2, 12], el_contraido: [7, 400, 414], el_afirmativo: [7, 72, 450], el_subsiste: [7, 198, 468, 300],
      el_negativo: [7, 72, 485], el_libres: [7, 507, 503],
      c_madurez: [7, 265, 584], c_cualidad: [7, 72, 627], c_fidelidad: [7, 120, 663, 168, 2, 11], c_indisolubilidad: [7, 379, 663],
      c_generacion: [7, 335, 683], c_comunidad: [7, 516, 702], c_condicion: [7, 72, 738],
      c_presiones: [8, 75, 127], c_libremente: [8, 388, 141],
      i_bautizado: [8, 265, 208], i_consanguinidad: [8, 72, 241], i_normal: [8, 72, 273], i_porque: [8, 181, 288], i_anadir: [8, 190, 319],
      firma: [8, 302.5, 498],
    },
    t2: {
      nombre: [9, 113, 143], apellidos: [9, 121, 160], nac: [9, 211, 177], domicilio: [9, 154, 194], dni: [9, 193, 211],
      juramento: [9, 388, 228], desde: [9, 277, 245], trato: [9, 301, 262],
      el_donde: [9, 73, 354, 548, 2, 12], el_contraido: [9, 401, 369], el_afirmativo: [9, 73, 402], el_subsiste: [9, 199, 417, 300],
      el_negativo: [9, 73, 432], el_libres: [9, 508, 447],
      c_madurez: [9, 266, 518], c_cualidad: [9, 73, 556], c_fidelidad: [9, 119, 588, 166, 2, 11], c_indisolubilidad: [9, 380, 588],
      c_generacion: [9, 336, 604], c_comunidad: [9, 517, 621], c_condicion: [9, 73, 653],
      c_presiones: [10, 73, 102], c_libremente: [10, 389, 116],
      i_bautizado: [10, 266, 183], i_consanguinidad: [10, 73, 216], i_normal: [10, 73, 248], i_porque: [10, 182, 263], i_anadir: [10, 191, 294],
      firma: [10, 301.5, 471],
    },
  };

  // Partes del expediente para imprimir, guardar o enviar
  const partes = [
    { id: 'todo', nombre: 'Todo el expediente', paginas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { id: 'portada', nombre: 'Portada y datos', paginas: [1, 2] },
    { id: 'novio', nombre: 'Novio', paginas: [3, 4] },
    { id: 'novia', nombre: 'Novia', paginas: [5, 6] },
    { id: 't1', nombre: 'Testigo 1', paginas: [7, 8] },
    { id: 't2', nombre: 'Testigo 2', paginas: [9, 10] },
    { id: 'ultima', nombre: 'Última página', paginas: [11] },
  ];

  const DOCUMENTOS = '1. DNI de los novios y los testigos.\n2. Partidas de nacimiento de los novios.\n3. Partidas de Bautismo de los novios.\n4. Certificado de cursillo prematrimonial.\n5. Declaración responsable de vida y estado.';

  return { contrayente, testigo, datos, examen, partes, DOCUMENTOS };
})();

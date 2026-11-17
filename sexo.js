/* ============================================================
   SEXO A PARTIR DEL NOMBRE
   Mira el primer nombre de pila: listas de nombres frecuentes en España y
   Latinoamérica y, si no está en ninguna, la terminación (-a → mujer).
   Siempre se puede corregir a mano en la pantalla.
   ============================================================ */

const Sexo = (() => {
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  // Nombres de mujer que NO terminan en -a
  const MUJER = new Set(('carmen pilar isabel raquel ines belen mercedes dolores rocio consuelo montserrat nieves luz sol ' +
    'beatriz ruth esther ester miriam noemi abigail lourdes asuncion concepcion encarnacion soledad trinidad paz rosario ' +
    'amparo socorro remedios milagros iris elizabeth ivonne itziar maite irene leire uxue inmaculada angeles gema yolanda ' +
    'elisabet judit jimena zoe abril chloe naiara aitziber edurne itxaso miren amaia marisol marian mariam yasmin jazmin ' +
    'carol raquel rut nerea noelia begona aranzazu arantxa esperanza caridad fe purificacion visitacion presentacion ' +
    'anunciacion piedad gracia guadalupe merce maribel mariluz maricarmen ines ainhoa aroa alba eider garazi ' +
    'iratxe izaskun josune nekane oihane uxue cristel ingrid astrid margaret rachel sarah raquel lis lys ivette ' +
    'janet jennifer kimberly evelyn ashley allison madison karen keren shirley nicole michelle rosemary ' +
    'flor mar cruz carmen consolacion estibaliz ruth leonor teresita').split(' '));

  // Nombres de varón que terminan en -a (o ambiguos que en España suelen ser de varón)
  const VARON = new Set(('borja luca nikita sasha joshua bautista jona kolya misha ilya ' +
    'josema mattia elia').split(' '));

  // Primeros nombres compuestos: "María José" es mujer, "José María" es varón
  const PRIMERA_MUJER = new Set(['maria', 'ma', 'mª', 'm.', 'mari', 'ana', 'rosa', 'luz', 'mar']);
  const PRIMERO_VARON = new Set(['jose', 'juan', 'jesus', 'francisco', 'luis', 'manuel', 'pedro', 'antonio', 'miguel', 'angel', 'carlos']);

  function adivinar(nombre) {
    const partes = norm(nombre).split(/[\s\-]+/).filter(Boolean);
    if (!partes.length) return null;
    const p = partes[0];
    if (PRIMERA_MUJER.has(p) || nombre.trim().startsWith('Mª')) return 'F';
    if (PRIMERO_VARON.has(p)) return 'M';
    if (MUJER.has(p)) return 'F';
    if (VARON.has(p)) return 'M';
    if (p.length < 2) return null;
    if (/a$/.test(p)) return 'F';
    return 'M';
  }

  return { adivinar };
})();

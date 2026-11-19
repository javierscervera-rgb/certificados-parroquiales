/* ============================================================
   AYUDA Y DUDAS
   Botón circular flotante (se puede arrastrar e incluso esconder casi
   del todo en un borde) que abre un panel con las dudas frecuentes
   y un formulario para escribir una consulta por correo.
   - Escritorio/tablet: a la derecha, al 33 % de la altura; el panel
     ocupa como mucho el 40 % del ancho.
   - Móvil: a la derecha, a media altura de la cabecera; el panel
     ocupa toda la pantalla.
   ============================================================ */
const Ayuda = (() => {
  const CORREO = 'javierscervera@gmail.com';
  const CLAVE = 'certificados.ayuda.posicion';
  const ICONO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M7.9 20A9 9 0 1 1 12 21a9.5 9.5 0 0 1-5.1-1.5L3 21l1.5-3.9A9 9 0 0 1 7.9 20Z"/>
    <path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-.8 1-2 1.2-2 2.5"/>
    <path d="M12 17h.01"/></svg>`;
  const movil = () => window.matchMedia('(max-width: 700px)').matches;
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Preguntas: [título, respuesta en HTML]
  const SECCIONES = [
    ['Primeros pasos', true, [
      ['1. Conectar con Google Drive', `
        <p>Pulsa el botón de la <strong>nube</strong> de la cabecera («Conectar con Google Drive») y entra con la <strong>cuenta de Google de la parroquia</strong>. Google te pedirá permiso para que la aplicación guarde sus propios archivos en tu Drive.</p>
        <p>Se crea la carpeta <em>Certificados parroquiales</em> con una hoja de cálculo de registros y la configuración (datos de la parroquia, firmantes, sello, tareas y amonestaciones). La aplicación no ve el resto de tu Drive.</p>
        <p>El botón indica el estado: <strong>Guardado</strong> (todo está en Drive), <strong>Guardando…</strong> o <strong>Reconectar</strong> (la sesión de Google ha caducado: púlsalo). Hay que conectar <strong>una vez en cada ordenador, tablet o móvil</strong>; después se reconecta solo.</p>
        <p>Sin conexión también puedes trabajar: lo guardado en este navegador se sube a Drive al conectar.</p>`],
      ['2. Datos de la parroquia', `
        <p>En <strong>⚙ Datos de la parroquia</strong> escribe el nombre, la dirección, la diócesis y el color del membrete, y sube el <strong>logo</strong> y el <strong>sello</strong> (mejor en PNG con fondo transparente). Ahí también van los datos de la Vicaría que usa el Alegato V.</p>`],
      ['3. Firmantes: hay que elegir quién firma para empezar', `
        <p>Mientras no se elige quién firma, los certificados y los registros están <strong>bloqueados</strong>: así ningún documento sale sin firmante.</p>
        <p>Pulsa <strong>Firmantes</strong> y añade a cada sacerdote con su <strong>nombre</strong>, su <strong>cargo</strong> (párroco, vicario parroquial…) y, si quieres, su <strong>firma escaneada</strong>. Después elígelo en el desplegable <strong>Firma</strong> de la pantalla de inicio. Se puede cambiar también en cada formulario.</p>`],
    ]],
    ['Los formularios', false, [
      ['Registros: una ficha por persona o pareja', `
        <p>Cada <strong>registro</strong> guarda los datos de una persona o de una pareja, y sirven para todos sus certificados: lo que escribes en el expediente aparece también en el Alegato V, el atestado, la partida de matrimonio, etc.</p>
        <p>En la tarjeta <strong>Registros</strong>: <em>Nuevo</em> empieza una ficha vacía, <em>Buscar</em> encuentra una por nombre, <em>Anterior/Siguiente</em> recorren las fichas y <em>Eliminar</em> la borra (también de Drive).</p>`],
      ['Rellenar un formulario', `
        <p>El tabulador lleva al primer campo vacío y luego de campo en campo. El sexo se pone solo según el nombre (se puede cambiar). A la derecha ves la <strong>vista previa</strong>; púlsala para ampliarla.</p>
        <p>En el expediente, el contador de cada caja indica cuántas letras caben en la línea del impreso.</p>`],
      ['Imprimir y guardar en PDF', `
        <p><strong>Con firma</strong> pone el sello y la firma escaneada; <strong>sin firma</strong> deja el hueco para firmar a mano.</p>
        <p><strong>Guardar PDF</strong> descarga el archivo. <strong>Imprimir</strong> manda el certificado a la impresora (nunca la pantalla).</p>
        <p>En <strong>Safari</strong> (iPhone, iPad y Mac) sale primero «Listo para imprimir»: en iPhone/iPad pulsa <em>Imprimir</em> y elige <em>Imprimir</em> en el menú de compartir; en Mac se abre el PDF en otra pestaña y allí pulsas <strong>⌘P</strong>. Si al pie sale la dirección web, en la ventana de imprimir de Mac desmarca «Imprimir encabezados y pies de página».</p>`],
      ['Enviar por mail', `
        <p>El correo sale desde el <strong>Gmail de la cuenta conectada</strong>, con el PDF adjunto (con o sin firma). Queda en «Enviados» de Gmail.</p>
        <p>La <strong>primera vez</strong> Google pide un permiso más: «enviar correo en tu nombre». Acéptalo; la aplicación solo envía el correo que tú escribes y pulsas.</p>
        <p>Rellena <em>Para</em> (y <em>CC</em> si quieres), revisa el asunto y el mensaje, que ya vienen preparados, y pulsa <strong>Enviar</strong>.</p>
        <p>El edicto de amonestaciones y la certificación para el Registro Civil <strong>no se envían por mail</strong>: solo se imprimen o se guardan. Si el envío falla, pulsa <em>Reconectar</em> en la nube y vuelve a intentarlo.</p>`],
    ]],
    ['Matrimonio', false, [
      ['El expediente matrimonial', `
        <p>Tiene pestañas: <em>Datos generales, Novio, Novia, Testigo 1, Testigo 2</em> y <em>Última página</em>. En los exámenes, al elegir JURO o PROMETO se abre el primer bloque; al marcar <strong>Resuelto</strong> se pliega y se abre el siguiente.</p>
        <p>Se imprime, guarda o envía <strong>completo o por partes</strong> (desplegable de la derecha). Desde ahí también se abren los demás documentos: Alegato V, exhortos, fe de vida, atestado, registro civil y amonestaciones.</p>`],
      ['Amonestaciones activas: cómo se acumulan', `
        <p>En la <strong>Última página</strong> del expediente, para el novio y para la novia eliges <em>Amonestaciones aquí</em> o <em>fuera</em> (con la parroquia) y las fechas de inicio y final.</p>
        <p>Cuando alguno de los dos <strong>se amonesta aquí</strong> y tiene fechas, la pareja pasa sola a <strong>Amonestaciones activas</strong>. Así se van <strong>acumulando</strong> todas las parejas que están en amonestaciones a la vez.</p>
        <p>En esa lista puedes <strong>editar</strong> o <strong>eliminar</strong> cada pareja. Cada una <strong>se borra sola 5 días después</strong> de su fecha final, y también si pasas el expediente a <em>dispensa</em> o eliminas el registro. La lista se comparte entre todos los aparatos de la parroquia.</p>
        <p>El <strong>edicto</strong> incluye las parejas marcadas (puedes desmarcar alguna) y solo se imprime o se guarda en PDF.</p>`],
      ['Partida de matrimonio y Registro Civil', `
        <p>Usan los mismos datos de los novios. La partida tiene su propio libro, folio y número. La certificación para el Registro Civil sale en los <strong>4 ejemplares</strong> del impreso oficial.</p>`],
    ]],
    ['Otras dudas', false, [
      ['Uso varios ordenadores', `
        <p>Conecta todos con la misma cuenta de Google de la parroquia. Si un mismo dato se cambió en dos sitios a la vez, la aplicación te pregunta <strong>qué versión se queda</strong> y te muestra la fecha de cada una.</p>`],
      ['Buscador de parroquias y tareas', `
        <p>En la pantalla de inicio, <strong>Buscar parroquia</strong> te dice a qué parroquia pertenece una dirección (Archidiócesis de Madrid). <strong>Tareas pendientes</strong> es una lista compartida por toda la parroquia.</p>`],
      ['Letra, modo día/noche y este botón', `
        <p>Los botones <strong>A A</strong> cambian el tamaño de letra; la luna/sol cambia entre modo noche y día (igual que en HerramientaSacerdotal).</p>
        <p>Este botón de ayuda se puede <strong>arrastrar</strong> a cualquier sitio y hasta esconder en un borde: queda asomando y se recupera pulsándolo.</p>`],
    ]],
  ];

  function panelHTML() {
    const cfg = (typeof estado !== 'undefined' && estado.config) || {};
    return `<div class="ayuda-cab">
        <h2>Ayuda y dudas</h2>
        <button type="button" class="ayuda-cerrar" data-ayuda-cerrar aria-label="Cerrar la ayuda">✕</button>
      </div>
      <div class="ayuda-cuerpo">
        <form class="ayuda-pregunta" data-ayuda-form>
          <label for="ayudaTexto">¿Tienes una duda o una sugerencia? Escríbela aquí</label>
          <textarea id="ayudaTexto" rows="3" placeholder="Por ejemplo: no consigo enviar el certificado por correo…"></textarea>
          <input id="ayudaQuien" type="text" placeholder="Tu nombre o tu parroquia (opcional)" value="${esc(cfg.nombre || '')}" autocomplete="off">
          <div class="ayuda-enviar">
            <button type="submit" class="btn prim">Enviar la consulta</button>
            <span class="nota">Se abre tu correo con el mensaje para <a href="mailto:${CORREO}">${CORREO}</a></span>
          </div>
        </form>
        ${SECCIONES.map(([titulo, abierta, preguntas]) => `
          <section class="ayuda-seccion">
            <h3>${titulo}</h3>
            ${preguntas.map(([p, r], i) => `<details class="ayuda-q" ${abierta && i === 0 ? 'open' : ''}><summary>${p}</summary><div class="ayuda-r">${r}</div></details>`).join('')}
          </section>`).join('')}
        <p class="nota ayuda-pie">¿No encuentras la respuesta? Escribe arriba o a <a href="mailto:${CORREO}">${CORREO}</a>.</p>
      </div>`;
  }

  /* ---------- Botón flotante ---------- */
  let boton, panel, fondo;
  function posicionInicial() {
    const t = 44;
    if (movil()) {
      const cab = document.querySelector('header');
      const h = cab ? cab.getBoundingClientRect().height : 160;
      return { x: window.innerWidth - t - 10, y: Math.max(8, h / 2 - t / 2) };
    }
    return { x: window.innerWidth - t - 16, y: window.innerHeight * 0.33 - t / 2 };
  }
  function leerPos() {
    try { const p = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (p && p.modo === (movil() ? 'm' : 'd')) return p; } catch (e) {}
    return null;
  }
  // Se deja asomar al menos 16 px por cualquier borde: así se puede «sacar» de la pantalla y recuperar
  function encajar(x, y) {
    const t = boton.offsetWidth || 44, asoma = 16;
    return {
      x: Math.min(window.innerWidth - asoma, Math.max(asoma - t, x)),
      y: Math.min(window.innerHeight - asoma, Math.max(asoma - t, y)),
    };
  }
  function colocar(p) {
    const q = encajar(p.x, p.y);
    boton.style.left = q.x + 'px'; boton.style.top = q.y + 'px';
    const t = boton.offsetWidth || 44;
    boton.classList.toggle('escondido', q.x < 0 || q.y < 0 || q.x + t > window.innerWidth || q.y + t > window.innerHeight);
    return q;
  }
  function recolocar() {
    const p = leerPos();
    if (p) colocar({ x: p.fx * window.innerWidth, y: p.fy * window.innerHeight });
    else colocar(posicionInicial());
  }

  function crearBoton() {
    boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'ayuda-boton';
    boton.setAttribute('aria-label', 'Ayuda y dudas');
    boton.title = 'Ayuda y dudas (puedes arrastrarlo)';
    boton.innerHTML = ICONO;
    document.body.appendChild(boton);
    let ini = null, movido = false;
    boton.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      ini = { px: e.clientX, py: e.clientY, x: boton.offsetLeft, y: boton.offsetTop };
      movido = false;
      boton.setPointerCapture(e.pointerId);
    });
    boton.addEventListener('pointermove', e => {
      if (!ini) return;
      const dx = e.clientX - ini.px, dy = e.clientY - ini.py;
      if (!movido && Math.hypot(dx, dy) < 6) return;
      movido = true; boton.classList.add('arrastrando');
      colocar({ x: ini.x + dx, y: ini.y + dy });
    });
    const soltar = e => {
      if (!ini) return;
      boton.classList.remove('arrastrando');
      if (movido) {
        const q = colocar({ x: boton.offsetLeft, y: boton.offsetTop });
        try { localStorage.setItem(CLAVE, JSON.stringify({ modo: movil() ? 'm' : 'd', fx: q.x / window.innerWidth, fy: q.y / window.innerHeight })); } catch (err) {}
      } else if (e.type === 'pointerup') {
        // un toque: si está escondido, primero vuelve a asomar entero; si no, abre la ayuda
        if (boton.classList.contains('escondido')) {
          const q = colocar(posicionInicial());
          try { localStorage.removeItem(CLAVE); } catch (err) {}
        } else abrir();
      }
      ini = null;
    };
    boton.addEventListener('pointerup', soltar);
    boton.addEventListener('pointercancel', soltar);
    boton.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
    boton.addEventListener('click', e => e.preventDefault());
    window.addEventListener('resize', recolocar);
    recolocar();
  }

  /* ---------- Panel ---------- */
  function abrir() {
    if (!panel) {
      fondo = document.createElement('div'); fondo.className = 'ayuda-fondo'; document.body.appendChild(fondo);
      panel = document.createElement('aside');
      panel.className = 'ayuda-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Ayuda y dudas');
      document.body.appendChild(panel);
      fondo.addEventListener('click', cerrar);
      panel.addEventListener('click', e => { if (e.target.closest('[data-ayuda-cerrar]')) cerrar(); });
      panel.addEventListener('submit', e => {
        if (!e.target.matches('[data-ayuda-form]')) return;
        e.preventDefault();
        const texto = panel.querySelector('#ayudaTexto').value.trim();
        if (!texto) { panel.querySelector('#ayudaTexto').focus(); return; }
        const quien = panel.querySelector('#ayudaQuien').value.trim();
        const cuerpo = `${texto}\n\n— ${quien || 'Usuario de Certificados'}\n(Enviado desde la ayuda de Certificados: ${location.host})`;
        location.href = `mailto:${CORREO}?subject=${encodeURIComponent('Duda sobre Certificados' + (quien ? ' · ' + quien : ''))}&body=${encodeURIComponent(cuerpo)}`;
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('abierto')) cerrar(); });
    }
    panel.innerHTML = panelHTML();
    panel.classList.add('abierto'); fondo.classList.add('abierto');
    document.body.classList.add('ayuda-abierta');
    boton.classList.add('oculto-por-panel');
    setTimeout(() => (panel.querySelector('#ayudaTexto') || panel).focus(), 50);
  }
  function cerrar() {
    if (!panel) return;
    panel.classList.remove('abierto'); fondo.classList.remove('abierto');
    document.body.classList.remove('ayuda-abierta');
    boton.classList.remove('oculto-por-panel');
    boton.focus();
  }

  function iniciar() { if (!boton) crearBoton(); }
  return { iniciar, abrir, cerrar, recolocar };
})();

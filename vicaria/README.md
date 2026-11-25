# Expedientes Vicaría (beta)

Circuito del expediente matrimonial entre la parroquia (Certificados) y la Vicaría.

- **Buzón central por correo** · todos los expedientes llegan a un único buzón (un Apps Script), pero cada uno va **dirigido a un correo**: solo lo ven esa cuenta de Google (el titular) y las cuentas a las que el titular dé acceso. Cualquiera puede entrar en la web con su cuenta de Google, pero solo ve lo suyo.
- **Parroquia** · en la pantalla *Expediente matrimonial*, botón **Enviar a Vicaría (beta)**: manda el expediente completo del registro (datos, exámenes de los novios y los testigos, diligencias) **al correo que se escribe** (por defecto, el email de la Vicaría en Datos de la parroquia → Vicaría, o el último usado). Mientras la Vicaría no lo haya empezado a revisar, al volver a enviarlo se puede cambiar el correo.
- **Vicaría** · web `vicaria/` (en producción: `https://certificados.herramientasacerdotal.es/vicaria/`):
  - **General**: lista de los expedientes que llegan (fecha de llegada, apellidos del novio y de la novia, parroquia, estado). Se ordena por llegada, estado o apellidos. Los archivados solo se ven con «Ver archivados». Los devueltos por la parroquia salen en rojo.
  - **Detalle**: el expediente por pestañas (más la pestaña **Vicaría**, para la aprobación de la última página), con márgenes. Al pulsar un dato se puede **rectificar** (el original queda tachado y el nuevo debajo) o **crear una nota** (sale en rojo en el margen, con una línea hasta el dato).
  - **Revisión**: el expediente sobre el impreso oficial, como un libro de dos páginas que se pasan con animación, con pantalla completa. Los datos se resaltan al pasar el cursor; al pulsarlos se rectifican o se anotan. Lo anotado sale en amarillo con un icono desplegable; el punto rojo marca las respuestas de la parroquia. La aprobación de la última página se rellena pulsando sobre ella.
  - **Alegato V** (pestaña del Detalle): los mismos campos y el mismo modelo que «Alegato V» en Certificados, rellenos con los datos del expediente (con sus rectificaciones). Lo que se cambia ahí solo vale para el Alegato (se guarda en `vic_alegato`; el expediente no se toca) y se puede «Restablecer». Vista previa de las dos páginas e **Imprimir Alegato V**.
  - **⚙ Mi buzón** (cabecera): tu correo; **personas con acceso a tus expedientes** (pueden verlos, anotarlos, aprobarlos e imprimirlos; solo el titular añade o quita); y tus **datos de la Vicaría** para el Alegato V (arzobispado, vicaría, vicario y cargo, dirección, ciudad, email, teléfono, logo). El Alegato de un expediente usa los datos de su titular.
  - **Administradores del buzón** (quien lo instaló y los de `ADMINS`): además pueden pulsar **Ver todo el buzón** en la lista.
  - Botones: **Aprobado** (destaca los teléfonos de los novios), **Devolver a Parroquia**, **Novios avisados**, **Alegato V recogido**, **Imprimir expediente**, **Archivar** / **Sacar del archivo**.
- **Devolver a parroquia** · en Certificados aparece el botón rojo **Revisión** junto a «Expediente prematrimonial». Lleva a **Revisión de expediente**: la parroquia contesta las notas, aprueba las rectificaciones o corrige los datos y pulsa **Devolver a la vicaría**. Lo corregido o aprobado pasa también a su registro. Indicador: *Pendiente de revisión* (rojo), *Pendiente de aprobación* (naranja), *Aprobado* (verde).

### Estados en la Vicaría

`pendiente_revision` → `revisado_parroquia` (devuelto a la parroquia) → `devuelto_parroquia` (la parroquia ha respondido) → … → `aprobado_contactar` → `aprobado_alegato` → `recogido_alegato` → `archivado`.

## Archivos

| Archivo | Contenido |
|---|---|
| `nucleo.js` | Estados, notas, rectificaciones y el servidor del buzón. **El mismo código** en Certificados, en esta web y en el Apps Script. |
| `servicio.js` | Conexión con el buzón (Apps Script) o modo de prueba. |
| `campos.js` | Pestañas y campos del expediente (de `plantillas.js` y `expediente.js`). |
| `index.html`, `vicaria.js`, `vicaria.css` | La web de la Vicaría. |
| `apps-script.gs` | El buzón, para pegar en Apps Script desde la cuenta de la Vicaría. Su parte final es copia de `nucleo.js` (`python3 vicaria/actualizar-apps-script.py`). |
| `../revision.js` | Lo de la parroquia: enviar, botón «Revisión» y pantalla de revisión. |

## Instalar el buzón de la Vicaría (una sola vez)

1. Con la **cuenta de Google de la Vicaría**, entra en <https://script.google.com> → **Nuevo proyecto**. Llámalo, por ejemplo, «Buzón Expedientes Vicaría».
2. Borra lo que haya en `Código.gs` y pega **entero** el contenido de `vicaria/apps-script.gs`. Guarda.
3. Elige la función **`instalar`** arriba y pulsa **Ejecutar**. Google pedirá permisos (Drive y conectar con un servicio externo): acéptalos. Se crea la carpeta **«Expedientes Vicaría»** en ese Drive.
4. **Implementar → Nueva implementación** → tipo **Aplicación web** · *Ejecutar como*: **Yo** · *Quién tiene acceso*: **Cualquier usuario** → **Implementar**. Copia la URL (termina en `/exec`).
5. Pon esa URL en `config.js`: `window.VICARIA_URL = 'https://script.google.com/macros/s/…/exec';` y publica.
6. Entra en `…/vicaria/` y pulsa **Entrar con Google**. Cada Vicaría entra con la cuenta del correo al que le envían los expedientes y, en **⚙ Mi buzón**, rellena sus datos y da acceso a quien quiera.
7. (Opcional) Más administradores del buzón: en Apps Script, **Configuración del proyecto → Propiedades del script → `ADMINS`** = correos separados por comas.

Lo que llegue sin destinatario (desde una versión anterior de Certificados) va al titular del buzón: la cuenta que lo instaló.

Si la pantalla de consentimiento del proyecto de Google Cloud está en modo *Prueba*, añade la cuenta de la Vicaría como usuario de prueba.

Si el buzón se instaló antes de existir «Datos de la Vicaría», la web los guarda en el navegador y avisa: hay que actualizarlo.

**Actualizar el buzón** tras cambiar `nucleo.js`: `python3 vicaria/actualizar-apps-script.py`, pega otra vez `apps-script.gs` y **Implementar → Gestionar implementaciones → Editar (lápiz) → Versión: nueva** (así la URL no cambia).

## Seguridad

- La parroquia **no** manda su sesión de Google al buzón (daría acceso a sus archivos de Certificados). El correo que ve la Vicaría es el de la cuenta con la que la parroquia está conectada, tal como lo indica ella. Como la dirección del buzón es pública, cualquiera podría enviarle un expediente: si llega algo extraño, se archiva.
- Cada expediente lleva una **clave secreta** que solo tiene la parroquia que lo envió (en su registro) y la Vicaría (cifrada). Sin ella no se puede ver ni responder.
- En la web de la Vicaría cada cuenta de Google solo ve los expedientes dirigidos a su correo y los de quien le haya dado acceso. Solo el titular cambia su lista de accesos y sus datos.
- Todo se guarda en el Drive de la cuenta que aloja el buzón: su dueño (y los administradores, con «Ver todo el buzón») puede ver todos los expedientes.

## Modo de prueba

Mientras `VICARIA_URL` esté vacía, «Enviar a Vicaría» ofrece **Activar modo de prueba** y la web de la Vicaría **Probar en modo de prueba**. Los expedientes se guardan solo en ese navegador, y Certificados y la web de la Vicaría (misma dirección) los ven a la vez: sirve para enseñar y probar todo el circuito sin instalar nada. En la web de la Vicaría se entra como el último correo al que se envió (y como administrador).

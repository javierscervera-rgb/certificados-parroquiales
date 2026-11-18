# Certificados parroquiales

Aplicación web para generar los certificados que se usan habitualmente en las parroquias
(bautismo, confirmación, matrimonio, catequesis…). Sustituye a una solución anterior en FileMaker.

- Funciona en el navegador, sin instalar nada.
- Genera cada certificado en PDF (A4), con o sin firma y sello, listo para imprimir.
- Cada parroquia configura una sola vez su membrete, su logo, su sello y sus firmantes.
- Varios registros (personas o parejas) con búsqueda, navegación y eliminación.
- Detecta el sexo a partir del nombre (se puede corregir a mano).
- Con la cuenta de Google de la parroquia: registros y configuración guardados en su
  Google Drive (carpeta «Certificados parroquiales») y envío de certificados por Gmail.

## Estado de los modelos

| Grupo | Certificado | Estado |
|---|---|---|
| Catequesis | Certificado de catequesis | ✅ |
| Bautismo | Certificado de bautismo | ✅ |
| Bautismo | Partida de bautismo (con margen y notas marginales) | ✅ |
| Bautismo | Autorización para bautizar fuera de la parroquia | ✅ |
| Bautismo | Certificado para ser padrino/madrina | ✅ |
| Matrimonio | Cursillo prematrimonial | ✅ |
| Matrimonio | Certificado matrimonio futuro (boda que se va a realizar) | ✅ |
| Matrimonio | Certificado matrimonio realizado | ✅ |
| Matrimonio | Bendición apostólica (boda, bodas de plata, bodas de oro) | ✅ |
| Matrimonio | Comunicación de matrimonio (con tabla de trámites) | ✅ |
| Matrimonio | Exhorto de amonestaciones (con certificación de la parroquia que publica) | ✅ |
| Matrimonio | Alegato V · Autorización de matrimonio (2 páginas, datos de la Vicaría) | ✅ |
| Matrimonio | Expediente, amonestaciones activas, registro civil | ⏳ falta pantalla y modelo |
| Confirmación | Certificado de confirmación | ✅ |
| Confirmación | Comunicación de confirmación | ✅ |

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Página y estilos |
| `plantillas.js` | Campos y texto de cada certificado (**aquí se añaden o corrigen modelos**) |
| `motor.js` | Maquetación A4 común a la vista previa y al PDF |
| `app.js` | Menú, registros, pantallas de datos y configuración |
| `google.js` | Inicio de sesión de Google, Drive (hoja de registros + `configuracion.json`) y Gmail |
| `sexo.js` | Sexo probable a partir del nombre de pila |
| `config.js` | ID de cliente OAuth de Google |

Los PDF se generan con [pdf-lib](https://pdf-lib.js.org), que se carga desde unpkg.

## Google Drive y Gmail

La aplicación pide solo dos permisos:
- `drive.file`: crear y usar sus propios archivos en el Drive de la parroquia. No ve el resto del Drive.
- `gmail.send`: enviar correos. Se pide la primera vez que se envía uno, y no permite leer el correo.

El ID de cliente OAuth va en `config.js`. Debe ser de tipo «Aplicación web» y tener
como origen autorizado `https://javierscervera-rgb.github.io`.

## Publicar con GitHub Pages

En el repositorio, entra en *Settings → Pages → Build and deployment*. Elige
*Deploy from a branch* y la rama `main`, carpeta `/ (root)`. La aplicación queda en
`https://<usuario>.github.io/<repositorio>/`.

## Probar en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

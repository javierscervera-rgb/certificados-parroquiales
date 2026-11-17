# Certificados parroquiales

Aplicación web para generar los certificados que se usan habitualmente en las parroquias
(bautismo, confirmación, matrimonio, catequesis…). Sustituye a una solución anterior en FileMaker.

- Funciona en el navegador, sin instalar nada.
- Genera cada certificado en PDF (A4), con o sin firma y sello, listo para imprimir.
- Cada parroquia configura una sola vez su membrete, su logo, su sello y sus firmantes.
- **Próximamente:** acceso con la cuenta de Google de la parroquia, con los registros
  guardados en su propio Google Drive.

## Estado de los modelos

| Grupo | Certificado | Estado |
|---|---|---|
| Catequesis | Certificado de catequesis | ✅ |
| Bautismo | Certificado de bautismo | ✅ |
| Bautismo | Partida de bautismo (con margen y notas marginales) | ✅ |
| Bautismo | Autorización para bautizar fuera de la parroquia | ✅ |
| Bautismo | Certificado para ser padrino/madrina | ✅ |
| Matrimonio | Cursillo prematrimonial | ✅ |
| Matrimonio | Celebración del matrimonio (boda que se va a realizar) | ✅ |
| Matrimonio | Certificado de matrimonio | ✅ |
| Matrimonio | Bendición apostólica (boda, bodas de plata, bodas de oro) | ✅ |
| Matrimonio | Comunicación de matrimonio (con tabla de trámites) | ✅ |
| Matrimonio | Expediente, Alegato V, amonestaciones, exhorto, registro civil | ⏳ falta pantalla y modelo |
| Confirmación | Certificado de confirmación | ✅ |
| Confirmación | Comunicación de confirmación | ✅ |

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Página y estilos |
| `plantillas.js` | Campos y texto de cada certificado (**aquí se añaden o corrigen modelos**) |
| `motor.js` | Maquetación A4 común a la vista previa y al PDF |
| `app.js` | Menú, pantallas de datos y configuración |

Los PDF se generan con [pdf-lib](https://pdf-lib.js.org), que se carga desde unpkg.

## Publicar con GitHub Pages

En el repositorio, entra en *Settings → Pages → Build and deployment*. Elige
*Deploy from a branch* y la rama `main`, carpeta `/ (root)`. La aplicación queda en
`https://<usuario>.github.io/<repositorio>/`.

## Probar en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

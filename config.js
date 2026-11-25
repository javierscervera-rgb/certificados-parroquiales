/* ============================================================
   CONFIGURACIÓN DE LA CONEXIÓN CON GOOGLE
   ID de cliente OAuth del proyecto de Google Cloud (tipo "Aplicación web").
   No es secreto: identifica a la aplicación ante Google.
   Orígenes autorizados: https://certificados.herramientasacerdotal.es (y https://javierscervera-rgb.github.io)
   ============================================================ */
window.GOOGLE_CLIENT_ID = '566558832672-5sj89qujqu783pbtd23obo7movdd2be3.apps.googleusercontent.com';

/* Mensajes de la ayuda: aplicación web de Google Apps Script en la cuenta del administrador
   (código en mensajes-apps-script.gs). Los mensajes se guardan en su Drive. */
window.MENSAJES_URL = 'https://script.google.com/macros/s/AKfycbztGEP8y4qwMQ4upHMUKl1nMbNQ-ewnrqzWpZ7deTN7uYKpLa45HausbdqqwQKXEJG8/exec';
window.MENSAJES_ADMIN = 'sansebastianmartir@gmail.com';

/* Buzón de la Vicaría (Expedientes Vicaría, beta): dirección de la aplicación web de Apps Script
   publicada desde la cuenta de Google de la Vicaría (código en vicaria/apps-script.gs; pasos en vicaria/README.md).
   Mientras esté vacía, «Enviar a Vicaría» ofrece el modo de prueba (todo se guarda en el navegador). */
window.VICARIA_URL = '';

"""Vuelve a copiar vicaria/nucleo.js al final de vicaria/apps-script.gs.
El Apps Script lleva el mismo núcleo que Certificados y la web de la Vicaría: si cambia nucleo.js,
se ejecuta esto (python3 vicaria/actualizar-apps-script.py) y se vuelve a pegar el .gs en el proyecto
de Apps Script de la Vicaría (Implementar → Gestionar implementaciones → Editar → Nueva versión)."""
import pathlib
aqui = pathlib.Path(__file__).resolve().parent
gs = (aqui / 'apps-script.gs').read_text(encoding='utf-8')
MARCA = '   ============================================================ */\n'
i = gs.index('NÚCLEO COMÚN')
fin = gs.index(MARCA, i) + len(MARCA)
nuevo = gs[:fin] + (aqui / 'nucleo.js').read_text(encoding='utf-8')
(aqui / 'apps-script.gs').write_text(nuevo, encoding='utf-8')
print('apps-script.gs actualizado' if nuevo != gs else 'apps-script.gs ya estaba al día')

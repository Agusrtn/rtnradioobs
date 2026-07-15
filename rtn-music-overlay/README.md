# RTN Music Overlay

Overlay preparado para OBS Browser Source. Transparencia real y animaciones suaves.

Instrucciones rápidas:

- Copia la carpeta `rtn-music-overlay` al servidor web o úsala en local.
- Abre OBS, añade una `Fuente del navegador` con URL apuntando a `index.html` local o al host donde subas los archivos.
- Configura ancho/alto según tu canvas (ej. 1920x1080) y activa `Transparente`.

Parámetros opcionales:

- `?api=URL` para cambiar el endpoint de la API. Por ejemplo:

  https://tusitio.com/overlay/index.html?api=https://rtn-music.vercel.app/api/radio-stream?format=json

Notas técnicas:

- El overlay consulta la API cada segundo y anima la barra a 60 FPS para suavidad.
- Si la portada no permite extracción de color por CORS, se usa un color por defecto.
- Reemplaza `assets/rtn-logo.svg` por tu logo vectorial si deseas.

Si quieres, empaqueto esto en un ZIP o lo subo a tu repo.
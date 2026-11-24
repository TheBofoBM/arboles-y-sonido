# Abrir y publicar el prototipo sin ChatGPT

La aplicación funciona en el navegador. ChatGPT no es necesario para abrirla,
procesar entradas, comparar árboles o escuchar los sampleos.

Actualizado el 23 de noviembre de 2026. La versión pública incorpora lectura
desde las relaciones en postorden, etiqueta JOIN, banco Aventura orbital con
base musical y registro por profundidad, ajustes sonoros compartidos y SQL
de referencia editable. También se subieron la demo y la partitura de JOIN
al repositorio.

La [publicación de esta actualización](https://github.com/TheBofoBM/arboles-y-sonido/actions/runs/45298341957)
terminó correctamente para el commit `291644a`. Se aprobaron 350 pruebas y la
compilación; Chrome verificó la URL pública con trece comprobaciones de
interfaz, once WAV cargados, reproducción, edición SQL, comparación A/B y
vista móvil de 390 px, sin errores de página ni recursos. El informe actual
está en [verificacion-github-pages.json](evidencias/verificacion-github-pages.json).

Publicación inicial del 18 de noviembre de 2026:

- [Abrir el prototipo](https://thebofobm.github.io/arboles-y-sonido/).
- [Repositorio de código](https://github.com/TheBofoBM/arboles-y-sonido).
- [Primera publicación satisfactoria](https://github.com/TheBofoBM/arboles-y-sonido/actions/runs/44343569049).

En aquella versión se verificó la URL pública con Chrome: HTTP 200, entradas JSON y álgebra,
comparación A/B, carga de cuatro WAV usados por el ejemplo, reproducción
completa y vista móvil sin desbordamiento. No hubo errores de página ni de
recursos en esa sesión. La evidencia está en
[verificacion-github-pages.json](evidencias/verificacion-github-pages.json) y
[captura de la comparación publicada](evidencias/comparacion-visual-github-pages.png).
La actualización centrada en el árbol, sus colores y el recorrido por niveles
se documenta en [interfaz visual y verificación](interfaz-visual-recorrido-2026-11-18.md).

## En la laptop

Abrir PowerShell en la carpeta del proyecto y ejecutar:

```powershell
npm ci
npm run dev
```

Si las dependencias ya están instaladas, basta `npm run dev`.
Abrir en Chrome o Edge la dirección local que indique Vite. Mantener esa
terminal abierta mientras se utiliza el prototipo; detener con Ctrl+C.

Para revisar la compilación local:

```powershell
npm run build
npm run preview
```

No se abre `index.html` con doble clic: la aplicación se sirve mediante HTTP.

## En GitHub Pages

Se preparó `.github/workflows/pages.yml`. El flujo instala las dependencias,
ejecuta Vitest, compila y publica únicamente `dist/`. Solo publica la rama
predeterminada del repositorio. También puede iniciarse desde Actions.

La configuración de Vite lee `VITE_BASE_PATH`. El flujo obtiene esa ruta de
`actions/configure-pages`, de modo que se adapten JavaScript, CSS, favicon,
importaciones diferidas y WAV al subdirectorio del repositorio. Localmente,
sin esa variable, se conserva `/`.

Configuración aplicada y pasos para repetirla en otro repositorio:

1. Elegir o crear el repositorio de destino.
2. Subir el proyecto con `src/`, `public/`, `.github/`, `package.json`,
   `package-lock.json`, `vite.config.js` e `index.html`, conservando las rutas.
   No hace falta subir `node_modules/` ni `dist/`.
3. En **Settings → Pages → Build and deployment → Source**, elegir
   **GitHub Actions**.
4. Subir los cambios a la rama predeterminada o ejecutar el flujo manualmente
   desde **Actions → Publicar prototipo en GitHub Pages → Run workflow**.
5. Abrir el enlace que indique la ejecución satisfactoria y comprobar
   **Comparar A / B**, las fórmulas y **Escuchar A/B**.

La dirección habitual de un proyecto tiene la forma
`https://USUARIO.github.io/REPOSITORIO/`. En este caso el usuario es TheBofoBM
y el repositorio es arboles-y-sonido. GitHub Actions publica los cambios que
se suban a la rama predeterminada; la dirección se mantiene.

GitHub Pages admite repositorios públicos con GitHub Free; la disponibilidad
para repositorios privados depende del plan. Los sampleos se incluyen en el
sitio y se reproducen al pulsar sus controles; no requieren un servidor de
audio o una sesión de ChatGPT.

Fuentes oficiales: [Vite: GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages),
[GitHub: flujos de publicación](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

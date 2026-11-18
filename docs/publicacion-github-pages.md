# Abrir y publicar el prototipo sin ChatGPT

La aplicación funciona en el navegador. ChatGPT no es necesario para abrirla,
procesar entradas, comparar árboles o escuchar los sampleos.

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

Pasos pendientes en GitHub:

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
`https://USUARIO.github.io/REPOSITORIO/`. No se ha asignado una URL pública a
este proyecto todavía: falta confirmar su repositorio y realizar el despliegue.

GitHub Pages admite repositorios públicos con GitHub Free; la disponibilidad
para repositorios privados depende del plan. Los sampleos se incluyen en el
sitio y se reproducen al pulsar sus controles; no requieren un servidor de
audio o una sesión de ChatGPT.

Fuentes oficiales: [Vite: GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages),
[GitHub: flujos de publicación](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

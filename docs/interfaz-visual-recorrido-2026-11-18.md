# Interfaz centrada en ver y escuchar el árbol

Revisión del 18 de noviembre de 2026. Se prioriza el diagrama y la reproducción;
se retiran del área principal las tablas de métricas, listas de recorridos y
metadatos. El contrato JSON y la lógica de los parsers y las reglas se conservan.

## Comportamiento

- La entrada inicial es álgebra relacional, con el ejemplo de biblioteca ya
  dibujado. No comienza el audio hasta pulsar **Escuchar árbol actual**.
- Cada operador tiene símbolo, nombre y color: proyección violeta, selección
  ámbar, JOIN azul, relación turquesa y proyección extendida rosa.
- El nodo que suena toma un color intenso y un indicador animado. Los nodos
  visitados conservan un borde de color. El progreso se muestra sin una tabla
  de resultados. Se respeta `prefers-reduced-motion` para las animaciones.
- El recorrido predeterminado es **por niveles**: raíz, segunda fila, tercera
  fila, etc.; dentro de cada nivel, de izquierda a derecha. Este orden evita
  volver a una fila superior al pasar de una rama profunda a otra.
- Preorden y postorden permanecen en **Cambiar recorrido**. Cambiar el árbol,
  recorrido o pestaña detiene el audio; iniciar A detiene B y viceversa.
- Los controles permiten acercar, alejar, ajustar y volver al tamaño real.
  En árboles grandes se puede desplazar el lienzo; durante la reproducción
  sigue al nodo activo si este sale de su área visible.
- Seleccionar un nodo con clic, Enter o Espacio muestra su expresión completa.
  La abreviación del texto dentro del nodo no modifica sus parámetros.
- Los editores de entrada, JSON, fórmula, historial y detalles de equivalencia
  quedan plegados después de generar un árbol válido.
- **Comparar A / B** abre el par de biblioteca y muestra dos diagramas con
  controles independientes. **Ver árboles transformados** aplica las mismas
  referencias heurísticas que ya ofrecía el prototipo.

## Implementación

| Archivo | Función |
| --- | --- |
| `src/modules/tree/treeLayout.js` | Coordenadas del diagrama, estilos y descripciones por operador. |
| `src/components/trees/TreeDiagram.vue` | SVG, zoom, selección, seguimiento y estados de reproducción. |
| `src/components/trees/OperatorLegend.vue` | Leyenda compartida. |
| `src/components/trees/TreeResult.vue` | Diagrama y JSON opcional; sustituye la salida principal de datos. |
| `src/components/trees/TreeWorkbench.vue` | Área de escucha; reglas e historial debajo del árbol. |
| `src/components/audio/SamplePlayer.vue` | Transporte, estado del operador y progreso visual. |
| `src/composables/useSamplePlayer.js` | Nodo activo y visitas acumuladas de la secuencia. |
| `src/modules/sonification/samplePlan.js` | Añade `niveles` como orden predeterminado; conserva preorden/postorden. |
| `src/components/comparison/TreeComparison.vue` | Dos lienzos A/B y editores plegados. |
| `src/styles/global.css` | Paleta, estados, lienzos, adaptación móvil y movimiento reducido. |
| `scripts/comprobar-interfaz.mjs` | Comprobaciones compartidas para servidor local y sitio público. |

La distribución asigna un espacio a cada hoja y centra cada padre sobre el
espacio ocupado por sus descendientes. La profundidad determina la fila; el
orden original de hijos conserva izquierda y derecha. Las coordenadas, el
zoom y los visitados son estado de presentación: no se insertan en el JSON.
Se reutilizan los cinco sampleos existentes, sin nuevas dependencias.

## Verificaciones ejecutadas

Entorno comprobado mediante `node --version`, `npm --version` y
`npm ls --depth=0`: Node v24.11.0, npm 11.6.1, Vue 3.5.44,
Vite 8.3.5, Vitest 5.0.5, complemento Vue 6.0.10 y parser 12.0.2.

| Comando / comprobación | Resultado observado |
| --- | --- |
| `npm run check` | 342 pruebas en 12 archivos aprobadas; compilación de producción correcta. |
| `git diff --check` | Sin errores de espacios; Git avisa de conversión LF/CRLF en Windows. |
| `node scripts/verificar-prototipo.mjs <playwright/index.mjs> <chrome.exe>` | Desarrollo en 127.0.0.1:5183: diez comprobaciones aprobadas, sin errores de consola, página ni HTTP. Servidor cerrado al terminar. |
| Build con `VITE_BASE_PATH=/arboles-y-sonido/` | Compilación correcta, incluidos los cinco WAV y los módulos diferidos. |
| `node scripts/verificar-prototipo.mjs <playwright/index.mjs> <chrome.exe> preview /arboles-y-sonido/` | Producción en 127.0.0.1:4183: las mismas comprobaciones aprobadas y servidor cerrado al terminar. |

Para los dos scripts se utilizaron estas rutas reales de herramientas externas
ya presentes en la laptop; no se instalaron como dependencias:

```text
C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1116-1220-0_26.1116.1220.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/playwright/index.mjs
C:/Program Files/Google/Chrome/Application/chrome.exe
```

Las pruebas de Vitest incluyen distribución sin solapamientos, orientación de
las ramas, estados activo/visitado, conservación del texto, JSON plegado y
secuencias por niveles para los cuatro ejemplos. Las comprobaciones en Chrome
incluyen audio con Web Audio, profundidades observadas **0,1,2,3,3**, final de
las cinco visitas, exclusión A/B, seis visitas de B, zoom, teclado, entradas
JSON/SQL/álgebra, reglas/deshacer, errores y vista de 390 px sin desbordamiento.

Evidencias reales de la compilación de producción:

- [Informe de navegador](evidencias/verificacion-navegador-preview-subruta.json).
- [Árbol mientras suena](evidencias/arbol-escuchando-preview-subruta.png).
- [Comparación mientras suena B](evidencias/comparacion-visual-preview-subruta.png).
- [Árbol en móvil](evidencias/arbol-movil-preview-subruta.png).

## Publicación comprobada

El cambio `46edbb147d1d7fc135e0ee9948c8c48198a1b35c` fue publicado mediante
[GitHub Actions, ejecución 44352577418](https://github.com/TheBofoBM/arboles-y-sonido/actions/runs/44352577418).
Instalación, pruebas, compilación y despliegue concluyeron con `success`.

Se ejecutó también, contra el sitio público:

```text
node scripts/verificar-publicacion.mjs <playwright/index.mjs> <chrome.exe> https://thebofobm.github.io/arboles-y-sonido/
```

Resultado del 18 de noviembre a las 16:55:10 UTC: HTTP 200, las diez
comprobaciones de interfaz aprobadas, cuatro WAV solicitados correctamente y
ningún error de página, consola ni recursos. El informe registra los cinco
IDs iluminados con profundidades 0,1,2,3,3. No quedaron servidores escuchando
en los puertos locales 4183 y 5183.

- [Informe del sitio público](evidencias/verificacion-github-pages.json).
- [Captura durante la escucha](evidencias/arbol-escuchando-github-pages.png).
- [Comparación A/B publicada](evidencias/comparacion-visual-github-pages.png).
- [Árbol publicado en móvil](evidencias/arbol-movil-github-pages.png).

## Límites y revisión manual

El árbol sigue siendo lógico: no se ejecuta SQL, no se muestran filas de una
base de datos ni se producen planes físicos o costos. La equivalencia conserva
su alcance acotado. Los sampleos representan operadores y orden de visita;
un sonido parecido no prueba equivalencia.

Las comprobaciones automáticas confirman carga, programación, final del audio y
resaltado; no evalúan subjetivamente la calidad musical. Para esa revisión,
abrir el sitio con altavoces o audífonos, pulsar **Escuchar** y comprobar de oído
las transiciones. Tomar una captura durante la reproducción con un nodo
iluminado y, para comparación, otra con ambos árboles visibles. Se puede
repetir en Edge o en un teléfono real; esa revisión manual no se ha registrado
como ejecutada en este documento.

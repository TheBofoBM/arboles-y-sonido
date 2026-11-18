# Verificación de álgebra, heurísticas, sampleos y comparación A/B

Fecha de la ampliación: 18 de noviembre de 2026, America/Mexico_City.
Solo se registran comprobaciones realmente ejecutadas. Los JSON de navegador
guardan la hora UTC.

## Pruebas y compilación

Comando final ejecutado: `npm run check` (ejecuta `npm test` y `npm run build`).

- **11 archivos de pruebas y 333 pruebas aprobadas**, código de salida 0.
- Compilación Vite 8.3.5 correcta, **54 módulos transformados**, código 0.
- La compilación incluye cinco WAV de 72 044 bytes cada uno, el lector de
  fórmulas y el panel de comparación. No se añadió ninguna dependencia npm.
- `npm ls --depth=0` devolvió las cinco dependencias directas instaladas sin
  errores: Vue 3.5.44, pgsql-ast-parser 12.0.2, Vite 8.3.5,
  @vitejs/plugin-vue 6.0.10 y Vitest 5.0.5.

Se conservaron los ocho archivos anteriores y se añadieron tres suites:

| Archivo | Comprobaciones |
| --- | --- |
| `src/tests/algebraHeuristics.test.js` | Fórmulas válidas e inválidas, Unicode, límites, conservación de predicados, pasos sin mutar el original, IDs únicos, precondiciones y equivalencia acotada. Incluye un intérprete independiente de fixtures para contrastar filas con duplicados, NULL y relaciones vacías; también literales grandes para evitar firmas equivocadas por redondeo. |
| `src/tests/sampleos.test.js` | Cobertura de todos los operadores y recorridos, de una relación a 2000 nodos, igualdad de motivos y tiempos del par de referencia, lectura de los PCM reales, duración, energía, extremos, picos y margen de mezcla. Verifica caché, errores, programación temporal, finalización, cancelación y exclusión entre reproductores con una interfaz de audio simulada. |
| `src/tests/comparisonUI.test.js` | Entradas A/B independientes, transferencia de árboles, errores, retirada de resultados obsoletos y renderizado SSR con identificadores DOM únicos. |

Los cambios en las pruebas anteriores actualizan los textos del botón SQL y
del pie de página para reflejar la nueva interfaz.

## Verificación en navegador real

Se ejecutó `scripts/verificar-prototipo.mjs` con Playwright del runtime de
trabajo y Chrome instalado, en modo headless. No se añadió Playwright a las
dependencias del proyecto ni se controló una sesión personal del navegador.

Forma de los comandos ejecutados:

```text
node scripts/verificar-prototipo.mjs <playwright/index.mjs del runtime> <chrome.exe instalado>
node scripts/verificar-prototipo.mjs <playwright/index.mjs del runtime> <chrome.exe instalado> preview
```

El primer comando inicia Vite en 127.0.0.1:5183; el segundo inicia la vista de
producción en 127.0.0.1:4183. Ambos verifican los siguientes casos:

1. Generación JSON existente con tres nodos.
2. Consulta SQL de biblioteca: tres transformaciones, seis nodos, deshacer y
   volver a aplicar el siguiente paso.
3. Transferencia del original y el transformado al panel A/B como JSON.
4. Par independiente SQL/álgebra: cinco y seis nodos; equivalencia reconocida
   por las reglas; referencias con seis nodos en ambos lados.
5. Decodificación y reproducción de WAV con Web Audio de Chrome; resaltado del
   nodo en curso; comenzar B detiene A; B termina después de su última fuente.
6. Generación desde álgebra y rechazo de `PI[*](Libro)`, retirando la salida
   anterior.
7. Editar A invalida el resultado de comparación y conserva el texto de B.
8. Vista de 390 px sin desbordamiento horizontal.

Registros de las ejecuciones satisfactorias:

- [Desarrollo](evidencias/verificacion-navegador-dev.json).
- [Producción](evidencias/verificacion-navegador-preview.json).

Ambos registros contienen `errors: []` y `puertoCerrado: true`. El script cierra
el navegador aislado, termina su servidor de prueba y comprueba que el puerto
dejó de responder. No se deja un servidor de verificación ejecutándose.

Capturas reales de producción:

- [Comparación y reproductores](evidencias/comparacion-vista-preview.png).
- [Página completa](evidencias/comparacion-sampleos-preview.png).
- [Vista móvil](evidencias/comparacion-movil-preview.png).

Se inspeccionaron visualmente la comparación de escritorio y la vista móvil.
Las capturas no son diseños simulados ni imágenes generadas.

## Incidencias corregidas durante el trabajo

- Una prueba de IDs DOM contaba también el sufijo `id` de `data-node-id`.
  Se corrigió el selector de la prueba; los IDs DOM reales eran únicos.
- Chrome solicitaba un favicon inexistente y registraba 404. Se añadió un
  favicon SVG local y su enlace HTML; las ejecuciones posteriores no reportaron
  errores de recursos.
- Una prueba nueva pretendía introducir todos los literales extremos mediante
  el parser de álgebra, aunque algunos quedan fuera del subconjunto del parser.
  Se corrigió para probar predicados textuales JSON opacos, que el modelo sí
  admite. La firma conserva la escritura literal y no utiliza el valor Number
  del parser para comparar números grandes.

## Alcance de la evidencia

La interfaz de audio simulada permite probar cancelación y fallos; la sesión
de Chrome añade evidencia de decodificación y finalización con Web Audio real.
No se realizó una evaluación perceptual con personas ni una medición acústica
de altavoces o auriculares. No se afirma que la calidad musical esté validada
para todos los oyentes, navegadores o dispositivos.

Los fixtures contrastan las reglas con datos de prueba, sin conectar la
aplicación a un gestor de bases de datos. No son planes físicos ni medidas de
rendimiento SQL. La comparación no demuestra equivalencia SQL general.

## Comprobación manual sugerida

Ejecutar `npm run dev`, abrir la dirección indicada por Vite, elegir
**Comparar A / B**, generar el par de biblioteca y escuchar A y B, primero
originales y después con referencias heurísticas. Probar preorden y postorden,
detener a mitad del recorrido y cambiar de pestaña durante la reproducción.

Valorar si se distinguen las estructuras y si las referencias suenan similares.
Tomar una captura de la comparación con los dos árboles y sus controles; para
el seguimiento del recorrido, capturar un nodo resaltado durante el audio.
Estas valoraciones y capturas manuales sugeridas no se presentan como ya realizadas.

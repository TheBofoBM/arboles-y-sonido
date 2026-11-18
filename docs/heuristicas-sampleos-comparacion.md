# Heurísticas, sampleos y comparación de dos árboles

Implementación inicial del enfoque solicitado el 18 de noviembre de 2026.
Se conserva el modelo canónico `{version: 1, raiz}` y los cinco campos del nodo.
Las modalidades JSON y SQL existentes siguen disponibles. La copia histórica
de entrega 2.3 conserva su corte anterior; este cambio se aplica al proyecto
de trabajo.

## Uso

Ejecutar `npm ci` si faltan dependencias y `npm run dev`.

1. Escuchar el ejemplo inicial o editar una entrada JSON, SQL o de álgebra y generar el árbol.
2. Aplicar una regla o las reglas disponibles. Deshacer permite volver al paso
   anterior; el historial conserva los árboles antes y después de cada regla.
3. Escuchar el árbol por niveles: raíz primero, luego cada fila de izquierda a
   derecha. El nodo activo toma el color intenso de su operador; los visitados
   conservan su borde. **Cambiar recorrido** permite elegir preorden o postorden.
   Detener cancela la secuencia.
4. Pulsar **Comparar original y actual** para llevar ambos árboles a A/B.
5. En **Comparar A / B** se pueden introducir dos entradas independientes y
   mezclar SQL, álgebra o JSON. El par de biblioteca está precargado.
6. Escuchar los originales o activar **Ver árboles transformados**.
   Esa opción transforma ambos con las mismas reglas antes de reproducirlos.

Las entradas editadas invalidan sus resultados anteriores. Solo hay una
reproducción activa: iniciar B detiene A. Cambiar de árbol, recorrido o pestaña
detiene el audio. No se reproduce automáticamente al cargar la página.

## Entrada de álgebra relacional

Gramática prefija, con identificadores simples y parámetros entre corchetes:

```text
expresión := relación [AS alias]
           | PI[columnas](expresión)
           | PI_DISTINCT[columnas](expresión)
           | PI_ALL[columnas](expresión)
           | SIGMA[predicado](expresión)
           | JOIN[condición](expresión, expresión)
```

Se admiten π, σ y ⋈ como alternativas a PI, SIGMA y JOIN, también con
corchetes. PI y PI_DISTINCT usan `distinct: true`; PI_ALL usa `false`.
Los predicados admiten comparaciones `= != <> < <= > >=` y AND, entre columnas
y literales de texto o número. Las columnas deben calificarse cuando hay más
de una relación; los alias deben ser únicos. No se valida un catálogo de
columnas de una base de datos. Se rechazan funciones, OR, agregaciones,
subconsultas, notación infija y otras construcciones fuera de esta gramática.
Límites: 20 000 caracteres, 64 niveles sintácticos, 2000 nodos y 64 columnas por
proyección; después se aplican los límites comunes del cargador de árboles.

```text
PI[L.titulo, A.nombre](
  SIGMA[L.anio > 2020 AND A.pais = 'México'](
    JOIN[L.id_autor = A.id_autor](Libro AS L, Autor AS A)
  )
)
```

`expresarArbol` genera una fórmula de presentación. Para la proyección
extendida que ya admite JSON utiliza PI_EXT como descripción textual; PI_EXT
no es una entrada soportada por este parser. Los parámetros canónicos se
conservan en el árbol y su JSON. No se usa eval ni Function.

## Reglas implementadas

| Regla | Precondiciones y efecto |
| --- | --- |
| DESCOMPONER_AND | Una selección con AND de comparaciones puras se convierte en selecciones consecutivas. Se conservan los fragmentos de cada comparación. |
| BAJAR_SELECCION_JOIN | La selección inmediatamente sobre un INNER JOIN tiene columnas calificadas que pertenecen únicamente a una entrada, con calificadores globalmente únicos. La condición del JOIN también pertenece al subconjunto puro. El filtro se mueve a esa entrada. |

Los predicados se comprueban con el parser existente. No se separa la palabra
AND dentro de una cadena literal. Los casos opacos (funciones, identificadores
entre comillas, calificadores ambiguos) quedan sin transformar. Las reglas
no atraviesan proyecciones ni cambian el orden de los JOIN. No se implementa
búsqueda exhaustiva de todos los árboles equivalentes ni optimización física.

Cada paso copia y valida el árbol; mantiene IDs existentes y crea IDs únicos
para nuevas selecciones. El historial está fuera del documento canónico. La
aplicación automática se detiene al no haber reglas comprobables, alcanzar los
límites del modelo o llegar a 128 pasos. La API permite entre 1 y 512 pasos.
Si una referencia queda parcial, la interfaz lo indica.

Para biblioteca se obtienen tres pasos: separar AND, bajar el filtro de Autor y
bajar el de Libro. El original tiene cinco nodos y el transformado seis, con
profundidad máxima tres en ambos. Un cambio en cantidad de nodos no constituye
por sí mismo una mejora de ejecución.

## Comparación A/B y equivalencia acotada

El módulo conserva cantidades, profundidad, operadores, parámetros y recorridos;
la interfaz prioriza los dos diagramas y sus controles de escucha, sin tablas de
métricas. Los detalles de equivalencia y el JSON se consultan al desplegarlos.
La firma lógica ignora IDs y etiquetas; conserva relaciones, alias, orden de
columnas, DISTINCT, condiciones y orden de las entradas del JOIN. Las cadenas
de selecciones puras se comparan como conjunciones ordenadas por firma.

Resultados posibles:

- **Misma expresión:** coinciden las firmas conservadoras originales.
- **Equivalencia por reglas:** coinciden las firmas después de aplicar las
  reglas soportadas a ambos árboles y ambos procesos llegaron a su término.
- **No demostrada:** el módulo no establece equivalencia. No significa que
  las consultas sean inequivalentes; por ejemplo, puede no reconocer cambios
  de alias o reordenamientos de JOIN equivalentes.

El módulo no es un demostrador general de equivalencia SQL. Mantiene la
distinción de multiplicidades: DISTINCT omitido en JSON conserva la convención
de conjuntos del modelo previo, y `false` representa proyección sin eliminar
duplicados. Los tests incluyen fixtures con duplicados, NULL y entradas vacías.
El intérprete de esos fixtures existe solo en las pruebas, no en la aplicación.

## Banco de sampleos

Se distribuyen cinco fragmentos WAV melódicos, uno por operador, derivados de
una grabación real de piano de **Alexander Holm, Salamander Grand Piano**,
con licencia **CC BY 3.0**. Véanse la
[atribución y adaptación](../src/assets/samples/ATRIBUCION.md), la grabación
original y las huellas en `src/assets/samples/manifest.json`.

Los fragmentos están montados previamente con cuatro notas en Do pentatónica,
ataques cada 0.25 s, duración de 1.5 s y pico máximo 0.65. Se reproducen mediante
AudioBufferSourceNode; no se generan tonos con osciladores. No se instala una
biblioteca de audio ni se descargan muestras externas durante la reproducción.
`scripts/preparar-sampleos.mjs` es una herramienta opcional de autoría y utiliza
Playwright externo y Chrome para decodificar la fuente, no para sintetizarla.

Cada visita inicia un fragmento, separado del siguiente por un segundo. La
secuencia incluye la cola completa de la última muestra: N visitas duran
N + 0.5 segundos. La programación usa el reloj de AudioContext; el intervalo
de la interfaz actualiza únicamente el resaltado. El volumen se limita a 0.45
(0.35 por defecto); con hasta dos fragmentos simultáneos, el límite de picos
del banco deja margen bajo 1. Los tests inspeccionan los PCM reales, su energía,
extremos, duración y el margen de mezcla.

El plan cubre todos los nodos del árbol admitido, sin truncarlo; se prueba desde
una relación hasta 2000 nodos. Los recorridos grandes pueden durar muchos
minutos: la interfaz dispone de Detener. El reproductor maneja errores de carga
o falta de Web Audio con un mensaje y permite volver a intentar.

El mapeo inicial representa tipo de operador y orden de visita. **No codifica
todavía los valores de predicados ni todos los atributos.** Dos consultas
distintas pueden producir la misma secuencia de muestras. Por eso el parecido
sonoro no se utiliza para decidir equivalencia. Las referencias del par de
biblioteca usan los mismos motivos y tiempos; la calidad y semejanza percibidas
siguen requiriendo evaluación con oyentes.

## Archivos principales

| Archivo | Responsabilidad |
| --- | --- |
| `src/modules/tree/algebra.js` | Parser de fórmulas y presentación textual. |
| `src/modules/validation/predicates.js` | Reconocimiento conservador de comparaciones puras. |
| `src/modules/tree/heuristics.js` | Pasos heurísticos e historial antes/después. |
| `src/modules/comparison/compareTrees.js` | Firma, métricas y equivalencia acotada. |
| `src/modules/sonification/samplePlan.js` | Banco y programación del recorrido. |
| `src/services/samplePlayer.js` | Carga local, caché, reproducción, exclusión A/B y cancelación. |
| `src/components/trees/TreeWorkbench.vue` | Transformar, deshacer y comparar versiones. |
| `src/modules/tree/treeLayout.js` | Distribución del diagrama, colores y descripciones. |
| `src/components/trees/TreeDiagram.vue` | Diagrama SVG, resaltado, zoom y selección. |
| `src/components/comparison/TreeComparison.vue` | Entradas independientes y resultados A/B. |
| `src/components/audio/SamplePlayer.vue` | Controles de reproducción y atribución. |

## Verificación

Las verificaciones de esta ampliación se registran en
[verificación de la ampliación](verificacion-ampliacion-2026-11-18.md).
Las instrucciones manuales y limitaciones están en ese registro.
La revisión visual posterior está registrada en
[interfaz visual y recorrido](interfaz-visual-recorrido-2026-11-18.md).

Fuentes técnicas: [semántica de INNER JOIN y WHERE, PostgreSQL](https://www.postgresql.org/docs/18/queries-table-expressions.html),
[AudioBufferSourceNode, MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode),
[AudioContext.resume, MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume),
[autor y licencia de Salamander](https://github.com/Tonejs/audio/blob/master/salamander/README).

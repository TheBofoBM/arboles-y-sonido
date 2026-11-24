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
3. Escuchar el árbol en postorden: relaciones primero, después sus operadores,
   hasta llegar a la raíz. El nodo activo toma el color intenso de su operador;
   los visitados conservan su borde. **Cambiar recorrido** permite elegir
   preorden o niveles. **Editar sonido** ajusta el registro y la base musical.
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

## Banco de sampleos y profundidad

El banco activo **Aventura orbital** contiene cinco motivos originales con
cuerdas, flauta, trompa y campanas, y un acompañamiento en 6/8. Usa grabaciones
de VSCO 2 CE y VCSL (CC0 1.0). La atribución, las licencias, las fuentes y el
manifiesto están en src/assets/samples/aventura/. El banco anterior de piano
y la propuesta de bloques musicales se conservan como antecedentes; no se
reproducen en la aplicación.

Cada operador conserva un motivo y un ritmo propios. Hay once variantes
preparadas, cuya referencia sigue la pentatónica G3, A3, B3, D4, E4, G4, A4,
B4, D5, E5, G5. Todas duran 2 s; los inicios están separados 1.5 s. La
sonificación completa dura (N − 1) × 1.5 + 2 segundos, sin cortar el último
motivo. El registro se prepara nota por nota, sin cambiar la velocidad global
ni la duración de los fragmentos.

El registro es max(0, registroRaiz − profundidad × pasoNivel), con profundidad
absoluta desde la raíz (0). Los valores predeterminados son registroRaiz=10
(G5) y pasoNivel=1. Un JOIN en profundidad 2 usa D5; si una regla lo mueve a
profundidad 1 usa E5, con el mismo motivo. La regla no se normaliza respecto a
la profundidad máxima de cada árbol. A y B comparten los ajustes. Al alcanzar
el mínimo G3, los niveles más profundos conservan ese registro: no se afirma
que el audio permita distinguir profundidades ilimitadas.

El usuario puede elegir raíz G3, G4 o G5; descenso de cero, uno o dos pasos de
escala o una octava por nivel; y volumen de base entre 0 y 0.4. Los ajustes se
mantienen durante la sesión, sin persistir al recargar. Cambiarlos detiene la
reproducción. La base es un bucle común de 6 s, con entrada y salida suaves,
independiente del orden de los operadores y sin transposición por nodo.

Los picos son 0.6 para motivos y 0.5 para la base. Con dos motivos solapados,
base al máximo y salida limitada a 0.45, la cota es
(2 × 0.6 + 0.4 × 0.5) × 0.45 = 0.63. Los tests inspeccionan los WAV reales:
PCM, duraciones, energía, picos y extremos. El reloj de AudioContext programa
los sonidos y el temporizador solo actualiza los nodos iluminados. Detener,
cambiar de árbol o iniciar B cancela también la base de A.

Se cubren todos los nodos admitidos, desde una relación hasta 2000 nodos.
Los predicados y atributos no están codificados íntegramente en el sonido;
la semejanza sonora no demuestra equivalencia. La calidad y el interés musical
requieren evaluación auditiva. La demo biblioteca-postorden.wav se encuentra
en docs/audio-propuestas/aventura-orbital/.

## SQL de referencia editable

El panel SQL de referencia traduce el árbol actual, incluido el resultado de
las reglas. PI se representa con SELECT DISTINCT; PI_ALL con SELECT sin
DISTINCT. Las relaciones sin proyección explícita se muestran con SELECT *;
para regenerarlas con el lector SQL se deben indicar columnas explícitas.

La traducción admite el subconjunto de álgebra de identificadores simples,
INNER JOIN y comparaciones unidas por AND. Puede reunir las selecciones en
WHERE y reagrupar INNER JOIN en una cadena, conservando sus condiciones; no
pretende preservar el orden de ejecución ni ser un plan físico. Cuando una
entrada aún no tiene una condición aplicable se usa ON 1 = 1 y se conserva
su condición en el JOIN posterior que ya dispone de sus referencias.

Las proyecciones intermedias y extendidas no se traducen: se muestra un aviso
en lugar de omitirlas y cambiar el significado. Tampoco se traducen nombres
citados ni predicados opacos fuera del subconjunto de álgebra. El resultado
se analiza sintácticamente antes de presentarlo.

El texto SQL se puede editar y aplicar al árbol mediante el lector existente.
El cambio reinicia el historial heurístico del árbol actual; el original sigue
disponible para comparar. Editar una consulta no ejecuta SQL contra un gestor.

## Archivos principales

| Archivo | Responsabilidad |
| --- | --- |
| `src/modules/tree/algebra.js` | Parser de fórmulas y presentación textual. |
| `src/modules/validation/predicates.js` | Reconocimiento conservador de comparaciones puras. |
| `src/modules/tree/heuristics.js` | Pasos heurísticos e historial antes/después. |
| `src/modules/comparison/compareTrees.js` | Firma, métricas y equivalencia acotada. |
| `src/modules/sonification/samplePlan.js` | Banco y programación del recorrido. |
| `src/modules/sonification/music.js` | Motivos, escala, duraciones y configuración sonora. |
| `src/modules/sql/treeToSql.js` | Traducción conservadora del árbol a SQL de referencia. |
| `src/components/sql/SqlReference.vue` | Edición del SQL y actualización del árbol. |
| `src/services/samplePlayer.js` | Carga local, caché, reproducción, exclusión A/B y cancelación. |
| `src/components/trees/TreeWorkbench.vue` | Transformar, deshacer y comparar versiones. |
| `src/modules/tree/treeLayout.js` | Distribución del diagrama, colores y descripciones. |
| `src/components/trees/TreeDiagram.vue` | Diagrama SVG, resaltado, zoom y selección. |
| `src/components/comparison/TreeComparison.vue` | Entradas independientes y resultados A/B. |
| `src/components/audio/SamplePlayer.vue` | Controles de reproducción y atribución. |

## Verificación

Actualización del 19 de noviembre de 2026: `npm run check` aprobó **350 pruebas
en 13 archivos** y compiló la aplicación. La vista previa de producción se
comprobó en Chrome, con trece verificaciones de interfaz, sin errores de consola
ni solicitudes fallidas. Se verificaron postorden, registro editable, SQL
editable, transformaciones, cancelación A/B y vista móvil de 390 px. El informe
está en `evidencias/verificacion-navegador-preview.json`; las capturas son
`arbol-escuchando-preview.png`, `arbol-movil-preview.png` y
`comparacion-visual-preview.png`. El servidor temporal terminó al completar
las verificaciones. Los WAV se comprobaron mediante sus datos PCM reales.

Los registros siguientes corresponden a versiones anteriores:

Las verificaciones de esta ampliación se registran en
[verificación de la ampliación](verificacion-ampliacion-2026-11-18.md).
Las instrucciones manuales y limitaciones están en ese registro.
La revisión visual posterior está registrada en
[interfaz visual y recorrido](interfaz-visual-recorrido-2026-11-18.md).

Fuentes técnicas: [semántica de INNER JOIN y WHERE, PostgreSQL](https://www.postgresql.org/docs/18/queries-table-expressions.html),
[AudioBufferSourceNode, MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode),
[AudioContext.resume, MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume),
[fuentes y licencia de VSCO 2 CE](https://github.com/sgossner/VSCO-2-CE),
[fuentes y licencia de VCSL](https://github.com/sgossner/VCSL).

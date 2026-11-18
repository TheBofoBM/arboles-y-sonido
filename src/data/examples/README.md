# Ejemplos del modelo de árboles

**Estado: contrastados con el capítulo 2 proporcionado por el usuario.**
Fuente: `Capitulo2_AdolfoBellidoMora-firmado.pdf`, sección 2.1.1. Se comprobaron
el texto y las tablas y figuras mediante extracción y revisión de páginas
renderizadas. El documento original no se modificó ni se incorporó al proyecto.

SHA-256 del archivo consultado:
`F34C9310A0833903D2D60A8C8915F9A7767642B6E607FF2D98F12C4F8C790772`.

## Relaciones de referencia

- `Libro(id_libro, titulo, anio, id_autor)`: tabla 2.2.
- `Autor(id_autor, nombre, pais)`: tabla 2.1.
- Correspondencia del JOIN interno: `Libro.id_autor = Autor.id_autor`.

Las dos tablas están en la página impresa 2 (página 4 del PDF, contando desde 1).
Los JSON representan planes lógicos: no incluyen las filas de esas tablas ni
una definición de esquema, y no ejecutan consultas.

## Consulta completa y árboles A y B

La consulta del capítulo solicita títulos y nombres de autores para libros
posteriores a 2020 y autores de México. Se representa con estos parámetros:

- Proyección: `["Libro.titulo", "Autor.nombre"]`.
- Selección conjunta: `Libro.anio > 2020 AND Autor.pais = 'México'`.
- JOIN: `Libro.id_autor = Autor.id_autor`.

El capítulo usa las abreviaturas `L` y `A`. En los JSON se sustituyen por los
nombres completos `Libro` y `Autor`, manteniendo los JSON de referencia originales.
La entrada SQL posterior conserva alias mediante el parámetro opcional `alias`.
En el árbol B, los filtros conservan la identificación de la relación de
origen, sin introducir los nombres intermedios `L_f` y `A_f` de la figura 2.2.
`AND` es una escritura textual del conector lógico; no implica un analizador SQL.
Los `id` y las etiquetas de los nodos son convenciones propias del prototipo.

El árbol A aplica una selección conjunta después del JOIN; el árbol B aplica
una selección por entrada antes del JOIN. Ambos conservan la proyección final
y Libro en la rama izquierda, Autor en la derecha.

| Archivo | Contenido |
| --- | --- |
| `libro.json` | Árbol mínimo con la relación Libro. |
| `autor.json` | Árbol mínimo con la relación Autor. |
| `seleccion-proyeccion-libro.json` | Proyección de `Libro.titulo` tras filtrar `Libro.anio > 2020`; ejemplo de composición de las páginas impresas 2 y 3. |
| `libro-autor.json` | Árbol A de la figura 2.3, con 5 nodos: JOIN, selección conjunta y proyección. |
| `libro-autor-entradas-filtradas.json` | Árbol B de la figura 2.3, con 6 nodos: dos selecciones, JOIN y proyección. |
| `ventas.json` | Lista de referencias del árbol inicial de ventas de la figura 2.4: cuatro relaciones, tres JOIN, selección y proyección extendida; 9 nodos. |
| `biblioteca.sql` | Consulta SELECT DISTINCT proporcionada por el usuario; el adaptador SQL conserva L y A, columnas y predicados. |

Referencias exactas de la consulta y los árboles:

| Contenido del capítulo | Página impresa | Página del PDF |
| --- | --- | --- |
| Consulta completa y tabla 2.7 | 6 | 8 |
| Figuras 2.1 y 2.2 | 7 | 9 |
| Figura 2.3 y explicación de los recorridos | 8 | 10 |

## Alcance de las comprobaciones

Los archivos `.json` son documentos completos de versión 1 y se validan mediante las
pruebas automatizadas. Ventas se procesa con `treeLoader.js`, que normaliza las
referencias al formato anidado. Los identificadores deben ser únicos dentro de cada
árbol; pueden repetirse entre archivos independientes.

La fila `biblioteca.sql` corresponde a texto SQL, no a otro formato JSON.
Su árbol generado sigue siendo un documento canónico de versión 1 y se prueba
también su reimportación por el lector JSON.

`chapter2Examples.test.js` comprueba filtros, proyección, condición de JOIN,
estructura, cantidad de nodos y postorden de A y B. Esas pruebas contrastan el
modelo con el capítulo; no ejecutan el álgebra ni demuestran equivalencia.

El capítulo explica que ambas alternativas producen el mismo resultado bajo
las condiciones de ese ejemplo con JOIN interno. El prototipo todavía no
calcula equivalencia ni compara costos. Tampoco implementa la eliminación de
duplicados de la proyección clásica o el `DISTINCT` de la consulta SQL.

## Caso de ventas

`ventas.json` conserva N1–N9 de la figura 2.4, página impresa 11 (página 13 del
PDF). Cliente, Pedido, Detalle y Producto se combinan, en ese orden, mediante
tres JOIN internos. La selección conserva ciudad Xalapa, estado Pagado y fechas
desde `2026-10-01` inclusive hasta `2026-11-01` exclusive, como en la consulta de
la página impresa 10. Las relaciones se presentan en las tablas 2.8 a 2.11,
páginas impresas 9 y 10.

Se sustituyen los alias C, P, D y R por los nombres completos. La raíz conserva
`PROYECCION_EXTENDIDA` y sus expresiones textuales, incluido el subtotal; no se
convierte en proyección clásica ni se ejecuta el cálculo. No se incorporan las
cantidades de filas de la figura, costos o algoritmos físicos.

`treeExamples.js` reúne los cuatro casos disponibles en el selector de la
interfaz. Los ejemplos simples de Libro y Autor siguen disponibles como JSON
independientes. Prestamo y los demás operadores del capítulo quedan fuera de
esta implementación.

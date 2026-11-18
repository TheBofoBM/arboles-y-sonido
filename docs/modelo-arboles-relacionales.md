# Modelo interno de árboles lógicos de consultas relacionales

## Alcance

La versión 1 representa un árbol lógico ordenado, sin ejecutar la consulta.
Admite `RELACION`, `SELECCION`, `PROYECCION`, `PROYECCION_EXTENDIDA` y `JOIN`. El modelo es JavaScript
independiente de Vue y del DOM. Se puede construir mediante funciones o cargar
desde JSON y validar antes de utilizarlo.

El núcleo del modelo no analiza SQL directamente. Un adaptador separado traduce
el subconjunto documentado en [sql-a-arbol-logico.md](sql-a-arbol-logico.md).
No incluye generación de sonidos, caracterización sonora ni optimización de
consultas. La interfaz muestra la estructura y sus metadatos.
La carga funcional se documenta en
[lectura-construccion-arboles.md](lectura-construccion-arboles.md).

## Representación JSON

Cada documento canónico anidado tiene exactamente dos campos: `version`, con el número `1`, y
`raiz`, con un único nodo. No se admiten listas de raíces ni árboles vacíos.

```json
{
  "version": 1,
  "raiz": {
    "id": "libro",
    "tipo": "RELACION",
    "etiqueta": "Libro",
    "parametros": { "nombre": "Libro" },
    "hijos": []
  }
}
```

Todos los nodos tienen los siguientes cinco campos. El JSON debe incluirlos
explícitamente; los valores por defecto se aplican solo mediante `crearNodo`.

| Campo | Contrato |
| --- | --- |
| `id` | Texto no vacío; único dentro del árbol y comparado de forma exacta, con distinción de mayúsculas. |
| `tipo` | Uno de los cinco nombres de operador, en mayúsculas. |
| `etiqueta` | Texto no vacío que podrá mostrarse en la interfaz. No se interpreta como una expresión. |
| `parametros` | Objeto con el parámetro específico del operador. |
| `hijos` | Arreglo de nodos de entrada, ordenado de izquierda a derecha. |

Se rechazan campos no admitidos tanto en el documento como en los nodos y los
parámetros. Esto permite detectar errores de escritura y evita almacenar estado
de presentación o metadatos derivados en el modelo. Los textos compuestos solo
por espacios son inválidos; los textos aceptados se conservan sin modificarlos.

### Operadores y aridad

| Tipo | Hijos exactos | `parametros` | Interpretación lógica |
| --- | --- | --- | --- |
| `RELACION` | 0 | `{ "nombre": "Libro" }` | Relación de entrada, una hoja del árbol. |
| `SELECCION` | 1 | `{ "predicado": "Libro.anio > 2020" }` | Restricción de las tuplas de su única entrada. |
| `PROYECCION` | 1 | `{ "atributos": ["Libro.titulo"] }` | Selección de atributos de su única entrada. |
| `PROYECCION_EXTENDIDA` | 1 | `{ "expresiones": ["Detalle.cantidad * Detalle.precio_unitario AS subtotal"] }` | Conservación de expresiones como texto, sin evaluarlas. |
| `JOIN` | 2 | `{ "condicion": "Libro.id_autor = Autor.id_autor" }` | JOIN interno lógico con condición entre sus entradas. |

`nombre`, `predicado` y `condicion` son textos no vacíos. `atributos` debe ser un
arreglo no vacío de textos no vacíos, sin duplicados exactos; conserva su orden.
`expresiones` tiene el mismo contrato de lista, pero representa la proyección
extendida del caso de ventas. No debe confundirse con atributos simples.

Dos parámetros opcionales permiten conservar la información de la entrada SQL
sin cambiar los cinco campos del nodo ni invalidar ejemplos anteriores:

- `RELACION.parametros.alias`: texto no vacío, si se proporciona.
- `PROYECCION.parametros.distinct`: booleano, si se proporciona. `true` solicita
  eliminación de duplicados sobre la tupla proyectada completa; `false` expresa
  proyección SQL sin eliminación solicitada. Si se omite en un JSON anterior,
  permanece la convención de proyección clásica sobre conjuntos. No se ejecuta
  ninguna de estas operaciones sobre filas.

El adaptador SQL siempre incluye `distinct`, conserva los nombres y alias
originales y mantiene los predicados como texto. Los validadores JSON comprueban
los tipos de estos parámetros, sin resolver referencias a un catálogo.

Los atributos y predicados de la tabla corresponden a los ejemplos del capítulo
2 proporcionado por el usuario. Se utilizan nombres completos de relación en
lugar de las abreviaturas `L` y `A` del capítulo.

### Izquierda, derecha y dirección de procesamiento

- En un `JOIN`, `hijos[0]` es la entrada izquierda y `hijos[1]` la derecha.
- En selección y proyección, `hijos[0]` es la entrada única; no se le asigna
  izquierda o derecha.
- Una relación no tiene entradas.

La raíz representa el resultado de la consulta y las hojas sus relaciones de
entrada. El preorden permite inspeccionar el plan desde la raíz; el postorden
visita las entradas antes de su operación. Ningún recorrido evalúa la consulta.

## Integridad del árbol

Los validadores recorren todo el subárbol y comprueban:

1. Forma del documento, versión admitida y raíz única.
2. Campos y parámetros requeridos y ausencia de campos desconocidos.
3. Tipo de operador, aridad y validez de cada entrada.
4. Identificadores únicos en todo el árbol, no solo entre hermanos.
5. Ausencia de ciclos o de un mismo objeto usado desde varias entradas.

Los ciclos y subárboles compartidos se rechazan con `REFERENCIA_REPETIDA`. El
modelo representa árboles, no grafos de planes con nodos compartidos. Para usar
dos veces una misma relación se requieren dos nodos distintos con diferentes
identificadores. El nombre de relación puede repetirse y se permite un alias
opcional. El adaptador SQL comprueba el ámbito y la unicidad de los alias; la
validación estructural JSON no sustituye esa resolución ni valida un catálogo.

Los documentos JSON no contienen referencias cíclicas por definición; la
comprobación también protege a los árboles construidos directamente con objetos
JavaScript. Los identificadores pueden repetirse entre árboles independientes.

## API de JavaScript

Las funciones del modelo se importan de `src/modules/tree/tree.js` y los
validadores de `src/modules/validation/treeValidation.js`.

| Función | Resultado y comportamiento |
| --- | --- |
| `crearNodo(datos)` | Valida el nodo y sus descendientes y devuelve una copia independiente. Si faltan `id` o `hijos`, genera un UUID o usa `[]`, respectivamente. Los demás campos son obligatorios. |
| `crearArbol(raiz)` | Valida todo el árbol y devuelve una copia `{ version: 1, raiz }`. |
| `obtenerRaiz(arbol)` | Devuelve la referencia a la raíz después de validar el árbol. |
| `obtenerNodo(arbol, id)` | Busca por identificador exacto; devuelve el nodo o `null` si no existe. |
| `obtenerHijos(nodo)` | Valida el subárbol y devuelve una copia del arreglo de entradas. Los nodos contenidos conservan sus referencias. |
| `obtenerHijoIzquierdo(nodo)` | Devuelve `hijos[0]` de un JOIN válido, o `null` si el operador no es binario. |
| `obtenerHijoDerecho(nodo)` | Devuelve `hijos[1]` de un JOIN válido, o `null` si el operador no es binario. |
| `recorrerArbol(arbol, { orden })` | Devuelve un arreglo de registros con nodo y metadatos. Admite `preorden` (por defecto) y `postorden`, ambos de izquierda a derecha. |
| `validarNodo(nodo)` | Devuelve `{ valido, errores }` para el nodo y todos sus descendientes. |
| `validarDefinicionNodo(nodo)` | Valida solo campos, parámetros y aridad; función compartida por los dos formatos. No sustituye la validación del árbol ni inspecciona el contenido de hijos. |
| `validarArbol(arbol)` | Devuelve `{ valido, errores }` para el documento completo. |

No se admiten operaciones incompletas: para crear un operador unario o binario
sus entradas deben existir y ser válidas. La construcción se realiza desde las
hojas hacia la raíz. Tampoco se proporcionan todavía funciones de edición del
árbol.

Los constructores copian los datos con `structuredClone`; los identificadores
automáticos utilizan `globalThis.crypto.randomUUID()`. Ambos están disponibles
en el Node utilizado por el proyecto y deben estar disponibles en el entorno
donde se invoquen los constructores. No se instaló una biblioteca de UUID.

Los objetos no están congelados. Las consultas y los registros del recorrido
contienen referencias a los nodos, que deben tratarse como solo lectura. Todas
las funciones públicas de consulta y recorrido revalidan su entrada; una
mutación externa que rompa el contrato se rechazará en la siguiente operación.

### Ejemplo de construcción

```javascript
import { crearNodo, crearArbol, recorrerArbol } from './src/modules/tree/tree.js'

const libro = crearNodo({
  tipo: 'RELACION',
  etiqueta: 'Libro',
  parametros: { nombre: 'Libro' },
})

const autor = crearNodo({
  tipo: 'RELACION',
  etiqueta: 'Autor',
  parametros: { nombre: 'Autor' },
})

const join = crearNodo({
  tipo: 'JOIN',
  etiqueta: 'Libro con su autor',
  parametros: { condicion: 'Libro.id_autor = Autor.id_autor' },
  hijos: [libro, autor],
})

const arbol = crearArbol(join)
const registros = recorrerArbol(arbol, { orden: 'postorden' })
const json = JSON.stringify(arbol, null, 2)
```

La condición corresponde al JOIN del ejemplo completo del capítulo 2, con
nombres de relación completos. Los `id` se generan sin intervención del usuario.

### Diagnósticos y excepciones

Los validadores no modifican los datos. Cada diagnóstico contiene un código
estable, una ruta al dato y un mensaje en español:

```json
{
  "valido": false,
  "errores": [
    {
      "codigo": "ARIDAD_INVALIDA",
      "ruta": "$.raiz.hijos",
      "mensaje": "JOIN requiere exactamente 2 hijos; recibió 1."
    }
  ]
}
```

Los constructores y consultas lanzan `ErrorArbol` ante datos inválidos; su
propiedad `errores` conserva esos diagnósticos. Un `id` de búsqueda vacío o no
textual, o un orden de recorrido no soportado, genera `TypeError`.

Otros códigos: `ARBOL_INVALIDO`, `VERSION_NO_SOPORTADA`, `RAIZ_INVALIDA`,
`NODO_INVALIDO`, `CAMPO_DESCONOCIDO`, `ID_INVALIDO`, `ID_DUPLICADO`,
`ETIQUETA_INVALIDA`, `TIPO_NO_SOPORTADO`, `PARAMETROS_INVALIDOS`,
`PARAMETRO_INVALIDO`, `ATRIBUTOS_INVALIDOS`, `EXPRESIONES_INVALIDAS`,
`ALIAS_INVALIDO`, `DISTINCT_INVALIDO`, `HIJOS_INVALIDOS` y
`REFERENCIA_REPETIDA`.

Para importar texto JSON, primero debe ejecutarse `JSON.parse(texto)`; un texto
mal formado genera el `SyntaxError` propio de JavaScript antes de la validación
del modelo. Luego puede usarse `validarArbol(documento)` para mostrar errores o
emplearse el documento directamente en las consultas, que lo revalidarán.

## Profundidad y posición derivadas

Cada registro de `recorrerArbol` contiene:

| Propiedad | Significado |
| --- | --- |
| `nodo` | Referencia al nodo original. |
| `profundidad` | Distancia en aristas a la raíz, empezando en `0`. |
| `posicion` | Índice horizontal dentro del mismo nivel, de izquierda a derecha y empezando en `0`. No es una coordenada en píxeles. |
| `ruta` | Arreglo de índices de hijos desde la raíz; la raíz tiene `[]`. |
| `padreId` | Identificador del padre; `null` en la raíz. |
| `lado` | `izquierdo` o `derecho` para una entrada de JOIN, `unico` para una entrada unaria y `null` en la raíz. |
| `indiceHijo` | Índice en el arreglo del padre, o `null` en la raíz. |

En un JOIN con dos relaciones: la raíz tiene profundidad `0`, posición `0`; las
relaciones tienen profundidad `1` y posiciones `0` y `1`. En árboles asimétricos
se numeran todos los nodos de cada nivel, incluso si tienen padres diferentes.
Las posiciones son iguales en preorden y postorden; no dependen del orden de
emisión de los registros.

No se requieren ni se aceptan `profundidad` o `posicion` dentro del JSON del nodo.
Los metadatos se recalculan y no se insertan en el árbol. Las rutas e índices
pueden cambiar si cambia la estructura; el identificador del nodo es la clave
de identidad persistente.

La validación y los recorridos son iterativos. Las consultas validan el árbol o
subárbol completo y la búsqueda es lineal; no hay índices persistentes ni cachés
que puedan quedar desactualizados. Los registros contienen rutas, por lo que
su almacenamiento también depende de la profundidad de los nodos.

## Ejemplos y procedencia

Los archivos de `src/data/examples/` incluyen relaciones individuales y
combinaciones de los operadores admitidos. Su procedencia y correspondencia se explican
en [README de los ejemplos](../src/data/examples/README.md).

La fuente es `Capitulo2_AdolfoBellidoMora-firmado.pdf`, sección 2.1.1. Las tablas
2.1 y 2.2 (página impresa 2, página 4 del PDF) definen
`Autor(id_autor, nombre, pais)` y `Libro(id_libro, titulo, anio, id_autor)`.
Los ejemplos reemplazan los supuestos provisionales utilizados antes de recibir
el documento.

La consulta completa filtra `Libro.anio > 2020` y `Autor.pais = 'México'`, reúne
por `id_autor` y proyecta `Libro.titulo` y `Autor.nombre`. Las figuras 2.1, 2.2 y
2.3 (páginas impresas 7 y 8, páginas 9 y 10 del PDF) se representan en:

- `libro-autor.json`: árbol A con 5 nodos y una selección conjunta sobre el JOIN.
- `libro-autor-entradas-filtradas.json`: árbol B con 6 nodos, con selección por año
  en la entrada Libro y por país en la entrada Autor, antes del JOIN.

Los nombres `L`, `A`, `L_f` y `A_f` del capítulo se expresan mediante sus
relaciones de origen en los parámetros de esos JSON de referencia, que conservan
su forma anterior. La entrada SQL adicional sí conserva alias mediante su
parámetro opcional. Los predicados se conservan como texto y las pruebas comprueban
estructura y recorridos; no ejecutan SQL ni prueban equivalencia semántica.

## Límites semánticos y extensión

- La validación es estructural. No comprueba que existan tablas o columnas,
  claves, dominios de datos, compatibilidad de tipos o referencias calificadas.
- Los validadores JSON conservan los predicados como texto opaco sin analizarlos.
  El adaptador SQL sí revisa sintaxis y subconjunto antes de generar el árbol,
  pero no evalúa ni ejecuta los predicados. Las etiquetas son solo texto
  de presentación; no deben renderizarse como HTML sin escapar.
- `JOIN` denota únicamente un JOIN interno lógico con condición explícita. No
  se admiten variantes externas, naturales o sin condición.
- Proyección contiene únicamente nombres textuales de atributos; no modela
  expresiones. Las expresiones de proyección extendida se conservan por separado
  como texto opaco: no se calculan agregados, renombramientos ni comodines.
- No están soportados UNION, diferencia, intersección, producto cartesiano,
  agrupación, ordenamiento, subconsultas ni operadores físicos. Los tipos
  desconocidos se rechazan; no se convierten silenciosamente en otro operador.
- El formato representa estructura lógica, sin ejecutar resultados ni definir
  equivalencia entre consultas. El parámetro DISTINCT describe la intención
  respecto a duplicados; no calcula filas ni evalúa valores nulos.

Para añadir un operador habrá que actualizar explícitamente su aridad en
`operators.js`, el contrato de parámetros en el validador, la orientación si
introduce nuevas formas de entrada, las pruebas y la documentación. Un cambio
incompatible del contrato requiere una nueva versión de documento.

## Verificación automatizada

Ejecutar desde la raíz:

```sh
npm test
npm run build
```

`treeValidation.test.js` comprueba los ejemplos JSON y los casos de aceptación y
rechazo del contrato. `tree.test.js` comprueba constructores, copias, búsqueda,
orientación, recorridos y metadatos en árboles asimétricos. Se conserva la prueba
de renderizado de la página inicial. La implementación original del modelo no
incorporó nuevas dependencias; el adaptador SQL posterior utiliza el parser
documentado en [sql-a-arbol-logico.md](sql-a-arbol-logico.md).

Resultado observado al implementar inicialmente el modelo, antes del ajuste al
capítulo 2:

- `npm test`: 3 archivos y 96 pruebas aprobados, incluida la prueba de interfaz
  existente; código de salida 0.
- `npm run build`: 13 módulos transformados y compilación completada en 270 ms
  según la salida de Vite; código de salida 0.
- Comprobación adicional ejecutada mediante entrada estándar con
  `node --input-type=module`: importación directa del modelo sin Vue ni DOM,
  creación de nodos con UUID, JOIN, consultas, postorden, metadatos y
  serialización JSON correctos. También se leyeron y validaron los cuatro
  archivos JSON con `node:fs/promises`; código de salida 0.

Estas cifras corresponden a la implementación inicial, previa al lector
funcional integrado ahora en la interfaz. Las verificaciones actuales figuran
en [lectura-construccion-arboles.md](lectura-construccion-arboles.md).

### Registro histórico: ajuste de los ejemplos Libro y Autor

Se ejecutó `npm run check`, que encadena `npm test` y `npm run build`:

- Vitest: 4 archivos y **106 pruebas aprobados**, duración reportada de 543 ms.
- Vite: 13 módulos transformados y compilación de producción completada en
  259 ms.
- Código de salida del comando: 0.

En esa etapa los JSON eran cinco y se validaron todos. Se añadió
`chapter2Examples.test.js` para comprobar los filtros, proyección, condición de
JOIN, número de nodos, ramas y postorden de los árboles A y B de la figura 2.3.
En ese ajuste no se cambiaron el contrato JSON, los operadores admitidos ni los módulos de
procesamiento. No se añadieron dependencias ni ejecución de SQL o audio.

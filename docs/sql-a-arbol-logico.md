# De un subconjunto SQL a un árbol lógico

## Resultado y alcance

El prototipo acepta una única consulta SELECT del subconjunto descrito aquí y
produce el documento JSON canónico de versión 1. La consulta se analiza, pero
no se ejecuta. No se obtienen planes físicos ni se estiman costos, filas o
algoritmos de un gestor. La sonificación continúa pendiente.

La entrada JSON existente conserva sus dos formatos, ejemplos y validaciones.

## Evaluación del parser

Se consultaron los proyectos oficiales y los metadatos de npm antes de instalar:

```powershell
npm view node-sql-parser version time.modified license dependencies dist.unpackedSize repository.url --json
npm view pgsql-ast-parser version time.modified license dependencies dist.unpackedSize repository.url --json
```

También se consultó `npm view <paquete> time --json` para identificar la fecha
de publicación de la versión concreta, diferenciándola de `time.modified`.

| Alternativa | Observación verificada | Decisión para este alcance |
| --- | --- | --- |
| [pgsql-ast-parser](https://github.com/oguimbal/pgsql-ast-parser) | 12.0.2, publicada el 27 de enero de 2026; MIT; AST PostgreSQL, ubicaciones de origen y soporte de Node/navegador documentados. | Elegida: un dialecto basta para el ejemplo y sus ubicaciones permiten conservar el texto. |
| [node-sql-parser](https://github.com/taozhi8833998/node-sql-parser) | 5.4.0, publicada el 12 de enero de 2026; Apache-2.0; múltiples dialectos y opciones de navegador. | Alternativa viable; su amplitud no es necesaria para esta primera gramática. No se instaló ni se midió su bundle. |
| [Chevrotain](https://chevrotain.io/docs/tutorial/step2_parsing.html) | Es una herramienta para definir gramáticas; su ejemplo SQL requiere construir las reglas. | No elegida: supondría mantener una gramática propia además del adaptador. No se instaló. |

Las publicaciones de 2026 son la evidencia de actualización consultada para los
dos parsers. Los tamaños desempaquetados indicados por npm fueron 1 715 138 bytes
para pgsql-ast-parser y 92 373 153 para node-sql-parser; son tamaños del paquete,
no del JavaScript que recibiría el navegador.

Se ejecutó `npm install --save-exact pgsql-ast-parser@12.0.2`. Es la única
dependencia directa nueva; usa Moo y Nearley como dependencias del parser. npm
añadió ocho paquetes y reportó cero vulnerabilidades en esa instalación. La
versión se fija porque el adaptador depende de la forma de su AST y de sus
rangos. Una actualización requiere ejecutar de nuevo los casos de regresión.

El proyecto permanece en JavaScript. La compatibilidad se comprobó realmente con
Vitest, Vite y el navegador, tanto en desarrollo como con el bundle compilado.
No se añadieron polyfills ni herramientas de TypeScript.

## Subconjunto admitido

- Una sentencia que comience por SELECT, con un punto y coma final opcional.
- Columnas explícitas en SELECT, con o sin calificador, y DISTINCT o ALL opcionales.
- Una tabla simple en FROM, con alias de tabla mediante AS o alias implícito.
- Cero o más INNER JOIN, o JOIN sin modificador, siempre con ON.
- WHERE opcional. ON y WHERE admiten comparaciones `=`, `!=`, `<>`, `<`, `<=`,
  `>` y `>=`, unidas por AND y con paréntesis de agrupación.
- Operandos de comparación: referencias a columnas, números o textos entre
  comillas simples. Se conservan números negativos y decimales.
- Identificadores entre comillas dobles y comillas duplicadas en identificadores
  o textos. Los comentarios se reconocen sin confundirlos con cláusulas.

Si interviene más de una tabla, todas las columnas deben llevar calificador.
Sin un catálogo no se puede decidir a qué tabla pertenece una columna sin
calificar. Con una sola tabla se aceptan columnas sin calificador.

Los alias se resuelven con las reglas léxicas del dialecto: los identificadores
no citados se comparan en minúsculas; los citados conservan su distinción de
mayúsculas. Si una tabla tiene alias, su nombre original no actúa además como
calificador. Una autounión requiere dos alias distintos y dos nodos de relación.
Los ON solo pueden referirse a las entradas disponibles hasta ese JOIN, nunca a
una tabla que aparezca más adelante.

### Construcciones rechazadas

Se rechazan sin generar un árbol parcial: múltiples sentencias, CTE, subconsultas,
operaciones de conjuntos, listas de tablas separadas por coma, esquemas en nombres
de tablas, JOIN externos, CROSS/NATURAL JOIN, USING, `*`, alias de columnas,
columnas repetidas, funciones, agregados, cálculos en SELECT o predicados, casts,
GROUP BY, HAVING, ORDER BY, LIMIT/OFFSET, bloqueos, OR, NOT, IN, BETWEEN, LIKE,
IS NULL y otros predicados fuera de la lista admitida. DISTINCT ON tampoco se
admite. Parámetros, cadenas delimitadas por dólares y escapes con barra inversa
se rechazan; para una comilla en un texto se utiliza `''`.

El parser reconoce más construcciones que este adaptador. La aceptación se
decide por una lista de tipos y campos de AST permitidos, no por el hecho de
que el parser haya aceptado la sintaxis. Una gramática ajena al dialecto puede
producir un error de sintaxis en vez de un error de construcción no soportada.

No se consulta un catálogo: no se comprueba si las tablas y columnas existen,
sus dominios, tipos o claves, ni si una comparación es compatible con esos
tipos. El análisis tampoco demuestra equivalencia entre consultas.

## Conservación de operadores, columnas y predicados

`sqlToTree.js` utiliza `parse(sql, { locationTracking: true })` y valida su AST.
Construye una relación por tabla; después encadena los JOIN en el orden del
FROM, coloca una sola selección con el WHERE completo, si existe, y termina en
una proyección. No empuja filtros ni reordena reuniones. La cadena de JOIN es
una traducción de la estructura escrita, no una elección de ejecución física.

Las ubicaciones del parser no incluyen siempre los paréntesis exteriores ni el
alias implícito de una tabla. Por ello, `sqlSource.js` lee únicamente posiciones
léxicas de palabras, cadenas, identificadores, comentarios y delimitadores. No
reemplaza la gramática del parser ni acepta una consulta por sí solo.

Las cláusulas se delimitan con los tokens y las ubicaciones del AST. Se guardan
las columnas, ON y WHERE mediante cortes del texto original, sin llamar a un
generador de SQL. Se conserva la puntuación, los alias, las comillas, los
paréntesis, espacios internos y saltos de línea; se quita el espacio exterior
de cada elemento y el terminador de sentencia. Los comentarios internos pueden
permanecer en esas cadenas. El texto completo queda en `analisisSQL.sqlOriginal`.

Las comparaciones de WHERE también se identifican individualmente en los
metadatos, sin partir una cadena buscando la palabra AND. Un literal como
`'A AND B'` sigue siendo un único literal.

## JSON, alias y DISTINCT

No cambian los campos de documento (`version`, `raiz`) ni los cinco campos de
cada nodo (`id`, `tipo`, `etiqueta`, `parametros`, `hijos`). Se añaden únicamente
dos parámetros opcionales con validación de tipo:

| Nodo | Parámetro opcional | Significado |
| --- | --- | --- |
| RELACION | `alias`: texto no vacío | Nombre de referencia utilizado por la consulta. `nombre` conserva el nombre de tabla escrito. |
| PROYECCION | `distinct`: booleano | Indica si la proyección solicita eliminación de duplicados. |

Los ejemplos anteriores sin esos parámetros siguen siendo válidos. Los
identificadores citados se guardan con sus comillas originales; son texto de
representación, no nombres consultados a un gestor.

### Decisión sobre DISTINCT

El adaptador SQL siempre escribe `PROYECCION.parametros.distinct`:

- `true`: procede de SELECT DISTINCT y expresa la eliminación de duplicados
  sobre la tupla proyectada completa, no sobre cada columna por separado.
- `false`: procede de SELECT o SELECT ALL y conserva la intención SQL de
  proyectar sin solicitar eliminación de duplicados. Es una anotación lógica
  de la proyección de multiconjuntos, no una afirmación de álgebra clásica pura.
- Si se omite en un JSON anterior, permanece la convención original de
  proyección clásica sobre conjuntos. Los futuros consumidores deben distinguir
  esa omisión de un `false` explícito.

No se añade un nodo separado para DISTINCT. Esta decisión conserva la estructura
de cinco nodos del ejemplo de biblioteca y hace explícita su semántica. El
prototipo no ejecuta la eliminación ni calcula resultados; un futuro evaluador
deberá respetar esta anotación.

Ejemplo del parámetro de la raíz:

```json
{ "atributos": ["L.titulo", "A.nombre"], "distinct": true }
```

## Ejemplo de biblioteca

El archivo `src/data/examples/biblioteca.sql` contiene la consulta proporcionada:

```sql
SELECT DISTINCT L.titulo, A.nombre
FROM Libro AS L
INNER JOIN Autor AS A
ON L.id_autor = A.id_autor
WHERE L.anio > 2020
AND A.pais = 'México';
```

Su árbol tiene cinco nodos, profundidad máxima 3 y este orden desde la raíz:

```text
PROYECCION [L.titulo, A.nombre; distinct=true]
  SELECCION [L.anio > 2020 AND A.pais = 'México']
    JOIN [L.id_autor = A.id_autor]
      RELACION [nombre=Libro, alias=L]
      RELACION [nombre=Autor, alias=A]
```

El predicado almacenado conserva el salto de línea antes de AND. Los id se
generan de forma determinista dentro de cada consulta: `sql-relacion-1`,
`sql-relacion-2`, `sql-join-1`, `sql-seleccion` y `sql-proyeccion`. No se exige
unicidad entre árboles independientes.

## API e integración

Archivo de dominio: `src/modules/sql/sqlToTree.js`.

- `analizarSQL(texto)`: devuelve el resultado preparado de `construirArbol`,
  junto con `analisisSQL`; lanza `ErrorSQL` ante un error del análisis.
- `procesarSQL(texto)`: devuelve `{ valido, errores, resultado }`. Los errores
  de SQL o del modelo dejan `resultado: null`; no se ocultan errores de programación.
- `LIMITES_SQL`: 20 000 unidades de `String.length`, 16 tablas, 64 columnas y
  64 comparaciones entre ON y WHERE. La lectura léxica admite hasta 4 000 tokens
  y 32 niveles de paréntesis. Los límites rechazan, sin truncar.

`resultado.arbol` es el JSON canónico reutilizable. `analisisSQL` está fuera de
ese documento e incluye dialecto, texto original, indicador DISTINCT, tablas y
alias, columnas identificadas con su tabla de origen, condiciones de selección
y JOIN. `columnas.original` conserva el texto; `columnas.nombre` contiene el
identificador normalizado para distinguir referencias.

Los diagnósticos contienen código, ruta, mensaje en español, línea y columna.
Los errores de token usan la posición que informa el parser; los errores al
final de entrada señalan el final. Para restricciones generales se señala el
inicio de la construcción o de la consulta. No se expone la extensa lista de
reglas internas del parser como mensaje de usuario.

Códigos principales: `SQL_ENTRADA_INVALIDA`, `SQL_VACIO`,
`SQL_SINTAXIS_INVALIDA`, `SQL_NO_SOPORTADO`, `SQL_UNA_SENTENCIA`,
`SQL_FROM_REQUERIDO`, `SQL_ALIAS_DUPLICADO`, `SQL_REFERENCIA_NO_DECLARADA`,
`SQL_COLUMNA_AMBIGUA`, `SQL_COLUMNAS_REPETIDAS`, `SQL_LIMITE` y
`SQL_FUENTE_INVALIDA`. El último rechaza una recuperación insegura del texto,
en lugar de generar condiciones recortadas.

En la interfaz:

1. Elegir **SQL**, editar o cargar la consulta de biblioteca y pulsar Procesar SQL.
2. Revisar el árbol, sus parámetros y recorridos; desplegar el análisis de tablas,
   alias, columnas y condiciones si se necesita inspeccionarlo.
3. Pulsar **Enviar árbol al editor JSON** para reemplazar el texto de ese editor;
   pulsar Procesar JSON para validarlo y visualizarlo por el flujo anterior.

Los editores mantienen estados independientes mediante KeepAlive. Cambiar de
modo conserva texto y resultado; editar un texto descarta su resultado anterior.
No se persisten los textos al recargar la página ni se envían a servicios externos.
El componente SQL se carga de forma diferida al abrir ese modo, de modo que el
parser no se incorpora al archivo inicial de la aplicación.

## Verificaciones realizadas

- `npm run check`: **8 archivos y 290 pruebas aprobados**, seguido de compilación
  correcta de producción: 34 módulos, 408 ms reportados por Vite; salida 0.
- `npm ls --depth=0`: Vue, Vite, plugin Vue, Vitest y pgsql-ast-parser instalados,
  sin dependencias directas ausentes o inválidas en la salida.
- El archivo de carga diferida SQL midió 261.80 kB, 47.29 kB con gzip según Vite.
  Es el tamaño de un artefacto de software, no un costo de ejecución de consulta.
- Navegador en desarrollo: procesamiento JSON original, consulta de biblioteca,
  conservación de estados al alternar, rechazo de LEFT JOIN y sintaxis inválida,
  recuperación del ejemplo y envío/reprocesamiento del JSON generado.
- Navegador con vista previa de la compilación de producción: apertura del modo
  SQL y procesamiento correcto de biblioteca, con 5 nodos y profundidad 3.
  En ambos entornos, la lectura de consola devolvió cero errores y advertencias.
- Captura real de la salida de producción:
  [evidencias/sql-biblioteca.png](evidencias/sql-biblioteca.png).
- Se cerraron las pestañas temporales y los servidores creados para verificar.
  Se ejecutaron `taskkill /PID 22500 /T /F` y `taskkill /PID 27540 /T /F`; después
  Node comprobó que ambos PID estaban inactivos y los puertos 5173 y 4173 ya no
  respondían por HTTP. Esos PID identifican solo esta ejecución.

Las primeras pruebas SQL detectaron la pérdida del alias implícito por los
rangos del AST y la representación de comillas duplicadas de identificadores.
Ambos problemas se corrigieron en el adaptador y sus regresiones están incluidas
en la ejecución satisfactoria. Se conservaron todas las pruebas JSON anteriores.

No hay pruebas de conexión con PostgreSQL, ejecución de consultas, equivalencia,
rendimiento de un gestor o cobertura de toda su gramática. Los casos automatizados
de dominio, estado reactivo y renderizado SSR son persistentes; las comprobaciones
de interacción de esta sección se realizaron realmente en el navegador, sin
añadir otra dependencia de pruebas.

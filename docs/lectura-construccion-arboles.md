# Lectura y construcción funcional de árboles lógicos

## Objetivo y alcance

El lector recibe texto JSON, valida su estructura, construye un árbol lógico en
memoria y calcula los datos necesarios para inspeccionarlo. Conserva los
operadores, etiquetas, parámetros y orden de entradas del documento. Este lector
JSON no analiza SQL, ejecuta predicados ni reescribe el plan. La entrada SQL
separada se documenta en [sql-a-arbol-logico.md](sql-a-arbol-logico.md).
No consulta una base de datos ni
obtiene un plan físico, algoritmos de ejecución, cardinalidades o costos.

La salida prepara una interfaz para futuros consumidores, incluida la
sonificación; no incorpora generación de sonidos.

## Formatos de entrada

Se admiten dos formatos de versión 1. No se pueden mezclar `raiz` y `nodos`.

### 1. Formato anidado existente

`{ "version": 1, "raiz": Nodo }`, donde cada entrada en `hijos` es otro nodo
completo. Se conserva el contrato documentado en
[modelo-arboles-relacionales.md](modelo-arboles-relacionales.md).

La raíz es explícita. Los nodos anidados no pueden referirse a otros por texto:
para ello se utiliza el segundo formato. Una lista de raíces es inválida.

### 2. Lista de nodos con referencias

El documento tiene exactamente `version` y `nodos`. Los nodos conservan sus
cinco campos; `hijos` contiene identificadores, no objetos. La raíz se deduce
como el único nodo sin referencias de entrada. La posición de un nodo en la
lista no decide la raíz ni el orden del recorrido.

```json
{
  "version": 1,
  "nodos": [
    {
      "id": "libro",
      "tipo": "RELACION",
      "etiqueta": "Libro",
      "parametros": { "nombre": "Libro" },
      "hijos": []
    },
    {
      "id": "autor",
      "tipo": "RELACION",
      "etiqueta": "Autor",
      "parametros": { "nombre": "Autor" },
      "hijos": []
    },
    {
      "id": "join",
      "tipo": "JOIN",
      "etiqueta": "Libro con su autor",
      "parametros": { "condicion": "Libro.id_autor = Autor.id_autor" },
      "hijos": ["libro", "autor"]
    }
  ]
}
```

Este documento tiene raíz `join`. `libro` es el hijo izquierdo y `autor` el
derecho. Todos los nodos deben pertenecer al mismo árbol: no se descartan
componentes desconectados ni se elige una raíz arbitraria.

La normalización produce el formato anidado canónico. Los objetos padre-hijo
se construyen después de validar el grafo; no se agregan punteros al padre a los
nodos canónicos para evitar ciclos al serializarlos.

## Operadores soportados

| Tipo | Aridad | Parámetro obligatorio |
| --- | --- | --- |
| `RELACION` | 0 | `nombre`: texto no vacío. |
| `SELECCION` | 1 | `predicado`: texto no vacío. |
| `PROYECCION` | 1 | `atributos`: lista no vacía de textos sin duplicados exactos. |
| `PROYECCION_EXTENDIDA` | 1 | `expresiones`: lista no vacía de textos sin duplicados exactos. |
| `JOIN` | 2 | `condicion`: texto no vacío; se interpreta como JOIN interno lógico. |

La proyección extendida permite conservar el operador de la figura 2.4 del
capítulo, cuyo subtotal utiliza `Detalle.cantidad * Detalle.precio_unitario`.
Las expresiones y sus nombres `AS` son texto opaco: se almacenan y se muestran,
pero no se evalúan ni se resuelven. Se mantiene la distinción con la proyección
clásica, que solo representa una lista de atributos.

La ampliación SQL admite además `alias` opcional en los parámetros de RELACION
y `distinct` booleano opcional en PROYECCION. Los JSON anteriores que los omiten
siguen siendo válidos. La semántica del indicador se define en la documentación
SQL y en el modelo; el lector JSON se limita a validar su tipo y conservarlo.

Continúan sin soportarse los JOIN externos o naturales, los operadores de
conjuntos, agregación, agrupación, ordenamiento y renombramiento de relaciones.
La validación no comprueba catálogos, existencia de columnas, sintaxis de
predicados ni tipos de datos. No ejecuta `DISTINCT` ni elimina filas duplicadas.

## Flujo y responsabilidades

1. **Lectura:** verifica que la entrada sea texto no vacío y utiliza
   `JSON.parse`, sin `eval`. La sintaxis inválida produce un diagnóstico propio.
2. **Formato:** distingue raíz anidada de lista con referencias y rechaza la
   mezcla de formatos y las versiones o campos no admitidos.
3. **Definiciones:** reutiliza los contratos de campos, parámetros y aridad de
   `treeValidation.js`. Detecta identificadores duplicados antes de enlazarlos.
4. **Referencias:** usa un `Map` por identificador. Comprueba existencia de cada
   hijo, número de entradas de cada nodo, raíz única y conectividad.
5. **Ciclos:** aplica DFS iterativo con estados activo/finalizado en todos los
   componentes. También encuentra ciclos que no sean alcanzables desde la raíz.
6. **Construcción:** enlaza los hijos en su orden original y valida de nuevo el
   árbol canónico. Copia los datos para separarlos del documento de entrada.
7. **Procesamiento:** reutiliza los recorridos existentes para calcular los
   metadatos, enlaces, cantidad de nodos y profundidad máxima.

La comprobación de referencias y ciclos recorre los vértices y aristas sin
recursión. Los metadatos incluyen rutas por nodo, por lo que su memoria también
depende de la profundidad. No se han realizado mediciones de rendimiento ni
estimaciones de costo de una consulta.

Antes de la validación completa del árbol anidado se comprueban sus límites
mediante un recorrido acotado, que evita repetir objetos en caso de ciclos.
Así no se clona ni se genera una lista extensa de diagnósticos para un documento
que ya supera el tamaño o la profundidad admitidos.

## API pública

Archivo: `src/modules/tree/treeLoader.js`.

| Función | Contrato |
| --- | --- |
| `cargarArbolDesdeJSON(texto)` | Analiza el texto y devuelve la estructura preparada; lanza `ErrorArbol` para entradas inválidas. |
| `construirArbol(documento)` | Recibe un objeto ya analizado, en cualquiera de los dos formatos, y devuelve la misma estructura preparada. |
| `procesarArbolJSON(texto)` | Frontera para la interfaz: devuelve `{ valido, errores, resultado }`; si hay errores de usuario, `resultado` es `null`. |
| `LIMITES_CARGA` | Constantes de tamaño, número de nodos y profundidad de esta carga. |

Los errores de programación inesperados no se convierten en errores de JSON ni
se ocultan. Los diagnósticos de usuario son `{ codigo, ruta, mensaje }`, en
español. Las rutas de referencias apuntan al documento original, por ejemplo
`$.nodos[2].hijos[1]`; los errores de documentos anidados usan `$.raiz…`.

```javascript
import { procesarArbolJSON } from './src/modules/tree/treeLoader.js'

const respuesta = procesarArbolJSON(texto)
if (respuesta.valido) {
  const { arbol, nodos, enlaces, recorridos } = respuesta.resultado
  // Datos disponibles para una vista o un futuro módulo de sonificación.
} else {
  console.log(respuesta.errores)
}
```

### Resultado preparado en memoria

| Campo | Contenido |
| --- | --- |
| `arbol` | Documento canónico `{ version: 1, raiz }`, con operadores y parámetros originales. |
| `raizId` | Identificador de la única raíz. |
| `nodos` | Registros en preorden: `id`, `tipo`, `etiqueta`, `parametros`, `hijosIds`, `profundidad`, `posicion`, `ruta`, `padreId`, `lado`, `indiceHijo`. |
| `enlaces` | Aristas ordenadas con `padreId`, `hijoId`, `indiceHijo` y `lado`. |
| `cantidadNodos` | Número de nodos de la estructura. No es cantidad de filas. |
| `profundidadMaxima` | Máxima distancia en aristas desde la raíz. Una relación sola tiene profundidad 0. |
| `recorridos` | Arreglos de identificadores `preorden` y `postorden`, visitando primero la entrada izquierda. |

`posicion` empieza en 0 dentro de cada nivel y no es una coordenada en píxeles.
El hijo de un operador unario tiene lado `unico`; los hijos de JOIN son
`izquierdo` y `derecho`; la raíz tiene padre, lado e índice de hijo `null`.
Todos los datos son serializables. No se requieren profundidad ni posición en
la entrada y estos campos no se insertan en el JSON canónico.

Las salidas deben tratarse como solo lectura: los registros y el árbol
comparten sus objetos de parámetros dentro de una misma carga, pero no con el
documento original. No se introduce una API de edición estructural en esta fase.

### Diagnósticos nuevos de carga

| Código | Situación |
| --- | --- |
| `ENTRADA_INVALIDA`, `JSON_VACIO`, `JSON_INVALIDO` | Tipo de entrada o sintaxis incorrectos. |
| `FORMATO_AMBIGUO` | Se mezclan `raiz` y `nodos`. |
| `NODOS_INVALIDOS` | La lista no es un arreglo no vacío. |
| `REFERENCIA_INVALIDA`, `REFERENCIA_INEXISTENTE` | Un hijo no es un identificador válido o no está definido. |
| `MULTIPLES_PADRES` | Un nodo tiene más de una referencia de entrada, incluido el mismo hijo repetido. |
| `RAIZ_NO_UNICA` | Se encontraron cero o más de una raíz. |
| `CICLO_DETECTADO`, `NODOS_DESCONECTADOS` | El grafo contiene un ciclo o componentes que no pertenecen al árbol de la raíz. |
| `EXPRESIONES_INVALIDAS` | Lista de expresiones de proyección extendida inválida. |
| `LIMITE_TEXTO`, `LIMITE_NODOS`, `LIMITE_PROFUNDIDAD` | Se excede un límite de carga. |

Se conservan además los errores existentes de versión, identificadores, tipo,
campos, parámetros y aridad. Un documento puede producir varios diagnósticos,
por ejemplo, un ciclo sin raíz.

### Límites de esta carga

- Hasta 1 000 000 de unidades de texto según `String.length` de JavaScript.
- Hasta 2 000 nodos.
- Profundidad máxima 128, con la raíz en 0.

Estos límites se aplican al lector para acotar el trabajo de la interfaz; no
modifican el contrato general de los constructores antiguos. No hay truncamiento
ni carga parcial: un documento que exceda un límite se rechaza.

## Interfaz y estado

- `TreeReader.vue`: selector de ejemplos, editor de texto, procesamiento,
  limpieza y diagnósticos con código y ruta.
- `TreeResult.vue`: jerarquía indentada, parámetros completos, resumen,
  preorden y postorden, tabla de relaciones y JSON normalizado desplegables.
- `useTreeReader.js`: coordina el texto, estado, resultado y errores. Al editar
  el JSON elimina inmediatamente la salida anterior para no mostrar resultados
  que correspondan a otro texto. Cargar un ejemplo reemplaza el editor y exige
  pulsar Procesar JSON de nuevo.

La vista usa interpolación de Vue para escapar etiquetas y parámetros; no usa
`v-html`. La indentación visual se limita a diez niveles para conservar espacio,
pero siempre se muestra la profundidad exacta. No se envían los JSON a un
servicio externo ni se guarda el contenido al cerrar o recargar la página.

Para utilizarla, ejecutar `npm run dev`, abrir la dirección que indique Vite,
pegar un documento o cargar un ejemplo y pulsar **Procesar JSON**.

## Casos de referencia y pruebas

| Ejemplo | Formato | Nodos | Profundidad máxima |
| --- | --- | --- | --- |
| Selección y proyección de Libro | Anidado | 3 | 2 |
| Libro y Autor, árbol A | Anidado | 5 | 3 |
| Filtros antes del JOIN, árbol B | Anidado | 6 | 3 |
| Ventas, cuatro relaciones y tres JOIN | Referencias | 9 | 5 |

Ventas conserva los identificadores N1–N9 y los operadores de la figura 2.4,
página impresa 11 (página 13 del PDF), del capítulo suministrado. Las condiciones
y columnas proceden también de las páginas impresas 9 y 10. Se sustituyen los
alias C, P, D y R por Cliente, Pedido, Detalle y Producto. No se copian las
cantidades de filas del dibujo ni se presentan como estimaciones del prototipo.

`treeLoader.test.js` cubre los cuatro casos, ambos formatos, conservación de
parámetros, independencia del orden de definiciones, errores de sintaxis,
referencias ausentes, duplicados, ciclos, componentes desconectados, múltiples
padres, raíces, aridad y límites. `treeReader.test.js` prueba el estado reactivo,
recuperación de errores, retirada de resultados obsoletos, renderizado SSR y
escape de texto. Se conservan las pruebas anteriores.

## Registro histórico: verificaciones del lector JSON

- Ejecución al implementar el lector JSON: 6 archivos y **179 pruebas aprobados**,
  seguido de compilación de producción correcta (25 módulos transformados;
  304 ms reportados por Vite); código de salida 0.
- En la primera ejecución de las pruebas nuevas se detectaron dos errores en
  los propios casos de prueba: un paréntesis adicional y una expectativa sobre
  `undefined`, que `JSON.stringify` omite. Se corrigieron antes de la ejecución
  satisfactoria indicada arriba.
- Navegador contra Vite local: se procesaron los cuatro ejemplos y se
  comprobaron sus resultados visibles; ventas mostró 9 nodos y profundidad 5.
  También se probaron JSON mal formado, ciclo sin raíz y recuperación mediante
  un ejemplo válido. La consulta de consola devolvió cero mensajes de error o
  advertencia durante esta comprobación.
- Se guardó una captura real de la salida del árbol B en
  [evidencias/lector-arboles.png](evidencias/lector-arboles.png).
- Se cerró la pestaña temporal y el servidor de comprobación mediante
  `taskkill /PID 9736 /T /F`. Después se comprobó con Node que ese PID ya no
  existía y que `http://127.0.0.1:5173/` había dejado de responder. Ese PID
  identifica únicamente la ejecución realizada; no debe reutilizarse.

No se incorporaron dependencias. Las pruebas de componentes usan el renderizador
SSR existente y la comprobación de interacción se realizó en el navegador;
no se añadió un entorno DOM simulado ni una suite de navegador automatizada
persistente. No se realizaron pruebas de carga ni validación semántica de SQL.

La ampliación SQL posterior conserva esas pruebas. Sus verificaciones actuales,
incluido el flujo de transferencia SQL a JSON, se registran en
[sql-a-arbol-logico.md](sql-a-arbol-logico.md).

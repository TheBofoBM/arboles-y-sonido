# Árboles y sonido

Prototipo de la tesis **«Método computacional para codificar árboles de consulta
relacional mediante estructuras sonoras como apoyo a la formación en bases de
datos»**.

**Abrir el prototipo:** [Árboles y sonido en GitHub Pages](https://thebofobm.github.io/arboles-y-sonido/).
Funciona directamente en el navegador, sin ChatGPT ni instalación local.

El proyecto permite pegar JSON o una consulta de un subconjunto SQL, validarlos
y construir un árbol lógico en memoria.
Incluye un diagrama interactivo con colores por operador y sampleos que iluminan
los nodos de arriba hacia abajo. La pantalla inicial muestra la biblioteca lista
para escuchar. Los parámetros completos aparecen al seleccionar un nodo; el
JSON y los detalles técnicos quedan plegados.
Acepta el formato anidado original y una lista de nodos con referencias por id.
La entrada SQL admite SELECT de columnas, FROM, alias de tablas, INNER JOIN con
ON, WHERE con comparaciones y AND, y DISTINCT. También admite expresiones de
álgebra relacional, transformaciones heurísticas paso a paso, reproducción con
sampleos de piano y comparación de dos árboles independientes. No ejecuta consultas,
obtiene planes físicos ni estima costos de ejecución.

El contrato JSON, la API y los límites están en
[Modelo de árboles relacionales](docs/modelo-arboles-relacionales.md).
La API de carga, formatos, validaciones e interfaz se describen en
[Lectura y construcción de árboles](docs/lectura-construccion-arboles.md).
La elección de parser, el subconjunto SQL y la representación de DISTINCT se
documentan en [SQL a árbol lógico](docs/sql-a-arbol-logico.md).
Los ejemplos de `Libro` y `Autor` están contrastados con el capítulo 2 e incluyen
los árboles A y B de la figura 2.3:
[procedencia y correspondencia de los ejemplos](src/data/examples/README.md).

La entrada de fórmulas, las reglas, la comparación A/B y la reproducción se
explican en [Heurísticas, sampleos y comparación](docs/heuristicas-sampleos-comparacion.md).
Para probar dos árboles, abrir **Comparar A / B**: el par de biblioteca aparece
listo para escuchar. **Editar consultas A y B** permite introducir otras entradas.
Se pueden escuchar los originales o activar **Ver árboles transformados**.
El recorrido predeterminado es por niveles, de arriba abajo y de izquierda a
derecha; preorden y postorden están en **Cambiar recorrido**. Véanse los
[detalles de la interfaz visual y su verificación](docs/interfaz-visual-recorrido-2026-11-18.md).

El prototipo también puede abrirse en Chrome/Edge o publicarse como sitio
estático en GitHub Pages. Véanse las
[instrucciones de apertura y publicación](docs/publicacion-github-pages.md).

## Requisitos e instalación

- Node.js 22.12+, 24.x o 26+ (según `engines` en `package.json`).
- npm, incluido con Node.js.

Desde la raíz del proyecto:

```sh
npm ci
npm run dev
```

Abrir la dirección local que indique Vite. Para una primera instalación sin
archivo de bloqueo se utiliza `npm install`; el repositorio ya incluye
`package-lock.json` para instalaciones reproducibles con `npm ci`.

## Comandos

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con actualización automática. |
| `npm run build` | Compilar la aplicación en `dist/`. |
| `npm run preview` | Revisar localmente la compilación de producción. |
| `npm test` | Ejecutar Vitest una vez; apropiado para integración continua. |
| `npm run test:watch` | Ejecutar Vitest en modo observación. |
| `npm run check` | Ejecutar las pruebas y compilar; se detiene si falla una prueba. |

## Organización

```text
src/
├── App.vue
├── main.js
├── components/
│   ├── sql/                   # SqlReader.vue
│   ├── trees/                 # JSON, álgebra, transformaciones y resultados
│   ├── audio/                 # SamplePlayer.vue
│   ├── comparison/            # TreeComparison.vue
│   └── common/ProjectOverview.vue
├── modules/
│   ├── tree/                  # Modelo, carga, álgebra y reglas heurísticas
│   ├── sql/                   # sqlToTree.js y sqlSource.js
│   ├── validation/            # treeValidation.js
│   ├── characterization/
│   ├── sonification/          # Plan de sampleos por recorrido
│   └── comparison/            # Comparación estructural y equivalencia acotada
├── assets/samples/            # WAV locales, fuente grabada y atribución
├── services/                 # Reproductor Web Audio
├── composables/               # useTreeReader.js y useSqlReader.js
├── data/examples/             # Libro, Autor, ventas y catálogo de ejemplos
├── styles/global.css
├── utils/
└── tests/                     # Interfaz, modelo, validación y ejemplos del capítulo 2
```

Las carpetas que siguen reservadas, como `characterization` y `utils`, contienen
únicamente `.gitkeep`. Los módulos funcionales están descritos arriba.

- **components**: interfaz Vue por área; `common` contiene elementos compartidos.
- **modules**: lógica de dominio en JavaScript, independiente de Vue y del DOM.
  `tree` implementa el modelo y sus operaciones; `validation` comprueba el
  contrato y la aridad; `sonification` programa las visitas y `comparison`
  compara dos entradas. `characterization` permanece reservado.
- **services**: reproducción de muestras mediante Web Audio.
- **composables**: estado reactivo de lectura, procesamiento y errores de la interfaz.
- **data/examples**: ejemplos JSON estáticos y su documentación de procedencia.
- **styles**: estilos globales; los estilos exclusivos de un componente podrán
  vivir en su bloque `<style scoped>`.
- **utils**: futuras funciones auxiliares independientes del dominio.
- **tests**: pruebas `*.test.js` ejecutadas por Vitest.

La interfaz coordina el lector mediante un composable. Los módulos
de dominio no deben importar componentes ni depender del navegador. Se evitan
archivos índice y abstracciones hasta que exista código que los necesite.

## Pruebas y herramientas

`vite.config.js` comparte el complemento de Vue entre Vite y Vitest. La prueba
de interfaz renderiza `App.vue` mediante `vue/server-renderer` en Node y comprueba la
integración de los componentes, el destino del enlace de salto y el estado del
prototipo. No necesita un DOM simulado. Esta prueba no sustituye una revisión
visual ni comprueba interacciones en un navegador.

Las pruebas del modelo cubren los ejemplos JSON, las aridades, la raíz única,
los identificadores, los ciclos, los campos y parámetros, la orientación de las
entradas, los recorridos y sus metadatos. No requieren dependencias adicionales.
Las pruebas de los ejemplos del capítulo verifican los filtros y los árboles A y
B, con cinco y seis nodos respectivamente, y sus recorridos en postorden.
El lector cubre también referencias inexistentes, ciclos, componentes
desconectados, raíces, límites de carga y el caso de ventas con cuatro relaciones,
tres JOIN y una proyección extendida cuyo subtotal se conserva como texto.

Vue y `pgsql-ast-parser` son dependencias de ejecución. Vite, `@vitejs/plugin-vue`
y Vitest son dependencias de desarrollo. El parser queda fijado a 12.0.2 y se
reutiliza para comprobar predicados de las reglas. No se incorporan router,
gestor de estado, bibliotecas de interfaz ni bibliotecas de audio.

Para usar la nueva entrada, ejecutar `npm run dev`, elegir **SQL** y pulsar
**Generar árbol desde SQL**. La consulta de biblioteca está precargada. **Enviar árbol al
editor JSON** permite comprobar el resultado mediante el lector existente;
los textos y resultados se conservan al alternar de modo durante la sesión.

Referencias: [Vite](https://vite.dev/guide/),
[configuración de Vitest](https://vitest.dev/config/) y
[Vue](https://vuejs.org/guide/quick-start.html).

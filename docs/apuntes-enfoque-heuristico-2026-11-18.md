# Apuntes del prototipo: transformación heurística y semejanza sonora

Fecha: 18 de noviembre de 2026.

Estos apuntes recogen una propuesta de enfoque del usuario. No describen
funcionalidades nuevas implementadas ni resultados experimentales.

Actualización posterior: la implementación inicial de este enfoque se describe
en [Heurísticas, sampleos y comparación](heuristicas-sampleos-comparacion.md).
El resto de este archivo conserva las decisiones que dieron origen al cambio.

## Enfoque propuesto

Centrar el prototipo en la optimización heurística de consultas: observar cómo
se transforma una expresión al aplicar reglas que conserven su semántica.
La experiencia debe permitir comparar la expresión y el árbol originales con
los obtenidos en cada paso de transformación.

Explorar un mapeo sonoro que haga perceptible la relación entre expresiones
equivalentes escritas de maneras distintas. La semejanza sonora es un objetivo
de diseño y una hipótesis por evaluar con oyentes; todavía no es un resultado
demostrado del prototipo.

## Interacción deseada

1. El usuario elige la modalidad e introduce una expresión de álgebra
   relacional o una consulta SQL.
2. Pulsa **Generar árbol**; el software construye la representación lógica.
3. El sistema presenta las reglas heurísticas aplicables y permite inspeccionar
   su aplicación paso a paso.
4. Se muestran la expresión, el árbol y la regla de cada paso, conservando el
   estado original para comparar.
5. Cuando exista el módulo sonoro, se podrán escuchar las representaciones
   original y transformada.

El usuario confirmó que se necesitan **ambas entradas: álgebra relacional y
SQL**. Ambas deberán producir el modelo de árbol lógico común. Queda por
definir la sintaxis admitida por el futuro parser de álgebra relacional y si
las reglas se aplican automáticamente, por elección del usuario o mediante
ambas modalidades.

## Reglas y conservación de la semántica

Cada regla que se implemente deberá documentar sus precondiciones, la parte
del árbol que modifica y la justificación de conservación de la semántica.
Debe registrar el antes y el después y rechazar aplicaciones cuyas condiciones
no puedan comprobarse.

Para delimitar ese trabajo hay que concretar el tratamiento de predicados,
alias, atributos, duplicados y DISTINCT. El alcance de los operadores del
modelo y el del parser deben seguir siendo explícitos.

Los cambios observados se describirán como transformaciones del árbol lógico.
No se atribuirán mejoras de tiempo, costos de ejecución ni planes físicos sin
mediciones o integración con un gestor que las respalden.

## Decisión sonora: sampleos durante todo el recorrido

El usuario precisó que el recurso sonoro serán **sampleos**, mediante muestras
o fragmentos melódicos reutilizables. Esta decisión sustituye el enfoque previo
basado en tonos individuales. Queda por definir qué característica selecciona
cada muestra y cómo se combinan las muestras para representar el árbol y sus
transformaciones.

El requisito central es que **cualquier árbol válido dentro del alcance
soportado tenga un mapeo completo y una reproducción musicalmente coherente
de principio a fin del recorrido**. El diseño debe contemplar las diferentes
formas válidas del árbol, no depender de que el usuario elija una estructura
particular para que las muestras combinen bien.

Para concretar «que se escuche bien», se establecen estos criterios de diseño:

- Cubrir todos los operadores admitidos y todas las visitas del recorrido
  seleccionado, manteniendo la correspondencia entre nodos y eventos sonoros.
- Seleccionar muestras compatibles y definir reglas de combinación, ritmo y
  transición que funcionen con diferentes órdenes, profundidades y cantidades
  de nodos válidas.
- Reproducir el recorrido completo, incluido el final de la última muestra,
  sin cortes accidentales, huecos por muestras ausentes ni saturación de la
  mezcla.
- Conservar la relación entre el sonido y la estructura: la coherencia musical
  debe acompañar la información que se quiere comunicar sobre el árbol.
- Comprobar los ejemplos de biblioteca y ventas, árboles de una sola relación
  y otras formas válidas del modelo; evaluar también la coherencia percibida
  por oyentes.

La validez estructural y la calidad sonora requieren comprobaciones distintas.
Validar el árbol permite iniciar el mapeo; el banco de muestras y las reglas de
combinación deberán satisfacer los criterios sonoros. «Se escucha bien» queda
como requisito y criterio de evaluación, no como garantía ya demostrada.

Una decisión central será qué rasgos sonoros se mantienen entre expresiones
equivalentes y cuáles permiten distinguir sus estructuras. La meta combina
reconocer la semejanza semántica y percibir los cambios producidos por las
reglas. No se presupone que equivalencia semántica implique audio idéntico.

La evaluación deberá especificar los pares de expresiones comparados, las
transformaciones aplicadas y cómo se recogerá la percepción de semejanza
sonora. No se han seleccionado muestras ni implementado reproducción en
esta actualización de apuntes.

## Relación con el proyecto existente

El README actual documenta entrada JSON y un subconjunto SQL, construcción y
validación del árbol, profundidad y recorridos. Esa implementación sirve de
base para la propuesta. La entrada textual de álgebra relacional, la aplicación
de reglas heurísticas y el mapeo con muestras melódicas requieren desarrollo y
validación posteriores.

La documentación vigente del modelo y las entradas está en:

- [Modelo de árboles relacionales](modelo-arboles-relacionales.md).
- [Lectura y construcción de árboles](lectura-construccion-arboles.md).
- [SQL a árbol lógico](sql-a-arbol-logico.md).

Este archivo registra los apuntes en el proyecto de trabajo. La copia de
entrega preparada anteriormente para el apartado 2.3 conserva su propio corte.

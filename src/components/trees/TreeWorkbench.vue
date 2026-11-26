<script setup>
import { shallowRef, ref, watch, computed } from 'vue'
import TreeResult from './TreeResult.vue'
import SamplePlayer from '../audio/SamplePlayer.vue'
import SqlReference from '../sql/SqlReference.vue'
import { aplicarPasoHeuristico, optimizarArbol } from '../../modules/tree/heuristics.js'
import { construirArbol } from '../../modules/tree/treeLoader.js'
import { expresarArbol } from '../../modules/tree/algebra.js'
const props = defineProps({ resultado: { type: Object, required: true } })
defineEmits(['comparar'])
const actual = shallowRef(props.resultado), pasos = shallowRef([]), aviso = ref(''), error = ref(''), nodoActivo = ref(null), visitados = ref([])
watch(() => props.resultado, value => { actual.value = value; pasos.value = []; aviso.value = ''; error.value = ''; nodoActivo.value = null; visitados.value = [] })
const seleccionado = ref(null)
const cambioSeleccionado = computed(() => {
  if (seleccionado.value === null) return null
  return aplicarPasoHeuristico(actual.value.arbol, seleccionado.value)
})
function moverSeleccionado() {
  const cambio = cambioSeleccionado.value
  if (!cambio?.aplicado) return
  pasos.value = [...pasos.value, { ...cambio.regla, antes: actual.value.arbol, despues: cambio.resultado.arbol }]
  actual.value = cambio.resultado
  seleccionado.value = null
  aviso.value = cambio.regla.descripcion
  error.value = ''
}
const formula = computed(() => expresarArbol(actual.value.arbol))
function transformar(todos = false) {
  error.value = ''
  try {
    if (todos) {
      const cambio = optimizarArbol(actual.value.arbol)
      pasos.value = [...pasos.value, ...cambio.pasos]; actual.value = cambio.resultado; aviso.value = cambio.aviso
    } else {
      const cambio = aplicarPasoHeuristico(actual.value.arbol)
      if (cambio.aplicado) pasos.value = [...pasos.value, { ...cambio.regla, antes: actual.value.arbol, despues: cambio.resultado.arbol }]
      actual.value = cambio.resultado; aviso.value = cambio.aviso ?? cambio.regla.descripcion
    }
  } catch (fallo) { error.value = fallo.message }
}
function deshacer() {
  const paso = pasos.value.at(-1)
  if (!paso) return
  actual.value = construirArbol(paso.antes); pasos.value = pasos.value.slice(0, -1); aviso.value = ''; error.value = ''
}
function actualizarDesdeSQL(resultado) {
  actual.value = resultado; pasos.value = []; error.value = ''
  aviso.value = 'Árbol actualizado desde el SQL editado.'
}
</script>

<template>
  <section class="listening-workspace" aria-label="Explorador visual del árbol">
    <div class="workspace-heading"><div><p class="eyebrow">UN ÁRBOL, UN RECORRIDO</p><h2>Escucha lo que ves.</h2></div><button class="button-secondary" type="button" @click="$emit('comparar', { a: resultado.arbol, b: actual.arbol })">Comparar original y actual <span aria-hidden="true">↗</span></button></div>
    <SamplePlayer :arbol="actual.arbol" nombre="árbol actual" @nodo-activo="nodoActivo = $event" @visitados="visitados = $event" />
    <TreeResult :resultado="actual" :nodo-activo="nodoActivo" :visitados="visitados" editable @seleccionar="seleccionado = $event" />
    <div v-if="seleccionado" class="editor-actions">
      <button v-if="cambioSeleccionado?.aplicado" class="button-primary" type="button" @click="moverSeleccionado">
        {{ cambioSeleccionado.regla.codigo === 'BAJAR_SELECCION_JOIN' ? 'Mover filtro a su rama del JOIN' : 'Separar filtro en dos o más selecciones' }}
      </button>
      <p v-else class="field-help" role="status">Este nodo no tiene un movimiento habilitado. Puedes editar sus expresiones en el SQL de referencia.</p>
    </div>
  </section>
  <section class="heuristic-panel" aria-label="Transformaciones heurísticas">
    <div><p class="eyebrow">EXPERIMENTA</p><h3>Transforma el árbol y vuelve a escucharlo.</h3></div>
    <div class="editor-actions">
      <button class="button-primary" type="button" @click="transformar(false)">Aplicar siguiente regla</button>
      <button class="button-secondary" type="button" @click="transformar(true)">Aplicar reglas disponibles</button>
      <button class="button-secondary" type="button" :disabled="!pasos.length" @click="deshacer">Deshacer paso</button>
    </div>
    <p v-if="aviso" class="reader-status" role="status">{{ aviso }}</p>
    <p v-if="error" role="alert" class="error-text">{{ error }}</p>
    <details v-if="pasos.length" class="technical-details"><summary>Historial: {{ pasos.length }} transformaciones</summary><ol class="step-list"><li v-for="(paso, i) in pasos" :key="i"><strong>{{ paso.codigo }}</strong> · {{ paso.descripcion }}<details><summary>Antes y después</summary><pre>{{ expresarArbol(paso.antes) }}</pre><pre>{{ expresarArbol(paso.despues) }}</pre></details></li></ol></details>
    <details class="technical-details"><summary>Ver fórmula</summary><pre class="formula-output">{{ formula }}</pre></details>
    <details class="technical-details">
      <summary>Cómo se transforma el SQL en sonido</summary>
      <ol>
        <li>El analizador identifica las tablas y alias, las condiciones de unión, los filtros y las columnas.</li>
        <li>FROM crea las hojas. INNER JOIN conecta dos entradas, WHERE añade una selección y SELECT coloca la proyección en la raíz. DISTINCT se guarda en la proyección.</li>
        <li>El recorrido fija el orden de escucha. En postorden, primero suenan las entradas de cada operador. El piano marca una visita cada 1.5 segundos.</li>
        <li>El tipo de nodo elige el motivo. La profundidad fija su registro: con los ajustes iniciales, baja un grado pentatónico por nivel desde Sol5, hasta Sol3.</li>
      </ol>
    </details>
    <SqlReference :arbol="actual.arbol" @actualizar="actualizarDesdeSQL" />
  </section>
</template>

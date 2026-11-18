<script setup>
import { shallowRef, ref, watch, computed } from 'vue'
import TreeResult from './TreeResult.vue'
import SamplePlayer from '../audio/SamplePlayer.vue'
import { aplicarPasoHeuristico, optimizarArbol } from '../../modules/tree/heuristics.js'
import { construirArbol } from '../../modules/tree/treeLoader.js'
import { expresarArbol } from '../../modules/tree/algebra.js'
const props = defineProps({ resultado: { type: Object, required: true } })
defineEmits(['comparar'])
const actual = shallowRef(props.resultado), pasos = shallowRef([]), aviso = ref(''), error = ref(''), nodoActivo = ref(null)
watch(() => props.resultado, value => { actual.value = value; pasos.value = []; aviso.value = ''; error.value = ''; nodoActivo.value = null })
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
</script>

<template>
  <section class="heuristic-panel" aria-label="Transformaciones heurísticas">
    <h2>Explorar transformaciones</h2>
    <p class="field-help">Separar AND y bajar filtros locales por INNER JOIN. Cada paso conserva sus predicados; las reglas comprueban sus precondiciones.</p>
    <pre class="formula-output" tabindex="0">{{ formula }}</pre>
    <div class="editor-actions">
      <button class="button-primary" type="button" @click="transformar(false)">Aplicar siguiente regla</button>
      <button class="button-secondary" type="button" @click="transformar(true)">Aplicar reglas disponibles</button>
      <button class="button-secondary" type="button" :disabled="!pasos.length" @click="deshacer">Deshacer paso</button>
      <button class="button-secondary" type="button" @click="$emit('comparar', { a: resultado.arbol, b: actual.arbol })">Comparar original y actual</button>
    </div>
    <p v-if="aviso" class="reader-status" role="status">{{ aviso }}</p>
    <p v-if="error" role="alert" class="error-text">{{ error }}</p>
    <details v-if="pasos.length" class="result-details">
      <summary>Historial: {{ pasos.length }} transformaciones</summary>
      <ol class="step-list"><li v-for="(paso, i) in pasos" :key="i"><strong>{{ paso.codigo }}</strong> · {{ paso.descripcion }}<details><summary>Antes y después</summary><pre>{{ expresarArbol(paso.antes) }}</pre><pre>{{ expresarArbol(paso.despues) }}</pre></details></li></ol>
    </details>
  </section>
  <SamplePlayer :arbol="actual.arbol" nombre="árbol actual" @nodo-activo="nodoActivo = $event" />
  <TreeResult :resultado="actual" :nodo-activo="nodoActivo" />
</template>

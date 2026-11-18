<script setup>
import { ref, shallowRef, watch } from 'vue'
import { procesarAlgebra } from '../../modules/tree/algebra.js'
import ejemplo from '../../data/examples/biblioteca.algebra.txt?raw'
import TreeWorkbench from './TreeWorkbench.vue'
defineEmits(['comparar'])
const texto = ref(ejemplo), resultado = shallowRef(procesarAlgebra(ejemplo).resultado), errores = shallowRef([])
watch(texto, () => { resultado.value = null; errores.value = [] }, { flush: 'sync' })
function generar() { const respuesta = procesarAlgebra(texto.value); resultado.value = respuesta.resultado; errores.value = respuesta.errores }
</script>

<template>
  <section class="tree-reader" aria-labelledby="algebra-title">
    <h2 id="algebra-title" class="sr-only">Álgebra relacional</h2>
    <details class="entry-editor" :open="!resultado"><summary><span class="entry-icon" aria-hidden="true">π</span> Tu consulta <span class="editor-caption">Álgebra relacional · Editar</span></summary>
    <form class="reader-form" @submit.prevent="generar">
      <label for="algebra-input">Fórmula de álgebra relacional</label>
      <p id="algebra-help" class="field-help">PI[columnas](entrada), SIGMA[predicado](entrada) y JOIN[condición](izquierda, derecha). También π, σ y ⋈ con corchetes. PI elimina duplicados; PI_ALL conserva multiplicidades. Alias: Libro AS L.</p>
      <textarea id="algebra-input" v-model="texto" rows="8" aria-describedby="algebra-help" :aria-invalid="errores.length > 0" spellcheck="false"></textarea>
      <div class="editor-actions"><button type="submit" class="button-primary">Generar árbol</button><button type="button" class="button-secondary" @click="texto = ejemplo">Cargar biblioteca</button></div>
    </form>
    </details>
    <div v-if="errores.length" class="validation-errors" role="alert"><p v-for="e in errores" :key="e.mensaje">{{ e.mensaje }} <span class="error-path">{{ e.codigo }} · Columna {{ e.columna ?? '—' }}</span></p></div>
    <TreeWorkbench v-if="resultado" :resultado="resultado" @comparar="$emit('comparar', $event)" />
  </section>
</template>

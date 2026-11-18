<script setup>
import { ref, watch } from 'vue'
import { useTreeReader } from '../../composables/useTreeReader.js'
import { EJEMPLOS_ARBOL } from '../../data/examples/treeExamples.js'
import TreeWorkbench from './TreeWorkbench.vue'

defineEmits(['comparar'])

const seleccionado = ref(EJEMPLOS_ARBOL[0].id)
const props = defineProps({ entrada: { type: Object, default: null } })
const { texto, resultado, errores, estado, procesar, cargarEjemplo, cargarTexto, limpiar } = useTreeReader()
watch(() => props.entrada, entrada => {
  if (entrada) cargarTexto(entrada.texto)
}, { immediate: true })
</script>

<template>
  <section class="tree-reader" aria-labelledby="reader-title">
    <div class="section-heading">
      <div><p class="eyebrow">Lectura y construcción</p><h2 id="reader-title">Procesar un árbol desde JSON</h2></div>
      <span class="status">Modelo lógico</span>
    </div>
    <details class="entry-editor" :open="!resultado"><summary><span class="entry-icon" aria-hidden="true">{ }</span> Editar estructura JSON</summary>
    <form class="reader-form" @submit.prevent="procesar">
      <div class="example-controls">
        <div class="example-select">
          <label for="tree-example">Ejemplo de referencia</label>
          <select id="tree-example" v-model="seleccionado">
            <option v-for="ejemplo in EJEMPLOS_ARBOL" :key="ejemplo.id" :value="ejemplo.id">{{ ejemplo.nombre }}</option>
          </select>
        </div>
        <button class="button-secondary" type="button" @click="cargarEjemplo(seleccionado)">Cargar ejemplo</button>
      </div>
      <label for="tree-json">Estructura JSON</label>
      <p id="json-help" class="field-help">
        Pega un documento con una raíz y nodos anidados, o una lista de nodos con sus hijos referidos por id.
        Cargar un ejemplo reemplaza el texto del editor.
      </p>
      <textarea
        id="tree-json" v-model="texto" rows="16" spellcheck="false"
        aria-describedby="json-help" :aria-invalid="estado === 'invalido'"
        placeholder='{"version": 1, "raiz": {…}}'
      ></textarea>
      <div class="editor-actions">
        <button class="button-primary" type="submit">Procesar JSON</button>
        <button class="button-secondary" type="button" @click="limpiar">Limpiar</button>
      </div>
    </form>
    </details>
    <div v-if="errores.length" class="validation-errors" role="alert">
      <h3>No se pudo construir el árbol</h3>
      <ul>
        <li v-for="(error, indice) in errores" :key="indice">
          <strong>{{ error.mensaje }}</strong>
          <span class="error-path">{{ error.ruta }} · {{ error.codigo }}</span>
        </li>
      </ul>
    </div>
    <p class="reader-status" role="status" aria-live="polite">
      {{ estado === 'valido' ? 'Árbol válido. Resultado actualizado.' : estado === 'invalido' ? 'Revisa los errores del documento.' : 'Edita o carga un ejemplo y pulsa Procesar JSON.' }}
    </p>
    <TreeWorkbench v-if="resultado" :resultado="resultado" @comparar="$emit('comparar', $event)" />
  </section>
</template>

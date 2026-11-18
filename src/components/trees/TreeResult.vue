<script setup>
import { computed } from 'vue'
import TreeDiagram from './TreeDiagram.vue'
const props = defineProps({ resultado: { type: Object, required: true }, prefijo: { type: String, default: 'result' }, nodoActivo: { type: String, default: null }, visitados: { type: Array, default: () => [] }, mostrarLeyenda: { type: Boolean, default: true } })
const jsonNormalizado = computed(() => JSON.stringify(props.resultado.arbol, null, 2))
</script>

<template>
  <section class="tree-result" :aria-labelledby="`${prefijo}-title`">
    <h2 :id="`${prefijo}-title`" class="sr-only">Árbol lógico</h2>
    <TreeDiagram :arbol="resultado.arbol" :nombre="prefijo === 'result' ? 'Árbol lógico' : prefijo === 'comparacion-a' ? 'Árbol A' : 'Árbol B'" :nodo-activo="nodoActivo" :visitados="visitados" :mostrar-leyenda="mostrarLeyenda" />
    <details class="technical-details"><summary>Ver JSON del árbol</summary><pre class="normalized-json" tabindex="0">{{ jsonNormalizado }}</pre></details>
  </section>
</template>

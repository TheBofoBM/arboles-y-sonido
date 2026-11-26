<script setup>
import TreeDiagram from './TreeDiagram.vue'
defineProps({ resultado: { type: Object, required: true }, prefijo: { type: String, default: 'result' }, nodoActivo: { type: String, default: null }, visitados: { type: Array, default: () => [] }, mostrarLeyenda: { type: Boolean, default: true }, editable: Boolean })
defineEmits(['seleccionar'])
</script>

<template>
  <section class="tree-result" :aria-labelledby="`${prefijo}-title`">
    <h2 :id="`${prefijo}-title`" class="sr-only">Árbol lógico</h2>
    <TreeDiagram :arbol="resultado.arbol" :nombre="prefijo === 'result' ? 'Árbol lógico' : prefijo === 'comparacion-a' ? 'Árbol A' : 'Árbol B'" :nodo-activo="nodoActivo" :visitados="visitados" :mostrar-leyenda="mostrarLeyenda" :editable="editable" @seleccionar="$emit('seleccionar', $event)" />
  </section>
</template>

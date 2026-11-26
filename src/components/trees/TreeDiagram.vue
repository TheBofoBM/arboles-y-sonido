<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { distribuirArbol } from '../../modules/tree/treeLayout.js'
import OperatorLegend from './OperatorLegend.vue'
const props = defineProps({ arbol: { type: Object, required: true }, nodoActivo: { type: String, default: null }, visitados: { type: Array, default: () => [] }, nombre: { type: String, default: 'Árbol lógico' }, mostrarLeyenda: { type: Boolean, default: true }, editable: Boolean })
const emit = defineEmits(['seleccionar'])
const plano = computed(() => distribuirArbol(props.arbol))
const superficie = ref(null), ancho = ref(800), escala = ref(1), seleccionado = ref(null)
const vistos = computed(() => new Set(props.visitados))
const detalle = computed(() => plano.value.nodos.find(n => n.id === seleccionado.value))
const indice = computed(() => new Map(plano.value.nodos.map(n => [n.id, n])))
let observador
function ajustar() {
  escala.value = Math.min(1, Math.max(0.001, (ancho.value - 24) / plano.value.ancho), 450 / plano.value.alto)
  if (superficie.value) superficie.value.scrollTo({ top: 0, left: 0 })
}
function zoom(factor) { escala.value = Math.min(2, Math.max(0.001, escala.value * factor)) }
watch(() => props.arbol, () => { seleccionado.value = null; nextTick(ajustar) })
watch(seleccionado, value => emit('seleccionar', value), { flush: 'sync' })
watch(() => props.nodoActivo, async id => {
  const n = indice.value.get(id)
  if (!n) return
  await nextTick()
  const scroller = superficie.value
  if (!scroller) return
  const x = n.x * escala.value, y = (n.y + plano.value.altoNodo / 2) * escala.value
  if (x < scroller.scrollLeft + 100 || x > scroller.scrollLeft + scroller.clientWidth - 100 || y < scroller.scrollTop + 50 || y > scroller.scrollTop + scroller.clientHeight - 50) {
    scroller.scrollTo({ left: Math.max(0, x - scroller.clientWidth / 2), top: Math.max(0, y - scroller.clientHeight / 2), behavior: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
})
onMounted(() => {
  observador = new ResizeObserver(entries => { ancho.value = entries[0].contentRect.width; ajustar() })
  observador.observe(superficie.value)
})
onBeforeUnmount(() => observador?.disconnect())
const corto = (value, max = 26) => value.length > max ? value.slice(0, max - 1) + '…' : value
</script>

<template>
  <div class="tree-diagram">
    <div class="diagram-toolbar">
      <span class="direction-label">El sonido sigue los nodos iluminados</span>
      <div class="zoom-controls" aria-label="Ampliación del árbol">
        <button type="button" aria-label="Alejar árbol" @click="zoom(1 / 1.25)">−</button>
        <button type="button" aria-label="Acercar árbol" @click="zoom(1.25)">+</button>
        <button type="button" @click="ajustar">Ajustar</button>
        <button type="button" aria-label="Tamaño real del árbol" @click="escala = 1">100%</button>
      </div>
    </div>
    <div ref="superficie" class="diagram-surface" tabindex="0" :aria-label="`Lienzo de ${nombre}`">
      <div class="diagram-world" :style="{ width: `${plano.ancho * escala}px`, minWidth: '100%', height: `${Math.max(470, plano.alto * escala)}px` }">
        <svg class="tree-svg" role="group" :aria-label="nombre" :width="plano.ancho * escala" :height="plano.alto * escala" :viewBox="`0 0 ${plano.ancho} ${plano.alto}`">
          <path v-for="enlace in plano.enlaces" :key="enlace.hijoId" :d="enlace.d" class="tree-edge" :class="{ 'edge-visited': vistos.has(enlace.hijoId), 'edge-active': nodoActivo === enlace.hijoId }" :data-parent="enlace.padreId" :data-child="enlace.hijoId" />
          <g v-for="n in plano.nodos" :key="n.id" class="tree-node node-card" :class="{ 'node-active': nodoActivo === n.id, 'node-visited': vistos.has(n.id), 'node-selected': seleccionado === n.id }" :transform="`translate(${n.x - plano.anchoNodo / 2}, ${n.y})`" :style="{ '--node-color': n.estilo.color, '--node-bg': n.estilo.fondo }" :data-node-id="n.id" :data-node-type="n.tipo" :data-depth="n.profundidad" :aria-current="nodoActivo === n.id ? 'step' : undefined" role="button" tabindex="0" :aria-label="`${n.estilo.nombre}: ${n.descripcion}`" @click="seleccionado = seleccionado === n.id ? null : n.id" @keydown.enter="seleccionado = n.id" @keydown.space.prevent="seleccionado = n.id">
            <title>{{ n.estilo.nombre }}: {{ n.descripcion }}</title>
            <rect class="node-shape" :width="plano.anchoNodo" :height="plano.altoNodo" rx="18" />
            <rect class="node-icon-bg" x="12" y="16" width="44" height="44" rx="14" />
            <text class="node-symbol" x="34" y="45" text-anchor="middle" aria-hidden="true">{{ n.estilo.simbolo }}</text>
            <text class="node-name" x="68" y="30">{{ n.estilo.nombre }}</text>
            <text class="node-expression" x="68" y="51">{{ corto(n.descripcion, 21) }}</text>
            <circle v-if="nodoActivo === n.id" class="node-beacon" cx="206" cy="12" r="6" aria-hidden="true" />
          </g>
        </svg>
      </div>
    </div>
    <OperatorLegend v-if="mostrarLeyenda" />
    <div v-if="detalle" class="node-inspector" :style="{ '--operator-color': detalle.estilo.color }"><strong>{{ detalle.estilo.nombre }}</strong><p>{{ detalle.descripcion }}</p><button type="button" aria-label="Cerrar detalle del nodo" @click="seleccionado = null">×</button></div>
    <p v-else class="canvas-hint">{{ editable ? 'Selecciona un operador para inspeccionarlo y ver si se puede mover.' : 'Selecciona un nodo para ver su expresión completa.' }}</p>
  </div>
</template>

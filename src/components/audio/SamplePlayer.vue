<script setup>
import { computed, ref, watch, useId } from 'vue'
import { useSamplePlayer } from '../../composables/useSamplePlayer.js'
import { recorrerArbol } from '../../modules/tree/tree.js'
import { ESTILOS_OPERADOR } from '../../modules/tree/treeLayout.js'
const props = defineProps({ arbol: { type: Object, required: true }, nombre: { type: String, default: 'árbol' } })
const emit = defineEmits(['nodo-activo', 'visitados'])
const orden = ref('niveles'), id = useId()
const { reproduciendo, cargando, error, nodoActivo, visitados, reproducir, detener } = useSamplePlayer(computed(() => props.arbol), orden)
const nodos = computed(() => recorrerArbol(props.arbol).map(r => r.nodo))
const sonando = computed(() => nodos.value.find(n => n.id === nodoActivo.value))
const progreso = computed(() => visitados.value.length / nodos.value.length * 100)
const descripcionOrden = computed(() => ({ niveles: 'De arriba hacia abajo', preorden: 'Preorden', postorden: 'Postorden' })[orden.value])
watch(nodoActivo, value => emit('nodo-activo', value), { flush: 'sync' })
watch(visitados, value => emit('visitados', value), { flush: 'sync' })
</script>

<template>
  <section class="sample-player" :aria-label="`Sampleos de ${nombre}`">
    <div class="transport-row">
      <button type="button" class="button-primary play-button" :disabled="reproduciendo || cargando" @click="reproducir"><span aria-hidden="true">{{ cargando ? '…' : '▶' }}</span>{{ cargando ? 'Cargando sampleos…' : 'Escuchar ' + nombre }}</button>
      <button type="button" class="button-stop" :disabled="!reproduciendo && !cargando" @click="detener"><span aria-hidden="true">■</span> Detener</button>
      <span class="playback-direction"><span aria-hidden="true">↓</span> {{ descripcionOrden }}</span>
    </div>
    <div class="playback-line">
      <span class="audio-bars" :class="{ moving: reproduciendo }" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <p role="status">{{ sonando ? 'Suena: ' + ESTILOS_OPERADOR[sonando.tipo].nombre : cargando ? 'Preparando los fragmentos…' : visitados.length === nodos.length ? 'Recorrido completo. Vuelve a escucharlo.' : 'Pulsa escuchar y sigue el color.' }}</p>
    </div>
    <div class="playback-track" role="progressbar" :aria-label="`Progreso de ${nombre}`" :aria-valuenow="visitados.length" :aria-valuemax="nodos.length" aria-valuemin="0"><span :style="{ width: progreso + '%' }"></span></div>
    <div class="audio-secondary">
      <details class="audio-options"><summary>Cambiar recorrido</summary><label :for="id" class="sr-only">Recorrido</label><select :id="id" v-model="orden"><option value="niveles">De arriba hacia abajo · por niveles</option><option value="preorden">Preorden · raíz, izquierda, derecha</option><option value="postorden">Postorden · hijos antes que padre</option></select></details>
      <details class="audio-credit"><summary>Créditos del audio</summary><p>Piano: Alexander Holm, Salamander Grand Piano, CC BY 3.0. Fragmentos adaptados para este prototipo. <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">Licencia</a>.</p></details>
    </div>
    <p v-if="error" role="alert" class="error-text">{{ error }}</p>
  </section>
</template>

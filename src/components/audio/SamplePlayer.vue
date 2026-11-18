<script setup>
import { computed, ref, watch, useId } from 'vue'
import { useSamplePlayer } from '../../composables/useSamplePlayer.js'
const props = defineProps({ arbol: { type: Object, required: true }, nombre: { type: String, default: 'árbol' } })
const emit = defineEmits(['nodo-activo'])
const orden = ref('postorden'), id = useId()
const { reproduciendo, cargando, error, nodoActivo, reproducir, detener } = useSamplePlayer(computed(() => props.arbol), orden)
watch(nodoActivo, value => emit('nodo-activo', value), { flush: 'sync' })
</script>

<template>
  <section class="sample-player" :aria-label="`Sampleos de ${nombre}`">
    <h3>Escuchar sampleos · {{ nombre }}</h3>
    <p class="field-help">Fragmentos de piano compatibles, un sampleo por visita. La reproducción incluye la cola final.</p>
    <div class="editor-actions">
      <label :for="id">Recorrido
        <select :id="id" v-model="orden"><option value="postorden">Postorden</option><option value="preorden">Preorden</option></select>
      </label>
      <button type="button" class="button-primary" :disabled="reproduciendo || cargando" @click="reproducir">{{ cargando ? 'Cargando sampleos…' : 'Escuchar ' + nombre }}</button>
      <button type="button" class="button-secondary" :disabled="!reproduciendo && !cargando" @click="detener">Detener</button>
    </div>
    <p v-if="nodoActivo" role="status">Nodo en reproducción: {{ nodoActivo }}</p>
    <p v-if="error" role="alert" class="error-text">{{ error }}</p>
    <p class="audio-credit">Piano: Alexander Holm, Salamander Grand Piano, CC BY 3.0. Fragmentos adaptados para este prototipo. <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">Licencia</a>.</p>
  </section>
</template>

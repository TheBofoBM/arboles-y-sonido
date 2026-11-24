<script setup>
import { computed, ref, watch, useId } from 'vue'
import { useSamplePlayer } from '../../composables/useSamplePlayer.js'
import { recorrerArbol } from '../../modules/tree/tree.js'
import { ESTILOS_OPERADOR } from '../../modules/tree/treeLayout.js'
import { ajustesSonoros, restablecerSonido } from '../../composables/useSoundSettings.js'
import { crearSecuenciaSampleos } from '../../modules/sonification/samplePlan.js'
import { MOTIVOS } from '../../modules/sonification/music.js'
const props = defineProps({ arbol: { type: Object, required: true }, nombre: { type: String, default: 'árbol' } })
const emit = defineEmits(['nodo-activo', 'visitados'])
const orden = ref('postorden'), id = useId()
const configuracion = computed(() => ({ ...ajustesSonoros }))
const plan = computed(() => crearSecuenciaSampleos(props.arbol, orden.value, configuracion.value))
const { reproduciendo, cargando, error, nodoActivo, visitados, reproducir, detener } = useSamplePlayer(computed(() => props.arbol), orden, configuracion)
const nodos = computed(() => recorrerArbol(props.arbol).map(r => r.nodo))
const sonando = computed(() => nodos.value.find(n => n.id === nodoActivo.value))
const eventoActivo = computed(() => plan.value.eventos.find(e => e.nodoId === nodoActivo.value))
const progreso = computed(() => visitados.value.length / nodos.value.length * 100)
const descripcionOrden = computed(() => ({ niveles: 'Desde la raíz · por niveles', preorden: 'Desde la raíz · preorden', postorden: 'Desde las relaciones · postorden' })[orden.value])
watch(nodoActivo, value => emit('nodo-activo', value), { flush: 'sync' })
watch(visitados, value => emit('visitados', value), { flush: 'sync' })
</script>

<template>
  <section class="sample-player" :aria-label="`Sampleos de ${nombre}`">
    <div class="transport-row">
      <button type="button" class="button-primary play-button" :disabled="reproduciendo || cargando" @click="reproducir"><span aria-hidden="true">{{ cargando ? '…' : '▶' }}</span>{{ cargando ? 'Cargando sampleos…' : 'Escuchar ' + nombre }}</button>
      <button type="button" class="button-stop" :disabled="!reproduciendo && !cargando" @click="detener"><span aria-hidden="true">■</span> Detener</button>
      <span class="playback-direction"><span aria-hidden="true">{{ orden === 'postorden' ? '↑' : '↓' }}</span> {{ descripcionOrden }}</span>
    </div>
    <div class="playback-line">
      <span class="audio-bars" :class="{ moving: reproduciendo }" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <p role="status">{{ sonando ? 'Suena: ' + ESTILOS_OPERADOR[sonando.tipo].nombre + ' · ' + eventoActivo.nota + ' · profundidad ' + eventoActivo.profundidad : cargando ? 'Preparando los fragmentos…' : visitados.length === nodos.length ? 'Recorrido completo. Vuelve a escucharlo.' : 'Aventura orbital · una base y un motivo por operador.' }}</p>
    </div>
    <div class="playback-track" role="progressbar" :aria-label="`Progreso de ${nombre}`" :aria-valuenow="visitados.length" :aria-valuemax="nodos.length" aria-valuemin="0"><span :style="{ width: progreso + '%' }"></span></div>
    <div class="audio-secondary">
      <details class="audio-options"><summary>Cambiar recorrido</summary><label :for="id" class="sr-only">Recorrido</label><select :id="id" v-model="orden"><option value="postorden">Desde las relaciones · postorden</option><option value="niveles">Desde la raíz · por niveles</option><option value="preorden">Preorden · raíz, izquierda, derecha</option></select></details>
      <details class="audio-credit"><summary>Créditos del audio</summary><p>Motivos originales de aventura espacial. Grabaciones orquestales de VSCO 2 CE (Sam Gossner y Simon Dalzell) y VCSL (Versilian Studios), CC0 1.0. <a href="https://github.com/sgossner/VSCO-2-CE" target="_blank" rel="noreferrer">VSCO</a> · <a href="https://github.com/sgossner/VCSL" target="_blank" rel="noreferrer">VCSL</a>.</p></details>
    </div>
    <details class="sound-settings"><summary>Editar sonido · registro y base</summary>
      <p class="field-help">Más cerca de la raíz, más agudo. La profundidad se cuenta desde la raíz (0). Los ajustes se comparten con A y B.</p>
      <div class="sound-settings-grid">
        <div><label :for="`${id}-registro`">Registro de la raíz</label><select :id="`${id}-registro`" v-model.number="ajustesSonoros.registroRaiz"><option :value="10">G5 · agudo</option><option :value="5">G4 · medio</option><option :value="0">G3 · grave</option></select></div>
        <div><label :for="`${id}-paso`">Descenso por nivel</label><select :id="`${id}-paso`" v-model.number="ajustesSonoros.pasoNivel"><option :value="1">1 paso de la escala</option><option :value="2">2 pasos de la escala</option><option :value="5">1 octava</option><option :value="0">Sin variación</option></select></div>
        <div><label :for="`${id}-base`">Volumen de la base · {{ Math.round(ajustesSonoros.volumenBase * 100) }}%</label><input :id="`${id}-base`" v-model.number="ajustesSonoros.volumenBase" type="range" min="0" max="0.4" step="0.02"></div>
      </div>
      <p class="field-help">Escala de Sol mayor pentatónica. Referencias entre G3 y G5; al alcanzar G3, los niveles siguientes conservan ese registro. Con volumen 0 escuchas solo los motivos.</p>
      <ul class="motif-key"><li v-for="(motivo, tipo) in MOTIVOS" :key="tipo"><strong>{{ ESTILOS_OPERADOR[tipo].nombre }}:</strong> {{ motivo.nombre }}</li></ul>
      <button type="button" class="button-secondary" @click="restablecerSonido">Restablecer sonido</button>
    </details>
    <p v-if="error" role="alert" class="error-text">{{ error }}</p>
  </section>
</template>

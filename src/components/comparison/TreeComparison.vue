<script setup>
import { ref, watch } from 'vue'
import { useTreeComparison } from '../../composables/useTreeComparison.js'
import TreeResult from '../trees/TreeResult.vue'
import OperatorLegend from '../trees/OperatorLegend.vue'
import SamplePlayer from '../audio/SamplePlayer.vue'
const props = defineProps({ entrada: { type: Object, default: null } })
const { textoA, textoB, resultado, errores, comparar, recibir, cargarEjemplo } = useTreeComparison({ soloSQL: true })
const referencia = ref(false), activoA = ref(null), activoB = ref(null), visitasA = ref([]), visitasB = ref([])
watch(() => props.entrada, value => { if (value) recibir(value); else comparar() }, { immediate: true })
function ejemplo() { cargarEjemplo(); comparar() }
</script>

<template>
  <section class="comparison" aria-labelledby="comparison-title">
    <div class="section-heading"><div><p class="eyebrow">DOS FORMAS DE ESCUCHAR</p><h2 id="comparison-title">Un árbol junto al otro.</h2></div><button type="button" class="button-secondary" @click="ejemplo">Cargar consultas de biblioteca</button></div>
    <details class="entry-editor" :open="!resultado"><summary><span class="entry-icon" aria-hidden="true">⌘</span> Editar consultas A y B <span class="editor-caption">SQL</span></summary>
      <form @submit.prevent="comparar">
        <div class="comparison-columns">
          <div class="reader-form"><h3>Árbol A</h3><label for="texto-a">Consulta SQL A</label><textarea id="texto-a" v-model="textoA" rows="7" spellcheck="false" :aria-invalid="errores.some(e => e.arbol === 'A')"></textarea></div>
          <div class="reader-form"><h3>Árbol B</h3><label for="texto-b">Consulta SQL B</label><textarea id="texto-b" v-model="textoB" rows="7" spellcheck="false" :aria-invalid="errores.some(e => e.arbol === 'B')"></textarea></div>
        </div><div class="editor-actions"><button type="submit" class="button-primary">Generar y comparar árboles</button></div>
      </form>
    </details>
    <div v-if="errores.length" class="validation-errors" role="alert"><p v-for="(e,i) in errores" :key="i"><strong>Árbol {{ e.arbol }}:</strong> {{ e.mensaje }}</p></div>
    <template v-if="resultado">
      <div class="comparison-options">
        <div class="comparison-summary" role="status"><span class="status-dot" aria-hidden="true"></span><h3>{{ resultado.estado === 'no-demostrada' ? 'Explora sus diferencias' : 'Equivalencia reconocida' }}</h3></div>
        <label class="reference-choice"><input v-model="referencia" type="checkbox"> Ver árboles transformados</label>
      </div>
      <OperatorLegend />
      <p v-if="referencia && (!resultado.normalA.completo || !resultado.normalB.completo)" role="status" class="field-help">Se alcanzó el límite de reglas; se muestra la transformación parcial.</p>
      <div class="comparison-columns results-columns">
        <section class="comparison-card" aria-label="Resultado A"><div class="tree-side-heading"><span class="side-letter side-a">A</span><div><h3>Árbol A</h3><p>{{ referencia ? 'Con reglas heurísticas' : 'Consulta original' }}</p></div></div><SamplePlayer :arbol="(referencia ? resultado.normalA.resultado : resultado.a).arbol" nombre="A" @nodo-activo="activoA = $event" @visitados="visitasA = $event" /><TreeResult prefijo="comparacion-a" :resultado="referencia ? resultado.normalA.resultado : resultado.a" :nodo-activo="activoA" :visitados="visitasA" :mostrar-leyenda="false" /></section>
        <section class="comparison-card" aria-label="Resultado B"><div class="tree-side-heading"><span class="side-letter side-b">B</span><div><h3>Árbol B</h3><p>{{ referencia ? 'Con reglas heurísticas' : 'Consulta original' }}</p></div></div><SamplePlayer :arbol="(referencia ? resultado.normalB.resultado : resultado.b).arbol" nombre="B" @nodo-activo="activoB = $event" @visitados="visitasB = $event" /><TreeResult prefijo="comparacion-b" :resultado="referencia ? resultado.normalB.resultado : resultado.b" :nodo-activo="activoB" :visitados="visitasB" :mostrar-leyenda="false" /></section>
      </div>
      <details class="technical-details"><summary>Cómo se comparan los árboles</summary><p>{{ resultado.mensaje }}</p><p>Un sonido parecido no demuestra equivalencia. Los sampleos representan los operadores y su recorrido.</p></details>
    </template>
  </section>
</template>

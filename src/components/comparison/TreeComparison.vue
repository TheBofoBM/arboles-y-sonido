<script setup>
import { ref, watch } from 'vue'
import { useTreeComparison } from '../../composables/useTreeComparison.js'
import TreeResult from '../trees/TreeResult.vue'
import SamplePlayer from '../audio/SamplePlayer.vue'
const props = defineProps({ entrada: { type: Object, default: null } })
const { tipoA, tipoB, textoA, textoB, resultado, errores, comparar, recibir, cargarEjemplo } = useTreeComparison()
const referencia = ref(false), activoA = ref(null), activoB = ref(null)
watch(() => props.entrada, value => { if (value) recibir(value) }, { immediate: true })
</script>

<template>
  <section class="comparison" aria-labelledby="comparison-title">
    <h2 id="comparison-title">Comparar dos árboles</h2>
    <p class="field-help">A y B son entradas independientes. Puedes mezclar SQL, álgebra relacional y JSON, o comparar el árbol original con su transformación.</p>
    <form @submit.prevent="comparar">
      <div class="comparison-columns">
        <div class="reader-form"><h3>Árbol A</h3><label for="tipo-a">Entrada A</label><select id="tipo-a" v-model="tipoA"><option value="sql">SQL</option><option value="algebra">Álgebra relacional</option><option value="json">JSON</option></select><label for="texto-a">Consulta o estructura A</label><textarea id="texto-a" v-model="textoA" rows="9" spellcheck="false" :aria-invalid="errores.some(e => e.arbol === 'A')"></textarea></div>
        <div class="reader-form"><h3>Árbol B</h3><label for="tipo-b">Entrada B</label><select id="tipo-b" v-model="tipoB"><option value="sql">SQL</option><option value="algebra">Álgebra relacional</option><option value="json">JSON</option></select><label for="texto-b">Consulta o estructura B</label><textarea id="texto-b" v-model="textoB" rows="9" spellcheck="false" :aria-invalid="errores.some(e => e.arbol === 'B')"></textarea></div>
      </div>
      <div class="editor-actions"><button type="submit" class="button-primary">Generar y comparar árboles</button><button type="button" class="button-secondary" @click="cargarEjemplo">Cargar par equivalente de biblioteca</button></div>
    </form>
    <div v-if="errores.length" class="validation-errors" role="alert"><p v-for="(e,i) in errores" :key="i"><strong>Árbol {{ e.arbol }}:</strong> {{ e.mensaje }}</p></div>
    <template v-if="resultado">
      <div class="comparison-summary" role="status"><h3>{{ resultado.mensaje }}</h3><p>Diferencia B − A: {{ resultado.diferencias.nodos }} nodos; {{ resultado.diferencias.profundidad }} niveles de profundidad máxima.</p></div>
      <div class="table-scroll"><table><caption>Operadores de los árboles originales</caption><thead><tr><th>Operador</th><th>A</th><th>B</th></tr></thead><tbody><tr v-for="row in resultado.operadores" :key="row.tipo"><th>{{ row.tipo }}</th><td>{{ row.a }}</td><td>{{ row.b }}</td></tr></tbody></table></div>
      <label class="reference-choice"><input v-model="referencia" type="checkbox"> Comparar las referencias heurísticas (misma política de sampleos y recorrido)</label>
      <p class="field-help">La referencia aplica las reglas soportadas a ambos árboles. Un sonido parecido no demuestra equivalencia. El banco inicial representa operadores y orden; no codifica los valores de cada predicado.</p>
      <p v-if="referencia && (!resultado.normalA.completo || !resultado.normalB.completo)" role="status">Se alcanzó el límite de pasos en una referencia; se muestra su transformación parcial.</p>
      <div class="comparison-columns results-columns">
        <section aria-label="Resultado A"><h3>Árbol A · {{ referencia ? 'referencia heurística' : 'original' }}</h3><SamplePlayer :arbol="(referencia ? resultado.normalA.resultado : resultado.a).arbol" nombre="A" @nodo-activo="activoA = $event" /><TreeResult prefijo="comparacion-a" :resultado="referencia ? resultado.normalA.resultado : resultado.a" :nodo-activo="activoA" /></section>
        <section aria-label="Resultado B"><h3>Árbol B · {{ referencia ? 'referencia heurística' : 'original' }}</h3><SamplePlayer :arbol="(referencia ? resultado.normalB.resultado : resultado.b).arbol" nombre="B" @nodo-activo="activoB = $event" /><TreeResult prefijo="comparacion-b" :resultado="referencia ? resultado.normalB.resultado : resultado.b" :nodo-activo="activoB" /></section>
      </div>
    </template>
  </section>
</template>

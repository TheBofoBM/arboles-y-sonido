<script setup>
import { defineAsyncComponent, ref, shallowRef } from 'vue'
import ProjectOverview from './components/common/ProjectOverview.vue'
import TreeReader from './components/trees/TreeReader.vue'

const SqlReader = defineAsyncComponent(() => import('./components/sql/SqlReader.vue'))
const AlgebraReader = defineAsyncComponent(() => import('./components/trees/AlgebraReader.vue'))
const TreeComparison = defineAsyncComponent(() => import('./components/comparison/TreeComparison.vue'))
const modoEntrada = ref('json')
const transferenciaJSON = shallowRef(null)
const comparacion = shallowRef(null)
function compararVersiones(par) { comparacion.value = { ...par }; modoEntrada.value = 'comparar' }
function recibirArbol(arbol) {
  transferenciaJSON.value = { texto: JSON.stringify(arbol, null, 2) }
  modoEntrada.value = 'json'
}
</script>

<template>
  <a class="skip-link" href="#contenido">Saltar al contenido</a>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="./" aria-label="Árboles y sonido, inicio">
        <span class="brand-mark" aria-hidden="true">AS</span>
        <span>Árboles y sonido</span>
      </a>
      <span class="status">Prototipo de tesis</span>
    </header>

    <main id="contenido" tabindex="-1">
      <ProjectOverview />
      <div class="input-modes" role="group" aria-label="Tipo de entrada">
        <button type="button" :aria-pressed="modoEntrada === 'json'" @click="modoEntrada = 'json'">JSON</button>
        <button type="button" :aria-pressed="modoEntrada === 'sql'" @click="modoEntrada = 'sql'">SQL</button>
        <button type="button" :aria-pressed="modoEntrada === 'algebra'" @click="modoEntrada = 'algebra'">Álgebra relacional</button>
        <button type="button" :aria-pressed="modoEntrada === 'comparar'" @click="modoEntrada = 'comparar'">Comparar A / B</button>
      </div>
      <KeepAlive>
        <TreeReader v-if="modoEntrada === 'json'" :entrada="transferenciaJSON" @comparar="compararVersiones" />
        <SqlReader v-else-if="modoEntrada === 'sql'" @enviar-json="recibirArbol" @comparar="compararVersiones" />
        <AlgebraReader v-else-if="modoEntrada === 'algebra'" @comparar="compararVersiones" />
        <TreeComparison v-else :entrada="comparacion" />
      </KeepAlive>
    </main>

    <footer class="site-footer">
      <p>Formación en bases de datos · Prototipo académico</p>
      <p>Árboles lógicos · Reglas heurísticas · Sampleos · Comparación A / B.</p>
    </footer>
  </div>
</template>

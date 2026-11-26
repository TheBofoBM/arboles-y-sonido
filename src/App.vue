<script setup>
import { defineAsyncComponent, ref, shallowRef, watch } from 'vue'
import ProjectOverview from './components/common/ProjectOverview.vue'

const SqlReader = defineAsyncComponent(() => import('./components/sql/SqlReader.vue'))
const TreeComparison = defineAsyncComponent(() => import('./components/comparison/TreeComparison.vue'))
const modoEntrada = ref('sql')
const comparacion = shallowRef(null)
const temas = [
  { id: 'violeta', nombre: 'Violeta' },
  { id: 'oceano', nombre: 'Océano' },
  { id: 'bosque', nombre: 'Bosque' },
]
const claveTema = 'arboles-y-sonido:tema'

function leerTema() {
  try {
    const guardado = globalThis.localStorage?.getItem(claveTema)
    return temas.find(({ id }) => id === guardado)?.id ?? temas[0].id
  } catch {
    return temas[0].id
  }
}

const tema = ref(leerTema())

function aplicarTema() {
  if (globalThis.document) document.documentElement.dataset.tema = tema.value
}
aplicarTema()
watch(tema, () => {
  aplicarTema()
  try {
    globalThis.localStorage?.setItem(claveTema, tema.value)
  } catch {
    // El tema sigue disponible durante la sesión si el navegador bloquea el almacenamiento.
  }
})

function compararVersiones(par) { comparacion.value = { ...par }; modoEntrada.value = 'comparar' }
</script>

<template>
  <a class="skip-link" href="#contenido">Saltar al contenido</a>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="./" aria-label="Árboles y sonido, inicio">
        <span class="brand-mark" aria-hidden="true">AS</span>
        <span>Árboles y sonido</span>
      </a>
      <div class="header-actions">
        <span class="status">Prototipo de tesis</span>
        <label class="theme-picker">
          <span>Tema</span>
          <select v-model="tema">
            <option v-for="opcion in temas" :key="opcion.id" :value="opcion.id">{{ opcion.nombre }}</option>
          </select>
        </label>
      </div>
    </header>

    <main id="contenido" tabindex="-1">
      <ProjectOverview />
      <div class="input-modes" role="group" aria-label="Tipo de entrada">
        <button type="button" :aria-pressed="modoEntrada === 'sql'" @click="modoEntrada = 'sql'">SQL</button>
        <button type="button" :aria-pressed="modoEntrada === 'comparar'" @click="modoEntrada = 'comparar'">Comparar A / B</button>
      </div>
      <KeepAlive>
        <SqlReader v-if="modoEntrada === 'sql'" @comparar="compararVersiones" />
        <TreeComparison v-else :entrada="comparacion" />
      </KeepAlive>
    </main>

    <footer class="site-footer">
      <p>Formación en bases de datos · Prototipo académico</p>
      <p>Explora, transforma y escucha.</p>
    </footer>
  </div>
</template>

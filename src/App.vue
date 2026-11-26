<script setup>
import { defineAsyncComponent, ref, shallowRef } from 'vue'
import ProjectOverview from './components/common/ProjectOverview.vue'

const SqlReader = defineAsyncComponent(() => import('./components/sql/SqlReader.vue'))
const TreeComparison = defineAsyncComponent(() => import('./components/comparison/TreeComparison.vue'))
const temas = [
  { id: 'lavanda', nombre: 'Lavanda' },
  { id: 'bosque', nombre: 'Bosque' },
  { id: 'oceano', nombre: 'Océano' },
  { id: 'arena', nombre: 'Arena' },
]
const claveTema = 'arboles-y-sonido:tema'
const tema = ref('lavanda')
try {
  const guardado = globalThis.localStorage?.getItem(claveTema)
  if (temas.some(opcion => opcion.id === guardado)) tema.value = guardado
} catch { /* El selector también funciona sin almacenamiento. */ }

function aplicarTema() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.tema = tema.value
  try { globalThis.localStorage?.setItem(claveTema, tema.value) } catch { /* Preferencia de sesión. */ }
}
aplicarTema()

const modoEntrada = ref('sql')
const comparacion = shallowRef(null)
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
      <div class="theme-picker">
        <label for="tema-interfaz">Tema</label>
        <select id="tema-interfaz" v-model="tema" @change="aplicarTema">
          <option v-for="opcion in temas" :key="opcion.id" :value="opcion.id">{{ opcion.nombre }}</option>
        </select>
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

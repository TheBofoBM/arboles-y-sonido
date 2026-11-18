import { ref, onBeforeUnmount, onDeactivated, watch } from 'vue'
import { crearReproductorSampleos } from '../services/samplePlayer.js'
import { crearSecuenciaSampleos } from '../modules/sonification/samplePlan.js'

export function useSamplePlayer(arbol, orden) {
  const reproduciendo = ref(false), cargando = ref(false), error = ref(''), nodoActivo = ref(null)
  const reproductor = crearReproductorSampleos()
  const detener = () => { reproductor.detener(); reproduciendo.value = false; cargando.value = false; nodoActivo.value = null }
  watch([arbol, orden], detener, { flush: 'sync' })
  onDeactivated(detener)
  onBeforeUnmount(() => { void reproductor.cerrar() })
  async function reproducir() {
    error.value = ''; cargando.value = true
    try {
      const ok = await reproductor.reproducir(crearSecuenciaSampleos(arbol.value, orden.value), {
        alNodo: id => { nodoActivo.value = id },
        alFinal: () => { reproduciendo.value = false; cargando.value = false; nodoActivo.value = null },
      })
      if (ok) { reproduciendo.value = true; cargando.value = false }
    } catch (fallo) { error.value = fallo.message; cargando.value = false; reproduciendo.value = false }
  }
  return { reproduciendo, cargando, error, nodoActivo, reproducir, detener }
}

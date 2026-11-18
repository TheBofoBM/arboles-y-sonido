import { ref, shallowRef, watch } from 'vue'
import { procesarEntrada } from '../modules/tree/entry.js'
import { compararArboles } from '../modules/comparison/compareTrees.js'
import sql from '../data/examples/biblioteca.sql?raw'
import algebra from '../data/examples/biblioteca-filtrada.algebra.txt?raw'

export function useTreeComparison() {
  const tipoA = ref('sql'), tipoB = ref('algebra'), textoA = ref(sql), textoB = ref(algebra)
  const resultado = shallowRef(null), errores = shallowRef([])
  const reiniciar = () => { resultado.value = null; errores.value = [] }
  watch([tipoA, tipoB, textoA, textoB], reiniciar, { flush: 'sync' })
  function comparar() {
    reiniciar()
    const a = procesarEntrada(tipoA.value, textoA.value), b = procesarEntrada(tipoB.value, textoB.value)
    errores.value = [...a.errores.map(e => ({ ...e, arbol: 'A' })), ...b.errores.map(e => ({ ...e, arbol: 'B' }))]
    if (a.valido && b.valido) {
      try { resultado.value = compararArboles(a.resultado.arbol, b.resultado.arbol) } catch (error) { errores.value = [{ arbol: 'A/B', mensaje: error.message }] }
    }
  }
  function recibir({ a, b }) {
    tipoA.value = 'json'; tipoB.value = 'json'
    textoA.value = JSON.stringify(a, null, 2); textoB.value = JSON.stringify(b, null, 2)
    comparar()
  }
  function cargarEjemplo() { tipoA.value = 'sql'; tipoB.value = 'algebra'; textoA.value = sql; textoB.value = algebra; reiniciar() }
  return { tipoA, tipoB, textoA, textoB, resultado, errores, comparar, recibir, cargarEjemplo }
}

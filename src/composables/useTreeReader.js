import { ref, shallowRef, watch } from 'vue'
import { procesarArbolJSON } from '../modules/tree/treeLoader.js'
import { EJEMPLOS_ARBOL } from '../data/examples/treeExamples.js'

export function useTreeReader() {
  const texto = ref(JSON.stringify(EJEMPLOS_ARBOL[0].documento, null, 2))
  const resultado = shallowRef(null)
  const errores = shallowRef([])
  const estado = ref('pendiente')

  function reiniciarResultado() {
    resultado.value = null
    errores.value = []
    estado.value = 'pendiente'
  }
  // Un resultado solo describe exactamente el texto con el que fue calculado.
  watch(texto, reiniciarResultado, { flush: 'sync' })

  function procesar() {
    const respuesta = procesarArbolJSON(texto.value)
    resultado.value = respuesta.resultado
    errores.value = respuesta.errores
    estado.value = respuesta.valido ? 'valido' : 'invalido'
  }
  function cargarEjemplo(id) {
    const ejemplo = EJEMPLOS_ARBOL.find(item => item.id === id)
    if (!ejemplo) throw new TypeError('El ejemplo seleccionado no existe.')
    cargarTexto(JSON.stringify(ejemplo.documento, null, 2))
  }
  function cargarTexto(nuevoTexto) {
    if (typeof nuevoTexto !== 'string') throw new TypeError('El documento del editor debe ser texto JSON.')
    texto.value = nuevoTexto
    reiniciarResultado()
  }
  function limpiar() {
    texto.value = ''
    reiniciarResultado()
  }
  return { texto, resultado, errores, estado, procesar, cargarEjemplo, cargarTexto, limpiar }
}

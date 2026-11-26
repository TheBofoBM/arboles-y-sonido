import { ref, shallowRef, watch } from 'vue'
import { procesarSQL } from '../modules/sql/sqlToTree.js'
import biblioteca from '../data/examples/biblioteca.sql?raw'

export function useSqlReader() {
  const texto = ref(biblioteca)
  const resultado = shallowRef(null)
  const errores = shallowRef([])
  const estado = ref('pendiente')
  function reiniciar() {
    resultado.value = null
    errores.value = []
    estado.value = 'pendiente'
  }
  watch(texto, reiniciar, { flush: 'sync' })
  function procesar() {
    const respuesta = procesarSQL(texto.value)
    resultado.value = respuesta.resultado
    errores.value = respuesta.errores
    estado.value = respuesta.valido ? 'valido' : 'invalido'
  }
  function cargarEjemplo(consulta = biblioteca) { texto.value = consulta; procesar() }
  function limpiar() { texto.value = ''; reiniciar() }
  return { texto, resultado, errores, estado, procesar, cargarEjemplo, limpiar }
}

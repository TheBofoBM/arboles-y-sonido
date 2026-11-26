import { ref, shallowRef, watch } from 'vue'
import { procesarEntrada } from '../modules/tree/entry.js'
import { compararArboles } from '../modules/comparison/compareTrees.js'
import { arbolASQL } from '../modules/sql/treeToSql.js'
import sql from '../data/examples/biblioteca.sql?raw'
import algebra from '../data/examples/biblioteca-filtrada.algebra.txt?raw'

// Para un INNER JOIN, estos filtros pueden escribirse en ON o en WHERE.
const sqlB = `SELECT DISTINCT L.titulo, A.nombre
FROM Libro AS L
INNER JOIN Autor AS A
  ON L.id_autor = A.id_autor
  AND L.anio > 2020
  AND A.pais = 'México';`

export function useTreeComparison({ soloSQL = false } = {}) {
  const ejemploB = soloSQL ? sqlB : algebra
  const tipoEjemploB = soloSQL ? 'sql' : 'algebra'
  const tipoA = ref('sql'), tipoB = ref(tipoEjemploB), textoA = ref(sql), textoB = ref(ejemploB)
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
    if (soloSQL) {
      tipoA.value = 'sql'; tipoB.value = 'sql'
      for (const [arbol, entrada] of [[a, textoA], [b, textoB]]) {
        try { entrada.value = arbolASQL(arbol) } catch { entrada.value = '' }
      }
      reiniciar()
      try { resultado.value = compararArboles(a, b) } catch (error) {
        errores.value = [{ arbol: 'A/B', mensaje: error.message }]
      }
      return
    }
    tipoA.value = 'json'; tipoB.value = 'json'
    textoA.value = JSON.stringify(a, null, 2); textoB.value = JSON.stringify(b, null, 2)
    comparar()
  }
  function cargarEjemplo() { tipoA.value = 'sql'; tipoB.value = tipoEjemploB; textoA.value = sql; textoB.value = ejemploB; reiniciar() }
  return { tipoA, tipoB, textoA, textoB, resultado, errores, comparar, recibir, cargarEjemplo }
}

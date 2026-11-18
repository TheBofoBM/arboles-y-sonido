import { procesarArbolJSON } from './treeLoader.js'
import { procesarSQL } from '../sql/sqlToTree.js'
import { procesarAlgebra } from './algebra.js'

export function procesarEntrada(tipo, texto) {
  if (tipo === 'json') return procesarArbolJSON(texto)
  if (tipo === 'sql') return procesarSQL(texto)
  if (tipo === 'algebra') return procesarAlgebra(texto)
  throw new TypeError('Modalidad de entrada desconocida.')
}

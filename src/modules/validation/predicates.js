import { parse, locationOf } from 'pgsql-ast-parser'
import { leerTokensFuente } from '../sql/sqlSource.js'

/** Análisis conservador: solo AND de comparaciones puras, sin ejecutar SQL. */
export function analizarPredicado(texto) {
  if (typeof texto !== 'string' || texto.length > 20000) return null
  const prefijo = 'SELECT * FROM origen WHERE '
  let ast
  try {
    // Comparte el límite de tokens y paréntesis del lexer SQL antes de parsear.
    leerTokensFuente(texto, () => { throw new Error('Predicado fuera de límites') })
    const sentencias = parse(prefijo + texto, { locationTracking: true })
    if (sentencias.length !== 1) return null
    ast = sentencias[0]
  } catch { return null }
  if (Object.keys(ast).some(k => !['type', 'columns', 'from', 'where', '_location'].includes(k)) || !ast.where) return null
  const fragmento = expr => {
    const loc = locationOf(expr)
    return loc ? (prefijo + texto).slice(loc.start, loc.end) : ''
  }
  const clauses = []
  function operand(expr, refs) {
    const keys = Object.keys(expr).filter(k => k !== '_location')
    if (expr.type === 'ref') {
      if (keys.some(k => !['type', 'name', 'table'].includes(k))) throw new Error()
      // Identificadores simples: los casos entre comillas se mantienen opacos.
      const source = fragmento(expr)
      if (!/^[a-z_][\w$]*(?:\.[a-z_][\w$]*)?$/i.test(source)) throw new Error()
      refs.push(source.includes('.') ? source.split('.')[0].toLowerCase() : null)
      return ['columna', source.toLowerCase()]
    }
    // No usar value: el parser convierte números a Number y puede redondear
    // enteros grandes. La firma conserva la escritura literal para no afirmar
    // equivalencias falsas por pérdida de precisión.
    if (['integer', 'numeric', 'string'].includes(expr.type) && keys.every(k => ['type', 'value'].includes(k))) return [expr.type, fragmento(expr)]
    throw new Error()
  }
  function visit(expr) {
    if (expr.type !== 'binary' || Object.keys(expr).some(k => !['type', 'op', 'left', 'right', '_location'].includes(k))) throw new Error()
    if (expr.op === 'AND') { visit(expr.left); visit(expr.right); return }
    if (!['=', '!=', '<>', '<', '<=', '>', '>='].includes(expr.op) || clauses.length >= 64) throw new Error()
    const referencias = []
    const firma = JSON.stringify([expr.op, operand(expr.left, referencias), operand(expr.right, referencias)])
    clauses.push({ texto: fragmento(expr), referencias, firma })
  }
  try { visit(ast.where) } catch { return null }
  return clauses
}

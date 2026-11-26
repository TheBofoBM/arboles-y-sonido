import { construirArbol } from '../tree/treeLoader.js'
import { analizarAlgebra, expresarArbol } from '../tree/algebra.js'
import { analizarSQL } from './sqlToTree.js'
import { parse } from 'pgsql-ast-parser'
import { analizarPredicado } from '../validation/predicates.js'

/** Traducción de referencia del subconjunto de álgebra editable; nunca ejecuta SQL. */
export function arbolASQL(documento) {
  construirArbol(documento)
  // Revalida nombres, referencias y predicados. JSON puede contener texto opaco
  // o proyección extendida que no se puede traducir con este contrato.
  try { analizarAlgebra(expresarArbol(documento)) } catch {
    throw new Error('La referencia SQL admite nombres simples, comparaciones y AND, sin proyección extendida. Revisa el álgebra editable.')
  }
  let raiz = documento.raiz, columnas = '*', distinct = false, orden = []
  if (raiz.tipo === 'PROYECCION') {
    orden = raiz.parametros.orden ?? []
    columnas = raiz.parametros.atributos.join(', ')
    distinct = raiz.parametros.distinct !== false
    raiz = raiz.hijos[0]
  }
  const filtros = [], tablas = [], joins = []
  const agrupar = texto => `(${texto}${texto.includes('--') ? '\n' : ''})`
  function fuente(nodo) {
    const p = nodo.parametros
    if (nodo.tipo === 'RELACION') { tablas.push(p); return }
    if (nodo.tipo === 'SELECCION') { filtros.push(p.predicado); fuente(nodo.hijos[0]); return }
    if (nodo.tipo === 'JOIN') {
      nodo.hijos.forEach(fuente); joins.push(p.condicion); return
    }
    throw new Error('La referencia SQL todavía no traduce proyecciones intermedias: requieren subconsultas para conservar su significado.')
  }
  fuente(raiz)
  const indices = new Map(tablas.map((p, i) => [(p.alias ?? p.nombre).toLowerCase(), i]))
  const condiciones = new Map()
  for (const condicion of joins) {
    // INNER JOIN es asociativo para este subconjunto puro. Cada condición se
    // escribe cuando ya están disponibles todos sus calificadores.
    const refs = analizarPredicado(condicion).flatMap(c => c.referencias)
    const indice = Math.max(1, ...refs.map(ref => indices.get(ref) ?? 0))
    condiciones.set(indice, [...(condiciones.get(indice) ?? []), condicion])
  }
  const tabla = p => p.nombre + (p.alias ? ` AS ${p.alias}` : '')
  const desde = tablas.map((p, i) => i === 0 ? tabla(p) : `INNER JOIN ${tabla(p)}\n  ON ${condiciones.has(i) ? condiciones.get(i).map(agrupar).join(' AND ') : '1 = 1'}`).join('\n')
  // Los filtros pueden reunirse en WHERE porque todas las uniones son INNER
  // JOIN y se rechazaron las proyecciones intermedias.
  const sql = `SELECT${distinct ? ' DISTINCT' : ''} ${columnas}\nFROM ${desde}${filtros.length ? '\nWHERE ' + filtros.map(agrupar).join('\n  AND ') : ''}${orden.length ? '\nORDER BY ' + orden.join(', ') : ''};`
  try { if (orden.length) analizarSQL(sql); else parse(sql) } catch { throw new Error('Algún identificador no puede representarse en SQL sin comillas. Usa nombres simples que no sean palabras reservadas.') }
  return sql
}

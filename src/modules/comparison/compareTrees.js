import { construirArbol } from '../tree/treeLoader.js'
import { optimizarArbol } from '../tree/heuristics.js'
import { analizarPredicado } from '../validation/predicates.js'

function firma(nodo) {
  if (nodo.tipo === 'SELECCION') {
    const filtros = []
    let actual = nodo
    while (actual.tipo === 'SELECCION') {
      const clauses = analizarPredicado(actual.parametros.predicado)
      if (!clauses) break
      filtros.push(...clauses.map(c => c.firma))
      actual = actual.hijos[0]
    }
    if (filtros.length) return ['SELECCION', filtros.sort(), firma(actual)]
  }
  const p = nodo.parametros
  const params = nodo.tipo === 'RELACION' ? [p.nombre, p.alias ?? null]
    : nodo.tipo === 'PROYECCION' ? [p.atributos, p.distinct ?? true]
      : nodo.tipo === 'PROYECCION_EXTENDIDA' ? [p.expresiones]
        : nodo.tipo === 'JOIN' ? [(analizarPredicado(p.condicion)?.map(c => c.firma).sort()) ?? p.condicion]
          : [p.predicado]
  return [nodo.tipo, params, nodo.hijos.map(firma)]
}

export function firmaLogica(documento) {
  return JSON.stringify(firma(construirArbol(documento).arbol.raiz))
}

/** Un fallo de reconocimiento significa «no demostrada», nunca inequivalencia. */
export function compararArboles(arbolA, arbolB) {
  const a = construirArbol(arbolA), b = construirArbol(arbolB)
  const normalA = optimizarArbol(a.arbol), normalB = optimizarArbol(b.arbol)
  const mismaExpresion = firmaLogica(a.arbol) === firmaLogica(b.arbol)
  const equivalenciaPorReglas = normalA.completo && normalB.completo
    && firmaLogica(normalA.resultado.arbol) === firmaLogica(normalB.resultado.arbol)
  const contar = resultado => Object.fromEntries(['RELACION', 'SELECCION', 'PROYECCION', 'PROYECCION_EXTENDIDA', 'JOIN'].map(tipo => [tipo, resultado.nodos.filter(n => n.tipo === tipo).length]))
  const conteoA = contar(a), conteoB = contar(b)
  return {
    a, b, normalA, normalB, mismaExpresion, equivalenciaPorReglas,
    estado: mismaExpresion ? 'misma-expresion' : equivalenciaPorReglas ? 'equivalencia-por-reglas' : 'no-demostrada',
    mensaje: mismaExpresion ? 'Misma expresión lógica según la firma conservadora (IDs y etiquetas no intervienen).'
      : equivalenciaPorReglas ? 'Equivalencia reconocida mediante las reglas heurísticas soportadas.'
        : 'Equivalencia no demostrada por este módulo. Las diferencias no prueban que las consultas sean distintas.',
    diferencias: { nodos: b.cantidadNodos - a.cantidadNodos, profundidad: b.profundidadMaxima - a.profundidadMaxima },
    operadores: Object.keys(conteoA).map(tipo => ({ tipo, a: conteoA[tipo], b: conteoB[tipo] })),
  }
}

import { construirArbol } from './treeLoader.js'
import { analizarPredicado } from '../validation/predicates.js'

function hojas(nodo) {
  return nodo.tipo === 'RELACION' ? [nodo] : nodo.hijos.flatMap(hojas)
}
function calificador(nodo) {
  const value = nodo.parametros.alias ?? nodo.parametros.nombre
  return /^[a-z_][\w$]*$/i.test(value) ? value.toLowerCase() : null
}

/** Una transformación demostrable. Nunca atraviesa proyecciones ni cambia JOIN. */
export function aplicarPasoHeuristico(documento, nodoId = null) {
  const antes = construirArbol(documento)
  const copia = structuredClone(antes.arbol)
  const ids = new Set(antes.nodos.map(n => n.id))
  let serial = 1
  const nuevoId = () => { while (ids.has(`heuristica-${serial}`)) serial++; const id = `heuristica-${serial++}`; ids.add(id); return id }
  let regla = null
  const aliases = hojas(copia.raiz).map(calificador)
  function visit(nodo) {
    for (let i = 0; i < nodo.hijos.length; i++) {
      nodo.hijos[i] = visit(nodo.hijos[i])
      if (regla) return nodo
    }
    if (nodo.tipo !== 'SELECCION' || (nodoId !== null && nodo.id !== nodoId)) return nodo
    const clauses = analizarPredicado(nodo.parametros.predicado)
    if (!clauses) return nodo
    if (clauses.length > 1) {
      let hijo = nodo.hijos[0]
      for (let i = clauses.length - 1; i >= 0; i--) {
        hijo = { id: i === 0 ? nodo.id : nuevoId(), tipo: 'SELECCION', etiqueta: 'Selección', parametros: { predicado: clauses[i].texto }, hijos: [hijo] }
      }
      regla = { codigo: 'DESCOMPONER_AND', nodoId: nodo.id, descripcion: 'Separar una conjunción de comparaciones puras en selecciones consecutivas.' }
      return hijo
    }
    const join = nodo.hijos[0]
    if (join.tipo !== 'JOIN' || !analizarPredicado(join.parametros.condicion)) return nodo
    const refs = clauses[0].referencias
    if (!refs.length || refs.includes(null) || refs.some(ref => aliases.filter(a => a === ref).length !== 1)) return nodo
    const lado = join.hijos.findIndex(hijo => {
      const disponibles = hojas(hijo).map(calificador)
      return refs.every(ref => disponibles.includes(ref))
    })
    if (lado === -1) return nodo
    nodo.hijos = [join.hijos[lado]]
    join.hijos[lado] = nodo
    regla = { codigo: 'BAJAR_SELECCION_JOIN', nodoId: nodo.id, descripcion: `Mover la selección a la entrada ${lado === 0 ? 'izquierda' : 'derecha'} del INNER JOIN; todas sus columnas están calificadas y pertenecen solo a esa entrada.` }
    return join
  }
  copia.raiz = visit(copia.raiz)
  // Si la transformación supera los límites, no se devuelve un árbol parcial.
  let despues
  try { despues = construirArbol(copia) } catch (error) {
    return { aplicado: false, regla: null, resultado: antes, aviso: `La transformación no cabe en los límites del modelo: ${error.message}` }
  }
  return { aplicado: Boolean(regla), regla, resultado: despues, aviso: regla ? null : 'No hay otra regla aplicable con las precondiciones verificables del subconjunto.' }
}

export function optimizarArbol(documento, limite = 128) {
  if (!Number.isInteger(limite) || limite < 1 || limite > 512) throw new TypeError('El límite de pasos debe estar entre 1 y 512.')
  let resultado = construirArbol(documento)
  const pasos = []
  for (let i = 0; i < limite; i++) {
    const cambio = aplicarPasoHeuristico(resultado.arbol)
    if (!cambio.aplicado) return { resultado, pasos, completo: true, aviso: cambio.aviso }
    pasos.push({ ...cambio.regla, antes: resultado.arbol, despues: cambio.resultado.arbol })
    resultado = cambio.resultado
  }
  return { resultado, pasos, completo: false, aviso: 'Se alcanzó el límite de pasos; puedes continuar paso a paso.' }
}

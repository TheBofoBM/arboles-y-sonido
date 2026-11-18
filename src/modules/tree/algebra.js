import { construirArbol } from './treeLoader.js'
import { ErrorArbol } from './tree.js'
import { analizarPredicado } from '../validation/predicates.js'

export class ErrorAlgebra extends Error {
  constructor(mensaje, posicion = 0) {
    super(mensaje)
    this.errores = [{ codigo: 'ALGEBRA_INVALIDA', ruta: '$.algebra', mensaje, columna: posicion + 1 }]
  }
}
const identificador = /^[a-z_][\w$]*$/i
const atributo = /^[a-z_][\w$]*(?:\.[a-z_][\w$]*)?$/i

/** Gramática acotada de operadores prefijos; nunca evalúa JavaScript ni SQL. */
export function analizarAlgebra(texto) {
  if (typeof texto !== 'string' || !texto.trim()) throw new ErrorAlgebra('Escribe una expresión de álgebra relacional.')
  if (texto.length > 20000) throw new ErrorAlgebra('La expresión supera 20 000 caracteres.')
  let pos = 0, cantidad = 0
  const espacio = () => { while (/\s/u.test(texto[pos] ?? '') && pos < texto.length) pos++ }
  const fallar = mensaje => { throw new ErrorAlgebra(mensaje, pos) }
  function esperar(token) { espacio(); if (texto[pos] !== token) fallar(`Se esperaba «${token}». Usa PI[atributos](entrada), SIGMA[predicado](entrada) o JOIN[condición](izquierda, derecha).`); pos++ }
  function palabra() { espacio(); const match = texto.slice(pos).match(/^[a-z_][\w$]*|^[πσ⋈]/i); if (!match) fallar('Se esperaba una relación u operador admitido.'); pos += match[0].length; return match[0] }
  function parametros() {
    esperar('[')
    const inicio = pos
    let comilla = null
    while (pos < texto.length) {
      const c = texto[pos]
      if (comilla) {
        if (c === comilla) { if (texto[pos + 1] === comilla) { pos += 2; continue }; comilla = null }
      } else if (c === "'" || c === '"') comilla = c
      else if (c === ']') { const value = texto.slice(inicio, pos).trim(); pos++; if (!value) fallar('Los parámetros no pueden estar vacíos.'); return value }
      pos++
    }
    fallar('Falta cerrar los parámetros con ].')
  }
  function expresion(profundidad = 0) {
    if (profundidad > 64 || ++cantidad > 2000) fallar('La expresión supera la complejidad admitida (64 niveles o 2000 nodos).')
    const token = palabra(), op = token.toUpperCase()
    const aliases = { PI: 'PROYECCION', 'Π': 'PROYECCION', PI_DISTINCT: 'PROYECCION', PI_ALL: 'PROYECCION', SIGMA: 'SELECCION', 'Σ': 'SELECCION', JOIN: 'JOIN', '⋈': 'JOIN' }
    const tipo = aliases[op]
    const id = `algebra-${cantidad}`
    if (!tipo) {
      if (!identificador.test(token)) fallar('El nombre de relación no está admitido.')
      const inicioAlias = pos
      espacio()
      let alias
      if (/^AS\b/i.test(texto.slice(pos))) { palabra(); alias = palabra(); if (!identificador.test(alias)) fallar('El alias debe ser un identificador simple.') }
      else pos = inicioAlias
      return { id, tipo: 'RELACION', etiqueta: alias ? `${token} AS ${alias}` : token, parametros: alias ? { nombre: token, alias } : { nombre: token }, hijos: [] }
    }
    const value = parametros()
    let params
    if (tipo === 'PROYECCION') {
      const atributos = value.split(',').map(s => s.trim())
      if (atributos.length > 64 || atributos.some(a => !atributo.test(a))) fallar('PI admite hasta 64 columnas simples separadas por comas; no admite *, cálculos ni alias de columna.')
      if (new Set(atributos.map(a => a.toLowerCase())).size !== atributos.length) fallar('Hay columnas repetidas en la proyección.')
      params = { atributos, distinct: op !== 'PI_ALL' }
    } else {
      if (!analizarPredicado(value)) fallar('El predicado admite comparaciones entre columnas y literales de texto o número, unidas por AND, con identificadores simples.')
      params = tipo === 'JOIN' ? { condicion: value } : { predicado: value }
    }
    esperar('(')
    const hijos = [expresion(profundidad + 1)]
    if (tipo === 'JOIN') { esperar(','); hijos.push(expresion(profundidad + 1)) }
    esperar(')')
    return { id, tipo, etiqueta: tipo === 'PROYECCION' ? (params.distinct ? 'Proyección DISTINCT' : 'Proyección ALL') : tipo === 'JOIN' ? 'INNER JOIN' : 'Selección', parametros: params, hijos }
  }
  const raiz = expresion()
  espacio()
  if (pos !== texto.length) fallar('Hay texto fuera de la expresión. No se admite notación infija, subíndices u operadores adicionales.')
  function revisar(nodo) {
    if (nodo.tipo === 'RELACION') return [(nodo.parametros.alias ?? nodo.parametros.nombre).toLowerCase()]
    const calificadores = nodo.hijos.flatMap(revisar)
    if (new Set(calificadores).size !== calificadores.length) fallar('Usa alias distintos para identificar cada entrada del JOIN.')
    const refs = nodo.tipo === 'PROYECCION' ? nodo.parametros.atributos.map(a => a.includes('.') ? a.split('.')[0].toLowerCase() : null)
      : analizarPredicado(nodo.parametros.predicado ?? nodo.parametros.condicion).flatMap(c => c.referencias)
    if (refs.some(ref => ref === null ? calificadores.length !== 1 : !calificadores.includes(ref))) fallar('Una columna usa un calificador no declarado o necesita calificación al haber varias relaciones.')
    return calificadores
  }
  revisar(raiz)
  return construirArbol({ version: 1, raiz })
}

export function procesarAlgebra(texto) {
  try { return { valido: true, errores: [], resultado: analizarAlgebra(texto) } } catch (error) {
    if (!(error instanceof ErrorAlgebra) && !(error instanceof ErrorArbol)) throw error
    return { valido: false, errores: error.errores, resultado: null }
  }
}

/** Notación de presentación; PI_EXT conserva como texto las expresiones JSON. */
export function expresarArbol(documento) {
  construirArbol(documento)
  function escribir(n) {
    const p = n.parametros
    if (n.tipo === 'RELACION') return p.nombre + (p.alias ? ` AS ${p.alias}` : '')
    if (n.tipo === 'JOIN') return `JOIN[${p.condicion}](${n.hijos.map(escribir).join(', ')})`
    const operador = n.tipo === 'SELECCION' ? `SIGMA[${p.predicado}]`
      : n.tipo === 'PROYECCION' ? `${p.distinct === false ? 'PI_ALL' : 'PI'}[${p.atributos.join(', ')}]`
        : `PI_EXT[${p.expresiones.join(', ')}]`
    return `${operador}(${escribir(n.hijos[0])})`
  }
  return escribir(documento.raiz)
}

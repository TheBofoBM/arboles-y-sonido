import { describe, it, expect } from 'vitest'
import { parse } from 'pgsql-ast-parser'
import { analizarAlgebra, procesarAlgebra, expresarArbol } from '../modules/tree/algebra.js'
import { aplicarPasoHeuristico, optimizarArbol } from '../modules/tree/heuristics.js'
import { compararArboles, firmaLogica } from '../modules/comparison/compareTrees.js'
import { analizarPredicado } from '../modules/validation/predicates.js'
import { analizarSQL } from '../modules/sql/sqlToTree.js'
import { validarArbol } from '../modules/validation/treeValidation.js'
import original from '../data/examples/biblioteca.algebra.txt?raw'
import filtrada from '../data/examples/biblioteca-filtrada.algebra.txt?raw'
import sql from '../data/examples/biblioteca.sql?raw'

describe('Entrada de álgebra relacional', () => {
  it('genera el mismo contrato que SQL, conserva predicados y permite ida y vuelta', () => {
    const a = analizarAlgebra(original), b = analizarSQL(sql)
    expect(a.cantidadNodos).toBe(5)
    expect(firmaLogica(a.arbol)).toBe(firmaLogica(b.arbol))
    expect(firmaLogica(analizarAlgebra(expresarArbol(a.arbol)).arbol)).toBe(firmaLogica(a.arbol))
  })
  it('admite los símbolos y distingue conjuntos de multiplicidades', () => {
    expect(analizarAlgebra('π[Libro.titulo](σ[Libro.anio > 2020](Libro))').cantidadNodos).toBe(3)
    expect(analizarAlgebra('PI_ALL[titulo](Libro)').arbol.raiz.parametros.distinct).toBe(false)
    expect(analizarAlgebra("SIGMA[Libro.titulo = 'A] AND B'](Libro)").cantidadNodos).toBe(2)
  })
  it.each(['', null, 'PI[*](Libro)', 'PI[x](Libro) basura', 'JOIN[x = 1](Libro)', 'PI[x](Libro, Autor)', 'SIGMA[x > 1 OR x < 0](Libro)', 'SIGMA[LOWER(x) = 1](Libro)', 'PI[L.x](Libro)', 'PI[x](JOIN[Libro.id = Autor.id](Libro, Autor))', 'JOIN[L.id = L.id](Libro AS L, Autor AS L)', 'PI[x,x](Libro)', 'PI[x](Libro', 'PI[x](Libro);'])('rechaza una expresión fuera del subconjunto: %s', entrada => {
    expect(procesarAlgebra(entrada).valido).toBe(false)
    expect(procesarAlgebra(entrada).resultado).toBeNull()
  })
  it('limita profundidad y tamaño antes de desbordar la pila', () => {
    expect(procesarAlgebra('SIGMA[x > 1]('.repeat(70) + 'Libro' + ')'.repeat(70)).valido).toBe(false)
    expect(procesarAlgebra('a'.repeat(20001)).valido).toBe(false)
    expect(analizarPredicado('('.repeat(40) + 'L.x = 1' + ')'.repeat(40))).toBeNull()
  })
})

// Intérprete independiente y acotado solo para verificar las reglas en fixtures.
// No forma parte de la aplicación ni evalúa texto con eval/Function.
function evaluar(n, datos) {
  function predicado(texto, row) {
    const ast = parse('SELECT * FROM origen WHERE ' + texto)[0].where
    const valor = e => e.type === 'ref' ? row[(e.table ? e.table.name + '.' : '') + e.name] : e.value
    function decidir(e) {
      if (e.op === 'AND') return decidir(e.left) && decidir(e.right)
      const l = valor(e.left), r = valor(e.right)
      if (l == null || r == null) return false
      return ({ '=': () => l === r, '>': () => l > r, '<': () => l < r, '>=': () => l >= r, '<=': () => l <= r, '!=': () => l !== r, '<>': () => l !== r })[e.op]()
    }
    return decidir(ast)
  }
  if (n.tipo === 'RELACION') return datos[n.parametros.nombre].map(row => Object.fromEntries(Object.entries(row).map(([k,v]) => [(n.parametros.alias ?? n.parametros.nombre) + '.' + k, v])))
  if (n.tipo === 'SELECCION') return evaluar(n.hijos[0], datos).filter(row => predicado(n.parametros.predicado, row))
  if (n.tipo === 'JOIN') return evaluar(n.hijos[0], datos).flatMap(l => evaluar(n.hijos[1], datos).map(r => ({ ...l, ...r }))).filter(row => predicado(n.parametros.condicion, row))
  const rows = evaluar(n.hijos[0], datos).map(row => n.parametros.atributos.map(k => row[k]))
  return n.parametros.distinct === false ? rows : [...new Map(rows.map(row => [JSON.stringify(row), row])).values()]
}

describe('Reglas heurísticas conservadoras', () => {
  it('conserva original, IDs únicos, AND literal y la condición del JOIN', () => {
    const a = analizarAlgebra(original), snapshot = structuredClone(a.arbol)
    const o = optimizarArbol(a.arbol)
    expect(o.pasos.map(p => p.codigo)).toEqual(['DESCOMPONER_AND', 'BAJAR_SELECCION_JOIN', 'BAJAR_SELECCION_JOIN'])
    expect(a.arbol).toEqual(snapshot)
    expect(validarArbol(o.resultado.arbol).valido).toBe(true)
    expect(new Set(o.resultado.nodos.map(n => n.id)).size).toBe(o.resultado.cantidadNodos)
    expect(o.resultado.nodos.find(n => n.tipo === 'JOIN').parametros.condicion).toBe('L.id_autor = A.id_autor')
    expect(analizarPredicado("L.titulo = 'A AND B' AND L.anio > 2020")).toHaveLength(2)
  })
  it.each([true, false])('preserva filas, duplicados y filtros con NULL (DISTINCT=%s)', distinct => {
    const a = analizarAlgebra(original).arbol; a.raiz.parametros.distinct = distinct
    const data = { Libro: [{ titulo: 'Uno', anio: 2022, id_autor: 1 }, { titulo: 'Uno', anio: 2022, id_autor: 1 }, { titulo: 'Dos', anio: null, id_autor: 1 }, { titulo: 'Tres', anio: 2023, id_autor: 2 }], Autor: [{ id_autor: 1, nombre: 'Ana', pais: 'México' }, { id_autor: 2, nombre: 'Sol', pais: null }] }
    expect(evaluar(optimizarArbol(a).resultado.arbol.raiz, data)).toEqual(evaluar(a.raiz, data))
  })
  it('funciona con relaciones vacías', () => {
    const a = analizarAlgebra(original).arbol, data = { Libro: [], Autor: [] }
    expect(evaluar(optimizarArbol(a).resultado.arbol.raiz, data)).toEqual([])
  })
  it('no atraviesa proyecciones ni baja predicados de ambas entradas', () => {
    for (const formula of ['SIGMA[L.id = A.id](JOIN[L.id = A.id](Libro AS L, Autor AS A))', 'SIGMA[L.x > 1](PI[L.x](Libro AS L))']) {
      expect(aplicarPasoHeuristico(analizarAlgebra(formula).arbol).aplicado).toBe(false)
    }
  })
  it('no transforma predicados opacos ni calificadores repetidos en JSON', () => {
    const a = analizarAlgebra(original).arbol
    a.raiz.hijos[0].parametros.predicado = 'random() > 0.5'
    expect(optimizarArbol(a).pasos).toEqual([])
    const b = analizarAlgebra(filtrada).arbol
    const join = b.raiz.hijos[0]
    join.hijos[1].hijos[0].parametros.alias = 'L'
    expect(optimizarArbol(b).pasos).toEqual([])
  })
  it('indica el límite y conserva instantáneas reproducibles', () => {
    const limited = optimizarArbol(analizarAlgebra(original).arbol, 1)
    expect(limited.completo).toBe(false)
    expect(limited.pasos[0].antes).not.toEqual(limited.pasos[0].despues)
    expect(() => optimizarArbol(analizarAlgebra(original).arbol, 0)).toThrow(TypeError)
  })
})

describe('Comparación de dos árboles', () => {
  it('reconoce el par SQL/álgebra de biblioteca por reglas', () => {
    const result = compararArboles(analizarSQL(sql).arbol, analizarAlgebra(filtrada).arbol)
    expect(result.estado).toBe('equivalencia-por-reglas')
    expect(result.diferencias.nodos).toBe(1)
    expect(result.operadores.find(n => n.tipo === 'SELECCION')).toEqual({ tipo: 'SELECCION', a: 1, b: 2 })
  })
  it('ignora IDs y etiquetas, pero conserva predicados, proyección, alias y DISTINCT', () => {
    const a = analizarAlgebra(original).arbol, b = structuredClone(a)
    b.raiz.id = 'otro'; b.raiz.etiqueta = 'Otra etiqueta'
    expect(compararArboles(a, b).estado).toBe('misma-expresion')
    for (const modificar of [r => { r.raiz.parametros.distinct = false }, r => { r.raiz.parametros.atributos.reverse() }, r => { r.raiz.hijos[0].parametros.predicado = "L.anio > 2021 AND A.pais = 'México'" }]) {
      const c = structuredClone(a); modificar(c)
      expect(compararArboles(a, c).estado).toBe('no-demostrada')
    }
  })
  it('rechaza estructuras inválidas y no altera las entradas', () => {
    const a = analizarAlgebra(original).arbol, antes = structuredClone(a)
    expect(() => compararArboles(a, {})).toThrow()
    compararArboles(a, a)
    expect(a).toEqual(antes)
  })
  it('no confunde literales numéricos que Number redondea ni altera cadenas', () => {
    for (const [uno, dos] of [['9007199254740992', '9007199254740993'], ['1e999', '2e999'], ["'México'", "'méxico'"]]) {
      // JSON admite predicados textuales que el parser puede dejar opacos.
      const a = analizarAlgebra('SIGMA[L.x = 0](Libro AS L)').arbol
      const b = structuredClone(a)
      a.raiz.parametros.predicado = `L.x = ${uno}`
      b.raiz.parametros.predicado = `L.x = ${dos}`
      expect(compararArboles(a, b).estado).toBe('no-demostrada')
    }
  })
})

import { describe, it, expect } from 'vitest'
import { parse } from 'pgsql-ast-parser'
import { analizarAlgebra } from '../modules/tree/algebra.js'
import { analizarSQL } from '../modules/sql/sqlToTree.js'
import { arbolASQL } from '../modules/sql/treeToSql.js'
import { optimizarArbol } from '../modules/tree/heuristics.js'
import { compararArboles } from '../modules/comparison/compareTrees.js'
import original from '../data/examples/biblioteca.algebra.txt?raw'

describe('Álgebra y árbol a SQL de referencia', () => {
  it('permite volver al mismo árbol lógico desde el SQL y editar el filtro', () => {
    const arbol = analizarAlgebra(original).arbol
    const sql = arbolASQL(arbol)
    expect(sql).toContain('SELECT DISTINCT L.titulo, A.nombre')
    expect(sql).toContain('INNER JOIN Autor AS A')
    expect(compararArboles(arbol, analizarSQL(sql).arbol).estado).toBe('misma-expresion')
    const editado = analizarSQL(sql.replace('2020', '2024')).arbol
    expect(editado.raiz.hijos[0].parametros.predicado).toContain('2024')
    expect(arbol.raiz.hijos[0].parametros.predicado).toContain('2020')
  })
  it('conserva los filtros al traducir el árbol transformado', () => {
    const arbol = optimizarArbol(analizarAlgebra(original).arbol).resultado.arbol
    const sql = arbolASQL(arbol)
    expect(sql).toContain('L.anio > 2020')
    expect(sql).toContain("A.pais = 'México'")
    expect(compararArboles(arbol, analizarSQL(sql).arbol).estado).toBe('equivalencia-por-reglas')
  })
  it('distingue multiplicidades y admite referencias sin proyección explícita', () => {
    expect(arbolASQL(analizarAlgebra('PI_ALL[titulo](Libro)').arbol)).toBe('SELECT titulo\nFROM Libro;')
    expect(arbolASQL(analizarAlgebra('Libro').arbol)).toBe('SELECT *\nFROM Libro;')
  })
  it('preserva JOIN anidados y AND dentro de cadenas; produce SQL analizable', () => {
    const arbol = analizarAlgebra("PI[A.x](JOIN[A.id = B.id](Libro AS A, JOIN[B.id = C.id](Autor AS B, SIGMA[C.nombre = 'A AND B'](Persona AS C))))").arbol
    const sql = arbolASQL(arbol)
    expect(sql).toContain('INNER JOIN Autor AS B')
    expect(sql).toContain('INNER JOIN Persona AS C')
    expect(sql).toContain("C.nombre = 'A AND B'")
    expect(parse(sql)).toHaveLength(1)
    expect(analizarSQL(sql).cantidadNodos).toBe(7)
  })
  it('rechaza traducciones que perderían proyecciones intermedias o texto opaco', () => {
    expect(() => arbolASQL(analizarAlgebra('PI[titulo](PI[titulo](Libro))').arbol)).toThrow('proyecciones intermedias')
    const arbol = analizarAlgebra('PI[titulo](Libro)').arbol
    arbol.raiz.hijos[0].parametros.nombre = 'Libro; DROP TABLE Autor'
    expect(() => arbolASQL(arbol)).toThrow('referencia SQL')
    expect(() => arbolASQL(analizarAlgebra('PI[x](select)').arbol)).toThrow('palabras reservadas')
  })
})

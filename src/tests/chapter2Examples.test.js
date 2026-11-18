import { describe, expect, it } from 'vitest'
import { obtenerNodo, obtenerHijoIzquierdo, obtenerHijoDerecho, recorrerArbol } from '../modules/tree/tree.js'
import seleccionProyeccion from '../data/examples/seleccion-proyeccion-libro.json'
import arbolA from '../data/examples/libro-autor.json'
import arbolB from '../data/examples/libro-autor-entradas-filtradas.json'

// Contrato de los ejemplos del capítulo 2: páginas impresas 2, 6, 7 y 8.
// Comprobaciones estructurales; no ejecutan SQL ni demuestran equivalencia.
describe('Ejemplos contrastados con el capítulo 2', () => {
  it('representa la proyección de títulos posterior a la selección por año', () => {
    expect(seleccionProyeccion.raiz.parametros).toEqual({ atributos: ['Libro.titulo'] })
    expect(seleccionProyeccion.raiz.hijos[0].parametros).toEqual({ predicado: 'Libro.anio > 2020' })
    expect(recorrerArbol(seleccionProyeccion, { orden: 'postorden' }).map(({ nodo }) => nodo.tipo))
      .toEqual(['RELACION', 'SELECCION', 'PROYECCION'])
  })

  it('representa el árbol A con cinco nodos y la selección conjunta sobre el JOIN', () => {
    expect(recorrerArbol(arbolA)).toHaveLength(5)
    expect(arbolA.raiz.tipo).toBe('PROYECCION')
    const seleccion = arbolA.raiz.hijos[0]
    expect(seleccion.tipo).toBe('SELECCION')
    expect(seleccion.parametros).toEqual({ predicado: "Libro.anio > 2020 AND Autor.pais = 'México'" })
    expect(seleccion.hijos[0].tipo).toBe('JOIN')
  })

  it('conserva el postorden del árbol A descrito en la página impresa 8', () => {
    expect(recorrerArbol(arbolA, { orden: 'postorden' }).map(({ nodo }) => nodo.id))
      .toEqual(['libro', 'autor', 'join-libro-autor', 'seleccion-anio-pais', 'proyeccion-libro-autor'])
  })

  it('representa el árbol B con seis nodos y una selección en cada entrada', () => {
    expect(recorrerArbol(arbolB)).toHaveLength(6)
    expect(arbolB.raiz.tipo).toBe('PROYECCION')
    const join = arbolB.raiz.hijos[0]
    expect(join.tipo).toBe('JOIN')
    const izquierda = obtenerHijoIzquierdo(join)
    const derecha = obtenerHijoDerecho(join)
    expect(izquierda.tipo).toBe('SELECCION')
    expect(izquierda.parametros).toEqual({ predicado: 'Libro.anio > 2020' })
    expect(izquierda.hijos[0].parametros.nombre).toBe('Libro')
    expect(derecha.tipo).toBe('SELECCION')
    expect(derecha.parametros).toEqual({ predicado: "Autor.pais = 'México'" })
    expect(derecha.hijos[0].parametros.nombre).toBe('Autor')
  })

  it('conserva el postorden del árbol B descrito en la página impresa 8', () => {
    expect(recorrerArbol(arbolB, { orden: 'postorden' }).map(({ nodo }) => nodo.id))
      .toEqual(['libro', 'seleccion-anio', 'autor', 'seleccion-pais', 'join-libro-autor', 'proyeccion-libro-autor'])
  })

  it.each([['A', arbolA], ['B', arbolB]])('conserva condición de JOIN y proyección del árbol %s', (_, arbol) => {
    expect(arbol.raiz.parametros).toEqual({ atributos: ['Libro.titulo', 'Autor.nombre'] })
    expect(obtenerNodo(arbol, 'join-libro-autor').parametros)
      .toEqual({ condicion: 'Libro.id_autor = Autor.id_autor' })
  })

  it.each([['A', arbolA], ['B', arbolB]])('deriva profundidades y posiciones del árbol %s sin incorporarlas al JSON', (_, arbol) => {
    const hojas = recorrerArbol(arbol).filter(({ nodo }) => nodo.tipo === 'RELACION')
    expect(hojas.map(({ nodo, profundidad, posicion }) => [nodo.parametros.nombre, profundidad, posicion]))
      .toEqual([['Libro', 3, 0], ['Autor', 3, 1]])
    for (const { nodo } of recorrerArbol(arbol)) {
      expect(nodo).not.toHaveProperty('profundidad')
      expect(nodo).not.toHaveProperty('posicion')
    }
  })
})

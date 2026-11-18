import { describe, expect, it } from 'vitest'
import {
  ErrorArbol, crearNodo, crearArbol, obtenerRaiz, obtenerNodo, obtenerHijos,
  obtenerHijoIzquierdo, obtenerHijoDerecho, recorrerArbol,
} from '../modules/tree/tree.js'
import { validarArbol } from '../modules/validation/treeValidation.js'
import libro from '../data/examples/libro.json'
import libroAutor from '../data/examples/libro-autor.json'

function relacion(id, nombre = 'Libro') {
  return crearNodo({ id, tipo: 'RELACION', etiqueta: nombre, parametros: { nombre } })
}

function arbolAsimetrico() {
  const izquierda = crearNodo({
    id: 'seleccion', tipo: 'SELECCION', etiqueta: 'Selección',
    parametros: { predicado: 'Libro.id_libro > 0' }, hijos: [relacion('libro')],
  })
  const derecha = crearNodo({
    id: 'join-interno', tipo: 'JOIN', etiqueta: 'JOIN interno',
    parametros: { condicion: 'condición ilustrativa' }, hijos: [relacion('autor', 'Autor'), relacion('otro-libro')],
  })
  return crearArbol(crearNodo({
    id: 'raiz', tipo: 'JOIN', etiqueta: 'JOIN raíz',
    parametros: { condicion: 'condición ilustrativa' }, hijos: [izquierda, derecha],
  }))
}

describe('Creación de nodos y árboles', () => {
  it('genera identificadores distintos cuando no se proporciona id', () => {
    const datos = { tipo: 'RELACION', etiqueta: 'Libro', parametros: { nombre: 'Libro' } }
    const primero = crearNodo(datos)
    const segundo = crearNodo(datos)
    expect(typeof primero.id).toBe('string')
    expect(primero.id.length).toBeGreaterThan(0)
    expect(segundo.id).not.toBe(primero.id)
    expect(primero.hijos).toEqual([])
    expect(datos).not.toHaveProperty('id')
  })

  it('conserva el identificador explícito y copia parámetros e hijos', () => {
    const datos = {
      id: 'proyeccion', tipo: 'PROYECCION', etiqueta: 'Títulos',
      parametros: { atributos: ['Libro.titulo'] }, hijos: [relacion('libro')],
    }
    const nodo = crearNodo(datos)
    datos.parametros.atributos.push('Libro.id_libro')
    datos.hijos[0].etiqueta = 'Cambio externo'
    expect(nodo.id).toBe('proyeccion')
    expect(nodo.parametros.atributos).toEqual(['Libro.titulo'])
    expect(nodo.hijos[0].etiqueta).toBe('Libro')
  })

  it('crea una raíz única independiente del objeto original', () => {
    const raiz = relacion('libro')
    const arbol = crearArbol(raiz)
    raiz.etiqueta = 'Cambio externo'
    expect(arbol).toEqual(libro)
    expect(validarArbol(arbol).valido).toBe(true)
  })

  it.each([null, undefined, [], [libro.raiz]])('impide crear un árbol sin raíz única: %j', (raiz) => {
    expect(() => crearArbol(raiz)).toThrow(ErrorArbol)
  })

  it.each([null, [], 'Libro'])('rechaza datos de nodo que no son un objeto: %j', (datos) => {
    expect(() => crearNodo(datos)).toThrow(ErrorArbol)
  })

  it('impide construir una operación incompleta y expone los diagnósticos', () => {
    try {
      crearNodo({ tipo: 'JOIN', etiqueta: 'JOIN', parametros: { condicion: 'x = y' }, hijos: [relacion('libro')] })
      expect.fail('Debió rechazar el JOIN con una entrada')
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorArbol)
      expect(error.errores).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: 'ARIDAD_INVALIDA', ruta: '$.hijos' })]))
    }
  })

  it('detecta ids duplicados al combinar subárboles previamente válidos', () => {
    expect(() => crearNodo({
      id: 'join', tipo: 'JOIN', etiqueta: 'JOIN', parametros: { condicion: 'x = y' },
      hijos: [relacion('duplicado'), relacion('duplicado', 'Autor')],
    })).toThrow(ErrorArbol)
  })
})

describe('Consulta y orientación de entradas', () => {
  it('consulta la raíz y encuentra nodos o devuelve null', () => {
    const arbol = crearArbol(libroAutor.raiz)
    expect(obtenerRaiz(arbol)).toBe(arbol.raiz)
    expect(obtenerNodo(arbol, 'autor').parametros.nombre).toBe('Autor')
    expect(obtenerNodo(arbol, 'inexistente')).toBeNull()
    expect(obtenerNodo(arbol, arbol.raiz.id)).toBe(arbol.raiz)
  })

  it('distingue Libro a la izquierda y Autor a la derecha del JOIN', () => {
    const join = obtenerNodo(libroAutor, 'join-libro-autor')
    expect(obtenerHijoIzquierdo(join).id).toBe('libro')
    expect(obtenerHijoDerecho(join).id).toBe('autor')
    const hijos = obtenerHijos(join)
    expect(hijos.map(({ id }) => id)).toEqual(['libro', 'autor'])
    hijos.reverse()
    expect(join.hijos.map(({ id }) => id)).toEqual(['libro', 'autor'])
  })

  it('no asigna izquierda o derecha a hojas ni a operadores unarios', () => {
    const seleccion = obtenerNodo(libroAutor, 'seleccion-anio-pais')
    for (const nodo of [libro.raiz, seleccion]) {
      expect(obtenerHijoIzquierdo(nodo)).toBeNull()
      expect(obtenerHijoDerecho(nodo)).toBeNull()
    }
    expect(obtenerHijos(libro.raiz)).toEqual([])
    expect(obtenerHijos(seleccion)).toHaveLength(1)
  })

  it.each(['', ' ', null, 12])('rechaza identificadores de búsqueda inválidos: %j', (id) => {
    expect(() => obtenerNodo(libro, id)).toThrow(TypeError)
  })

  it('revalida documentos que hayan sido alterados externamente', () => {
    const arbol = crearArbol(libro.raiz)
    arbol.raiz.hijos.push(relacion('ilegal'))
    expect(() => obtenerRaiz(arbol)).toThrow(ErrorArbol)
    expect(() => obtenerNodo(arbol, 'libro')).toThrow(ErrorArbol)
    expect(() => recorrerArbol(arbol)).toThrow(ErrorArbol)
    expect(() => obtenerHijos(arbol.raiz)).toThrow(ErrorArbol)
    expect(() => obtenerHijoIzquierdo(arbol.raiz)).toThrow(ErrorArbol)
    expect(() => obtenerHijoDerecho(arbol.raiz)).toThrow(ErrorArbol)
  })
})

describe('Recorridos y metadatos derivados', () => {
  it('recorre en preorden de izquierda a derecha', () => {
    expect(recorrerArbol(arbolAsimetrico()).map(({ nodo }) => nodo.id))
      .toEqual(['raiz', 'seleccion', 'libro', 'join-interno', 'autor', 'otro-libro'])
  })

  it('recorre en postorden de izquierda a derecha', () => {
    expect(recorrerArbol(arbolAsimetrico(), { orden: 'postorden' }).map(({ nodo }) => nodo.id))
      .toEqual(['libro', 'seleccion', 'autor', 'otro-libro', 'join-interno', 'raiz'])
  })

  it('calcula profundidad, posición por nivel y contexto en un árbol asimétrico', () => {
    const registros = recorrerArbol(arbolAsimetrico())
    expect(registros.map(({ nodo, profundidad, posicion, ruta, padreId, lado, indiceHijo }) =>
      [nodo.id, profundidad, posicion, ruta, padreId, lado, indiceHijo]))
      .toEqual([
        ['raiz', 0, 0, [], null, null, null],
        ['seleccion', 1, 0, [0], 'raiz', 'izquierdo', 0],
        ['libro', 2, 0, [0, 0], 'seleccion', 'unico', 0],
        ['join-interno', 1, 1, [1], 'raiz', 'derecho', 1],
        ['autor', 2, 1, [1, 0], 'join-interno', 'izquierdo', 0],
        ['otro-libro', 2, 2, [1, 1], 'join-interno', 'derecho', 1],
      ])
  })

  it('conserva las mismas posiciones estructurales en ambos órdenes', () => {
    const arbol = arbolAsimetrico()
    const porId = (registros) => Object.fromEntries(registros.map(({ nodo, ...metadatos }) => [nodo.id, metadatos]))
    expect(porId(recorrerArbol(arbol))).toEqual(porId(recorrerArbol(arbol, { orden: 'postorden' })))
  })

  it('no inserta profundidad o posición en el JSON y devuelve referencias a los nodos', () => {
    const arbol = arbolAsimetrico()
    const antes = JSON.stringify(arbol)
    const registros = recorrerArbol(arbol)
    expect(registros[0].nodo).toBe(arbol.raiz)
    expect(JSON.stringify(arbol)).toBe(antes)
    expect(registros[0].nodo).not.toHaveProperty('profundidad')
    expect(registros[0].nodo).not.toHaveProperty('posicion')
  })

  it('calcula correctamente los metadatos de un árbol con solo una relación', () => {
    expect(recorrerArbol(libro)).toEqual([{
      nodo: libro.raiz, profundidad: 0, posicion: 0, ruta: [], padreId: null, lado: null, indiceHijo: null,
    }])
  })

  it('rechaza órdenes no implementados', () => {
    expect(() => recorrerArbol(libro, { orden: 'inorden' })).toThrow(TypeError)
  })
})

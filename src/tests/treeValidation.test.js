import { describe, expect, it } from 'vitest'
import { validarArbol, validarNodo } from '../modules/validation/treeValidation.js'
import libro from '../data/examples/libro.json'
import autor from '../data/examples/autor.json'
import seleccionProyeccion from '../data/examples/seleccion-proyeccion-libro.json'
import libroAutor from '../data/examples/libro-autor.json'
import entradasFiltradas from '../data/examples/libro-autor-entradas-filtradas.json'

const parametros = {
  RELACION: { nombre: 'Libro' },
  SELECCION: { predicado: 'Libro.anio > 2020' },
  PROYECCION: { atributos: ['Libro.titulo'] },
  JOIN: { condicion: 'Libro.id_autor = Autor.id_autor' },
}

function nodoConHijos(tipo, cantidad) {
  return {
    id: 'operacion', tipo, etiqueta: tipo, parametros: structuredClone(parametros[tipo]),
    hijos: Array.from({ length: cantidad }, (_, indice) => ({ ...structuredClone(libro.raiz), id: `hoja-${indice}` })),
  }
}

function codigos(resultado) {
  expect(resultado.valido).toBe(false)
  return resultado.errores.map(({ codigo }) => codigo)
}

describe('Contrato JSON del árbol', () => {
  it.each([
    ['Libro', libro], ['Autor', autor], ['selección y proyección', seleccionProyeccion], ['Libro con Autor', libroAutor],
    ['Libro con Autor y entradas filtradas', entradasFiltradas],
  ])('acepta el ejemplo %s y su ida y vuelta por JSON', (_, ejemplo) => {
    const copia = JSON.parse(JSON.stringify(ejemplo))
    expect(validarArbol(copia)).toEqual({ valido: true, errores: [] })
    expect(copia).toEqual(ejemplo)
  })

  it.each([null, undefined, [], 'árbol'])('rechaza documentos que no son objetos: %j', (valor) => {
    expect(codigos(validarArbol(valor))).toContain('ARBOL_INVALIDO')
  })

  it.each([undefined, null, [], [libro.raiz, autor.raiz]])('exige una raíz única: %j', (raiz) => {
    expect(codigos(validarArbol({ version: 1, raiz }))).toContain('RAIZ_INVALIDA')
  })

  it.each([undefined, 0, 2, '1'])('rechaza versiones no admitidas: %j', (version) => {
    expect(codigos(validarArbol({ version, raiz: libro.raiz }))).toContain('VERSION_NO_SOPORTADA')
  })

  it('rechaza una segunda raíz fuera del campo raiz', () => {
    expect(codigos(validarArbol({ ...libro, otraRaiz: autor.raiz }))).toContain('CAMPO_DESCONOCIDO')
  })

  it('rechaza identificadores duplicados en objetos distintos', () => {
    const arbol = structuredClone(libroAutor)
    arbol.raiz.hijos[0].id = arbol.raiz.id
    expect(codigos(validarArbol(arbol))).toContain('ID_DUPLICADO')
  })

  it('rechaza ciclos sin entrar en un recorrido infinito', () => {
    const nodo = nodoConHijos('SELECCION', 0)
    nodo.hijos.push(nodo)
    expect(codigos(validarNodo(nodo))).toContain('REFERENCIA_REPETIDA')
  })

  it('rechaza la misma instancia utilizada como dos entradas', () => {
    const nodo = nodoConHijos('JOIN', 2)
    nodo.hijos[1] = nodo.hijos[0]
    expect(codigos(validarNodo(nodo))).toContain('REFERENCIA_REPETIDA')
  })

  it('devuelve diagnósticos con código, ruta y mensaje sin modificar la entrada', () => {
    const arbol = structuredClone(libro)
    arbol.raiz.id = ''
    const antes = structuredClone(arbol)
    expect(validarArbol(arbol)).toEqual({
      valido: false,
      errores: [{ codigo: 'ID_INVALIDO', ruta: '$.raiz.id', mensaje: 'id debe ser un texto no vacío.' }],
    })
    expect(arbol).toEqual(antes)
  })
})

describe('Aridad de los operadores', () => {
  it.each([['RELACION', 0], ['SELECCION', 1], ['PROYECCION', 1], ['JOIN', 2]])(
    'acepta %s con %i hijos', (tipo, cantidad) => {
      expect(validarNodo(nodoConHijos(tipo, cantidad)).valido).toBe(true)
    },
  )

  it.each([
    ['RELACION', 1], ['RELACION', 2], ['SELECCION', 0], ['SELECCION', 2],
    ['PROYECCION', 0], ['PROYECCION', 2], ['JOIN', 0], ['JOIN', 1], ['JOIN', 3],
  ])('rechaza %s con %i hijos', (tipo, cantidad) => {
    expect(codigos(validarNodo(nodoConHijos(tipo, cantidad)))).toContain('ARIDAD_INVALIDA')
  })

  it.each([undefined, null, {}, 'Libro'])('rechaza hijos que no son un arreglo: %j', (hijos) => {
    expect(codigos(validarNodo({ ...libro.raiz, hijos }))).toContain('HIJOS_INVALIDOS')
  })

  it('rechaza huecos y entradas que no son nodos', () => {
    const nodo = nodoConHijos('SELECCION', 1)
    nodo.hijos = new Array(1)
    expect(codigos(validarNodo(nodo))).toContain('NODO_INVALIDO')
  })
})

describe('Campos y parámetros de los nodos', () => {
  it.each(['UNION', 'join', '', undefined, 'toString', new String('RELACION')])(
    'rechaza tipos no soportados: %j', (tipo) => {
      expect(codigos(validarNodo({ ...libro.raiz, tipo }))).toContain('TIPO_NO_SOPORTADO')
    },
  )

  it.each([
    ['id', '', 'ID_INVALIDO'], ['id', 1, 'ID_INVALIDO'], ['id', undefined, 'ID_INVALIDO'],
    ['etiqueta', '   ', 'ETIQUETA_INVALIDA'], ['etiqueta', null, 'ETIQUETA_INVALIDA'],
  ])('rechaza %s inválido: %j', (campo, valor, codigo) => {
    expect(codigos(validarNodo({ ...libro.raiz, [campo]: valor }))).toContain(codigo)
  })

  it.each([undefined, null, [], new Date()])('exige un objeto de parámetros: %j', (parametros) => {
    expect(codigos(validarNodo({ ...libro.raiz, parametros }))).toContain('PARAMETROS_INVALIDOS')
  })

  it.each([
    ['RELACION', { nombre: '' }, 0], ['RELACION', {}, 0],
    ['SELECCION', { predicado: ' ' }, 1], ['SELECCION', { predicado: 10 }, 1],
    ['JOIN', { condicion: null }, 2], ['JOIN', {}, 2],
  ])('exige el parámetro textual de %s: %j', (tipo, parametros, cantidad) => {
    const nodo = { ...nodoConHijos(tipo, cantidad), parametros }
    expect(codigos(validarNodo(nodo))).toContain('PARAMETRO_INVALIDO')
  })

  it.each([[], [''], ['titulo', 'titulo'], ['titulo', 1], 'titulo', new Array(1)])(
    'rechaza listas de atributos inválidas: %j', (atributos) => {
      const nodo = { ...nodoConHijos('PROYECCION', 1), parametros: { atributos } }
      expect(codigos(validarNodo(nodo))).toContain('ATRIBUTOS_INVALIDOS')
    },
  )

  it('no admite campos derivados dentro del JSON del nodo', () => {
    expect(codigos(validarNodo({ ...libro.raiz, profundidad: 2, posicion: 3 })))
      .toEqual(['CAMPO_DESCONOCIDO', 'CAMPO_DESCONOCIDO'])
  })

  it('rechaza parámetros adicionales que no están soportados', () => {
    const nodo = { ...libro.raiz, parametros: { nombre: 'Libro', filas: [] } }
    expect(codigos(validarNodo(nodo))).toContain('CAMPO_DESCONOCIDO')
  })
})

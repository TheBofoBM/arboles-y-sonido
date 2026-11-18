import { describe, expect, it } from 'vitest'
import { construirArbol, cargarArbolDesdeJSON, procesarArbolJSON, LIMITES_CARGA } from '../modules/tree/treeLoader.js'
import { ErrorArbol, recorrerArbol } from '../modules/tree/tree.js'
import { EJEMPLOS_ARBOL } from '../data/examples/treeExamples.js'
import ventas from '../data/examples/ventas.json'
import libroAutor from '../data/examples/libro-autor.json'

function relacion(id) {
  return { id, tipo: 'RELACION', etiqueta: id, parametros: { nombre: id }, hijos: [] }
}
function seleccion(id, hijo) {
  return { id, tipo: 'SELECCION', etiqueta: id, parametros: { predicado: 'anio > 2020' }, hijos: [hijo] }
}
function join(id, hijos) {
  return { id, tipo: 'JOIN', etiqueta: id, parametros: { condicion: 'x.id = y.id' }, hijos }
}
function codigos(documento) {
  const respuesta = procesarArbolJSON(JSON.stringify(documento))
  expect(respuesta.valido).toBe(false)
  expect(respuesta.resultado).toBeNull()
  expect(respuesta.errores.length).toBeGreaterThan(0)
  for (const error of respuesta.errores) expect(error).toEqual({ codigo: expect.any(String), ruta: expect.any(String), mensaje: expect.any(String) })
  return respuesta.errores.map(error => error.codigo)
}

describe('Lectura y construcción del árbol lógico', () => {
  it.each([
    ['seleccion-proyeccion', 3, 2], ['libro-autor', 5, 3], ['entradas-filtradas', 6, 3], ['ventas', 9, 5],
  ])('procesa %s y calcula nodos y profundidad', (id, cantidad, profundidad) => {
    const ejemplo = EJEMPLOS_ARBOL.find(item => item.id === id)
    const respuesta = procesarArbolJSON(JSON.stringify(ejemplo.documento))
    expect(respuesta.valido).toBe(true)
    expect(respuesta.errores).toEqual([])
    expect(respuesta.resultado.cantidadNodos).toBe(cantidad)
    expect(respuesta.resultado.profundidadMaxima).toBe(profundidad)
    expect(respuesta.resultado.enlaces).toHaveLength(cantidad - 1)
  })

  it('normaliza formatos anidado y de referencias al mismo árbol, sin depender del orden de nodos', () => {
    const nodos = recorrerArbol(libroAutor).map(({ nodo }) => ({ ...nodo, hijos: nodo.hijos.map(hijo => hijo.id) })).reverse()
    const desdeReferencias = construirArbol({ version: 1, nodos })
    expect(desdeReferencias).toEqual(construirArbol(libroAutor))
    expect(desdeReferencias.arbol).toEqual(libroAutor)
  })

  it('construye las referencias padre-hijo con entradas ordenadas y una sola raíz', () => {
    const resultado = construirArbol(libroAutor)
    expect(resultado.nodos.filter(nodo => nodo.padreId === null).map(nodo => nodo.id)).toEqual([resultado.raizId])
    expect(resultado.enlaces).toEqual(expect.arrayContaining([
      { padreId: 'join-libro-autor', hijoId: 'libro', indiceHijo: 0, lado: 'izquierdo' },
      { padreId: 'join-libro-autor', hijoId: 'autor', indiceHijo: 1, lado: 'derecho' },
    ]))
    expect(resultado.nodos.find(nodo => nodo.id === 'join-libro-autor').hijosIds).toEqual(['libro', 'autor'])
    expect(resultado.nodos.find(nodo => nodo.id === 'autor')).toMatchObject({ profundidad: 3, posicion: 1, ruta: [0, 0, 1] })
  })

  it('preserva operadores, parámetros y etiquetas y no modifica el documento de entrada', () => {
    const entrada = structuredClone(libroAutor)
    const antes = JSON.stringify(entrada)
    const resultado = construirArbol(entrada)
    expect(JSON.stringify(entrada)).toBe(antes)
    expect(resultado.arbol).toEqual(entrada)
    entrada.raiz.hijos[0].parametros.predicado = 'cambio externo'
    expect(resultado.arbol.raiz.hijos[0].parametros.predicado).toBe("Libro.anio > 2020 AND Autor.pais = 'México'")
    expect(() => JSON.stringify(resultado)).not.toThrow()
    for (const nodo of resultado.nodos) {
      expect(nodo).not.toHaveProperty('costo')
      expect(nodo).not.toHaveProperty('filas')
      expect(nodo).not.toHaveProperty('algoritmo')
    }
  })

  it('respeta las cadenas de predicado sin interpretarlas ni normalizarlas', () => {
    const documento = { version: 1, raiz: { ...seleccion('s', relacion('l')), parametros: { predicado: "  campo = 'México' AND otro >= 1  " } } }
    expect(construirArbol(documento).arbol.raiz.parametros.predicado).toBe(documento.raiz.parametros.predicado)
  })

  it('admite identificadores que coincidan con propiedades del prototipo sin confundirlos con índices', () => {
    const resultado = construirArbol({ version: 1, nodos: [seleccion('__proto__', 'constructor'), relacion('constructor')] })
    expect(resultado.raizId).toBe('__proto__')
    expect(resultado.recorridos.postorden).toEqual(['constructor', '__proto__'])
  })

  it('representa cuatro relaciones, tres JOIN, selección y proyección extendida de ventas', () => {
    const resultado = cargarArbolDesdeJSON(JSON.stringify(ventas))
    expect(resultado.nodos.filter(nodo => nodo.tipo === 'RELACION').map(nodo => nodo.parametros.nombre))
      .toEqual(['Cliente', 'Pedido', 'Detalle', 'Producto'])
    expect(resultado.nodos.filter(nodo => nodo.tipo === 'JOIN')).toHaveLength(3)
    expect(resultado.raizId).toBe('N9')
    expect(resultado.arbol.raiz.tipo).toBe('PROYECCION_EXTENDIDA')
    expect(resultado.arbol.raiz.parametros.expresiones).toContain('Detalle.cantidad * Detalle.precio_unitario AS subtotal')
    expect(resultado.nodos.find(nodo => nodo.id === 'N8').parametros.predicado)
      .toBe("Cliente.ciudad = 'Xalapa' AND Pedido.estado = 'Pagado' AND Pedido.fecha >= '2026-10-01' AND Pedido.fecha < '2026-11-01'")
    expect(resultado.nodos.filter(nodo => nodo.tipo === 'JOIN').map(nodo => nodo.parametros.condicion)).toEqual([
      'Detalle.id_producto = Producto.id_producto', 'Pedido.id_pedido = Detalle.id_pedido', 'Cliente.id_cliente = Pedido.id_cliente',
    ])
    expect(resultado.recorridos.preorden).toEqual(['N9', 'N8', 'N7', 'N5', 'N3', 'N1', 'N2', 'N4', 'N6'])
    expect(resultado.recorridos.postorden).toEqual(['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9'])
  })
})

describe('Errores comprensibles de importación', () => {
  it.each(['', '  ', '\n'])('rechaza texto vacío: %j', texto => {
    expect(procesarArbolJSON(texto).errores[0].codigo).toBe('JSON_VACIO')
  })
  it.each(['{', '{"version":1,}', "{'version':1}", 'undefined'])('rechaza sintaxis JSON inválida: %s', texto => {
    expect(procesarArbolJSON(texto)).toEqual({
      valido: false, resultado: null,
      errores: [{ codigo: 'JSON_INVALIDO', ruta: '$', mensaje: expect.stringContaining('comillas dobles') }],
    })
  })
  it.each([undefined, null, {}, 42])('rechaza entrada que no sea texto: %j', entrada => {
    expect(procesarArbolJSON(entrada).errores[0].codigo).toBe('ENTRADA_INVALIDA')
  })
  it.each([null, [], 12, 'texto'])('rechaza documentos JSON que no son árboles: %j', documento => {
    expect(codigos(documento)).toContain('ARBOL_INVALIDO')
  })
  it('lanza ErrorArbol desde la API estricta y permite usar la API de resultado sin excepciones de usuario', () => {
    expect(() => cargarArbolDesdeJSON('{')).toThrow(ErrorArbol)
    expect(procesarArbolJSON('{').valido).toBe(false)
  })
  it('rechaza formatos mezclados', () => {
    expect(codigos({ ...libroAutor, nodos: [] })).toContain('FORMATO_AMBIGUO')
  })
  it('rechaza referencias textuales dentro del formato anidado', () => {
    expect(codigos({ version: 1, raiz: seleccion('s', 'no-existe') })).toContain('NODO_INVALIDO')
  })
  it('mantiene la validación de ids únicos en el formato anidado', () => {
    const documento = { version: 1, raiz: join('j', [relacion('r'), relacion('r')]) }
    expect(codigos(documento)).toContain('ID_DUPLICADO')
  })
  it('rechaza ciclos al construir desde objetos anidados', () => {
    const raiz = seleccion('s', null)
    raiz.hijos[0] = raiz
    expect(() => construirArbol({ version: 1, raiz })).toThrow(ErrorArbol)
  })
})

describe('Integridad de referencias y raíz única', () => {
  it.each([null, {}, []])('rechaza listas de nodos inválidas o vacías: %j', nodos => {
    expect(codigos({ version: 1, nodos })).toContain('NODOS_INVALIDOS')
  })
  it('rechaza un documento sin raiz ni nodos', () => {
    expect(codigos({ version: 1 })).toContain('RAIZ_INVALIDA')
  })
  it('rechaza una versión desconocida', () => {
    expect(codigos({ version: 2, nodos: [relacion('r')] })).toContain('VERSION_NO_SOPORTADA')
  })
  it('rechaza campos desconocidos y definiciones incompletas con rutas del documento original', () => {
    const respuesta = procesarArbolJSON(JSON.stringify({ version: 1, extra: true, nodos: [{ ...relacion('r'), etiqueta: '' }] }))
    expect(respuesta.errores).toEqual(expect.arrayContaining([
      expect.objectContaining({ codigo: 'CAMPO_DESCONOCIDO', ruta: '$.extra' }),
      expect.objectContaining({ codigo: 'ETIQUETA_INVALIDA', ruta: '$.nodos[0].etiqueta' }),
    ]))
  })
  it('rechaza definiciones que no son nodos', () => {
    expect(codigos({ version: 1, nodos: [null] })).toContain('NODO_INVALIDO')
  })
  it('rechaza ids duplicados antes de construir las referencias', () => {
    expect(codigos({ version: 1, nodos: [relacion('r'), relacion('r')] })).toContain('ID_DUPLICADO')
  })
  it.each([null, 10, {}, ''])('rechaza referencias inválidas: %j', referencia => {
    expect(codigos({ version: 1, nodos: [seleccion('s', referencia)] })).toContain('REFERENCIA_INVALIDA')
  })
  it('detecta referencias inexistentes con su ruta exacta', () => {
    const respuesta = procesarArbolJSON(JSON.stringify({ version: 1, nodos: [seleccion('s', 'ausente')] }))
    expect(respuesta.errores).toContainEqual({
      codigo: 'REFERENCIA_INEXISTENTE', ruta: '$.nodos[0].hijos[0]', mensaje: 'No existe un nodo con el identificador ausente.',
    })
  })
  it('detecta más de una raíz sin elegir una arbitrariamente', () => {
    expect(codigos({ version: 1, nodos: [relacion('a'), relacion('b')] })).toContain('RAIZ_NO_UNICA')
  })
  it('detecta un ciclo y ausencia de raíz', () => {
    const errores = codigos({ version: 1, nodos: [seleccion('a', 'b'), seleccion('b', 'a')] })
    expect(errores).toContain('CICLO_DETECTADO')
    expect(errores).toContain('RAIZ_NO_UNICA')
  })
  it('detecta una autorreferencia', () => {
    expect(codigos({ version: 1, nodos: [seleccion('a', 'a')] })).toContain('CICLO_DETECTADO')
  })
  it('detecta ciclos en un componente separado aunque exista una única raíz', () => {
    const errores = codigos({ version: 1, nodos: [relacion('raiz'), seleccion('a', 'b'), seleccion('b', 'a')] })
    expect(errores).toContain('CICLO_DETECTADO')
    expect(errores).toContain('NODOS_DESCONECTADOS')
    expect(errores).not.toContain('RAIZ_NO_UNICA')
  })
  it('rechaza un nodo con dos padres aunque no haya ciclos', () => {
    expect(codigos({ version: 1, nodos: [join('j', ['a', 'b']), seleccion('a', 'r'), seleccion('b', 'r'), relacion('r')] }))
      .toContain('MULTIPLES_PADRES')
  })
  it('rechaza un mismo hijo repetido en las dos entradas de un JOIN', () => {
    expect(codigos({ version: 1, nodos: [join('j', ['r', 'r']), relacion('r')] })).toContain('MULTIPLES_PADRES')
  })
  it.each([
    ['RELACION', { nombre: 'Libro' }, ['r']], ['SELECCION', { predicado: 'anio > 2020' }, []],
    ['PROYECCION', { atributos: ['titulo'] }, []], ['PROYECCION_EXTENDIDA', { expresiones: ['cantidad * precio'] }, []],
    ['JOIN', { condicion: 'x = y' }, ['r']],
  ])('reutiliza la validación de aridad de %s', (tipo, parametros, hijos) => {
    expect(codigos({ version: 1, nodos: [{ id: 'op', tipo, etiqueta: tipo, parametros, hijos }, relacion('r')] }))
      .toContain('ARIDAD_INVALIDA')
  })
  it.each([[], [''], ['x', 'x'], 'x', undefined])('valida las expresiones de la proyección extendida: %j', expresiones => {
    const op = { id: 'p', tipo: 'PROYECCION_EXTENDIDA', etiqueta: 'Reporte', parametros: { expresiones }, hijos: ['r'] }
    expect(codigos({ version: 1, nodos: [op, relacion('r')] })).toContain('EXPRESIONES_INVALIDAS')
  })
})

describe('Límites de carga de la interfaz', () => {
  it('rechaza árboles anidados demasiado profundos antes de la validación y clonación completas', () => {
    let raiz = relacion('r')
    for (let i = 0; i <= LIMITES_CARGA.profundidad; i += 1) raiz = seleccion(`s-${i}`, raiz)
    expect(codigos({ version: 1, raiz })).toContain('LIMITE_PROFUNDIDAD')
  })
  it('aplica también el límite de nodos al formato anidado', () => {
    const hijos = Array.from({ length: LIMITES_CARGA.nodos }, (_, i) => relacion(`r-${i}`))
    expect(codigos({ version: 1, raiz: join('raiz', hijos) })).toContain('LIMITE_NODOS')
  })
  it('rechaza texto que exceda el límite antes de analizarlo', () => {
    expect(procesarArbolJSON(' '.repeat(LIMITES_CARGA.caracteres) + '{}').errores[0].codigo).toBe('LIMITE_TEXTO')
  })
  it('rechaza demasiados nodos antes de construirlos', () => {
    expect(codigos({ version: 1, nodos: Array.from({ length: LIMITES_CARGA.nodos + 1 }, (_, i) => relacion(`r-${i}`)) }))
      .toContain('LIMITE_NODOS')
  })
  it('acepta el límite de profundidad y rechaza una arista adicional', () => {
    const cadena = cantidad => ({ version: 1, nodos: [
      ...Array.from({ length: cantidad }, (_, i) => seleccion(`s-${i}`, i === cantidad - 1 ? 'r' : `s-${i + 1}`)), relacion('r'),
    ] })
    expect(construirArbol(cadena(LIMITES_CARGA.profundidad)).profundidadMaxima).toBe(LIMITES_CARGA.profundidad)
    expect(codigos(cadena(LIMITES_CARGA.profundidad + 1))).toContain('LIMITE_PROFUNDIDAD')
  })
})

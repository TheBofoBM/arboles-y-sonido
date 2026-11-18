import { ErrorArbol, crearArbol, recorrerArbol } from './tree.js'
import { validarArbol, validarDefinicionNodo } from '../validation/treeValidation.js'

export const LIMITES_CARGA = Object.freeze({ caracteres: 1_000_000, nodos: 2000, profundidad: 128 })

function fallar(codigo, ruta, mensaje) {
  throw new ErrorArbol([{ codigo, ruta, mensaje }])
}

function exigirValidez({ valido, errores }) {
  if (!valido) throw new ErrorArbol(errores)
}

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    && (Object.getPrototypeOf(valor) === Object.prototype || Object.getPrototypeOf(valor) === null)
}

/** Comprueba ciclos en TODOS los componentes, incluso los separados de la raíz. */
function detectarCiclos(indice, adyacencias, errores) {
  const color = new Map()
  for (const inicio of indice.keys()) {
    if (color.has(inicio)) continue
    color.set(inicio, 1)
    const pila = [{ id: inicio, siguiente: 0 }]
    while (pila.length > 0) {
      const actual = pila[pila.length - 1]
      const hijos = adyacencias.get(actual.id)
      if (actual.siguiente === hijos.length) {
        color.set(actual.id, 2)
        pila.pop()
        continue
      }
      const { id: hijoId, posicion } = hijos[actual.siguiente++]
      if (color.get(hijoId) === 1) {
        errores.push({
          codigo: 'CICLO_DETECTADO', ruta: `$.nodos[${indice.get(actual.id).posicion}].hijos[${posicion}]`,
          mensaje: `La referencia de ${actual.id} a ${hijoId} forma un ciclo.`,
        })
      } else if (!color.has(hijoId)) {
        color.set(hijoId, 1)
        pila.push({ id: hijoId, siguiente: 0 })
      }
    }
  }
}

function normalizarReferencias(documento) {
  const errores = []
  for (const campo of Object.keys(documento)) {
    if (campo !== 'version' && campo !== 'nodos') {
      errores.push({ codigo: 'CAMPO_DESCONOCIDO', ruta: `$.${campo}`, mensaje: `El campo ${campo} no pertenece al formato de referencias.` })
    }
  }
  if (documento.version !== 1) {
    errores.push({ codigo: 'VERSION_NO_SOPORTADA', ruta: '$.version', mensaje: 'Solo se admite la versión 1 del modelo.' })
  }
  if (!Array.isArray(documento.nodos) || documento.nodos.length === 0) {
    errores.push({ codigo: 'NODOS_INVALIDOS', ruta: '$.nodos', mensaje: 'nodos debe ser una lista no vacía de definiciones de nodo.' })
    throw new ErrorArbol(errores)
  }
  if (documento.nodos.length > LIMITES_CARGA.nodos) fallar('LIMITE_NODOS', '$.nodos', `Se admiten hasta ${LIMITES_CARGA.nodos} nodos por carga.`)

  const indice = new Map()
  documento.nodos.forEach((nodo, posicion) => {
    for (const error of validarDefinicionNodo(nodo).errores) {
      errores.push({ ...error, ruta: `$.nodos[${posicion}]${error.ruta.slice(1)}` })
    }
    if (!esObjeto(nodo) || typeof nodo.id !== 'string' || !nodo.id.trim()) return
    if (indice.has(nodo.id)) {
      errores.push({ codigo: 'ID_DUPLICADO', ruta: `$.nodos[${posicion}].id`, mensaje: `El identificador ${nodo.id} está repetido.` })
    } else indice.set(nodo.id, { nodo, posicion })
  })

  const adyacencias = new Map([...indice.keys()].map(id => [id, []]))
  const entradas = new Map([...indice.keys()].map(id => [id, 0]))
  for (const [id, { nodo, posicion }] of indice) {
    if (!Array.isArray(nodo.hijos)) continue
    for (let hijo = 0; hijo < nodo.hijos.length; hijo += 1) {
      const hijoId = nodo.hijos[hijo]
      const ruta = `$.nodos[${posicion}].hijos[${hijo}]`
      if (typeof hijoId !== 'string' || !hijoId.trim()) {
        errores.push({ codigo: 'REFERENCIA_INVALIDA', ruta, mensaje: 'Cada hijo debe ser el identificador textual de un nodo.' })
      } else if (!indice.has(hijoId)) {
        errores.push({ codigo: 'REFERENCIA_INEXISTENTE', ruta, mensaje: `No existe un nodo con el identificador ${hijoId}.` })
      } else {
        adyacencias.get(id).push({ id: hijoId, posicion: hijo })
        entradas.set(hijoId, entradas.get(hijoId) + 1)
      }
    }
  }
  for (const [id, cantidad] of entradas) {
    if (cantidad > 1) errores.push({
      codigo: 'MULTIPLES_PADRES', ruta: `$.nodos[${indice.get(id).posicion}]`,
      mensaje: `El nodo ${id} recibe ${cantidad} referencias de entrada; un árbol no admite hijos compartidos ni repetidos.`,
    })
  }
  const raices = [...entradas.keys()].filter(id => entradas.get(id) === 0)
  if (raices.length !== 1) errores.push({
    codigo: 'RAIZ_NO_UNICA', ruta: '$.nodos', mensaje: `Se requiere una sola raíz (nodo sin padre); se encontraron ${raices.length}.`,
  })
  detectarCiclos(indice, adyacencias, errores)
  if (raices.length === 1) {
    const alcanzados = new Set()
    const pendientes = [raices[0]]
    while (pendientes.length) {
      const id = pendientes.pop()
      if (alcanzados.has(id)) continue
      alcanzados.add(id)
      for (const hijo of adyacencias.get(id)) pendientes.push(hijo.id)
    }
    if (alcanzados.size !== indice.size) errores.push({
      codigo: 'NODOS_DESCONECTADOS', ruta: '$.nodos', mensaje: 'Hay nodos que no se pueden alcanzar desde la raíz.',
    })
  }
  if (errores.length) throw new ErrorArbol(errores)

  const construidos = new Map([...indice].map(([id, { nodo }]) => [id, { ...nodo, hijos: [] }]))
  for (const [id, { nodo }] of indice) construidos.get(id).hijos = nodo.hijos.map(hijoId => construidos.get(hijoId))
  return { version: 1, raiz: construidos.get(raices[0]) }
}

function comprobarLimites(arbol) {
  if (!esObjeto(arbol) || !esObjeto(arbol.raiz)) return
  let cantidad = 0
  const visitados = new WeakSet()
  const pendientes = [{ nodo: arbol.raiz, profundidad: 0 }]
  while (pendientes.length) {
    const { nodo, profundidad } = pendientes.pop()
    if (++cantidad > LIMITES_CARGA.nodos) fallar('LIMITE_NODOS', '$', `Se admiten hasta ${LIMITES_CARGA.nodos} nodos por carga.`)
    if (profundidad > LIMITES_CARGA.profundidad) fallar('LIMITE_PROFUNDIDAD', '$', `La profundidad máxima admitida es ${LIMITES_CARGA.profundidad}.`)
    if (!esObjeto(nodo) || visitados.has(nodo)) continue
    visitados.add(nodo)
    if (Array.isArray(nodo.hijos)) {
      for (const hijo of nodo.hijos) pendientes.push({ nodo: hijo, profundidad: profundidad + 1 })
    }
  }
}

/** Normaliza uno de los dos formatos y prepara datos serializables para la interfaz. */
export function construirArbol(documento) {
  if (esObjeto(documento) && Object.hasOwn(documento, 'nodos') && Object.hasOwn(documento, 'raiz')) {
    fallar('FORMATO_AMBIGUO', '$', 'Utiliza raiz con nodos anidados o nodos con referencias, sin mezclar ambos formatos.')
  }
  const normalizado = esObjeto(documento) && Object.hasOwn(documento, 'nodos')
    ? normalizarReferencias(documento) : documento
  comprobarLimites(normalizado)
  exigirValidez(validarArbol(normalizado))
  const arbol = crearArbol(normalizado.raiz)
  const preorden = recorrerArbol(arbol)
  const postorden = recorrerArbol(arbol, { orden: 'postorden' })
  const nodos = preorden.map(({ nodo, ...metadatos }) => ({
    id: nodo.id, tipo: nodo.tipo, etiqueta: nodo.etiqueta, parametros: nodo.parametros,
    hijosIds: nodo.hijos.map(hijo => hijo.id), ...metadatos,
  }))
  const enlaces = nodos.filter(nodo => nodo.padreId !== null).map(nodo => ({
    padreId: nodo.padreId, hijoId: nodo.id, indiceHijo: nodo.indiceHijo, lado: nodo.lado,
  }))
  return {
    arbol, raizId: arbol.raiz.id, nodos, enlaces, cantidadNodos: nodos.length,
    profundidadMaxima: Math.max(...nodos.map(nodo => nodo.profundidad)),
    recorridos: { preorden: preorden.map(({ nodo }) => nodo.id), postorden: postorden.map(({ nodo }) => nodo.id) },
  }
}

/** Lee texto JSON sin evaluar expresiones y construye el árbol lógico. */
export function cargarArbolDesdeJSON(texto) {
  if (typeof texto !== 'string') fallar('ENTRADA_INVALIDA', '$', 'La entrada debe ser texto JSON.')
  if (!texto.trim()) fallar('JSON_VACIO', '$', 'Pega una estructura JSON antes de procesarla.')
  if (texto.length > LIMITES_CARGA.caracteres) fallar('LIMITE_TEXTO', '$', `El JSON no puede superar ${LIMITES_CARGA.caracteres} caracteres.`)
  let documento
  try { documento = JSON.parse(texto) } catch {
    fallar('JSON_INVALIDO', '$', 'El texto no es un JSON válido. Revisa las comillas dobles, las comas y las llaves.')
  }
  return construirArbol(documento)
}

/** Frontera de errores de usuario; los errores de programación no se ocultan. */
export function procesarArbolJSON(texto) {
  try { return { valido: true, errores: [], resultado: cargarArbolDesdeJSON(texto) } } catch (error) {
    if (!(error instanceof ErrorArbol)) throw error
    return { valido: false, errores: error.errores, resultado: null }
  }
}

import { validarArbol, validarNodo } from '../validation/treeValidation.js'

/**
 * @typedef {Object} Nodo
 * @property {string} id Único dentro de su árbol.
 * @property {'RELACION'|'SELECCION'|'PROYECCION'|'PROYECCION_EXTENDIDA'|'JOIN'} tipo
 * @property {string} etiqueta Texto de presentación, independiente de los parámetros.
 * @property {{nombre: string, alias?: string}|{predicado: string}|{atributos: string[], distinct?: boolean}|{expresiones: string[]}|{condicion: string}} parametros
 * @property {Nodo[]} hijos Entradas ordenadas de la operación.
 *
 * @typedef {{version: 1, raiz: Nodo}} Arbol
 */

/** Error de dominio con la misma lista de diagnósticos que los validadores. */
export class ErrorArbol extends Error {
  constructor(errores) {
    super(errores.map(({ ruta, mensaje }) => `${ruta}: ${mensaje}`).join('\n'))
    this.name = 'ErrorArbol'
    this.errores = errores
  }
}

function exigirValidez(resultado) {
  if (!resultado.valido) throw new ErrorArbol(resultado.errores)
}

/** Crea una copia independiente del subárbol; id e hijos tienen valores por defecto. */
export function crearNodo(datos = {}) {
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new ErrorArbol([{ codigo: 'NODO_INVALIDO', ruta: '$', mensaje: 'Los datos del nodo deben ser un objeto.' }])
  }
  const nodo = {
    id: Object.hasOwn(datos, 'id') ? datos.id : globalThis.crypto.randomUUID(),
    hijos: [],
    ...datos,
  }
  exigirValidez(validarNodo(nodo))
  return structuredClone(nodo)
}

/** Crea un documento con exactamente una raíz y comprueba todos los identificadores. */
export function crearArbol(raiz) {
  const arbol = { version: 1, raiz }
  exigirValidez(validarArbol(arbol))
  return structuredClone(arbol)
}

export function obtenerRaiz(arbol) {
  exigirValidez(validarArbol(arbol))
  return arbol.raiz
}

/** Devuelve una copia del arreglo; los nodos contenidos conservan su identidad. */
export function obtenerHijos(nodo) {
  exigirValidez(validarNodo(nodo))
  return [...nodo.hijos]
}

export function obtenerHijoIzquierdo(nodo) {
  exigirValidez(validarNodo(nodo))
  return nodo.tipo === 'JOIN' ? nodo.hijos[0] : null
}

export function obtenerHijoDerecho(nodo) {
  exigirValidez(validarNodo(nodo))
  return nodo.tipo === 'JOIN' ? nodo.hijos[1] : null
}

/**
 * Recorre de izquierda a derecha y devuelve nodos con metadatos derivados.
 * profundidad y posicion comienzan en 0; posicion es el índice dentro del nivel.
 * No incorpora estos datos al JSON ni modifica los nodos originales.
 */
export function recorrerArbol(arbol, { orden = 'preorden' } = {}) {
  exigirValidez(validarArbol(arbol))
  if (orden !== 'preorden' && orden !== 'postorden') {
    throw new TypeError('orden debe ser preorden o postorden.')
  }

  const resultado = []
  const posiciones = new Map()
  const pendientes = [{
    registro: { nodo: arbol.raiz, profundidad: 0, ruta: [], padreId: null, lado: null, indiceHijo: null },
    visitado: false,
  }]

  while (pendientes.length > 0) {
    const { registro, visitado } = pendientes.pop()
    if (visitado) {
      resultado.push(registro)
      continue
    }

    const { nodo, profundidad, ruta } = registro
    registro.posicion = posiciones.get(profundidad) ?? 0
    posiciones.set(profundidad, registro.posicion + 1)
    if (orden === 'preorden') resultado.push(registro)
    else pendientes.push({ registro, visitado: true })

    for (let indice = nodo.hijos.length - 1; indice >= 0; indice -= 1) {
      pendientes.push({
        registro: {
          nodo: nodo.hijos[indice],
          profundidad: profundidad + 1,
          ruta: [...ruta, indice],
          padreId: nodo.id,
          lado: nodo.tipo === 'JOIN' ? (indice === 0 ? 'izquierdo' : 'derecho') : 'unico',
          indiceHijo: indice,
        },
        visitado: false,
      })
    }
  }
  return resultado
}

/** Busca un identificador exacto; devuelve null cuando no existe. */
export function obtenerNodo(arbol, id) {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new TypeError('id debe ser un texto no vacío.')
  }
  return recorrerArbol(arbol).find(({ nodo }) => nodo.id === id)?.nodo ?? null
}

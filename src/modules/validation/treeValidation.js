import { OPERADORES } from '../tree/operators.js'

const CAMPOS_NODO = new Set(['id', 'tipo', 'etiqueta', 'parametros', 'hijos'])
const CAMPOS_ARBOL = new Set(['version', 'raiz'])
const PARAMETRO_POR_TIPO = Object.freeze({
  RELACION: 'nombre',
  SELECCION: 'predicado',
  PROYECCION: 'atributos',
  PROYECCION_EXTENDIDA: 'expresiones',
  JOIN: 'condicion',
})

function esObjeto(valor) {
  return valor !== null && typeof valor === 'object'
    && (Object.getPrototypeOf(valor) === Object.prototype || Object.getPrototypeOf(valor) === null)
}

function esTexto(valor) {
  return typeof valor === 'string' && valor.trim().length > 0
}

function agregarError(errores, codigo, ruta, mensaje) {
  errores.push({ codigo, ruta, mensaje })
}

function revisarCampos(objeto, permitidos, ruta, errores) {
  for (const campo of Object.keys(objeto)) {
    if (!permitidos.has(campo)) {
      agregarError(errores, 'CAMPO_DESCONOCIDO', `${ruta}.${campo}`, `El campo ${campo} no forma parte del modelo.`)
    }
  }
}

function revisarParametros(nodo, ruta, errores) {
  const parametros = nodo.parametros
  if (!esObjeto(parametros)) {
    agregarError(errores, 'PARAMETROS_INVALIDOS', ruta, 'parametros debe ser un objeto JSON.')
    return
  }

  const campo = PARAMETRO_POR_TIPO[nodo.tipo]
  const permitidos = new Set([campo])
  if (nodo.tipo === 'RELACION') permitidos.add('alias')
  if (nodo.tipo === 'PROYECCION') { permitidos.add('distinct'); permitidos.add('orden') }
  revisarCampos(parametros, permitidos, ruta, errores)
  if (nodo.tipo === 'RELACION' && Object.hasOwn(parametros, 'alias') && !esTexto(parametros.alias)) {
    agregarError(errores, 'ALIAS_INVALIDO', `${ruta}.alias`, 'alias debe ser un texto no vacío cuando se proporciona.')
  }
  if (nodo.tipo === 'PROYECCION' && Object.hasOwn(parametros, 'orden')
      && (!Array.isArray(parametros.orden) || !parametros.orden.length || parametros.orden.length > 64
        || parametros.orden.some(valor => typeof valor !== 'string' || !valor.trim()))) {
    agregarError(errores, 'ORDEN_INVALIDO', `${ruta}.orden`, 'orden debe contener entre 1 y 64 criterios de ordenamiento.')
  }
  if (nodo.tipo === 'PROYECCION' && Object.hasOwn(parametros, 'distinct') && typeof parametros.distinct !== 'boolean') {
    agregarError(errores, 'DISTINCT_INVALIDO', `${ruta}.distinct`, 'distinct debe ser true o false cuando se proporciona.')
  }
  if (nodo.tipo === 'PROYECCION' || nodo.tipo === 'PROYECCION_EXTENDIDA') {
    const valores = parametros[campo]
    if (!Array.isArray(valores) || valores.length === 0
      || !Array.from(valores).every(esTexto) || new Set(valores).size !== valores.length) {
      const codigo = campo === 'atributos' ? 'ATRIBUTOS_INVALIDOS' : 'EXPRESIONES_INVALIDAS'
      agregarError(errores, codigo, `${ruta}.${campo}`, `Se requiere una lista no vacía de ${campo} de texto, sin duplicados.`)
    }
  } else if (!esTexto(parametros[campo])) {
    agregarError(errores, 'PARAMETRO_INVALIDO', `${ruta}.${campo}`, `${campo} debe ser un texto no vacío.`)
  }
}

function revisarDefinicion(nodo, ruta, errores) {
  revisarCampos(nodo, CAMPOS_NODO, ruta, errores)
  if (!esTexto(nodo.id)) {
    agregarError(errores, 'ID_INVALIDO', `${ruta}.id`, 'id debe ser un texto no vacío.')
  }
  if (!esTexto(nodo.etiqueta)) {
    agregarError(errores, 'ETIQUETA_INVALIDA', `${ruta}.etiqueta`, 'etiqueta debe ser un texto no vacío.')
  }
  const soportado = typeof nodo.tipo === 'string' && Object.hasOwn(OPERADORES, nodo.tipo)
  if (!soportado) {
    agregarError(errores, 'TIPO_NO_SOPORTADO', `${ruta}.tipo`, `El tipo debe ser uno de: ${Object.keys(OPERADORES).join(', ')}.`)
  } else {
    revisarParametros(nodo, `${ruta}.parametros`, errores)
  }
  if (!Array.isArray(nodo.hijos)) {
    agregarError(errores, 'HIJOS_INVALIDOS', `${ruta}.hijos`, 'hijos debe ser un arreglo ordenado de nodos o referencias, según el formato.')
  } else if (soportado && nodo.hijos.length !== OPERADORES[nodo.tipo].aridad) {
    agregarError(errores, 'ARIDAD_INVALIDA', `${ruta}.hijos`, `${nodo.tipo} requiere exactamente ${OPERADORES[nodo.tipo].aridad} hijos; recibió ${nodo.hijos.length}.`)
  }
}

/** Valida campos, parámetros y aridad; no examina el contenido de hijos. */
export function validarDefinicionNodo(nodo) {
  const errores = []
  if (!esObjeto(nodo)) agregarError(errores, 'NODO_INVALIDO', '$', 'Cada nodo debe ser un objeto JSON.')
  else revisarDefinicion(nodo, '$', errores)
  return { valido: errores.length === 0, errores }
}

function revisarNodos(raiz, rutaInicial, errores) {
  const pendientes = [{ nodo: raiz, ruta: rutaInicial }]
  const referencias = new WeakSet()
  const identificadores = new Set()

  while (pendientes.length > 0) {
    const { nodo, ruta } = pendientes.pop()
    if (!esObjeto(nodo)) {
      agregarError(errores, 'NODO_INVALIDO', ruta, 'Cada nodo debe ser un objeto JSON.')
      continue
    }
    if (referencias.has(nodo)) {
      agregarError(errores, 'REFERENCIA_REPETIDA', ruta, 'Un nodo no puede repetirse: no se permiten ciclos ni subárboles compartidos.')
      continue
    }
    referencias.add(nodo)
    revisarDefinicion(nodo, ruta, errores)

    if (esTexto(nodo.id) && identificadores.has(nodo.id)) {
      agregarError(errores, 'ID_DUPLICADO', `${ruta}.id`, `El identificador ${nodo.id} está repetido en el árbol.`)
    } else if (esTexto(nodo.id)) {
      identificadores.add(nodo.id)
    }
    if (!Array.isArray(nodo.hijos)) continue
    for (let indice = nodo.hijos.length - 1; indice >= 0; indice -= 1) {
      pendientes.push({ nodo: nodo.hijos[indice], ruta: `${ruta}.hijos[${indice}]` })
    }
  }
}

/** Valida un nodo y todo su subárbol sin modificarlo. */
export function validarNodo(nodo) {
  const errores = []
  revisarNodos(nodo, '$', errores)
  return { valido: errores.length === 0, errores }
}

/** Valida la versión del documento, la raíz única y todo el árbol. */
export function validarArbol(arbol) {
  const errores = []
  if (!esObjeto(arbol)) {
    agregarError(errores, 'ARBOL_INVALIDO', '$', 'El árbol debe ser un objeto con version y una sola raiz.')
    return { valido: false, errores }
  }
  revisarCampos(arbol, CAMPOS_ARBOL, '$', errores)
  if (arbol.version !== 1) {
    agregarError(errores, 'VERSION_NO_SOPORTADA', '$.version', 'Solo se admite la versión 1 del modelo.')
  }
  if (!esObjeto(arbol.raiz)) {
    agregarError(errores, 'RAIZ_INVALIDA', '$.raiz', 'Se requiere una sola raíz de tipo nodo; no se admiten árboles vacíos ni listas de raíces.')
  } else {
    revisarNodos(arbol.raiz, '$.raiz', errores)
  }
  return { valido: errores.length === 0, errores }
}

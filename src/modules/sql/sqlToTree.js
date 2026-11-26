import { parse, locationOf } from 'pgsql-ast-parser'
import { construirArbol } from '../tree/treeLoader.js'
import { ErrorArbol } from '../tree/tree.js'
import { esPalabra, leerTokensFuente } from './sqlSource.js'

export const LIMITES_SQL = Object.freeze({ caracteres: 20000, tablas: 16, columnas: 64, condiciones: 64 })

export class ErrorSQL extends Error {
  constructor(errores) {
    super(errores.map(error => error.mensaje).join('\n'))
    this.name = 'ErrorSQL'
    this.errores = errores
  }
}

/** Un SELECT del subconjunto PostgreSQL hacia el documento canónico de versión 1. */
export function analizarSQL(sql) {
  function fallar(codigo, mensaje, offset = 0) {
    const previo = typeof sql === 'string' ? sql.slice(0, offset) : ''
    const lineas = previo.split('\n')
    throw new ErrorSQL([{ codigo, ruta: '$.sql', mensaje, linea: lineas.length, columna: lineas.at(-1).length + 1 }])
  }
  if (typeof sql !== 'string') fallar('SQL_ENTRADA_INVALIDA', 'La consulta debe ser texto SQL.')
  if (!sql.trim()) fallar('SQL_VACIO', 'Escribe una consulta SELECT antes de procesarla.')
  if (sql.length > LIMITES_SQL.caracteres) fallar('SQL_LIMITE', `La consulta no puede superar ${LIMITES_SQL.caracteres} caracteres.`)
  const tokens = leerTokensFuente(sql, fallar)
  let sentencias
  try { sentencias = parse(sql, { locationTracking: true }) } catch (error) {
    if (error instanceof RangeError) fallar('SQL_LIMITE', 'La consulta supera la complejidad admitida por el parser.')
    // El parser incluye un extracto de la consulta y una lista interna de reglas;
    // no se muestran como mensaje de usuario.
    fallar('SQL_SINTAXIS_INVALIDA', 'La consulta no tiene una sintaxis válida para el dialecto PostgreSQL admitido. Revisa SELECT, FROM, ON, comas y comillas.', error.token?.offset ?? sql.length)
  }
  if (sentencias.length !== 1) fallar('SQL_UNA_SENTENCIA', 'Introduce exactamente una consulta SELECT; no se admiten varias sentencias.')
  const ast = sentencias[0]
  if (ast.type !== 'select') fallar('SQL_NO_SOPORTADO', 'Solo se admite una consulta SELECT sin CTE ni operaciones de conjuntos.')
  if (!esPalabra(tokens[0], 'SELECT')) fallar('SQL_NO_SOPORTADO', 'La consulta debe comenzar por SELECT, sin paréntesis exteriores ni sentencias vacías previas.')
  const puntosComa = tokens.filter(token => token.texto === ';' && token.nivel === 0)
  if (puntosComa.length > 1 || (puntosComa.length === 1 && puntosComa[0] !== tokens.at(-1))) {
    fallar('SQL_UNA_SENTENCIA', 'Se admite una única consulta SELECT con un solo punto y coma opcional al final.')
  }

  function campos(objeto, permitidos, descripcion) {
    const nombres = { orderBy: 'ORDER BY', groupBy: 'GROUP BY', having: 'HAVING', limit: 'LIMIT/OFFSET', alias: 'alias de columna', schema: 'nombres con esquema' }
    for (const campo of Object.keys(objeto)) {
      if (campo !== '_location' && !permitidos.includes(campo)) {
        fallar('SQL_NO_SOPORTADO', `${descripcion}: no se admite la construcción ${nombres[campo] ?? campo}.`, locationOf(objeto)?.start)
      }
    }
  }
  function fuente(nodo) {
    const ubicacion = locationOf(nodo)
    if (!ubicacion || ubicacion.end <= ubicacion.start) fallar('SQL_FUENTE_INVALIDA', 'No se pudo recuperar el texto original de la consulta.')
    return sql.slice(ubicacion.start, ubicacion.end)
  }
  campos(ast, ['type', 'columns', 'distinct', 'from', 'where', 'orderBy'], 'SELECT')
  if (ast.distinct !== undefined && ast.distinct !== 'distinct' && ast.distinct !== 'all') {
    fallar('SQL_NO_SOPORTADO', 'Se admite DISTINCT sobre todas las columnas proyectadas; DISTINCT ON no está soportado.')
  }
  if (!ast.from?.length) fallar('SQL_FROM_REQUERIDO', 'La consulta debe incluir FROM con una tabla de entrada.')
  if (ast.from.length > LIMITES_SQL.tablas || ast.columns.length > LIMITES_SQL.columnas) {
    fallar('SQL_LIMITE', 'Se admiten hasta 16 tablas y 64 columnas por consulta.')
  }

  const inicioPrimeraTabla = locationOf(ast.from[0]).start
  const indiceFrom = tokens.findLastIndex((token, i) => token.inicio < inicioPrimeraTabla
    && token.nivel === 0 && esPalabra(token, 'FROM') && tokens[i - 1]?.texto !== '.')
  const indiceWhere = ast.where ? tokens.findLastIndex((token, i) => token.inicio < locationOf(ast.where).start
    && token.nivel === 0 && esPalabra(token, 'WHERE') && tokens[i - 1]?.texto !== '.') : -1
  if (indiceFrom < 0 || (ast.where && indiceWhere < 0)) fallar('SQL_FUENTE_INVALIDA', 'No se pudieron localizar las cláusulas originales de forma segura.')
  const finConsulta = puntosComa[0]?.inicio ?? tokens.at(-1)?.fin ?? sql.length
  const indiceOrden = ast.orderBy?.length ? tokens.findIndex((token, i) => i > indiceFrom
    && token.nivel === 0 && esPalabra(token, 'ORDER') && esPalabra(tokens[i + 1], 'BY')) : -1
  if (ast.orderBy?.length && indiceOrden < 0) fallar('SQL_FUENTE_INVALIDA', 'No se pudo localizar ORDER BY.')
  const finDatos = indiceOrden < 0 ? finConsulta : tokens[indiceOrden].inicio
  const inicioColumnas = tokens[ast.distinct ? 1 : 0]?.fin
  const partesColumnas = []
  let inicioParte = inicioColumnas
  for (const token of tokens) {
    if (token.inicio < inicioColumnas || token.inicio >= tokens[indiceFrom]?.inicio) continue
    if (token.nivel === 0 && token.texto === ',') {
      partesColumnas.push(sql.slice(inicioParte, token.inicio).trim())
      inicioParte = token.fin
    }
  }
  partesColumnas.push(sql.slice(inicioParte, tokens[indiceFrom]?.inicio).trim())
  if (partesColumnas.length !== ast.columns.length) fallar('SQL_FUENTE_INVALIDA', 'No se pudieron conservar las columnas originales de forma segura.')

  const ambito = new Map()
  const tablas = []
  const joins = []
  let numeroCondiciones = 0

  function identificador(token) {
    if (!token || !['palabra', 'identificador'].includes(token.tipo)) {
      fallar('SQL_FUENTE_INVALIDA', 'No se pudo recuperar un identificador original de forma segura.')
    }
    return token.tipo === 'identificador' ? token.texto.slice(1, -1).replaceAll('""', '"') : token.texto.toLowerCase()
  }
  function tokensDe(nodo) {
    const rango = locationOf(nodo)
    return tokens.filter(token => token.inicio >= rango.start && token.fin <= rango.end)
  }
  function referencia(expr, alcance) {
    campos(expr, ['type', 'name', 'table'], 'Referencia de columna')
    if (expr.name === '*') fallar('SQL_NO_SOPORTADO', 'Especifica las columnas; no se admiten * ni tabla.*.', locationOf(expr)?.start)
    let tabla
    if (expr.table) {
      campos(expr.table, ['name'], 'Calificador de columna')
      tabla = alcance.get(identificador(tokensDe(expr.table)[0]))
      if (!tabla) fallar('SQL_REFERENCIA_NO_DECLARADA', `El calificador ${fuente(expr.table)} no corresponde a una tabla o alias disponible.`, locationOf(expr)?.start)
    } else {
      if (alcance.size !== 1) fallar('SQL_COLUMNA_AMBIGUA', `Califica la columna ${fuente(expr)} con su tabla o alias cuando interviene más de una tabla.`, locationOf(expr)?.start)
      tabla = [...alcance.values()][0]
    }
    return { tablaId: tabla.id, nombre: identificador(tokensDe(expr).at(-1)) }
  }
  function operando(expr, alcance) {
    if (expr.type === 'ref') return referencia(expr, alcance)
    if (['integer', 'numeric', 'string'].includes(expr.type)) {
      campos(expr, ['type', 'value'], 'Literal')
      return
    }
    fallar('SQL_NO_SOPORTADO', 'Los predicados admiten solo columnas y literales de texto o número, sin funciones, cálculos ni subconsultas.', locationOf(expr)?.start)
  }
  function predicado(expr, alcance) {
    const pendientes = [expr]
    const condiciones = []
    while (pendientes.length) {
      const actual = pendientes.pop()
      if (actual.type !== 'binary') fallar('SQL_NO_SOPORTADO', 'Usa comparaciones unidas por AND; no se admiten NOT, IN, BETWEEN, IS NULL u otras formas de predicado.', locationOf(actual)?.start)
      campos(actual, ['type', 'left', 'right', 'op'], 'Predicado')
      if (actual.op === 'AND') { pendientes.push(actual.right, actual.left); continue }
      if (!['=', '!=', '<>', '<', '<=', '>', '>='].includes(actual.op)) {
        fallar('SQL_NO_SOPORTADO', `El operador ${actual.op} no está soportado; usa comparaciones y AND.`, locationOf(actual)?.start)
      }
      if (++numeroCondiciones > LIMITES_SQL.condiciones) fallar('SQL_LIMITE', 'Se admiten hasta 64 comparaciones entre ON y WHERE.')
      operando(actual.left, alcance)
      operando(actual.right, alcance)
      condiciones.push(fuente(actual))
    }
    return condiciones
  }
  function nodo(id, tipo, etiqueta, parametros, hijos = []) { return { id, tipo, etiqueta, parametros, hijos } }

  let entrada
  for (let i = 0; i < ast.from.length; i += 1) {
    const tabla = ast.from[i]
    if (tabla.type !== 'table') fallar('SQL_NO_SOPORTADO', 'FROM solo admite tablas simples, sin subconsultas, funciones ni joins entre paréntesis.')
    campos(tabla, ['type', 'name', 'join'], 'FROM')
    campos(tabla.name, ['name', 'alias'], 'Nombre de tabla')
    if (i === 0 && tabla.join) fallar('SQL_NO_SOPORTADO', 'La primera entrada de FROM debe ser una tabla simple.')
    if (i > 0 && (!tabla.join || tabla.join.type !== 'INNER JOIN' || !tabla.join.on)) {
      fallar('SQL_NO_SOPORTADO', 'Se admiten únicamente INNER JOIN (o JOIN) con ON; no se admiten comas, USING, NATURAL ni JOIN externos.')
    }
    if (tabla.join) campos(tabla.join, ['type', 'on'], 'JOIN')
    const ubicacion = locationOf(tabla.name)
    const indiceNombre = tokens.findIndex(token => token.inicio === ubicacion.start)
    const tokenNombre = tokens[indiceNombre]
    const tokenAlias = tabla.name.alias === undefined ? null
      : tokens[indiceNombre + (esPalabra(tokens[indiceNombre + 1], 'AS') ? 2 : 1)]
    const clave = identificador(tokenAlias ?? tokenNombre)
    const nombre = tokenNombre.texto
    const alias = tokenAlias?.texto ?? null
    if (ambito.has(clave)) fallar('SQL_ALIAS_DUPLICADO', `La tabla o alias ${alias ?? nombre} está repetido; utiliza alias distintos.`, ubicacion.start)
    const id = `sql-relacion-${i + 1}`
    const parametros = alias === null ? { nombre } : { nombre, alias }
    const registro = { id, nombre, alias, referencia: alias ?? nombre }
    tablas.push(registro)
    ambito.set(clave, registro)
    const relacion = nodo(id, 'RELACION', alias === null ? nombre : `${nombre} AS ${alias}`, parametros)
    if (i === 0) entrada = relacion
    else {
      predicado(tabla.join.on, ambito)
      const inicioOn = locationOf(tabla.join).start
      const tokenOn = tokens.find(token => token.inicio === inicioOn && esPalabra(token, 'ON'))
      if (!tokenOn) fallar('SQL_FUENTE_INVALIDA', 'No se pudo recuperar la condición ON completa.')
      const fin = i + 1 < ast.from.length ? locationOf(ast.from[i + 1]).start
        : indiceWhere >= 0 ? tokens[indiceWhere].inicio : finDatos
      const condicion = sql.slice(tokenOn.fin, fin).trim()
      const joinId = `sql-join-${i}`
      joins.push({ id: joinId, condicion })
      entrada = nodo(joinId, 'JOIN', 'INNER JOIN', { condicion }, [entrada, relacion])
    }
  }

  const columnas = ast.columns.map((columna, i) => {
    campos(columna, ['expr'], 'Columna SELECT')
    if (columna.expr.type !== 'ref') fallar('SQL_NO_SOPORTADO', 'SELECT admite solo columnas, sin funciones, constantes, expresiones ni subconsultas.', locationOf(columna)?.start)
    return { original: partesColumnas[i], ...referencia(columna.expr, ambito) }
  })
  // La proyección actual requiere atributos únicos; no se eliminan columnas
  // repetidas de forma silenciosa, aunque SQL permita escribirlas.
  const identidades = columnas.map(columna => JSON.stringify([columna.tablaId, columna.nombre]))
  if (new Set(identidades).size !== identidades.length) fallar('SQL_COLUMNAS_REPETIDAS', 'La proyección inicial no admite la misma columna más de una vez.')
  const condicionesSeleccion = ast.where ? predicado(ast.where, ambito) : []
  const where = ast.where ? sql.slice(tokens[indiceWhere].fin, finDatos).trim() : null
  if (where !== null) entrada = nodo('sql-seleccion', 'SELECCION', 'WHERE', { predicado: where }, [entrada])
  const distinct = ast.distinct === 'distinct'
  const orden = ast.orderBy?.map(item => {
    campos(item, ['by', 'order', 'nulls'], 'ORDER BY')
    const expr = item.by
    if (expr.type !== 'ref') fallar('SQL_NO_SOPORTADO', 'ORDER BY admite columnas, sin posiciones ni expresiones.', locationOf(expr)?.start)
    const columna = referencia(expr, ambito)
    if (distinct && !columnas.some(c => c.tablaId === columna.tablaId && c.nombre === columna.nombre)) {
      fallar('SQL_NO_SOPORTADO', 'Con SELECT DISTINCT, incluye en SELECT cada columna de ORDER BY.', locationOf(expr)?.start)
    }
    return fuente(expr) + ' ' + (item.order ?? 'ASC') + (item.nulls ? ' NULLS ' + item.nulls : '')
  })
  if (orden?.length > LIMITES_SQL.columnas) fallar('SQL_LIMITE', 'ORDER BY admite hasta 64 columnas.')
  const raiz = nodo('sql-proyeccion', 'PROYECCION', distinct ? 'SELECT DISTINCT' : 'SELECT', {
    atributos: columnas.map(columna => columna.original), distinct, ...(orden?.length ? { orden } : {}),
  }, [entrada])
  const resultado = construirArbol({ version: 1, raiz })
  return {
    ...resultado,
    analisisSQL: { dialecto: 'PostgreSQL (subconjunto)', distinct, tablas, columnas, condicionesSeleccion, joins, where, sqlOriginal: sql },
  }
}

export function procesarSQL(sql) {
  try { return { valido: true, errores: [], resultado: analizarSQL(sql) } } catch (error) {
    if (!(error instanceof ErrorSQL) && !(error instanceof ErrorArbol)) throw error
    return { valido: false, errores: error.errores, resultado: null }
  }
}

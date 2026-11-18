/**
 * Posiciones léxicas para recuperar texto, no un parser de gramática SQL.
 * La sintaxis y el subconjunto se validan con pgsql-ast-parser y su AST.
 */
export function leerTokensFuente(sql, fallar) {
  const tokens = []
  let indice = 0
  let nivel = 0
  while (indice < sql.length) {
    const inicio = indice
    const caracter = sql[indice]
    if (/\s/u.test(caracter)) { indice += 1; continue }
    if (sql.startsWith('--', indice)) {
      while (indice < sql.length && sql[indice] !== '\n') indice += 1
      continue
    }
    if (sql.startsWith('/*', indice)) {
      let abiertos = 1
      indice += 2
      while (indice < sql.length && abiertos) {
        if (sql.startsWith('/*', indice)) { abiertos += 1; indice += 2 }
        else if (sql.startsWith('*/', indice)) { abiertos -= 1; indice += 2 }
        else indice += 1
      }
      if (abiertos) fallar('SQL_SINTAXIS_INVALIDA', 'Hay un comentario de bloque sin cerrar.', inicio)
      continue
    }
    let tipo = 'simbolo'
    if (caracter === "'" || caracter === '"') {
      tipo = caracter === '"' ? 'identificador' : 'cadena'
      indice += 1
      let cerrado = false
      while (indice < sql.length) {
        if (sql[indice] === '\\' && caracter === "'") {
          fallar('SQL_NO_SOPORTADO', 'No se admiten escapes con barra inversa; usa comillas simples duplicadas dentro de los textos.', indice)
        }
        if (sql[indice] === caracter) {
          if (sql[indice + 1] === caracter) { indice += 2; continue }
          indice += 1
          cerrado = true
          break
        }
        indice += 1
      }
      if (!cerrado) fallar('SQL_SINTAXIS_INVALIDA', 'Hay una cadena o identificador entre comillas sin cerrar.', inicio)
    } else if (caracter === '$') {
      fallar('SQL_NO_SOPORTADO', 'No se admiten parámetros ni cadenas delimitadas por dólares en este subconjunto.', inicio)
    } else if (/[\p{L}_]/u.test(caracter)) {
      tipo = 'palabra'
      indice += 1
      while (indice < sql.length && /[\p{L}\p{N}_$]/u.test(sql[indice])) indice += 1
    } else {
      indice += 1
    }
    const texto = sql.slice(inicio, indice)
    if (texto === ')') nivel -= 1
    if (nivel < 0) fallar('SQL_SINTAXIS_INVALIDA', 'Hay un paréntesis de cierre sin apertura.', inicio)
    tokens.push({ tipo, texto, inicio, fin: indice, nivel })
    if (texto === '(') nivel += 1
    if (nivel > 32 || tokens.length > 4000) fallar('SQL_LIMITE', 'La consulta supera el límite de complejidad del analizador inicial.', inicio)
  }
  if (nivel !== 0) fallar('SQL_SINTAXIS_INVALIDA', 'Hay paréntesis sin cerrar.', sql.length)
  return tokens
}

export function esPalabra(token, palabra) {
  return token?.tipo === 'palabra' && token.texto.toUpperCase() === palabra
}

import { describe, expect, it } from 'vitest'
import { analizarSQL, procesarSQL, ErrorSQL, LIMITES_SQL } from '../modules/sql/sqlToTree.js'
import { validarArbol } from '../modules/validation/treeValidation.js'
import { procesarArbolJSON } from '../modules/tree/treeLoader.js'
import biblioteca from '../data/examples/biblioteca.sql?raw'

describe('SQL de biblioteca del capítulo 2', () => {
  it('conserva ORDER BY sin incluirlo en el predicado WHERE', () => {
    const resultado = analizarSQL('SELECT titulo, anio FROM Libro WHERE anio > 2020 ORDER BY anio DESC, titulo')
    expect(resultado.arbol.raiz.parametros.orden).toEqual(['anio DESC', 'titulo ASC'])
    expect(resultado.arbol.raiz.hijos[0].parametros.predicado).toBe('anio > 2020')
  })
  it('construye proyección, selección, JOIN y relaciones, conservando alias y texto', () => {
    const resultado = analizarSQL(biblioteca)
    expect(resultado.cantidadNodos).toBe(5)
    expect(resultado.profundidadMaxima).toBe(3)
    const proyeccion = resultado.arbol.raiz
    expect(proyeccion.tipo).toBe('PROYECCION')
    expect(proyeccion.parametros).toEqual({ atributos: ['L.titulo', 'A.nombre'], distinct: true })
    const seleccion = proyeccion.hijos[0]
    expect(seleccion.tipo).toBe('SELECCION')
    expect(seleccion.parametros).toEqual({ predicado: "L.anio > 2020\nAND A.pais = 'México'" })
    const join = seleccion.hijos[0]
    expect(join.tipo).toBe('JOIN')
    expect(join.parametros).toEqual({ condicion: 'L.id_autor = A.id_autor' })
    expect(join.hijos.map(nodo => nodo.parametros)).toEqual([{ nombre: 'Libro', alias: 'L' }, { nombre: 'Autor', alias: 'A' }])
    expect(resultado.recorridos.postorden).toEqual(['sql-relacion-1', 'sql-relacion-2', 'sql-join-1', 'sql-seleccion', 'sql-proyeccion'])
    expect(resultado.analisisSQL.columnas).toEqual([
      { original: 'L.titulo', tablaId: 'sql-relacion-1', nombre: 'titulo' },
      { original: 'A.nombre', tablaId: 'sql-relacion-2', nombre: 'nombre' },
    ])
    expect(resultado.analisisSQL.condicionesSeleccion).toEqual(['L.anio > 2020', "A.pais = 'México'"])
    expect(resultado.analisisSQL.sqlOriginal).toBe(biblioteca)
  })

  it('genera el JSON canónico anterior sin agregar campos a documento o nodos', () => {
    const resultado = analizarSQL(biblioteca)
    expect(validarArbol(resultado.arbol)).toEqual({ valido: true, errores: [] })
    expect(Object.keys(resultado.arbol)).toEqual(['version', 'raiz'])
    for (const nodo of resultado.nodos) {
      expect(nodo).not.toHaveProperty('costo')
      expect(nodo).not.toHaveProperty('algoritmo')
      expect(nodo).not.toHaveProperty('filas')
    }
    const reimportado = procesarArbolJSON(JSON.stringify(resultado.arbol))
    expect(reimportado.valido).toBe(true)
    expect(reimportado.resultado.arbol).toEqual(resultado.arbol)
    expect(reimportado.resultado.recorridos).toEqual(resultado.recorridos)
  })
})

describe('Consultas válidas del subconjunto SQL', () => {
  it.each([
    ['SELECT titulo FROM Libro', false], ['select distinct titulo from Libro;', true], ['SELECT ALL titulo FROM Libro', false],
  ])('representa explícitamente DISTINCT en %s', (sql, distinct) => {
    const resultado = analizarSQL(sql)
    expect(resultado.arbol.raiz.parametros).toEqual({ atributos: ['titulo'], distinct })
    expect(resultado.cantidadNodos).toBe(2)
    expect(resultado.arbol.raiz.hijos[0].parametros).toEqual({ nombre: 'Libro' })
  })

  it('admite alias implícitos y una autounión con alias distintos', () => {
    const resultado = analizarSQL('SELECT L1.titulo, L2.titulo FROM Libro L1 JOIN Libro L2 ON L1.id_autor = L2.id_autor')
    expect(resultado.analisisSQL.tablas.map(tabla => [tabla.nombre, tabla.alias])).toEqual([['Libro', 'L1'], ['Libro', 'L2']])
    expect(resultado.cantidadNodos).toBe(4)
    expect(resultado.analisisSQL.columnas.map(columna => columna.tablaId)).toEqual(['sql-relacion-1', 'sql-relacion-2'])
  })

  it('conserva paréntesis, espacios, comillas y un AND dentro de un literal', () => {
    const where = "((L.titulo = 'A AND B') AND (L.anio >= -1))"
    const resultado = analizarSQL(`SELECT ( L.titulo ) FROM Libro AS L WHERE ${where};`)
    expect(resultado.arbol.raiz.parametros.atributos).toEqual(['( L.titulo )'])
    expect(resultado.arbol.raiz.hijos[0].parametros.predicado).toBe(where)
    expect(resultado.analisisSQL.condicionesSeleccion).toEqual(["L.titulo = 'A AND B'", 'L.anio >= -1'])
  })

  it('conserva identificadores citados y comillas duplicadas dentro de literales', () => {
    const sql = `SELECT "L"."Título" FROM "Mis Libros" AS "L" WHERE "L"."Título" = 'O''Brien; FROM WHERE AND';`
    const resultado = analizarSQL(sql)
    expect(resultado.arbol.raiz.parametros.atributos).toEqual(['"L"."Título"'])
    expect(resultado.analisisSQL.tablas[0]).toMatchObject({ nombre: '"Mis Libros"', alias: '"L"' })
    expect(resultado.analisisSQL.where).toBe(`"L"."Título" = 'O''Brien; FROM WHERE AND'`)
  })

  it('conserva identificadores con comillas dobles escapadas', () => {
    const resultado = analizarSQL('SELECT "L""x"."a""b" FROM "T" AS "L""x"')
    expect(resultado.analisisSQL.tablas[0].alias).toBe('"L""x"')
    expect(resultado.analisisSQL.columnas[0].nombre).toBe('a"b')
  })

  it('no confunde comentarios, palabras de cláusulas y nombres de columna citados', () => {
    const resultado = analizarSQL(`-- SELECT falso\nSELECT /* columna */ L."FROM", L."WHERE" FROM Libro /* AS falso */ AS L WHERE (L.anio > 2020 /* AND nada */ AND L.titulo != 'WHERE'); -- fin`)
    expect(resultado.arbol.raiz.parametros.atributos).toEqual(['/* columna */ L."FROM"', 'L."WHERE"'])
    expect(resultado.analisisSQL.where).toBe("(L.anio > 2020 /* AND nada */ AND L.titulo != 'WHERE')")
    expect(resultado.analisisSQL.tablas[0]).toMatchObject({ nombre: 'Libro', alias: 'L' })
  })

  it('conserva ON con paréntesis en una cadena de tres JOIN, sin empujar filtros', () => {
    const resultado = analizarSQL(`SELECT C.nombre, R.nombre FROM Cliente C
INNER JOIN Pedido P ON (C.id_cliente = P.id_cliente)
JOIN Detalle D ON (P.id_pedido=D.id_pedido AND D.cantidad>0)
INNER JOIN Producto R ON D.id_producto = R.id_producto
WHERE C.ciudad = 'Xalapa' AND P.estado = 'Pagado';`)
    expect(resultado.cantidadNodos).toBe(9)
    expect(resultado.profundidadMaxima).toBe(5)
    expect(resultado.analisisSQL.joins.map(join => join.condicion)).toEqual([
      '(C.id_cliente = P.id_cliente)', '(P.id_pedido=D.id_pedido AND D.cantidad>0)', 'D.id_producto = R.id_producto',
    ])
    expect(resultado.arbol.raiz.hijos[0].tipo).toBe('SELECCION')
    expect(resultado.arbol.raiz.hijos[0].hijos[0].tipo).toBe('JOIN')
    expect(resultado.nodos.filter(nodo => nodo.tipo === 'SELECCION')).toHaveLength(1)
  })

  it.each(['=', '!=', '<>', '<', '<=', '>', '>='])('admite comparaciones %s', operador => {
    const resultado = analizarSQL(`SELECT titulo FROM Libro WHERE anio ${operador} 2020`)
    expect(resultado.analisisSQL.where).toBe(`anio ${operador} 2020`)
  })

  it('admite números decimales y un WHERE sin JOIN', () => {
    expect(analizarSQL('SELECT cantidad FROM Detalle WHERE precio_unitario >= 12.5').cantidadNodos).toBe(3)
  })

  it('resuelve las mayúsculas de alias no citados según el AST PostgreSQL', () => {
    expect(analizarSQL('SELECT l.titulo FROM Libro AS L').analisisSQL.columnas[0].tablaId).toBe('sql-relacion-1')
  })
})

describe('Rechazo explícito de SQL no soportado', () => {
  it.each([
    'SELECT * FROM Libro', 'SELECT L.* FROM Libro L', 'SELECT COUNT(id_libro) FROM Libro',
    'SELECT 1 FROM Libro', 'SELECT anio + 1 FROM Libro', 'SELECT titulo AS nombre FROM Libro',
    'SELECT DISTINCT ON (titulo) titulo FROM Libro',
    'SELECT id_autor FROM Libro GROUP BY id_autor',
    'SELECT titulo FROM Libro LIMIT 5', 'SELECT titulo FROM Libro OFFSET 1',
    'SELECT titulo FROM Libro HAVING anio > 0', 'SELECT titulo FROM Libro FOR UPDATE',
    'SELECT titulo FROM public.Libro', 'SELECT titulo FROM (SELECT titulo FROM Libro) L',
    'SELECT id FROM unnest(ARRAY[1]) t',
    'SELECT L.titulo FROM Libro L LEFT JOIN Autor A ON L.id_autor = A.id_autor',
    'SELECT L.titulo FROM Libro L RIGHT JOIN Autor A ON L.id_autor = A.id_autor',
    'SELECT L.titulo FROM Libro L FULL JOIN Autor A ON L.id_autor = A.id_autor',
    'SELECT L.titulo FROM Libro L CROSS JOIN Autor A', 'SELECT L.titulo FROM Libro L NATURAL JOIN Autor A',
    'SELECT L.titulo FROM Libro L JOIN Autor A USING (id_autor)',
    'SELECT L.titulo FROM Libro L, Autor A',
    'SELECT titulo FROM Libro WHERE anio > 2020 OR anio < 2000',
    'SELECT titulo FROM Libro WHERE anio > 2020 AND (anio < 2024 OR anio > 2025)',
    'SELECT titulo FROM Libro WHERE NOT (anio = 2020)', 'SELECT titulo FROM Libro WHERE anio BETWEEN 2000 AND 2020',
    'SELECT titulo FROM Libro WHERE anio IN (2020, 2021)', 'SELECT titulo FROM Libro WHERE titulo IS NULL',
    "SELECT titulo FROM Libro WHERE titulo LIKE 'A%'", 'SELECT titulo FROM Libro WHERE anio + 1 = 2020',
    "SELECT titulo FROM Libro WHERE lower(titulo) = 'a'", 'SELECT titulo FROM Libro WHERE anio = NULL',
    'SELECT titulo FROM Libro WHERE true', 'SELECT titulo::text FROM Libro',
    'SELECT (SELECT titulo FROM Libro) FROM Autor', 'SELECT titulo FROM Libro UNION SELECT nombre FROM Autor',
    'WITH L AS (SELECT titulo FROM Libro) SELECT titulo FROM L', 'DELETE FROM Libro WHERE id_libro = 1',
    'UPDATE Libro SET anio = 2020', 'INSERT INTO Libro (titulo) VALUES (\'a\')',
    'SELECT titulo FROM Libro WHERE titulo = $$WHERE AND$$',
    "SELECT titulo FROM Libro WHERE titulo = E'a\\nb'", '(SELECT titulo FROM Libro)', ';SELECT titulo FROM Libro',
  ])('rechaza sin generar un árbol: %s', sql => {
    const respuesta = procesarSQL(sql)
    expect(respuesta.valido).toBe(false)
    expect(respuesta.resultado).toBeNull()
    expect(respuesta.errores.length).toBeGreaterThan(0)
    expect(respuesta.errores[0].mensaje.length).toBeGreaterThan(10)
  })

  it.each([
    ['SELECT titulo FROM Libro L JOIN Autor A ON L.id_autor=A.id_autor', 'SQL_COLUMNA_AMBIGUA'],
    ['SELECT X.titulo FROM Libro L', 'SQL_REFERENCIA_NO_DECLARADA'],
    ['SELECT Libro.titulo FROM Libro L', 'SQL_REFERENCIA_NO_DECLARADA'],
    ['SELECT L.titulo FROM Libro L JOIN Autor L ON L.id_autor=L.id_autor', 'SQL_ALIAS_DUPLICADO'],
    ['SELECT Libro.titulo FROM Libro JOIN Libro ON Libro.id_autor=Libro.id_autor', 'SQL_ALIAS_DUPLICADO'],
    ['SELECT L.titulo FROM Libro L JOIN Autor A ON L.id_autor=X.id_autor JOIN Extra X ON X.id=A.id_autor', 'SQL_REFERENCIA_NO_DECLARADA'],
    ['SELECT titulo, Libro.titulo FROM Libro', 'SQL_COLUMNAS_REPETIDAS'],
    ['SELECT titulo, TITULO FROM Libro', 'SQL_COLUMNAS_REPETIDAS'],
    ['SELECT "l".titulo FROM Libro AS "L"', 'SQL_REFERENCIA_NO_DECLARADA'],
  ])('detecta referencias o columnas inválidas: %s', (sql, codigo) => {
    expect(procesarSQL(sql).errores[0].codigo).toBe(codigo)
  })
})

describe('Sintaxis, errores y límites', () => {
  it.each(['', ' ', '\n'])('rechaza SQL vacío: %j', sql => {
    expect(procesarSQL(sql).errores[0].codigo).toBe('SQL_VACIO')
  })
  it.each([null, undefined, {}, 1])('rechaza entradas no textuales: %j', sql => {
    expect(procesarSQL(sql).errores[0].codigo).toBe('SQL_ENTRADA_INVALIDA')
  })
  it.each([
    'SELECT FROM', 'SELECT titulo FROM', 'SELECT titulo, FROM Libro',
    "SELECT titulo FROM Libro WHERE titulo = 'sin cerrar", 'SELECT titulo FROM Libro /* sin cerrar',
    'SELECT titulo FROM Libro WHERE (anio > 1', 'SELECT titulo FROM Libro WHERE anio > 1)',
    'SELECT titulo FROM Libro WHERE anio >;', 'SELECT L.titulo FROM Libro L INNER JOIN Autor A ON',
  ])('detecta sintaxis inválida: %s', sql => {
    const respuesta = procesarSQL(sql)
    expect(respuesta.valido).toBe(false)
    expect(respuesta.resultado).toBeNull()
    expect(respuesta.errores[0].codigo).toBe('SQL_SINTAXIS_INVALIDA')
  })
  it('identifica la posición del token erróneo que informa el parser', () => {
    const sql = 'SELECT titulo\nFROM Libro WHERE anio >;'
    expect(procesarSQL(sql).errores[0]).toMatchObject({ linea: 2, columna: 24 })
  })
  it('exige una sola sentencia y no procesa solo la primera', () => {
    expect(procesarSQL('SELECT titulo FROM Libro; DELETE FROM Libro;').errores[0].codigo).toBe('SQL_UNA_SENTENCIA')
    expect(procesarSQL('SELECT titulo FROM Libro;;').errores[0].codigo).toBe('SQL_UNA_SENTENCIA')
  })
  it('requiere FROM', () => {
    expect(procesarSQL('SELECT titulo').errores[0].codigo).toBe('SQL_FROM_REQUERIDO')
  })
  it('expone ErrorSQL en la API estricta y errores comprensibles en la API segura', () => {
    expect(() => analizarSQL('SELECT')).toThrow(ErrorSQL)
    expect(procesarSQL('SELECT').errores[0]).toMatchObject({ codigo: expect.any(String), ruta: '$.sql', mensaje: expect.any(String) })
  })
  it('limita el texto y los paréntesis antes de llamar al parser', () => {
    expect(procesarSQL('SELECT ' + 'x'.repeat(LIMITES_SQL.caracteres)).errores[0].codigo).toBe('SQL_LIMITE')
    expect(procesarSQL('SELECT titulo FROM Libro WHERE ' + '('.repeat(33) + 'anio > 1' + ')'.repeat(33)).errores[0].codigo).toBe('SQL_LIMITE')
  })
  it('limita las columnas sin truncarlas', () => {
    const sql = `SELECT ${Array.from({ length: 65 }, (_, i) => `col${i}`).join(', ')} FROM Libro`
    expect(procesarSQL(sql).errores[0].codigo).toBe('SQL_LIMITE')
  })
  it('limita las tablas sin omitir reuniones', () => {
    const joins = Array.from({ length: 16 }, (_, i) => `JOIN Tabla${i + 1} T${i + 1} ON T0.id=T${i + 1}.id`).join(' ')
    expect(procesarSQL(`SELECT T0.id FROM Tabla0 T0 ${joins}`).errores[0].codigo).toBe('SQL_LIMITE')
  })
  it('limita la cantidad de comparaciones', () => {
    const sql = 'SELECT titulo FROM Libro WHERE ' + Array.from({ length: 65 }, (_, i) => `anio > ${i}`).join(' AND ')
    expect(procesarSQL(sql).errores[0].codigo).toBe('SQL_LIMITE')
  })
})

describe('Compatibilidad JSON de alias y DISTINCT', () => {
  const relacion = { id: 'r', tipo: 'RELACION', etiqueta: 'Libro', parametros: { nombre: 'Libro' }, hijos: [] }
  it('conserva los documentos anteriores con parámetros omitidos', () => {
    expect(validarArbol({ version: 1, raiz: relacion }).valido).toBe(true)
    expect(validarArbol({ version: 1, raiz: { id: 'p', tipo: 'PROYECCION', etiqueta: 'Títulos', parametros: { atributos: ['titulo'] }, hijos: [relacion] } }).valido).toBe(true)
  })
  it.each(['', ' ', null, 1])('rechaza un alias JSON inválido: %j', alias => {
    const respuesta = validarArbol({ version: 1, raiz: { ...relacion, parametros: { nombre: 'Libro', alias } } })
    expect(respuesta.errores.map(error => error.codigo)).toContain('ALIAS_INVALIDO')
  })
  it.each(['true', 0, null])('rechaza un valor DISTINCT que no sea booleano: %j', distinct => {
    const respuesta = validarArbol({ version: 1, raiz: { id: 'p', tipo: 'PROYECCION', etiqueta: 'Títulos', parametros: { atributos: ['titulo'], distinct }, hijos: [relacion] } })
    expect(respuesta.errores.map(error => error.codigo)).toContain('DISTINCT_INVALIDO')
  })
})

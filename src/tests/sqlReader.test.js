import { effectScope, createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { useSqlReader } from '../composables/useSqlReader.js'
import { useTreeReader } from '../composables/useTreeReader.js'
import SqlReader from '../components/sql/SqlReader.vue'

function conLectores(comprobar) {
  const scope = effectScope()
  try { scope.run(() => comprobar(useSqlReader(), useTreeReader())) } finally { scope.stop() }
}

describe('Estado de la entrada SQL', () => {
  it('procesa el ejemplo y descarta resultados al editar', () => conLectores(lector => {
    lector.procesar()
    expect(lector.estado.value).toBe('valido')
    expect(lector.resultado.value.cantidadNodos).toBe(5)
    lector.texto.value = 'SELECT * FROM Libro'
    expect(lector.resultado.value).toBeNull()
    expect(lector.estado.value).toBe('pendiente')
    lector.procesar()
    expect(lector.estado.value).toBe('invalido')
    expect(lector.resultado.value).toBeNull()
    lector.cargarEjemplo()
    expect(lector.errores.value).toEqual([])
    lector.procesar()
    expect(lector.resultado.value.arbol.raiz.parametros.distinct).toBe(true)
  }))
  it('limpia texto y estado', () => conLectores(lector => {
    lector.procesar()
    lector.limpiar()
    expect(lector.resultado.value).toBeNull()
    expect(lector.texto.value).toBe('')
    lector.procesar()
    expect(lector.errores.value[0].codigo).toBe('SQL_VACIO')
  }))
  it('permite enviar el JSON generado al lector existente y procesarlo sin pérdidas', () => conLectores((sql, json) => {
    json.procesar()
    sql.procesar()
    json.cargarTexto(JSON.stringify(sql.resultado.value.arbol))
    expect(json.estado.value).toBe('pendiente')
    expect(json.resultado.value).toBeNull()
    json.procesar()
    expect(json.resultado.value.arbol).toEqual(sql.resultado.value.arbol)
    expect(json.resultado.value.recorridos).toEqual(sql.resultado.value.recorridos)
  }))
  it('cargar texto externo exige texto y no afecta a otro lector', () => conLectores((sql, json) => {
    const antes = sql.texto.value
    expect(() => json.cargarTexto(null)).toThrow(TypeError)
    json.cargarTexto('{}')
    expect(sql.texto.value).toBe(antes)
  }))
  it('renderiza el editor SQL sin ejecutar consultas', async () => {
    const html = await renderToString(createSSRApp(SqlReader))
    expect(html).toContain('id="tree-sql"')
    expect(html).toContain('Generar árbol desde SQL')
    expect(html).toContain('Subconjunto PostgreSQL')
    expect(html).toContain('El prototipo construye el árbol sin ejecutar SQL.')
    expect(html).toContain('Productos ordenados')
    expect(html).toContain('Pedidos con cliente y sucursal')
    expect(html).toContain('SELECT DISTINCT L.titulo, A.nombre')
  })
})

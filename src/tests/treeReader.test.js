import { createSSRApp, h, effectScope } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { useTreeReader } from '../composables/useTreeReader.js'
import { construirArbol } from '../modules/tree/treeLoader.js'
import TreeResult from '../components/trees/TreeResult.vue'
import { EJEMPLOS_ARBOL } from '../data/examples/treeExamples.js'

function conLector(comprobar) {
  const scope = effectScope()
  try { scope.run(() => comprobar(useTreeReader())) } finally { scope.stop() }
}

describe('Estado del lector JSON', () => {
  it.each(EJEMPLOS_ARBOL.map(ejemplo => [ejemplo.id]))('carga y procesa el ejemplo %s', id => conLector(lector => {
    lector.cargarEjemplo(id)
    expect(lector.estado.value).toBe('pendiente')
    lector.procesar()
    expect(lector.estado.value).toBe('valido')
    expect(lector.resultado.value.cantidadNodos).toBeGreaterThan(0)
    expect(lector.errores.value).toEqual([])
  }))

  it('descarta resultados obsoletos al editar el JSON', () => conLector(lector => {
    lector.procesar()
    lector.texto.value = '{'
    expect(lector.resultado.value).toBeNull()
    expect(lector.estado.value).toBe('pendiente')
    lector.procesar()
    expect(lector.resultado.value).toBeNull()
    expect(lector.estado.value).toBe('invalido')
    expect(lector.errores.value[0].codigo).toBe('JSON_INVALIDO')
    lector.cargarEjemplo('ventas')
    expect(lector.errores.value).toEqual([])
    lector.procesar()
    expect(lector.resultado.value.cantidadNodos).toBe(9)
  }))

  it('limpia el texto, los errores y el resultado', () => conLector(lector => {
    lector.procesar()
    lector.limpiar()
    expect(lector.texto.value).toBe('')
    expect(lector.resultado.value).toBeNull()
    expect(lector.errores.value).toEqual([])
    expect(lector.estado.value).toBe('pendiente')
    lector.procesar()
    expect(lector.errores.value[0].codigo).toBe('JSON_VACIO')
  }))

  it('rechaza un ejemplo desconocido sin perder el texto', () => conLector(lector => {
    const antes = lector.texto.value
    expect(() => lector.cargarEjemplo('inexistente')).toThrow(TypeError)
    expect(lector.texto.value).toBe(antes)
  }))
})

describe('Salida visual', () => {
  it('dibuja ventas completo y deja el JSON cerrado sin tablas de resultados', async () => {
    const resultado = construirArbol(EJEMPLOS_ARBOL.find(ejemplo => ejemplo.id === 'ventas').documento)
    const html = await renderToString(createSSRApp({ render: () => h(TreeResult, { resultado }) }))
    expect(html.match(/class="tree-node node-card/g)).toHaveLength(9)
    expect(html.match(/class="tree-edge"/g)).toHaveLength(8)
    expect(html).toContain('PROYECCION_EXTENDIDA')
    expect(html).toContain('Detalle.cantidad * Detalle.precio_unitario AS subtotal')
    expect(html).toContain('role="button" tabindex="0"')
    expect(html).toContain('<details class="technical-details"><summary>Ver JSON del árbol</summary>')
    expect(html).not.toContain('<table')
    expect(html).not.toContain('<dt>Nodos')
  })

  it('escapa etiquetas y parámetros introducidos por el usuario', async () => {
    const texto = '<script>alert("ejemplo")</script>'
    const resultado = construirArbol({ version: 1, raiz: { id: 'r', tipo: 'RELACION', etiqueta: texto, parametros: { nombre: texto }, hijos: [] } })
    const html = await renderToString(createSSRApp({ render: () => h(TreeResult, { resultado }) }))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

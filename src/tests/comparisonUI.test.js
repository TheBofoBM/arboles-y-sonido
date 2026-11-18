import { createSSRApp, effectScope, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, it, expect } from 'vitest'
import { useTreeComparison } from '../composables/useTreeComparison.js'
import TreeComparison from '../components/comparison/TreeComparison.vue'
import AlgebraReader from '../components/trees/AlgebraReader.vue'
import TreeWorkbench from '../components/trees/TreeWorkbench.vue'
import { analizarAlgebra } from '../modules/tree/algebra.js'
import ejemplo from '../data/examples/biblioteca.algebra.txt?raw'

describe('Comparación e interfaz integrada', () => {
  it('mantiene A y B independientes y retira resultados obsoletos', () => {
    const scope = effectScope()
    scope.run(() => {
      const c = useTreeComparison(), textoB = c.textoB.value
      c.comparar(); expect(c.resultado.value.estado).toBe('equivalencia-por-reglas')
      c.textoA.value = '{'
      expect(c.resultado.value).toBeNull()
      c.comparar()
      expect(c.errores.value.every(e => e.arbol === 'A')).toBe(true)
      expect(c.textoB.value).toBe(textoB)
      c.cargarEjemplo(); expect(c.errores.value).toEqual([])
      c.recibir({ a: analizarAlgebra(ejemplo).arbol, b: analizarAlgebra(ejemplo).arbol })
      expect(c.tipoA.value).toBe('json')
      expect(c.resultado.value.estado).toBe('misma-expresion')
    })
    scope.stop()
  })
  it('renderiza dos árboles con IDs únicos, controles de audio y métricas', async () => {
    const a = analizarAlgebra(ejemplo).arbol
    const html = await renderToString(createSSRApp({ render: () => h(TreeComparison, { entrada: { a, b: a } }) }))
    expect(html).toContain('comparacion-a-title')
    expect(html).toContain('comparacion-b-title')
    expect(html).toContain('Escuchar A')
    expect(html).toContain('Escuchar B')
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1])
    expect(new Set(ids).size).toBe(ids.length)
    expect(html).toContain('Un sonido parecido no demuestra equivalencia')
  })
  it('muestra sintaxis de fórmulas, generación y el banco de sampleos', async () => {
    const html = await renderToString(createSSRApp(AlgebraReader))
    expect(html).toContain('Generar árbol')
    expect(html).toContain('PI_ALL')
    const workbench = await renderToString(createSSRApp({ render: () => h(TreeWorkbench, { resultado: analizarAlgebra(ejemplo) }) }))
    expect(workbench).toContain('Comparar original y actual')
    expect(workbench).toContain('Aplicar siguiente regla')
    expect(workbench).toContain('CC BY 3.0')
    expect(workbench).not.toContain('Oscillator')
  })
})

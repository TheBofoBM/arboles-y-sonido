import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import { distribuirArbol } from '../modules/tree/treeLayout.js'
import { EJEMPLOS_ARBOL } from '../data/examples/treeExamples.js'
import TreeDiagram from '../components/trees/TreeDiagram.vue'

describe('Distribución visual del árbol', () => {
  it.each(EJEMPLOS_ARBOL.map(e => [e.nombre, e.documento]))('mantiene orientación, enlaces y nodos sin solaparse: %s', (_, arbol) => {
    const antes = JSON.stringify(arbol), plano = distribuirArbol(arbol)
    expect(JSON.stringify(arbol)).toBe(antes)
    expect(plano.enlaces).toHaveLength(plano.nodos.length - 1)
    const indice = new Map(plano.nodos.map(n => [n.id, n]))
    for (const n of plano.nodos) {
      expect(n.x - plano.anchoNodo / 2).toBeGreaterThanOrEqual(0)
      expect(n.x + plano.anchoNodo / 2).toBeLessThanOrEqual(plano.ancho)
      expect(n.y + plano.altoNodo).toBeLessThanOrEqual(plano.alto)
      const hermanos = plano.nodos.filter(o => o.id !== n.id && o.profundidad === n.profundidad)
      for (const o of hermanos) expect(Math.abs(n.x - o.x)).toBeGreaterThanOrEqual(plano.anchoNodo)
      for (const e of plano.enlaces.filter(e => e.padreId === n.id)) expect(indice.get(e.hijoId).y).toBeGreaterThan(n.y + plano.altoNodo)
      if (n.hijosIds.length === 2) expect(indice.get(n.hijosIds[0]).x).toBeLessThan(indice.get(n.hijosIds[1]).x)
    }
  })

  it('señala el nodo activo y los visitados sin perder el predicado completo', async () => {
    const arbol = EJEMPLOS_ARBOL[0].documento
    const plano = distribuirArbol(arbol), activo = plano.nodos[1]
    const html = await renderToString(createSSRApp({ render: () => h(TreeDiagram, { arbol, nodoActivo: activo.id, visitados: [plano.nodos[0].id, activo.id] }) }))
    expect(html.match(/aria-current="step"/g)).toHaveLength(1)
    expect(html.match(/node-visited/g)).toHaveLength(2)
    expect(html).toContain('edge-active')
    expect(html).toContain('Acercar árbol')
    expect(html).toContain('aria-label="Colores de los operadores"')
  })
})

import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import App from '../App.vue'

describe('Página inicial', () => {
  it('abre el ejemplo visual con escucha y conserva las entradas y el alcance lógico', async () => {
    const html = await renderToString(createSSRApp(App))

    expect(html).toContain('href="#contenido"')
    expect(html).toContain('<main id="contenido"')
    expect(html).toContain('id="project-title"')
    expect(html).toContain('Método computacional para codificar árboles de consulta relacional')
    expect(html).toContain('id="algebra-input"')
    expect(html).toContain('Mira el árbol.')
    expect(html.match(/class="tree-node node-card/g)).toHaveLength(5)
    expect(html).toContain('Desde las relaciones · postorden')
    expect(html).toContain('Aventura orbital')
    expect(html).toContain('SQL de referencia · Editar')
    expect(html).toContain('Editar sonido · registro y base')
    expect(html).not.toContain('Reunión')
    expect(html).not.toContain('<table')
    expect(html).toContain('planes físicos')
    expect(html).toContain('Tipo de entrada')
    expect(html).toContain('>SQL</button>')
    expect(html).toContain('Aplicar siguiente regla')
    expect(html).toContain('Sampleos')
    expect(html).toContain('Comparar A / B')
  })
})

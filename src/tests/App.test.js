import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import App from '../App.vue'

describe('Página inicial', () => {
  it('renderiza la aplicación con el lector JSON y el alcance del modelo lógico', async () => {
    const html = await renderToString(createSSRApp(App))

    expect(html).toContain('href="#contenido"')
    expect(html).toContain('<main id="contenido"')
    expect(html).toContain('id="project-title"')
    expect(html).toContain('Método computacional para codificar árboles de consulta relacional')
    expect(html).toContain('id="tree-json"')
    expect(html).toContain('Procesar JSON')
    expect(html).toContain('planes físicos')
    expect(html).toContain('Tipo de entrada')
    expect(html).toContain('>SQL</button>')
    expect(html).toContain('Reglas heurísticas')
    expect(html).toContain('Sampleos')
    expect(html).toContain('Comparar A / B')
  })
})

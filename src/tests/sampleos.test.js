import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { crearSecuenciaSampleos, MUESTRAS } from '../modules/sonification/samplePlan.js'
import { crearReproductorSampleos } from '../services/samplePlayer.js'
import { OPERADORES } from '../modules/tree/operators.js'
import { EJEMPLOS_ARBOL } from '../data/examples/treeExamples.js'
import { analizarAlgebra } from '../modules/tree/algebra.js'
import { optimizarArbol } from '../modules/tree/heuristics.js'
import { construirArbol } from '../modules/tree/treeLoader.js'
import original from '../data/examples/biblioteca.algebra.txt?raw'
import filtrada from '../data/examples/biblioteca-filtrada.algebra.txt?raw'

describe('Secuencia de sampleos y banco grabado', () => {
  it.each(EJEMPLOS_ARBOL.map(e => [e.nombre, e.documento]))('cubre el recorrido completo de %s', (_, arbol) => {
    for (const orden of ['niveles', 'preorden', 'postorden']) {
      const plan = crearSecuenciaSampleos(arbol, orden)
      expect(plan.eventos.length).toBe(new Set(plan.eventos.map(e => e.nodoId)).size)
      expect(plan.duracion).toBe(plan.eventos.length + 0.5)
      expect(plan.eventos.every((e,i) => e.inicio === i && e.duracion === 1.5)).toBe(true)
      expect(plan.eventos.every(e => Object.values(MUESTRAS).some(m => m.id === e.muestraId))).toBe(true)
    }
  })
  it.each(EJEMPLOS_ARBOL.map(e => [e.nombre, e.documento]))('por defecto recorre %s por filas de arriba abajo y de izquierda a derecha', (_, arbol) => {
    const resultado = construirArbol(arbol)
    const esperados = [...resultado.nodos].sort((a, b) => a.profundidad - b.profundidad || a.posicion - b.posicion)
    const eventos = crearSecuenciaSampleos(arbol).eventos
    expect(eventos.map(e => e.nodoId)).toEqual(esperados.map(n => n.id))
    expect(eventos[0].nodoId).toBe(resultado.raizId)
  })
  it('asigna una muestra a cada operador y verifica PCM, duración, picos y extremos reales', () => {
    expect(Object.keys(MUESTRAS)).toEqual(Object.keys(OPERADORES))
    for (const m of Object.values(MUESTRAS)) {
      const wav = readFileSync(join(process.cwd(), 'src/assets/samples', m.id + '.wav'))
      expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
      expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
      expect(wav.readUInt16LE(20)).toBe(1)
      const rate = wav.readUInt32LE(24), bytes = wav.readUInt32LE(40)
      expect(bytes / 2 / rate).toBe(m.duracion)
      let peak = 0, energia = 0
      for (let i = 44; i < wav.length; i += 2) { const v = wav.readInt16LE(i) / 32767; peak = Math.max(peak, Math.abs(v)); energia += v * v }
      expect(peak).toBeCloseTo(0.65, 3)
      expect(energia).toBeGreaterThan(1)
      expect(wav.readInt16LE(44)).toBe(0)
      expect(wav.readInt16LE(wav.length - 2)).toBe(0)
      // Como máximo dos fragmentos solapados: margen incluso al volumen máximo.
      expect(peak * 2 * 0.45).toBeLessThan(1)
    }
  })
  it('usa los mismos motivos y tiempos en referencias equivalentes', () => {
    const a = optimizarArbol(analizarAlgebra(original).arbol).resultado.arbol
    const b = optimizarArbol(analizarAlgebra(filtrada).arbol).resultado.arbol
    const firma = tree => crearSecuenciaSampleos(tree).eventos.map(e => [e.muestraId, e.inicio, e.duracion])
    expect(firma(a)).toEqual(firma(b))
  })
  it('no admite árboles o recorridos inválidos', () => {
    expect(() => crearSecuenciaSampleos({})).toThrow()
    expect(() => crearSecuenciaSampleos(EJEMPLOS_ARBOL[0].documento, 'inorden')).toThrow()
  })
  it('cubre desde una sola relación hasta el límite de 2000 nodos sin truncar', () => {
    let serial = 0
    function rama(cantidad) {
      const id = `grande-${serial++}`
      if (cantidad === 1) return { id, tipo: 'RELACION', etiqueta: id, parametros: { nombre: id }, hijos: [] }
      const izquierda = Math.floor(cantidad / 2)
      return { id, tipo: 'JOIN', etiqueta: 'JOIN', parametros: { condicion: 'a.id = b.id' }, hijos: [rama(izquierda), rama(cantidad - izquierda)] }
    }
    const hoja = { version: 1, raiz: rama(1) }
    expect(crearSecuenciaSampleos(hoja).eventos).toHaveLength(1)
    const arbol = { version: 1, raiz: { id: 'proyeccion', tipo: 'PROYECCION', etiqueta: 'PI', parametros: { atributos: ['x'] }, hijos: [rama(1000)] } }
    const plan = crearSecuenciaSampleos(arbol)
    expect(plan.eventos).toHaveLength(2000)
    expect(plan.duracion).toBe(2000.5)
    expect(new Set(plan.eventos.map(e => e.nodoId)).size).toBe(2000)
  })
})

const reproductores = []
afterEach(async () => { for (const p of reproductores.splice(0)) await p.cerrar(); vi.useRealTimers() })
function setup(descargar = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }))) {
  const sources = [], gain = { gain: { value: 0 }, connect: vi.fn() }
  const context = { currentTime: 10, destination: {}, resume: vi.fn(async () => {}), close: vi.fn(async () => {}), createGain: () => gain, decodeAudioData: vi.fn(async () => ({ duration: 1.5 })), createBufferSource: () => {
    const s = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }
    sources.push(s); return s
  } }
  const player = crearReproductorSampleos({ crearContexto: () => context, descargar })
  reproductores.push(player)
  return { player, context, gain, sources, descargar }
}
describe('Reproductor de muestras', () => {
  it('programa con el reloj de audio, espera el final y reutiliza los buffers', async () => {
    vi.useFakeTimers()
    const { player, context, sources, descargar } = setup(), final = vi.fn(), nodo = vi.fn()
    const plan = crearSecuenciaSampleos(EJEMPLOS_ARBOL[0].documento)
    await player.reproducir(plan, { alFinal: final, alNodo: nodo })
    expect(sources.map(s => s.start.mock.calls[0][0])).toEqual([10.08, 11.08, 12.08])
    context.currentTime = 11.1; vi.advanceTimersByTime(40)
    expect(nodo).toHaveBeenCalledWith(plan.eventos[1].nodoId)
    sources[0].onended(); expect(final).not.toHaveBeenCalled()
    sources.at(-1).onended(); expect(final).toHaveBeenCalledTimes(1)
    await player.reproducir(plan)
    expect(descargar).toHaveBeenCalledTimes(3)
    expect(context.resume).toHaveBeenCalledTimes(2)
  })
  it('detiene A al comenzar B y desconecta cada fuente cancelada', async () => {
    const a = setup(), b = setup(), finalA = vi.fn(), plan = crearSecuenciaSampleos(EJEMPLOS_ARBOL[0].documento)
    await a.player.reproducir(plan, { alFinal: finalA })
    await b.player.reproducir(plan)
    expect(finalA).toHaveBeenCalledTimes(1)
    expect(a.sources.every(s => s.stop.mock.calls.length === 1 && s.onended === null)).toBe(true)
    b.player.detener()
    expect(b.sources.every(s => s.disconnect.mock.calls.length === 1)).toBe(true)
  })
  it('no reproduce cargas canceladas y comunica errores recuperables', async () => {
    let completar
    const load = new Promise(resolve => { completar = resolve })
    const a = setup(() => load), plan = crearSecuenciaSampleos(EJEMPLOS_ARBOL[0].documento)
    const pendiente = a.player.reproducir(plan)
    await Promise.resolve(); a.player.detener()
    completar({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })
    expect(await pendiente).toBe(false)
    expect(a.sources).toHaveLength(0)
    const b = setup(async () => ({ ok: false }))
    await expect(b.player.reproducir(plan)).rejects.toThrow('No se pudo cargar')
  })
  it('valida la duración del banco y limita el volumen', async () => {
    const a = setup(), plan = crearSecuenciaSampleos(EJEMPLOS_ARBOL[0].documento)
    await a.player.reproducir(plan, { volumen: 50 })
    expect(a.gain.gain.value).toBe(0.45)
    a.player.detener()
    const b = setup(); b.context.decodeAudioData.mockResolvedValue({ duration: 0.5 })
    await expect(b.player.reproducir(plan)).rejects.toThrow('duración')
  })
})

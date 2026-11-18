import { MUESTRAS } from '../modules/sonification/samplePlan.js'

let activo = null

/** Reproduce WAV locales con AudioBufferSourceNode; no utiliza osciladores. */
export function crearReproductorSampleos({ crearContexto, descargar = (...args) => fetch(...args) } = {}) {
  let contexto = null, salida = null, fuentes = [], sesion = 0, reloj = null, finalizar = null
  const cache = new Map()
  function detener() {
    sesion++
    clearInterval(reloj); reloj = null
    for (const fuente of fuentes) { fuente.onended = null; fuente.stop(); fuente.disconnect() }
    fuentes = []
    const callback = finalizar; finalizar = null
    if (activo === detener) activo = null
    callback?.()
  }
  async function reproducir(plan, { alNodo = () => {}, alFinal = () => {}, volumen = 0.35 } = {}) {
    if (!plan.eventos.length) throw new Error('No hay visitas para reproducir.')
    if (activo) activo()
    detener(); activo = detener
    const actual = sesion
    finalizar = alFinal
    try {
      if (!contexto) {
        const Constructor = globalThis.AudioContext ?? globalThis.webkitAudioContext
        if (!crearContexto && !Constructor) throw new Error('Este navegador no dispone de Web Audio. Usa un navegador compatible.')
        contexto = crearContexto ? crearContexto() : new Constructor()
        salida = contexto.createGain(); salida.connect(contexto.destination)
      }
      await contexto.resume()
      const muestras = new Map(Object.values(MUESTRAS).map(m => [m.id, m]))
      const buffers = new Map(await Promise.all([...new Set(plan.eventos.map(e => e.muestraId))].map(async id => {
        const muestra = muestras.get(id)
        if (!muestra) throw new Error('La secuencia contiene una muestra desconocida.')
        if (!cache.has(id)) cache.set(id, (async () => {
          const respuesta = await descargar(muestra.url)
          if (!respuesta.ok) throw new Error(`No se pudo cargar el sampleo ${id}.`)
          const buffer = await contexto.decodeAudioData(await respuesta.arrayBuffer())
          if (Math.abs(buffer.duration - muestra.duracion) > 0.01) throw new Error(`La duración del sampleo ${id} no coincide con el banco.`)
          return buffer
        })().catch(error => { cache.delete(id); throw error }))
        return [id, await cache.get(id)]
      })))
      if (actual !== sesion) return false
      salida.gain.value = Math.min(0.45, Math.max(0, volumen))
      const comienzo = contexto.currentTime + 0.08
      let ultimo = -1
      // Todos los inicios usan el reloj de audio; no una cadena de temporizadores.
      for (const [i, evento] of plan.eventos.entries()) {
        const fuente = contexto.createBufferSource()
        fuente.buffer = buffers.get(evento.muestraId); fuente.connect(salida)
        fuente.onended = () => {
          fuente.disconnect()
          if (i === plan.eventos.length - 1 && actual === sesion) {
            fuentes = []; clearInterval(reloj); reloj = null
            finalizar = null; activo = null; alFinal()
          }
        }
        fuentes.push(fuente)
        fuente.start(comienzo + evento.inicio)
      }
      reloj = setInterval(() => {
        const tiempo = contexto.currentTime - comienzo
        const indice = Math.min(plan.eventos.length - 1, Math.floor(tiempo))
        if (indice >= 0 && indice !== ultimo) { ultimo = indice; alNodo(plan.eventos[indice].nodoId) }
      }, 40)
      return true
    } catch (error) {
      if (actual !== sesion) return false
      detener()
      throw error
    }
  }
  async function cerrar() { detener(); if (contexto) { await contexto.close(); contexto = null; salida = null; cache.clear() } }
  return { reproducir, detener, cerrar }
}

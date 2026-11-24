import { BANCO } from '../modules/sonification/samplePlan.js'

let activo = null

/** Reproduce WAV locales con AudioBufferSourceNode; no utiliza osciladores. */
export function crearReproductorSampleos({ crearContexto, descargar = (...args) => fetch(...args) } = {}) {
  let contexto = null, salida = null, fuentes = [], ganancias = [], sesion = 0, reloj = null, finalizar = null
  const cache = new Map()
  function detener() {
    sesion++
    clearInterval(reloj); reloj = null
    for (const fuente of fuentes) { fuente.onended = null; fuente.stop(); fuente.disconnect() }
    fuentes = []
    for (const ganancia of ganancias) ganancia.disconnect()
    ganancias = []
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
      const muestras = new Map(BANCO.map(m => [m.id, m]))
      const ids = [...new Set([...plan.eventos.map(e => e.muestraId), ...(plan.base?.volumen > 0 ? [plan.base.muestraId] : [])])]
      const buffers = new Map(await Promise.all(ids.map(async id => {
        const muestra = muestras.get(id)
        if (!muestra?.url) throw new Error('La secuencia contiene una muestra desconocida o ausente.')
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
      if (plan.base?.volumen > 0) {
        const fuente = contexto.createBufferSource(), mezcla = contexto.createGain()
        fuente.buffer = buffers.get(plan.base.muestraId); fuente.loop = true
        mezcla.gain.setValueAtTime(0, comienzo)
        mezcla.gain.linearRampToValueAtTime(Math.min(.4, plan.base.volumen), comienzo + .08)
        mezcla.gain.setValueAtTime(Math.min(.4, plan.base.volumen), comienzo + plan.duracion - .3)
        mezcla.gain.linearRampToValueAtTime(0, comienzo + plan.duracion)
        fuente.connect(mezcla); mezcla.connect(salida)
        ganancias.push(mezcla); fuentes.push(fuente)
        fuente.start(comienzo); fuente.stop(comienzo + plan.duracion)
      }
      // Todos los inicios usan el reloj de audio; no una cadena de temporizadores.
      for (const [i, evento] of plan.eventos.entries()) {
        const fuente = contexto.createBufferSource()
        fuente.buffer = buffers.get(evento.muestraId); fuente.connect(salida)
        fuente.onended = () => {
          if (i === plan.eventos.length - 1 && actual === sesion) {
            detener()
          }
        }
        fuentes.push(fuente)
        fuente.start(comienzo + evento.inicio)
      }
      reloj = setInterval(() => {
        const tiempo = contexto.currentTime - comienzo
        let indice = ultimo
        while (indice + 1 < plan.eventos.length && plan.eventos[indice + 1].inicio <= tiempo) indice++
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

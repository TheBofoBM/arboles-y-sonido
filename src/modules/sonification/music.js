/** Una misma escala y un pulso de 6/8 para cualquier forma del árbol. */
export const DURACION_MOTIVO = 2
export const INTERVALO_NODO = 1.5
export const DURACION_BASE = 6
export const CONFIGURACION_SONORA = Object.freeze({ registroRaiz: 10, pasoNivel: 1, volumenBase: 0.22 })
export const MOTIVOS = Object.freeze({
  RELACION: { id: 'relacion', instrumento: 'cuerdas', nombre: 'Órbita · cuerdas', grados: [0, 2, 4, 3, 2], tiempos: [0, .25, .5, .875, 1.25] },
  SELECCION: { id: 'seleccion', instrumento: 'flauta', nombre: 'Destello · flauta', grados: [0, 3, 2, 1, 2, 0], tiempos: [0, .375, .5, .75, 1, 1.25] },
  PROYECCION: { id: 'proyeccion', instrumento: 'campanas', nombre: 'Estrella · campanas', grados: [0, 2, 3, 5, 4, 5], tiempos: [0, .25, .5, .75, 1.125, 1.25] },
  PROYECCION_EXTENDIDA: { id: 'proyeccion-extendida', instrumento: 'campanas', nombre: 'Constelación · campanas y cuerdas', grados: [0, 1, 3, 2, 4, 5], tiempos: [0, .25, .5, .875, 1, 1.25] },
  JOIN: { id: 'join', instrumento: 'trompa', nombre: 'Encuentro · trompa y cuerdas', grados: [0, 3, 2, 4, 3, 5], tiempos: [0, .375, .5, .75, 1, 1.25] },
})
export function midiPentatonico(grado) {
  const octava = Math.floor(grado / 5), indice = ((grado % 5) + 5) % 5
  return 55 + octava * 12 + [0, 2, 4, 7, 9][indice]
}
export function nombreRegistro(grado) {
  const midi = midiPentatonico(grado)
  return ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][midi % 12] + (Math.floor(midi / 12) - 1)
}
export function validarConfiguracion(opciones = {}) {
  const config = { ...CONFIGURACION_SONORA, ...opciones }
  if (![0, 5, 10].includes(config.registroRaiz) || ![0, 1, 2, 5].includes(config.pasoNivel)
      || !Number.isFinite(config.volumenBase) || config.volumenBase < 0 || config.volumenBase > .4) {
    throw new TypeError('Configuración sonora fuera del rango admitido.')
  }
  return config
}

import { construirArbol } from '../tree/treeLoader.js'
import { MOTIVOS, DURACION_MOTIVO, INTERVALO_NODO, DURACION_BASE, validarConfiguracion, nombreRegistro } from './music.js'

// Variantes preparadas: cambiar el registro no altera el tempo ni la duración.
const archivos = import.meta.glob('../../assets/samples/aventura/*.wav', { eager: true, query: '?url', import: 'default' })
export const MUESTRAS = Object.freeze(Object.fromEntries(Object.entries(MOTIVOS).map(([tipo, motivo]) => [tipo, Object.freeze({
  id: motivo.id, duracion: DURACION_MOTIVO,
  variantes: Object.freeze(Array.from({ length: 11 }, (_, registro) => Object.freeze({
    id: `${motivo.id}-${registro}`, duracion: DURACION_MOTIVO,
    url: archivos[`../../assets/samples/aventura/${motivo.id}-${registro}.wav`],
  }))),
})])))
export const BASE = Object.freeze({ id: 'base-aventura', duracion: DURACION_BASE, url: archivos['../../assets/samples/aventura/base.wav'] })
export const BANCO = Object.freeze([BASE, ...Object.values(MUESTRAS).flatMap(m => m.variantes)])

/** Postorden: entradas antes que operadores. Profundidad absoluta, raíz=0. */
export function crearSecuenciaSampleos(documento, orden = 'postorden', opciones = {}) {
  const configuracion = validarConfiguracion(opciones)
  const resultado = construirArbol(documento)
  if (!['niveles', 'preorden', 'postorden'].includes(orden)) throw new TypeError('Recorrido no soportado.')
  const indice = new Map(resultado.nodos.map(n => [n.id, n]))
  const visitas = orden === 'niveles' ? [...resultado.nodos].sort((a, b) => a.profundidad - b.profundidad || a.posicion - b.posicion).map(n => n.id) : resultado.recorridos[orden]
  const eventos = visitas.map((id, i) => {
    const nodo = indice.get(id), motivo = MUESTRAS[nodo.tipo]
    const registro = Math.max(0, configuracion.registroRaiz - nodo.profundidad * configuracion.pasoNivel)
    const muestra = motivo.variantes[registro]
    return { nodoId: id, tipo: nodo.tipo, profundidad: nodo.profundidad, registro, nota: nombreRegistro(registro), muestraId: muestra.id, inicio: i * INTERVALO_NODO, duracion: muestra.duracion }
  })
  return { orden, configuracion, base: { muestraId: BASE.id, volumen: configuracion.volumenBase }, eventos, duracion: eventos.at(-1).inicio + eventos.at(-1).duracion }
}

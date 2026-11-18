import { construirArbol } from '../tree/treeLoader.js'

export const MUESTRAS = Object.freeze(Object.fromEntries([
  ['RELACION', 'relacion'], ['SELECCION', 'seleccion'], ['PROYECCION', 'proyeccion'],
  ['PROYECCION_EXTENDIDA', 'proyeccion-extendida'], ['JOIN', 'join'],
].map(([tipo, archivo]) => [tipo, Object.freeze({
  id: archivo, duracion: 1.5, url: new URL(`../../assets/samples/${archivo}.wav`, import.meta.url).href,
})])))

/** Un fragmento melódico por visita; pulso fijo y cola completa de la última muestra. */
export function crearSecuenciaSampleos(documento, orden = 'niveles') {
  const resultado = construirArbol(documento)
  if (!['niveles', 'preorden', 'postorden'].includes(orden)) throw new TypeError('Recorrido no soportado.')
  const indice = new Map(resultado.nodos.map(n => [n.id, n]))
  const visitas = orden === 'niveles' ? [...resultado.nodos].sort((a, b) => a.profundidad - b.profundidad || a.posicion - b.posicion).map(n => n.id) : resultado.recorridos[orden]
  const eventos = visitas.map((id, i) => {
    const nodo = indice.get(id), muestra = MUESTRAS[nodo.tipo]
    if (!muestra) throw new TypeError(`Falta una muestra para ${nodo.tipo}.`)
    return { nodoId: id, tipo: nodo.tipo, muestraId: muestra.id, inicio: i, duracion: muestra.duracion }
  })
  return { orden, eventos, duracion: eventos.at(-1).inicio + eventos.at(-1).duracion }
}

import { construirArbol } from './treeLoader.js'

export const ESTILOS_OPERADOR = Object.freeze({
  PROYECCION: { nombre: 'Proyección', simbolo: 'π', color: '#7955d9', fondo: '#f0eaff' },
  PROYECCION_EXTENDIDA: { nombre: 'Proyección extendida', simbolo: 'π+', color: '#d54f86', fondo: '#fff0f6' },
  SELECCION: { nombre: 'Selección', simbolo: 'σ', color: '#c67713', fondo: '#fff4dc' },
  JOIN: { nombre: 'JOIN', simbolo: '⋈', color: '#3677dc', fondo: '#eaf2ff' },
  RELACION: { nombre: 'Relación', simbolo: 'R', color: '#168c83', fondo: '#e4f7f1' },
})

export function describirNodo(nodo) {
  const p = nodo.parametros
  if (nodo.tipo === 'RELACION') return p.nombre + (p.alias ? ` · ${p.alias}` : '')
  if (nodo.tipo === 'SELECCION') return p.predicado
  if (nodo.tipo === 'JOIN') return p.condicion
  const columnas = (p.atributos ?? p.expresiones).join(', ')
  return p.orden ? `${columnas} · ORDER BY ${p.orden.join(', ')}` : columnas
}

/** Centros de padres sobre sus hojas; cada nivel tiene su propia fila. */
export function distribuirArbol(documento) {
  const resultado = construirArbol(documento)
  const anchos = new Map(), posiciones = new Map()
  const anchoNodo = 220, altoNodo = 78, separacion = 28, nivel = 120, margen = 28
  function medir(n) {
    const unidades = n.hijos.length ? n.hijos.reduce((suma, h) => suma + medir(h), 0) : 1
    anchos.set(n.id, unidades)
    return unidades
  }
  const hojas = medir(resultado.arbol.raiz)
  function ubicar(n, inicio, profundidad) {
    const unidades = anchos.get(n.id)
    posiciones.set(n.id, { x: margen + (inicio + unidades / 2) * (anchoNodo + separacion) - separacion / 2, y: margen + profundidad * nivel })
    let offset = inicio
    for (const hijo of n.hijos) { ubicar(hijo, offset, profundidad + 1); offset += anchos.get(hijo.id) }
  }
  ubicar(resultado.arbol.raiz, 0, 0)
  return {
    ancho: hojas * (anchoNodo + separacion) - separacion + margen * 2,
    alto: resultado.profundidadMaxima * nivel + altoNodo + margen * 2,
    anchoNodo, altoNodo,
    nodos: resultado.nodos.map(n => ({ ...n, ...posiciones.get(n.id), estilo: ESTILOS_OPERADOR[n.tipo], descripcion: describirNodo(n) })),
    enlaces: resultado.enlaces.map(e => {
      const padre = posiciones.get(e.padreId), hijo = posiciones.get(e.hijoId)
      return { ...e, d: `M ${padre.x} ${padre.y + altoNodo} C ${padre.x} ${padre.y + altoNodo + 22}, ${hijo.x} ${hijo.y - 22}, ${hijo.x} ${hijo.y}` }
    }),
  }
}

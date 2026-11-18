import seleccionProyeccion from './seleccion-proyeccion-libro.json'
import libroAutor from './libro-autor.json'
import entradasFiltradas from './libro-autor-entradas-filtradas.json'
import ventas from './ventas.json'

export const EJEMPLOS_ARBOL = Object.freeze([
  { id: 'seleccion-proyeccion', nombre: 'Selección y proyección de Libro', documento: seleccionProyeccion },
  { id: 'libro-autor', nombre: 'Libro y Autor · JOIN y filtro', documento: libroAutor },
  { id: 'entradas-filtradas', nombre: 'Libro y Autor · filtros antes del JOIN', documento: entradasFiltradas },
  { id: 'ventas', nombre: 'Ventas · cuatro relaciones y tres JOIN', documento: ventas },
])

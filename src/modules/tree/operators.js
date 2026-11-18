/** Operadores lógicos admitidos por la versión 1 del modelo. */
export const OPERADORES = Object.freeze({
  RELACION: Object.freeze({ aridad: 0 }),
  SELECCION: Object.freeze({ aridad: 1 }),
  PROYECCION: Object.freeze({ aridad: 1 }),
  PROYECCION_EXTENDIDA: Object.freeze({ aridad: 1 }),
  JOIN: Object.freeze({ aridad: 2 }),
})

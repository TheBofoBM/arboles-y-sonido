<script setup>
import { ref } from 'vue'
import biblioteca from '../../data/examples/biblioteca.sql?raw'
import { useSqlReader } from '../../composables/useSqlReader.js'
import TreeWorkbench from '../trees/TreeWorkbench.vue'

defineEmits(['comparar'])
const { texto, resultado, errores, estado, procesar, cargarEjemplo, limpiar } = useSqlReader()
procesar()
const ejemplos = [
  { nombre: 'Productos ordenados', sql: 'SELECT nombre, precio FROM Producto ORDER BY precio DESC, nombre ASC;' },
  { nombre: 'Ventas pagadas', sql: "SELECT id_venta, total FROM Venta WHERE estado = 'Pagada' AND total >= 500;" },
  { nombre: 'Ciudades sin duplicados', sql: 'SELECT DISTINCT ciudad FROM Cliente ORDER BY ciudad;' },
  { nombre: 'Pedidos con cliente y sucursal', sql: `SELECT P.id_pedido, C.nombre, S.nombre
FROM Pedido P
JOIN Cliente C ON P.id_cliente = C.id_cliente
JOIN Sucursal S ON P.id_sucursal = S.id_sucursal
WHERE P.total > 1000
ORDER BY P.id_pedido DESC;` },
  { nombre: 'Biblioteca', sql: biblioteca },
]
const ejemploElegido = ref('')
</script>

<template>
  <section class="tree-reader" aria-labelledby="sql-reader-title">
    <div class="section-heading">
      <div><p class="eyebrow">SQL hacia álgebra relacional</p><h2 id="sql-reader-title">Construir un árbol desde SQL</h2></div>
      <span class="status">Subconjunto PostgreSQL</span>
    </div>
    <details class="entry-editor" :open="!resultado"><summary><span class="entry-icon" aria-hidden="true">SQL</span> Editar consulta SQL</summary>
    <form class="reader-form" @submit.prevent="procesar">
      <label for="tree-sql">Consulta SQL</label>
      <p id="sql-help" class="field-help">
        SELECT de columnas, FROM, alias de tablas, INNER JOIN con ON y comparaciones unidas por AND.
        Puedes usar DISTINCT y ORDER BY por columnas. El prototipo construye el árbol sin ejecutar SQL.
      </p>
      <textarea id="tree-sql" v-model="texto" rows="9" spellcheck="false" aria-describedby="sql-help" :aria-invalid="estado === 'invalido'"></textarea>
      <div class="editor-actions">
        <button class="button-primary" type="submit">Generar árbol desde SQL</button>
        <label for="sql-ejemplo">Consulta de ejemplo</label>
        <select id="sql-ejemplo" v-model="ejemploElegido" @change="cargarEjemplo(ejemploElegido); ejemploElegido = ''">
          <option disabled value="">Elegir un ejemplo</option>
          <option v-for="ejemplo in ejemplos" :key="ejemplo.nombre" :value="ejemplo.sql">{{ ejemplo.nombre }}</option>
        </select>
        <button class="button-secondary" type="button" @click="limpiar">Limpiar SQL</button>
      </div>
    </form>
    </details>
    <div v-if="errores.length" class="validation-errors" role="alert">
      <h3>No se pudo construir el árbol SQL</h3>
      <ul>
        <li v-for="(error, indice) in errores" :key="indice">
          <strong>{{ error.mensaje }}</strong>
          <span class="error-path">{{ error.codigo }}<template v-if="error.linea"> · Línea {{ error.linea }}, columna {{ error.columna }}</template></span>
        </li>
      </ul>
    </div>
    <p class="reader-status" role="status" aria-live="polite">
      {{ estado === 'valido' ? 'Árbol listo para escuchar.' : estado === 'invalido' ? 'Revisa la sintaxis y el subconjunto SQL admitido.' : 'Edita la consulta y pulsa Generar árbol desde SQL.' }}
    </p>
    <template v-if="resultado">
      <TreeWorkbench :resultado="resultado" @comparar="$emit('comparar', $event)" />
    </template>
  </section>
</template>

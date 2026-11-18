<script setup>
import { useSqlReader } from '../../composables/useSqlReader.js'
import TreeWorkbench from '../trees/TreeWorkbench.vue'

defineEmits(['enviar-json', 'comparar'])
const { texto, resultado, errores, estado, procesar, cargarEjemplo, limpiar } = useSqlReader()
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
        DISTINCT se conserva en la proyección. No se ejecuta la consulta.
      </p>
      <textarea id="tree-sql" v-model="texto" rows="9" spellcheck="false" aria-describedby="sql-help" :aria-invalid="estado === 'invalido'"></textarea>
      <div class="editor-actions">
        <button class="button-primary" type="submit">Generar árbol desde SQL</button>
        <button class="button-secondary" type="button" @click="cargarEjemplo">Cargar consulta de biblioteca</button>
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
      <details class="technical-details"><summary>Opciones de la consulta</summary>
      <button class="button-secondary transfer-json" type="button" @click="$emit('enviar-json', resultado.arbol)">Enviar árbol al editor JSON</button>
      <details class="result-details sql-analysis">
        <summary>Tablas, alias, columnas y condiciones identificados</summary>
        <pre class="normalized-json" tabindex="0">{{ JSON.stringify(resultado.analisisSQL, null, 2) }}</pre>
      </details>
      </details>
      <TreeWorkbench :resultado="resultado" @comparar="$emit('comparar', $event)" />
    </template>
  </section>
</template>

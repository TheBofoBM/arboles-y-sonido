<script setup>
import { ref, watch } from 'vue'
import { arbolASQL } from '../../modules/sql/treeToSql.js'
import { procesarSQL } from '../../modules/sql/sqlToTree.js'
const props = defineProps({ arbol: { type: Object, required: true } })
const emit = defineEmits(['actualizar'])
const texto = ref(''), aviso = ref(''), error = ref('')
watch(() => props.arbol, arbol => {
  texto.value = ''; aviso.value = ''; error.value = ''
  try { texto.value = arbolASQL(arbol) } catch (fallo) { aviso.value = fallo.message }
}, { immediate: true })
function aplicar() {
  const respuesta = procesarSQL(texto.value)
  error.value = respuesta.errores.map(e => e.mensaje).join(' ')
  if (respuesta.valido) emit('actualizar', respuesta.resultado)
}
</script>

<template>
  <details class="technical-details sql-reference"><summary>SQL de referencia · Editar</summary>
    <p class="field-help">Traducción del árbol actual. Puedes editarla y generar un árbol nuevo; no se ejecuta contra una base de datos. SELECT DISTINCT corresponde a PI; SELECT sin DISTINCT, a PI_ALL. Al regenerar, el lector SQL vuelve a construir el árbol desde las cláusulas escritas.</p>
    <p v-if="aviso" role="status">{{ aviso }}</p>
    <form v-else class="reader-form" @submit.prevent="aplicar">
      <label>Consulta SQL de referencia<textarea v-model="texto" rows="8" spellcheck="false" :aria-invalid="!!error"></textarea></label>
      <p class="field-help">Para generar el árbol se requieren columnas explícitas en SELECT. El editor admite INNER JOIN y AND del subconjunto SQL del prototipo. La referencia reúne filtros en WHERE y puede reagrupar los INNER JOIN conservando sus condiciones.</p>
      <button type="submit" class="button-secondary">Aplicar SQL al árbol</button>
      <p v-if="error" role="alert" class="error-text">{{ error }}</p>
    </form>
  </details>
</template>

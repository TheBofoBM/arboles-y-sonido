<script setup>
import { computed } from 'vue'

const props = defineProps({ resultado: { type: Object, required: true }, prefijo: { type: String, default: 'result' }, nodoActivo: { type: String, default: null } })
const jsonNormalizado = computed(() => JSON.stringify(props.resultado.arbol, null, 2))
</script>

<template>
  <section class="tree-result" :aria-labelledby="`${prefijo}-title`">
    <h2 :id="`${prefijo}-title`">Resultado estructurado</h2>
    <p class="field-help">Operadores y predicados del documento, sin reordenarlos. Profundidad desde cero.</p>
    <dl class="tree-stats">
      <div><dt>Nodos</dt><dd>{{ resultado.cantidadNodos }}</dd></div>
      <div><dt>Profundidad máxima</dt><dd>{{ resultado.profundidadMaxima }}</dd></div>
      <div><dt>Raíz</dt><dd>{{ resultado.raizId }}</dd></div>
    </dl>
    <h3>Estructura del árbol</h3>
    <ol class="tree-outline" aria-label="Árbol lógico en preorden">
      <li v-for="nodo in resultado.nodos" :key="nodo.id" :style="{ '--nivel': Math.min(nodo.profundidad, 10) }">
        <article class="node-card" :class="{ 'node-active': nodoActivo === nodo.id }" :data-node-id="nodo.id" :aria-current="nodoActivo === nodo.id ? 'step' : undefined">
          <div class="node-heading"><span class="node-type">{{ nodo.tipo }}</span><code>{{ nodo.id }}</code></div>
          <h4>{{ nodo.etiqueta }}</h4>
          <pre class="node-parameters">{{ JSON.stringify(nodo.parametros, null, 2) }}</pre>
          <p class="node-context">
            Profundidad {{ nodo.profundidad }} · Posición {{ nodo.posicion }} ·
            {{ nodo.padreId === null ? 'Raíz' : `Padre: ${nodo.padreId} · Entrada: ${nodo.lado}` }}
          </p>
        </article>
      </li>
    </ol>
    <div class="traversal-grid">
      <section v-for="orden in ['preorden', 'postorden']" :key="orden" :aria-label="orden">
        <h3>{{ orden === 'preorden' ? 'Preorden' : 'Postorden' }}</h3>
        <ol class="traversal-list">
          <li v-for="id in resultado.recorridos[orden]" :key="id"><code>{{ id }}</code></li>
        </ol>
      </section>
    </div>
    <details class="result-details">
      <summary>Relaciones padre-hijo y metadatos</summary>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Tabla de nodos y relaciones">
        <table>
          <caption>Entradas ordenadas de cada nodo</caption>
          <thead><tr><th scope="col">Id</th><th scope="col">Padre</th><th scope="col">Hijos</th><th scope="col">Profundidad</th><th scope="col">Posición</th><th scope="col">Entrada</th></tr></thead>
          <tbody>
            <tr v-for="nodo in resultado.nodos" :key="nodo.id">
              <th scope="row">{{ nodo.id }}</th><td>{{ nodo.padreId ?? 'Raíz' }}</td>
              <td>{{ nodo.hijosIds.join(', ') || 'Sin hijos' }}</td><td>{{ nodo.profundidad }}</td>
              <td>{{ nodo.posicion }}</td><td>{{ nodo.lado ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
    <details class="result-details">
      <summary>JSON normalizado del árbol lógico</summary>
      <pre class="normalized-json" tabindex="0">{{ jsonNormalizado }}</pre>
    </details>
  </section>
</template>

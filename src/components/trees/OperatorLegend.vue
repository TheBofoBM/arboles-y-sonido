<script setup>
import { ESTILOS_OPERADOR } from '../../modules/tree/treeLayout.js'
</script>
<template>
  <div class="operator-legend" aria-label="Colores de los operadores">
    <span v-for="(estilo, tipo) in ESTILOS_OPERADOR" :key="tipo" :style="{ '--operator-color': estilo.color }"><i aria-hidden="true"></i>{{ estilo.nombre }}</span>
  </div>
</template>

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // GitHub Pages aporta /repositorio/; en desarrollo local se conserva /.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.js'],
    clearMocks: true,
  },
})

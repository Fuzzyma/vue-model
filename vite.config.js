import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [ vue() ],
  build: {
    lib: {
      formats: [ 'iife' ],
      entry: './src/Model.ts',
      name: 'Model'
    },
    minify: false,
    rollupOptions: {
      external: [ 'vue' ],
      output: {
        globals: { vue: 'Vue' }
      }
    }
  }
})

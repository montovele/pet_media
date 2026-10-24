import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5199,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4020',
        changeOrigin: true,
      },
    },
  },
})

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './app.css'
import App from './App.vue'
import router from './router'

createApp(App).use(createPinia()).use(router).mount('#app')

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
    console.error('No se pudo registrar el modo instalable de BIO-ACTA:', error)
  })
}

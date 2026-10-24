import { defineStore } from 'pinia'
import { photosApi } from '../services/photosApi'
import type { Photo } from '../../../types/content'

export const usePhotosStore = defineStore('photos', {
  state: () => ({ items: [] as Photo[], loading: false, loaded: false, error: '' }),
  actions: {
    async load() {
      if (this.loading || this.loaded) return
      this.loading = true
      this.error = ''
      try {
        this.items = await photosApi.list()
        this.loaded = true
      } catch {
        this.error = 'No se pudieron cargar tus fotos.'
      } finally {
        this.loading = false
      }
    },
  },
})
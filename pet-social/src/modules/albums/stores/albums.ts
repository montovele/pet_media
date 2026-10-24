import { defineStore } from 'pinia'
import { albumsApi } from '../services/albumsApi'
import type { Album } from '../../../types/content'

export const useAlbumsStore = defineStore('albums', {
  state: () => ({ items: [] as Album[], loading: false, saving: false, loaded: false, error: '' }),
  actions: {
    async load() {
      if (this.loading || this.loaded) return
      this.loading = true
      this.error = ''
      try {
        this.items = await albumsApi.list()
        this.loaded = true
      } catch {
        this.error = 'No se pudieron cargar tus álbumes.'
      } finally {
        this.loading = false
      }
    },
    async create(input: { title: string; description?: string; photoIds: string[] }) {
      this.saving = true
      this.error = ''
      try {
        const album = await albumsApi.create(input)
        this.items = [album, ...this.items]
        return true
      } catch {
        this.error = 'No se pudo guardar el álbum.'
        return false
      } finally {
        this.saving = false
      }
    },
  },
})
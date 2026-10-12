import { defineStore } from 'pinia'
import { brandApi } from '../services/brandApi'

export const useBrandStore = defineStore('brand', {
  state: () => ({
    name: 'entremomentos',
    logoUrl: null as string | null,
    loaded: false,
    loading: false,
    saving: false,
    error: '',
  }),
  actions: {
    async load() {
      if (this.loaded || this.loading) return
      this.loading = true
      this.error = ''
      try {
        const brand = await brandApi.get()
        this.name = brand.name
        this.logoUrl = brand.logoUrl
        this.loaded = true
      } catch {
        this.error = 'No se pudo cargar la identidad de marca.'
      } finally {
        this.loading = false
      }
    },
    async update(values: { name?: string; logoUrl?: string | null }) {
      this.saving = true
      this.error = ''
      try {
        const brand = await brandApi.update(values)
        this.name = brand.name
        this.logoUrl = brand.logoUrl
        this.loaded = true
        return true
      } catch {
        this.error = 'No se pudo guardar la identidad de marca.'
        return false
      } finally {
        this.saving = false
      }
    },
  },
})
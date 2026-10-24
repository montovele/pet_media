import { defineStore } from 'pinia'
import axios from 'axios'
import { brandApi } from '../services/brandApi'

function getRequestError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    if (typeof error.response?.data?.message === 'string') return error.response.data.message
    if (!error.response) return 'No se pudo conectar con la API. Comprueba que el backend esté activo.'
  }
  return error instanceof Error ? error.message : fallback
}

export const useBrandStore = defineStore('brand', {
  state: () => ({
    name: 'entremomentos',
    logoUrl: null as string | null,
    primaryColor: '#187a75',
    secondaryColor: '#d55d45',
    loaded: false,
    loading: false,
    saving: false,
    error: '',
  }),
  actions: {
    applyBranding() {
      const root = document.documentElement
      root.style.setProperty('--brand-primary', this.primaryColor)
      root.style.setProperty('--brand-secondary', this.secondaryColor)
      const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (favicon) favicon.href = this.logoUrl || '/icons/paw.svg'
      const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      themeColor?.setAttribute('content', this.primaryColor)
      document.title = `${this.name} · Su identidad lo acompaña`
    },
    async load() {
      if (this.loaded || this.loading) return
      this.loading = true
      this.error = ''
      try {
        const brand = await brandApi.get()
        this.name = brand.name
        this.logoUrl = brand.logoUrl
        this.primaryColor = brand.primaryColor
        this.secondaryColor = brand.secondaryColor
        this.applyBranding()
        this.loaded = true
      } catch (error) {
        this.error = getRequestError(error, 'No se pudo cargar la identidad de marca.')
      } finally {
        this.loading = false
      }
    },
    async update(values: { name?: string; logoUrl?: string | null; primaryColor?: string; secondaryColor?: string }) {
      this.saving = true
      this.error = ''
      try {
        const brand = await brandApi.update(values)
        this.name = brand.name
        this.logoUrl = brand.logoUrl
        this.primaryColor = brand.primaryColor
        this.secondaryColor = brand.secondaryColor
        this.applyBranding()
        this.loaded = true
        return true
      } catch (error) {
        this.error = getRequestError(error, 'No se pudo guardar la identidad de marca.')
        return false
      } finally {
        this.saving = false
      }
    },
  },
})
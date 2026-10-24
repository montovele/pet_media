import { defineStore } from 'pinia'
import axios from 'axios'
import { activitiesApi } from '../services/activitiesApi'
import type { Activity, CreateActivityInput } from '../../../types/content'

export const useActivitiesStore = defineStore('activities', {
  state: () => ({
    items: [] as Activity[],
    loading: false,
    saving: false,
    loaded: false,
    error: '',
  }),
  actions: {
    async load() {
      if (this.loading || this.loaded) return
      this.loading = true
      this.error = ''
      try {
        this.items = await activitiesApi.list()
        this.loaded = true
      } catch {
        this.error = 'No se pudieron cargar tus actividades.'
      } finally {
        this.loading = false
      }
    },
    async create(input: CreateActivityInput, media?: File[]) {
      this.saving = true
      this.error = ''
      try {
        const activity = await activitiesApi.create(input, media)
        this.items = [activity, ...this.items].sort((left, right) => right.date.localeCompare(left.date))
        return true
      } catch (error) {
        this.error = axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : axios.isAxiosError(error) && !error.response
            ? 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
            : 'No se pudo guardar la actividad.'
        return false
      } finally {
        this.saving = false
      }
    },
  },
})
import { defineStore } from 'pinia'
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
    async create(input: CreateActivityInput, video?: File) {
      this.saving = true
      this.error = ''
      try {
        const activity = await activitiesApi.create(input, video)
        this.items = [activity, ...this.items].sort((left, right) => right.date.localeCompare(left.date))
        return true
      } catch {
        this.error = 'No se pudo guardar la actividad.'
        return false
      } finally {
        this.saving = false
      }
    },
  },
})
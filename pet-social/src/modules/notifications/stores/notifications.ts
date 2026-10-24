import { defineStore } from 'pinia'
import type { NotificationItem } from '../../../types/content'
import { notificationsApi } from '../services/notificationsApi'

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [] as NotificationItem[],
    loading: false,
    loaded: false,
    error: '',
  }),
  getters: {
    unreadCount: (state) => state.items.filter((item) => !item.read).length,
  },
  actions: {
    async loadNotifications() {
      if (this.loading) return
      this.loading = true
      this.error = ''
      try {
        this.items = await notificationsApi.list()
        this.loaded = true
      } catch {
        this.error = 'No pudimos cargar la actividad reciente. Inténtalo de nuevo.'
      } finally {
        this.loading = false
      }
    },
    async markAllRead() {
      const previousItems = this.items
      this.items = this.items.map((item) => ({ ...item, read: true }))
      try {
        await notificationsApi.markAllRead()
      } catch {
        this.items = previousItems
        this.error = 'No pudimos marcar las notificaciones como leídas.'
      }
    },
    addNotification(notification: NotificationItem) {
      this.items = [notification, ...this.items]
    },
    clear() {
      this.items = []
      this.loaded = false
      this.error = ''
    },
  },
})

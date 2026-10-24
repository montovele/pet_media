import { z } from 'zod'
import { api } from '../../../services/api/client'
import type { NotificationItem } from '../../../types/content'

const notificationSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  type: z.string().transform((type): NotificationItem['type'] => {
    if (type === 'reaction') return 'like'
    if (type === 'story' || type === 'like' || type === 'comment' || type === 'social' || type === 'care' || type === 'lost_found') return type
    return 'social'
  }),
  title: z.string(),
  description: z.string(),
  createdAt: z.string(),
  read: z.boolean(),
})

export const notificationsApi = {
  async list() {
    const { data } = await api.get<unknown>('/notifications')
    return z.array(notificationSchema).parse(data) as NotificationItem[]
  },
  async markAllRead() {
    await api.patch('/notifications/read-all')
  },
}
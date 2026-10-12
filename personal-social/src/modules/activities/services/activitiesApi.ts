import { z } from 'zod'
import { api } from '../../../services/api/client'
import type { Activity, CreateActivityInput } from '../../../types/content'

const activitySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  date: z.string(),
  locationName: z.string().optional(),
  category: z.enum(['walk', 'travel', 'food', 'wellness', 'culture', 'other']),
  video: z.object({ id: z.string(), url: z.string(), type: z.literal('video') }).optional(),
  createdAt: z.string(),
}).transform((activity) => {
  const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
  return {
    ...activity,
    video: activity.video ? { ...activity.video, url: new URL(activity.video.url, apiBase).toString() } : undefined,
  }
})

export const activitiesApi = {
  async list() {
    const { data } = await api.get<unknown>('/activities')
    return z.array(activitySchema).parse(data) as Activity[]
  },
  async uploadVideo(file: File) {
    const formData = new FormData()
    formData.append('files', file)
    const { data } = await api.post<unknown>('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return z.object({
      files: z.array(z.object({ id: z.string(), type: z.enum(['image', 'video']), url: z.string() })).min(1),
    }).parse(data).files[0]
  },
  async create(input: CreateActivityInput, video?: File) {
    const videoFile = video ? await this.uploadVideo(video) : undefined
    const { data } = await api.post<unknown>('/activities', { ...input, videoId: videoFile?.id })
    return activitySchema.parse(data) as Activity
  },
}
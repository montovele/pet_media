import { z } from 'zod'
import { api } from '../../../services/api/client'
import type { Activity, CreateActivityInput } from '../../../types/content'

const activitySchema = z.object({
  id: z.string(),
  animalId: z.string().uuid().nullable(),
  animalName: z.string().nullable().optional(),
  animalSpecies: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  date: z.string(),
  locationName: z.string().optional(),
  category: z.enum(['walk', 'travel', 'food', 'wellness', 'culture', 'other']),
  media: z.array(z.object({ id: z.string(), url: z.string(), type: z.enum(['image', 'video']) })).optional(),
  video: z.object({ id: z.string(), url: z.string(), type: z.literal('video') }).optional(),
  createdAt: z.string(),
}).transform((activity) => {
  const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
  const media = activity.media ?? (activity.video ? [activity.video] : [])
  const resolveMediaUrl = (file: (typeof media)[number]) => ({
    ...file,
    url: new URL(file.url, apiBase).toString(),
  })
  return {
    ...activity,
    media: media.map(resolveMediaUrl),
    video: activity.video ? resolveMediaUrl(activity.video) : undefined,
  }
})

export const activitiesApi = {
  async list() {
    const { data } = await api.get<unknown>('/activities')
    return z.array(activitySchema).parse(data) as Activity[]
  },
  async uploadMedia(files: File[]) {
    const formData = new FormData()
    for (const file of files) formData.append('files', file)
    const { data } = await api.post<unknown>('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
    })
    return z.object({
      files: z.array(z.object({ id: z.string(), type: z.enum(['image', 'video']), url: z.string() })).min(1),
    }).parse(data).files
  },
  async create(input: CreateActivityInput, media?: File[]) {
    const uploadedMedia = media?.length ? await this.uploadMedia(media) : undefined
    const { data } = await api.post<unknown>('/activities', {
      ...input,
      mediaIds: uploadedMedia?.map((file) => file.id),
    })
    return activitySchema.parse(data) as Activity
  },
}
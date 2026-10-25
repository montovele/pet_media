import { z } from 'zod'
import { api } from '../../../services/api/client'
import type { Photo } from '../../../types/content'

const photoSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  createdAt: z.string(),
  source: z.enum(['Historia', 'Publicación', 'Actividad']),
  mediaType: z.enum(['image', 'video']).default('image'),
})

export const photosApi = {
  async list() {
    const { data } = await api.get<unknown>('/photos')
    const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
    return z.array(photoSchema).parse(data).map((photo) => resolvePhoto(photo, apiBase)) as Photo[]
  },
  async get(photoId: string) {
    const { data } = await api.get<unknown>(`/photos/${encodeURIComponent(photoId)}`)
    const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
    return resolvePhoto(photoSchema.parse(data), apiBase) as Photo
  },
}

function resolvePhoto(photo: z.infer<typeof photoSchema>, apiBase: URL) {
  return { ...photo, url: new URL(photo.url, apiBase).toString() }
}
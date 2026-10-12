import { z } from 'zod'
import { api } from '../../../services/api/client'
import type { Album } from '../../../types/content'

const albumSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  createdAt: z.string(),
  photos: z.array(z.object({ id: z.string(), url: z.string() })),
})

export const albumsApi = {
  async list() {
    const { data } = await api.get<unknown>('/albums')
    const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
    return z.array(albumSchema).parse(data).map((album) => resolveAlbum(album, apiBase)) as Album[]
  },
  async get(albumId: string) {
    const { data } = await api.get<unknown>(`/albums/${encodeURIComponent(albumId)}`)
    const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
    return resolveAlbum(albumSchema.parse(data), apiBase) as Album
  },
  async create(input: { title: string; description?: string; photoIds: string[] }) {
    const { data } = await api.post<unknown>('/albums', input)
    const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
    return resolveAlbum(albumSchema.parse(data), apiBase) as Album
  },
}

function resolveAlbum(album: z.infer<typeof albumSchema>, apiBase: URL) {
  return {
    ...album,
    photos: album.photos.map((photo) => ({ ...photo, url: new URL(photo.url, apiBase).toString() })),
  }
}
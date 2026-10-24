import { z } from 'zod'
import { api } from '../../../services/api/client'
import type {
  PublishStoryRequest,
  SocialAccount,
  SocialConnectResponse,
  SocialPlatform,
  SocialPublication,
} from '../types/social.types'

const platformSchema = z.enum(['instagram', 'facebook'])
const accountSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  platform: platformSchema,
  accountName: z.string(),
  connected: z.boolean(),
  connectedAt: z.string().optional(),
})
const publicationSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  storyId: z.union([z.string(), z.number()]).transform(String).optional(),
  storyTitle: z.string(),
  platform: platformSchema,
  status: z.enum(['PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED']),
  caption: z.string(),
  createdAt: z.string(),
  externalUrl: z.string().url().optional(),
  errorMessage: z.string().optional(),
})
const accountListSchema = z.union([z.array(accountSchema), z.object({ items: z.array(accountSchema) })])
const publicationListSchema = z.union([z.array(publicationSchema), z.object({ items: z.array(publicationSchema) })])

function listItems<T>(result: T[] | { items: T[] }) {
  return Array.isArray(result) ? result : result.items
}

export const socialApi = {
  async getAccounts() {
    const { data } = await api.get<unknown>('/social/accounts')
    return listItems(accountListSchema.parse(data)) as SocialAccount[]
  },
  async startConnection(platform: SocialPlatform) {
    const { data } = await api.post<unknown>(`/social/${platform}/connect`)
    return z.object({ authorizationUrl: z.string().url() }).parse(data) as SocialConnectResponse
  },
  async disconnect(platform: SocialPlatform) {
    await api.delete(`/social/${platform}/disconnect`)
  },
  async publishEntry(request: PublishStoryRequest) {
    const { data } = await api.post<unknown>('/social/publications', request)
    return listItems(publicationListSchema.parse(data)) as SocialPublication[]
  },
  async getPublications() {
    const { data } = await api.get<unknown>('/social/publications')
    return listItems(publicationListSchema.parse(data)) as SocialPublication[]
  },
  async getPublication(id: string) {
    const { data } = await api.get<unknown>(`/social/publications/${id}`)
    return publicationSchema.parse(data) as SocialPublication
  },
}

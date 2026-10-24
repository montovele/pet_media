import { z } from 'zod'
import { api } from '../../../services/api/client'

const publicationMediaSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: z.enum(['image', 'video']),
})
const publicationSchema = z.object({
  id: z.string(),
  kind: z.enum(['post', 'story']),
  title: z.string(),
  caption: z.string(),
  imageUrl: z.string().optional(),
  mediaType: z.string().optional(),
  media: z.array(publicationMediaSchema).default([]),
  createdAt: z.string(),
  moderationStatus: z.enum(['pending', 'approved', 'rejected']),
  moderationNote: z.string().optional(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
    email: z.string(),
    isActive: z.boolean(),
  }),
})

export type ModerationPublication = z.infer<typeof publicationSchema>
export const moderationRoleSchema = z.enum(['admin', 'editor', 'moderator', 'user'])
export type ModerationRole = z.infer<typeof moderationRoleSchema>
const moderationUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['superadmin', 'admin', 'editor', 'moderator', 'user']),
  isActive: z.boolean(),
})
const supervisionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['superadmin', 'admin', 'editor', 'moderator', 'user']),
  isActive: z.boolean(),
  moderationNote: z.string().nullable(),
  createdAt: z.string(),
  postsCount: z.number().int(),
  storiesCount: z.number().int(),
  activitiesCount: z.number().int(),
  commentsCount: z.number().int(),
  reactionsCount: z.number().int(),
  totalActivity: z.number().int(),
  lastActivityAt: z.string().nullable(),
  level: z.enum(['Bajo', 'Moderado', 'Medio', 'Alto']),
})
const supervisionOverviewSchema = z.object({
  stats: z.object({
    totalUsers: z.number().int(),
    activeUsers: z.number().int(),
    inactiveUsers: z.number().int(),
    superadminUsers: z.number().int(),
    adminUsers: z.number().int(),
    editorUsers: z.number().int(),
    moderatorUsers: z.number().int(),
    regularUsers: z.number().int(),
  }),
  users: z.array(supervisionUserSchema),
})
export type ModerationUser = z.infer<typeof moderationUserSchema>
export type SupervisionUser = z.infer<typeof supervisionUserSchema>
export type SupervisionOverview = z.infer<typeof supervisionOverviewSchema>

export const moderationApi = {
  async listPublications(status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending') {
    const { data } = await api.get<unknown>('/moderation/publications', { params: { status } })
    return z.array(publicationSchema).parse(data) as ModerationPublication[]
  },
  async reviewContent(publication: Pick<ModerationPublication, 'id' | 'kind'>, decision: 'approve' | 'reject', reason: string) {
    const { data } = await api.patch<unknown>(`/moderation/content/${publication.kind}/${publication.id}/review`, { decision, reason })
    return z.object({ id: z.string(), kind: z.enum(['post', 'story']), moderationStatus: z.enum(['approved', 'rejected']), moderationNote: z.string().nullable() }).parse(data)
  },
  async listUsers() {
    const { data } = await api.get<unknown>('/moderation/users')
    return z.array(moderationUserSchema).parse(data) as ModerationUser[]
  },
  async listSupervisionOverview() {
    const { data } = await api.get<unknown>('/moderation/users/supervision')
    return supervisionOverviewSchema.parse(data) as SupervisionOverview
  },
  async assignRole(userId: string, role: ModerationRole) {
    const { data } = await api.patch<unknown>(`/moderation/users/${userId}/role`, { role })
    return z.object({ id: z.string(), role: moderationRoleSchema }).parse(data)
  },
  async setUserStatus(userId: string, isActive: boolean, reason: string) {
    const { data } = await api.patch<unknown>(`/moderation/users/${userId}/status`, { isActive, reason })
    return z.object({ id: z.string(), isActive: z.boolean(), moderationNote: z.string().nullable() }).parse(data)
  },
}
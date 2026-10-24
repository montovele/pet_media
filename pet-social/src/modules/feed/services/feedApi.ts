import { z } from 'zod'
import { api } from '../../../services/api/client'
import type { CommentItem, FeedEntry, StoryDraft } from '../../../types/content'
import { resolveAvatarUrl } from '../../../utils/avatar'

const visibilitySchema = z.enum(['public', 'followers', 'private'])
const mediaSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: z.enum(['image', 'video']),
})
const authorSchema = z.object({
  name: z.string(),
  handle: z.string(),
  avatar: z.string(),
})
const entrySchema = z.object({
  id: z.string(),
  kind: z.enum(['story', 'post']),
  title: z.string().optional(),
  caption: z.string(),
  imageUrl: z.string().optional(),
  mediaType: z.enum(['image', 'video']).optional(),
  media: z.array(mediaSchema).optional(),
  visibility: visibilitySchema,
  moderationStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  moderationNote: z.string().optional(),
  createdAt: z.string(),
  likes: z.number(),
  comments: z.number(),
  liked: z.boolean(),
  isFollowedAuthor: z.boolean().optional(),
  author: authorSchema,
}).transform((entry) => {
  const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
  return {
    ...entry,
    imageUrl: entry.imageUrl ? new URL(entry.imageUrl, apiBase).toString() : undefined,
    media: entry.media?.map((item) => ({ ...item, url: new URL(item.url, apiBase).toString() })),
    author: {
      ...entry.author,
      avatar: resolveAvatarUrl(entry.author.avatar, apiBase),
    },
  }
})
const commentSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
  likes: z.number(),
  liked: z.boolean(),
  author: authorSchema,
}).transform((comment) => {
  const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
  return { ...comment, author: { ...comment.author, avatar: resolveAvatarUrl(comment.author.avatar, apiBase) } }
})

export const feedApi = {
  async getFeed() {
    const { data } = await api.get<unknown>('/feed')
    return z.array(entrySchema).parse(data) as FeedEntry[]
  },
  async getPublicStories() {
    const { data } = await api.get<unknown>('/public/stories')
    return z.array(entrySchema).parse(data) as FeedEntry[]
  },
  async createPost(caption: string) {
    const { data } = await api.post<unknown>('/posts', { caption, visibility: 'public' })
    return entrySchema.parse(data) as FeedEntry
  },
  async uploadMedia(files: File[]) {
    const uploadedFiles: Array<z.infer<typeof mediaSchema>> = []
    for (const file of files) {
      const formData = new FormData()
      formData.append('files', file)
      const { data } = await api.post<unknown>('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
      })
      uploadedFiles.push(...z.object({ files: z.array(mediaSchema) }).parse(data).files)
    }
    return uploadedFiles
  },
  async createStory(story: Omit<StoryDraft, 'storyId' | 'media'> & { media: Array<{ id: string; type: 'image' | 'video' }> }) {
    const { data } = await api.post<unknown>('/stories', story)
    return entrySchema.parse(data) as FeedEntry
  },
  async updateStory(storyId: string, story: Omit<StoryDraft, 'storyId' | 'media'> & { media: Array<{ id: string; type: 'image' | 'video' }> }) {
    const { data } = await api.put<unknown>(`/stories/${storyId}`, story)
    return entrySchema.parse(data) as FeedEntry
  },
  async deleteStory(storyId: string) {
    await api.delete(`/stories/${storyId}`)
  },
  async toggleLike(entryId: string) {
    const { data } = await api.post<unknown>(`/feed/${entryId}/like`)
    return z.object({ liked: z.boolean(), likes: z.number() }).parse(data)
  },
  async getComments(entryId: string) {
    const { data } = await api.get<unknown>(`/feed/${entryId}/comments`)
    return z.array(commentSchema).parse(data) as CommentItem[]
  },
  async addComment(entryId: string, text: string) {
    const { data } = await api.post<unknown>(`/feed/${entryId}/comments`, { text })
    return commentSchema.parse(data) as CommentItem
  },
  async toggleCommentLike(entryId: string, commentId: string) {
    const { data } = await api.post<unknown>(`/feed/${entryId}/comments/${commentId}/like`)
    return z.object({ liked: z.boolean(), likes: z.number() }).parse(data)
  },
}
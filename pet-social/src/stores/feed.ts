import { defineStore } from 'pinia'
import axios from 'axios'
import { feedApi } from '../modules/feed/services/feedApi'
import type { CommentItem, FeedEntry, StoryDraft } from '../types/content'

export const useFeedStore = defineStore('feed', {
  state: () => ({
    entries: [] as FeedEntry[],
    commentsByEntry: {} as Record<string, CommentItem[]>,
    feedLoading: false,
    feedLoaded: false,
    feedError: '',
    actionError: '',
    storyPublishing: false,
  }),
  getters: {
    stories: (state) => state.entries.filter((entry) => entry.kind === 'story'),
    commentsFor: (state) => (entryId: string) => state.commentsByEntry[entryId] ?? [],
  },
  actions: {
    async loadFeed(force = false) {
      if (this.feedLoading || this.feedLoaded && !force) return
      this.feedLoading = true
      this.feedError = ''
      try {
        this.entries = await feedApi.getFeed()
        this.feedLoaded = true
      } catch {
        this.entries = []
        this.feedError = 'No se pudo cargar el contenido guardado. Revisa la conexión con el servidor.'
      } finally {
        this.feedLoading = false
      }
    },
    async loadPublicStories() {
      this.feedError = ''
      try {
        const stories = await feedApi.getPublicStories()
        const otherEntries = this.entries.filter((entry) => entry.kind !== 'story')
        this.entries = [...otherEntries, ...stories].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      } catch {
        this.feedError = 'No se pudieron cargar las historias públicas.'
      }
    },
    async toggleLike(id: string) {
      this.actionError = ''
      try {
        const result = await feedApi.toggleLike(id)
        const entry = this.entries.find((item) => item.id === id)
        if (entry) {
          entry.liked = result.liked
          entry.likes = result.likes
        }
      } catch {
        this.actionError = 'No se pudo guardar el me gusta. Inténtalo de nuevo.'
      }
    },
    async loadComments(entryId: string) {
      try {
        this.commentsByEntry[entryId] = await feedApi.getComments(entryId)
      } catch {
        this.actionError = 'No se pudieron cargar los comentarios.'
      }
    },
    async addComment(entryId: string, text: string) {
      const trimmed = text.trim()
      if (!trimmed) return
      this.actionError = ''
      try {
        const comment = await feedApi.addComment(entryId, trimmed)
        this.commentsByEntry[entryId] = [...(this.commentsByEntry[entryId] ?? []), comment]
        const entry = this.entries.find((item) => item.id === entryId)
        if (entry) entry.comments += 1
      } catch {
        this.actionError = 'No se pudo guardar el comentario. Inténtalo de nuevo.'
        throw new Error(this.actionError)
      }
    },
    async toggleCommentLike(entryId: string, commentId: string) {
      const comment = this.commentsByEntry[entryId]?.find((item) => item.id === commentId)
      if (!comment) return
      const previous = { liked: comment.liked, likes: comment.likes }
      comment.liked = !comment.liked
      comment.likes += comment.liked ? 1 : -1
      try {
        const result = await feedApi.toggleCommentLike(entryId, commentId)
        comment.liked = result.liked
        comment.likes = result.likes
      } catch {
        comment.liked = previous.liked
        comment.likes = previous.likes
        this.actionError = 'No se pudo guardar el me gusta en el comentario.'
      }
    },
    async saveStory(input: StoryDraft) {
      this.actionError = ''
      this.storyPublishing = true
      try {
        const files = input.media.flatMap((item) => item.file ? [item.file] : [])
        const uploaded = files.length ? await feedApi.uploadMedia(files) : []
        let uploadedIndex = 0
        const media = input.media.flatMap((item) => {
          if (item.id) return [{ id: item.id, type: item.type }]
          if (!item.file) return []
          const uploadedItem = uploaded[uploadedIndex++]
          return uploadedItem ? [{ id: uploadedItem.id, type: uploadedItem.type }] : []
        })
        if (uploadedIndex !== uploaded.length) throw new Error('No se pudieron asociar todos los archivos.')

        const payload = {
          title: input.title,
          caption: input.caption,
          visibility: input.visibility,
          media,
          imageUrl: input.imageUrl,
          mediaType: input.mediaType,
        }
        const entry = input.storyId
          ? await feedApi.updateStory(input.storyId, payload)
          : await feedApi.createStory(payload)
        const existingIndex = this.entries.findIndex((item) => item.id === entry.id)
        if (existingIndex >= 0) this.entries.splice(existingIndex, 1, entry)
        else {
          this.entries.unshift(entry)
          this.commentsByEntry[entry.id] = []
        }
        return true
      } catch (error: unknown) {
        this.actionError = axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : axios.isAxiosError(error) && !error.response
            ? 'No se pudo conectar con el servidor al subir los archivos. Revisa la conexión e inténtalo de nuevo.'
            : 'No se pudo guardar la historia. Inténtalo de nuevo.'
        return false
      } finally {
        this.storyPublishing = false
      }
    },
    async deleteStory(storyId: string) {
      this.actionError = ''
      try {
        await feedApi.deleteStory(storyId)
        this.entries = this.entries.filter((entry) => entry.id !== storyId)
        delete this.commentsByEntry[storyId]
        return true
      } catch {
        this.actionError = 'No se pudo eliminar la historia. Inténtalo de nuevo.'
        return false
      }
    },
    async addPost(caption: string) {
      this.actionError = ''
      try {
        const entry = await feedApi.createPost(caption)
        this.entries.unshift(entry)
        this.commentsByEntry[entry.id] = []
        return true
      } catch {
        this.actionError = 'No se pudo guardar la publicación. Inténtalo de nuevo.'
        return false
      }
    },
  },
})
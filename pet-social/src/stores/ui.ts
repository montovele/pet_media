import { defineStore } from 'pinia'
import type { FeedEntry } from '../types/content'

export const useUiStore = defineStore('ui', {
  state: () => ({ storyDialogOpen: false, editingStory: null as FeedEntry | null }),
  actions: {
    openStoryDialog() {
      this.editingStory = null
      this.storyDialogOpen = true
    },
    openStoryEditor(story: FeedEntry) {
      this.editingStory = story
      this.storyDialogOpen = true
    },
    closeStoryDialog() {
      this.storyDialogOpen = false
      this.editingStory = null
    },
  },
})

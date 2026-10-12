export type FeedKind = 'story' | 'post'
export type Visibility = 'public' | 'followers' | 'private'
export type ModerationStatus = 'pending' | 'approved' | 'rejected'

export type ActivityCategory = 'walk' | 'travel' | 'food' | 'wellness' | 'culture' | 'other'

export interface Activity {
  id: string
  title: string
  description?: string
  date: string
  locationName?: string
  category: ActivityCategory
  video?: FeedMedia
  createdAt: string
}

export interface CreateActivityInput {
  title: string
  description?: string
  date: string
  locationName?: string
  category: ActivityCategory
  videoId?: string
}

export interface Photo {
  id: string
  url: string
  title: string
  createdAt: string
  source: 'Historia' | 'Publicación'
}

export interface Album {
  id: string
  title: string
  description?: string
  createdAt: string
  photos: Array<Pick<Photo, 'id' | 'url'>>
}

export interface FeedAuthor {
  name: string
  handle: string
  avatar: string
}

export type StoryBlockType = 'text' | 'image' | 'video'

export interface StoryBlock {
  id: string
  type: StoryBlockType
  position: number
  text?: string
  mediaUrl?: string
  alt?: string
}

export interface FeedMedia {
  id: string
  url: string
  type: 'image' | 'video'
}

export interface StoryMediaDraft {
  id?: string
  file?: File
  type: 'image' | 'video'
}

export interface StoryDraft {
  storyId?: string
  title: string
  caption: string
  media: StoryMediaDraft[]
  imageUrl?: string
  mediaType?: 'image' | 'video'
  visibility: Visibility
}

export interface CommentItem {
  id: string
  author: FeedAuthor
  text: string
  createdAt: string
  likes: number
  liked: boolean
}

export interface NotificationItem {
  id: string
  type: 'story' | 'like' | 'comment' | 'social'
  title: string
  description: string
  createdAt: string
  read: boolean
}

export interface FeedEntry {
  id: string
  kind: FeedKind
  author: FeedAuthor
  createdAt: string
  title?: string
  caption: string
  imageUrl?: string
  mediaType?: 'image' | 'video'
  media?: FeedMedia[]
  blocks?: StoryBlock[]
  images?: string[]
  place?: string
  visibility: Visibility
  moderationStatus?: ModerationStatus
  moderationNote?: string
  likes: number
  comments: number
  liked: boolean
  isFollowedAuthor?: boolean
}

export type SocialPlatform = 'instagram' | 'facebook'
export type SocialPublicationStatus = 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED'

export interface SocialAccount {
  id: string
  platform: SocialPlatform
  accountName: string
  connected: boolean
  connectedAt?: string
}

export interface SocialPublication {
  id: string
  storyId?: string
  storyTitle: string
  platform: SocialPlatform
  status: SocialPublicationStatus
  caption: string
  createdAt: string
  externalUrl?: string
  errorMessage?: string
}

export interface SocialConnectResponse {
  authorizationUrl: string
}

export interface PublishStoryRequest {
  entryId: string
  platforms: ['facebook']
  caption: string
}

export interface SocialPublicationListResponse {
  items: SocialPublication[]
}

export const DEFAULT_AVATAR_URL = '/default-avatar.svg'

export function resolveAvatarUrl(url: string | undefined, apiBase: URL) {
  if (!url || url === DEFAULT_AVATAR_URL) return `${window.location.origin}${DEFAULT_AVATAR_URL}`
  return new URL(url, apiBase).toString()
}
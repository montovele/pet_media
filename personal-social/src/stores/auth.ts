import { defineStore } from 'pinia'
import axios from 'axios'
import { z } from 'zod'
import { authApi } from '../modules/auth/services/authApi'
import type { AuthUser } from '../modules/auth/services/authApi'
import { DEFAULT_AVATAR_URL } from '../utils/avatar'

const STORAGE_KEY = 'social-auth-user'
const fallbackProfile: AuthUser = {
  id: 'mariana',
  name: 'Mariana López',
  username: '@mariana',
  bio: 'Coleccionando días bonitos.',
  avatarUrl: DEFAULT_AVATAR_URL,
  coverUrl: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1600&q=85',
  role: 'user',
  isModerator: false,
}

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      ...fallbackProfile,
      ...parsed,
      id: String(parsed.id ?? fallbackProfile.id),
      name: parsed.name || fallbackProfile.name,
      username: parsed.username || fallbackProfile.username,
    }
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: readStoredUser() as AuthUser | null,
    status: readStoredUser() ? 'authenticated' : 'anonymous' as 'unknown' | 'authenticated' | 'anonymous',
    checkingSession: false,
  }),
  getters: {
    authenticated: (state) => state.status === 'authenticated' && !!state.user,
  },
  actions: {
    persistUser() {
      if (typeof window === 'undefined') return

      if (this.user) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user))
        return
      }

      window.localStorage.removeItem(STORAGE_KEY)
    },
    updateProfile(partial: Partial<Pick<AuthUser, 'name' | 'bio' | 'avatarUrl' | 'coverUrl'>>) {
      const nextUser = {
        ...(this.user ?? fallbackProfile),
        ...partial,
      }
      this.user = nextUser
      this.status = 'authenticated'
      this.persistUser()
      return this.user
    },
    async refreshSession(force = false) {
      if (this.status !== 'unknown' && !force) return this.authenticated
      this.checkingSession = true
      try {
        this.user = await authApi.getCurrentUser()
        this.status = 'authenticated'
        this.persistUser()
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          this.user = null
          this.status = 'anonymous'
        } else if (error instanceof z.ZodError || axios.isAxiosError(error) && error.response?.status === 404) {
          this.user = null
          this.status = 'anonymous'
        } else {
          this.user = null
          this.status = 'anonymous'
        }
      } finally {
        this.checkingSession = false
      }
      return this.authenticated
    },
    async login(email: string, password: string) {
      await authApi.login({ email, password })
      this.status = 'unknown'
      return this.refreshSession()
    },
    async updateUserProfile(partial: Partial<Pick<AuthUser, 'name' | 'bio' | 'avatarUrl' | 'coverUrl'>>) {
      const previousUser = this.user
      this.updateProfile(partial)

      try {
        const freshUser = await authApi.updateProfile(partial)
        this.user = freshUser
        this.status = 'authenticated'
        this.persistUser()
        return freshUser
      } catch (error) {
        this.user = previousUser
        this.status = 'authenticated'
        this.persistUser()
        throw error
      }
    },
    async logout() {
      try {
        await authApi.logout()
      } finally {
        this.user = null
        this.status = 'anonymous'
        this.persistUser()
      }
    },
  },
})
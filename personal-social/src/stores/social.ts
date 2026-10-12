import { defineStore } from 'pinia'
import axios from 'axios'
import { z } from 'zod'
import { socialApi } from '../modules/social/services/socialApi'
import type { PublishStoryRequest, SocialPlatform, SocialPublication } from '../modules/social/types/social.types'

function friendlyError(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return 'El servicio social no respondió con el formato esperado. Comprueba que VITE_API_URL apunte al backend social activo.'
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'No se pudo conectar con el servidor. Revisa la conexión e inténtalo de nuevo.'
    if (error.response.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.'
    if (error.response.status === 404) return `El backend devolvió 404 en ${error.config?.url || 'la solicitud social'}. Reinicia el backend para cargar sus rutas actuales y verifica que VITE_API_URL apunte a esa API.`
    if (typeof error.response.data?.message === 'string') return error.response.data.message
    if (error.response.status === 503) {
      const message = typeof error.response.data?.message === 'string' ? error.response.data.message : 'Configura META_APP_ID, META_APP_SECRET y META_REDIRECT_URI en backend/.env para conectar Meta.'
      return message
    }
  }
  return fallback
}

export const useSocialStore = defineStore('social', {
  state: () => ({
    accounts: [] as Awaited<ReturnType<typeof socialApi.getAccounts>>,
    publications: [] as SocialPublication[],
    config: {
      configured: false,
      missing: [] as string[],
      message: '',
      appId: '',
      redirectUri: '',
      graphVersion: 'v25.0',
      hasAppSecret: false,
    },
    accountsLoading: false,
    publicationsLoading: false,
    publishing: false,
    accountsError: '',
    publicationsError: '',
    actionError: '',
  }),
  getters: {
    connectedAccounts: (state) => state.accounts.filter((account) => account.connected),
  },
  actions: {
    async loadConfig() {
      try {
        const { data } = await axios.get('/social/config', { baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true })
        this.config = {
          configured: Boolean(data?.configured),
          missing: Array.isArray(data?.missing) ? data.missing : [],
          message: typeof data?.message === 'string' ? data.message : '',
          appId: typeof data?.appId === 'string' ? data.appId : '',
          redirectUri: typeof data?.redirectUri === 'string' ? data.redirectUri : '',
          graphVersion: typeof data?.graphVersion === 'string' ? data.graphVersion : 'v25.0',
          hasAppSecret: Boolean(data?.hasAppSecret),
        }
      } catch {
        this.config = { configured: false, missing: ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI'], message: 'Configura META_APP_ID, META_APP_SECRET y META_REDIRECT_URI en backend/.env o guardalos desde el formulario de configuración para conectar Meta.', appId: '', redirectUri: '', graphVersion: 'v25.0', hasAppSecret: false }
      }
    },
    async saveConfig(input: { appId: string; appSecret: string; redirectUri: string; graphVersion?: string }) {
      this.actionError = ''
      try {
        const { data } = await axios.post('/social/config', input, { baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true })
        this.config = {
          configured: Boolean(data?.configured),
          missing: Array.isArray(data?.missing) ? data.missing : [],
          message: typeof data?.message === 'string' ? data.message : '',
          appId: typeof data?.appId === 'string' ? data.appId : input.appId,
          redirectUri: typeof data?.redirectUri === 'string' ? data.redirectUri : input.redirectUri,
          graphVersion: typeof data?.graphVersion === 'string' ? data.graphVersion : input.graphVersion || 'v25.0',
          hasAppSecret: typeof data?.hasAppSecret === 'boolean' ? data.hasAppSecret : Boolean(input.appSecret),
        }
        return true
      } catch (error) {
        this.actionError = friendlyError(error, 'No se pudo guardar la configuración de Meta.')
        return false
      }
    },
    async loadAccounts() {
      this.accountsLoading = true
      this.accountsError = ''
      try {
        this.accounts = await socialApi.getAccounts()
      } catch (error) {
        this.accountsError = friendlyError(error, 'No pudimos cargar las cuentas conectadas.')
      } finally {
        this.accountsLoading = false
      }
    },
    async startConnection(platform: SocialPlatform) {
      this.actionError = ''
      const popup = window.open('about:blank', '_blank')
      if (!popup) {
        this.actionError = 'Permite las ventanas emergentes para continuar con la autorización de Meta.'
        return false
      }

      try {
        const { authorizationUrl } = await socialApi.startConnection(platform)
        popup.location.href = authorizationUrl
        return true
      } catch (error) {
        popup.close()
        this.actionError = friendlyError(error, 'No pudimos iniciar la conexión de la cuenta.')
        return false
      }
    },
    async disconnect(platform: SocialPlatform) {
      this.actionError = ''
      try {
        await socialApi.disconnect(platform)
        this.accounts = this.accounts.filter((account) => account.platform !== platform)
        return true
      } catch (error) {
        this.actionError = friendlyError(error, 'No pudimos desconectar la cuenta.')
        return false
      }
    },
    async publishEntry(request: PublishStoryRequest) {
      this.publishing = true
      this.actionError = ''
      try {
        const created = await socialApi.publishEntry(request)
        this.publications = [...created, ...this.publications]
        return true
      } catch (error) {
        this.actionError = friendlyError(error, 'No se pudo publicar en Facebook.')
        return false
      } finally {
        this.publishing = false
      }
    },
    async loadPublications() {
      this.publicationsLoading = true
      this.publicationsError = ''
      try {
        this.publications = await socialApi.getPublications()
      } catch (error) {
        this.publicationsError = friendlyError(error, 'No pudimos consultar el estado de las publicaciones.')
      } finally {
        this.publicationsLoading = false
      }
    },
  },
})

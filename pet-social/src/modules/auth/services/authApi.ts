import { z } from 'zod'
import { api } from '../../../services/api/client'
import { DEFAULT_AVATAR_URL, resolveAvatarUrl } from '../../../utils/avatar'

const userSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  username: z.string(),
  name: z.string(),
  email: z.email().optional(),
  bio: z.string().optional(),
  avatarUrl: z.string().optional(),
  coverUrl: z.string().nullable().optional(),
  role: z.enum(['superadmin', 'admin', 'editor', 'moderator', 'user']).default('user'),
  isModerator: z.boolean().default(false),
  isAccessGuest: z.boolean().default(false),
  accessGrant: z.object({
    id: z.string().uuid(),
    animalId: z.string().uuid(),
    animalIds: z.array(z.string().uuid()).default([]),
    allAnimals: z.boolean().default(false),
    role: z.string().optional(),
    permissions: z.array(z.string()),
    expiresAt: z.string().nullable().optional(),
  }).optional(),
}).transform((user) => {
  const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
  return {
    ...user,
    avatarUrl: resolveAvatarUrl(user.avatarUrl || DEFAULT_AVATAR_URL, apiBase),
    coverUrl: user.coverUrl ? resolveAvatarUrl(user.coverUrl, apiBase) : undefined,
  }
})

export type AuthUser = z.infer<typeof userSchema>

const nearbyUserSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  username: z.string(),
  avatarUrl: z.string().optional(),
  bio: z.string().optional(),
  lastLocation: z.string().default('Sin ubicación'),
  status: z.string().default('Sin actividad reciente'),
  statusTone: z.enum(['online', 'away', 'offline']).default('offline'),
  lastActivityAt: z.string().nullable(),
  isFollowing: z.boolean().default(false),
  followersCount: z.number().default(0),
  followingCount: z.number().default(0),
})
export type NearbyUser = z.infer<typeof nearbyUserSchema>

const followStateSchema = z.object({
  userId: z.union([z.string(), z.number()]).transform(String),
  isFollowing: z.boolean().default(false),
  followersCount: z.number().default(0),
  followingCount: z.number().default(0),
})

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre para continuar.').max(80, 'El nombre es demasiado largo.'),
  email: z.email('Escribe un correo electrónico válido.'),
  password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres.').max(128, 'La contraseña es demasiado larga.'),
  confirmPassword: z.string(),
  acceptedTerms: z.literal(true, { error: 'Debes aceptar los términos para crear una cuenta.' }),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Las contraseñas no coinciden.',
})

export type RegisterValues = z.infer<typeof registerSchema>
export const loginSchema = z.object({
  email: z.email('Escribe un correo electrónico válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const authApi = {
  async register(values: Pick<RegisterValues, 'name' | 'email' | 'password'>) {
    const { data, headers } = await api.post<unknown>('/auth/register', values)
    if (!String(headers['content-type'] ?? '').includes('application/json')) {
      throw new z.ZodError([{ code: 'invalid_type', expected: 'object', input: data, path: [], message: 'Invalid registration response' }])
    }
    return z.object({ message: z.string().optional() }).passthrough().parse(data)
  },
  async login(values: Pick<LoginValues, 'email' | 'password'>) {
    await api.post('/auth/login', values)
  },
  async loginAccessGrant(values: { grantId: string; email: string; password: string }) {
    await api.post('/auth/access-grant-login', values)
  },
  async logout() {
    await api.post('/auth/logout')
  },
  async getCurrentUser() {
    const { data } = await api.get<unknown>('/auth/me')
    return userSchema.parse(data)
  },
  async getNearbyUsers() {
    const { data } = await api.get<unknown>('/auth/nearby')
    return z.array(nearbyUserSchema).parse(data) as NearbyUser[]
  },
  async toggleFollow(userId: string, shouldFollow: boolean) {
    const endpoint = `/auth/follow/${encodeURIComponent(userId)}`
    const { data } = shouldFollow
      ? await api.post<unknown>(endpoint)
      : await api.delete<unknown>(endpoint)
    return followStateSchema.parse(data)
  },
  async updateProfile(values: Partial<Pick<AuthUser, 'name' | 'bio' | 'avatarUrl' | 'coverUrl'>>) {
    const { data } = await api.patch<unknown>('/auth/me', values)
    return userSchema.parse(data)
  },
}

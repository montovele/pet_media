const { z } = require('zod')

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().max(180),
  password: z.string().min(10).max(128),
})

const loginSchema = z.object({
  email: z.email().trim().max(180),
  password: z.string().min(1).max(128),
})

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(220).optional(),
  avatarUrl: z.string().trim().max(255).optional(),
  coverUrl: z.string().trim().max(255).optional(),
}).refine((values) => Object.keys(values).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar el perfil.',
})

module.exports = { registerSchema, loginSchema, updateProfileSchema }
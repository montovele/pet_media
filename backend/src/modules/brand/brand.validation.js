const { z } = require('zod')

const updateBrandSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  logoUrl: z.string().trim().max(255).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).refine((values) => Object.keys(values).length > 0, {
  message: 'Indica al menos un ajuste de marca que quieras actualizar.',
})

module.exports = { updateBrandSchema }
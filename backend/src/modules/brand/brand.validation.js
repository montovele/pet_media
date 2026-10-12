const { z } = require('zod')

const updateBrandSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  logoUrl: z.string().trim().max(255).nullable().optional(),
}).refine((values) => Object.keys(values).length > 0, {
  message: 'Indica el nombre o el logo que quieres actualizar.',
})

module.exports = { updateBrandSchema }
const { z } = require('zod')

const createAlbumSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  photoIds: z.array(z.string().min(1).max(50)).max(100).default([]),
}).refine((value) => new Set(value.photoIds).size === value.photoIds.length, {
  message: 'No repitas fotos dentro del mismo álbum.',
})

module.exports = { createAlbumSchema }
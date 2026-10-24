const { z } = require('zod')

const activitySchema = z.object({
  animalId: z.uuid(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional(),
  date: z.iso.date(),
  locationName: z.string().trim().max(180).optional(),
  category: z.enum(['walk', 'travel', 'food', 'wellness', 'culture', 'other']).default('other'),
  mediaIds: z.array(z.uuid()).min(1).max(20).refine((ids) => new Set(ids).size === ids.length, {
    message: 'No adjuntes el mismo archivo más de una vez.',
  }).optional(),
  mediaId: z.uuid().optional(),
  videoId: z.uuid().optional(),
}).refine((values) => !(values.mediaIds && (values.mediaId || values.videoId)), {
  message: 'Usa una lista de archivos o el formato anterior, no ambos.',
  path: ['mediaIds'],
}).refine((values) => !(values.mediaId && values.videoId), {
  message: 'No envíes más de un formato de archivo anterior.',
  path: ['mediaId'],
})

module.exports = { activitySchema }
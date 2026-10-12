const { z } = require('zod')

const activitySchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional(),
  date: z.iso.date(),
  locationName: z.string().trim().max(180).optional(),
  category: z.enum(['walk', 'travel', 'food', 'wellness', 'culture', 'other']).default('other'),
  videoId: z.uuid().optional(),
})

module.exports = { activitySchema }
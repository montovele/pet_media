const { z } = require('zod')

const createPostSchema = z.object({
  caption: z.string().trim().min(1).max(500),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
})

const createStorySchema = z.object({
  title: z.string().trim().min(3).max(180),
  caption: z.string().trim().min(1).max(500),
  imageUrl: z.string().url().max(255).optional(),
  mediaType: z.enum(['image', 'video']).optional(),
  media: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['image', 'video']),
  })).optional(),
  visibility: z.enum(['public', 'followers', 'private']).default('public'),
})
const updateStorySchema = createStorySchema

const createCommentSchema = z.object({
  text: z.string().trim().min(1).max(220),
})

module.exports = { createPostSchema, createStorySchema, updateStorySchema, createCommentSchema }
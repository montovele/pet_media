const express = require('express')
const feedService = require('./feed.service')
const { requireAuth } = require('../../middleware/auth.middleware')
const { validate } = require('../../middleware/validate.middleware')
const { createPostSchema, createStorySchema, updateStorySchema, createCommentSchema } = require('./feed.validation')

const router = express.Router()

router.get('/public/stories', async (_req, res, next) => {
  try {
    res.json(await feedService.getPublicStories())
  } catch (error) {
    next(error)
  }
})

router.use(requireAuth)
router.get('/feed', async (req, res, next) => {
  try {
    res.json(await feedService.getFeed(req.user.id))
  } catch (error) {
    next(error)
  }
})
router.post('/feed/:id/like', async (req, res, next) => {
  try {
    res.json(await feedService.toggleLike(req.user.id, req.params.id))
  } catch (error) {
    next(error)
  }
})
router.get('/feed/:id/comments', async (req, res, next) => {
  try {
    res.json(await feedService.getComments(req.params.id, req.user.id))
  } catch (error) {
    next(error)
  }
})
router.post('/feed/:entryId/comments/:commentId/like', async (req, res, next) => {
  try {
    res.json(await feedService.toggleCommentLike(req.user.id, req.params.entryId, req.params.commentId))
  } catch (error) {
    next(error)
  }
})
router.post('/feed/:id/comments', validate(createCommentSchema), async (req, res, next) => {
  try {
    res.status(201).json(await feedService.addComment(req.user.id, req.params.id, req.body.text))
  } catch (error) {
    next(error)
  }
})
router.post('/posts', validate(createPostSchema), async (req, res, next) => {
  try {
    res.status(201).json(await feedService.createPost(req.user.id, req.body))
  } catch (error) {
    next(error)
  }
})
router.post('/stories', validate(createStorySchema), async (req, res, next) => {
  try {
    res.status(201).json(await feedService.createStory(req.user.id, req.body))
  } catch (error) {
    next(error)
  }
})
router.put('/stories/:id', validate(updateStorySchema), async (req, res, next) => {
  try {
    res.json(await feedService.updateStory(req.user.id, req.params.id, req.body))
  } catch (error) {
    next(error)
  }
})
router.delete('/stories/:id', async (req, res, next) => {
  try {
    await feedService.deleteStory(req.user.id, req.params.id)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

module.exports = router
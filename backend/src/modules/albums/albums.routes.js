const express = require('express')
const albumsService = require('./albums.service')
const { requireAuth } = require('../../middleware/auth.middleware')
const { validate } = require('../../middleware/validate.middleware')
const { createAlbumSchema } = require('./albums.validation')

const router = express.Router()
router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    res.json(await albumsService.getAlbums(req.user.id))
  } catch (error) {
    next(error)
  }
})
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await albumsService.getAlbum(req.user.id, req.params.id))
  } catch (error) {
    next(error)
  }
})

router.post('/', validate(createAlbumSchema), async (req, res, next) => {
  try {
    res.status(201).json(await albumsService.createAlbum(req.user.id, req.body))
  } catch (error) {
    next(error)
  }
})

module.exports = router
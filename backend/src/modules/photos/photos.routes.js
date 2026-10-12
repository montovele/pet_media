const express = require('express')
const photosService = require('./photos.service')
const { requireAuth } = require('../../middleware/auth.middleware')

const router = express.Router()
router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    res.json(await photosService.getPhotos(req.user.id))
  } catch (error) {
    next(error)
  }
})
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await photosService.getPhoto(req.user.id, req.params.id))
  } catch (error) {
    next(error)
  }
})

module.exports = router
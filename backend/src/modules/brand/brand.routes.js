const express = require('express')
const brandService = require('./brand.service')
const { requireAuth, requireRoles } = require('../../middleware/auth.middleware')
const { validate } = require('../../middleware/validate.middleware')
const { updateBrandSchema } = require('./brand.validation')

const router = express.Router()

router.get('/', async (_req, res, next) => {
  try {
    res.json(await brandService.getBrandSettings())
  } catch (error) {
    next(error)
  }
})

router.patch('/', requireAuth, requireRoles('superadmin'), validate(updateBrandSchema), async (req, res, next) => {
  try {
    res.json(await brandService.updateBrandSettings(req.user.id, req.body))
  } catch (error) {
    next(error)
  }
})

module.exports = router
const express = require('express')
const activityService = require('./activities.service')
const { requireAuth } = require('../../middleware/auth.middleware')
const { validate } = require('../../middleware/validate.middleware')
const { activitySchema } = require('./activities.validation')

const router = express.Router()

router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    res.json(await activityService.getActivities(req.user))
  } catch (error) {
    next(error)
  }
})

router.post('/', validate(activitySchema), async (req, res, next) => {
  try {
    res.status(201).json(await activityService.createActivity(req.user, req.body))
  } catch (error) {
    next(error)
  }
})

module.exports = router
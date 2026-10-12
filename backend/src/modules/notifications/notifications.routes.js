const express = require('express')
const notificationsService = require('./notifications.service')
const { requireAuth } = require('../../middleware/auth.middleware')

const router = express.Router()

router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    res.json(await notificationsService.listForUser(req.user.id))
  } catch (error) {
    next(error)
  }
})

router.patch('/read-all', async (req, res, next) => {
  try {
    await notificationsService.markAllRead(req.user.id)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

module.exports = router
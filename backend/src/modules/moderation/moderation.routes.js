const express = require('express')
const moderationService = require('./moderation.service')
const { requireAuth, requireModerator, requireRoles } = require('../../middleware/auth.middleware')

const router = express.Router()
router.use(requireAuth, requireModerator)

router.get('/publications', async (req, res, next) => {
  try {
    res.json(await moderationService.listPublications(req.query.status || 'approved'))
  } catch (error) {
    next(error)
  }
})

router.patch('/content/:kind/:contentId/review', async (req, res, next) => {
  try {
    res.json(await moderationService.reviewContent(req.user.id, req.params.kind, req.params.contentId, req.body?.decision, req.body?.reason))
  } catch (error) {
    next(error)
  }
})

router.get('/users', requireRoles('superadmin'), async (_req, res, next) => {
  try {
    res.json(await moderationService.listUsers())
  } catch (error) {
    next(error)
  }
})

router.get('/users/supervision', requireRoles('superadmin'), async (_req, res, next) => {
  try {
    res.json(await moderationService.getSupervisionOverview())
  } catch (error) {
    next(error)
  }
})

router.patch('/users/:userId/role', requireRoles('superadmin'), async (req, res, next) => {
  try {
    res.json(await moderationService.assignRole(req.user.id, req.params.userId, req.body?.role))
  } catch (error) {
    next(error)
  }
})

router.patch('/users/:userId/status', async (req, res, next) => {
  try {
    if (typeof req.body?.isActive !== 'boolean') {
      const error = new Error('Indica si la cuenta debe quedar activa o desactivada.')
      error.statusCode = 400
      throw error
    }
    res.json(await moderationService.setUserStatus(req.user.id, req.user.role, req.params.userId, req.body.isActive, req.body.reason))
  } catch (error) {
    next(error)
  }
})

module.exports = router
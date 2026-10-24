const express = require('express')
const { rateLimit } = require('express-rate-limit')
const bioActaService = require('./bioActa.service')
const { requireAuth, optionalAuth, requireRoles } = require('../../middleware/auth.middleware')
const { validate } = require('../../middleware/validate.middleware')
const { signAccessGrantToken } = require('../../utils/jwt')
const {
  lostFoundReportSchema,
  careLogSchema,
  lostFoundStatusSchema,
  lostFoundContactSchema,
  accessGrantUnlockSchema,
  accessGrantUpdateSchema,
} = require('./animals.validation')

const router = express.Router()
const publicReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Has enviado varios reportes. Espera un momento antes de intentarlo de nuevo.' },
})
const contactRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Has enviado varias solicitudes de contacto. Inténtalo más tarde.' },
})
const accessGrantUnlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Has intentado desbloquear varios accesos. Espera un momento antes de volver a intentarlo.' },
})

router.get('/public/lost-found-reports', async (_req, res, next) => {
  try {
    res.json(await bioActaService.listPublicLostFoundReports())
  } catch (error) {
    next(error)
  }
})

router.post('/lost-found-reports', publicReportLimiter, optionalAuth, validate(lostFoundReportSchema), async (req, res, next) => {
  try {
    res.status(201).json(await bioActaService.createLostFoundReport(req.user ?? null, req.body))
  } catch (error) {
    next(error)
  }
})

router.get('/lost-found-reports/mine', requireAuth, async (req, res, next) => {
  try {
    res.json(await bioActaService.listMyLostFoundReports(req.user))
  } catch (error) {
    next(error)
  }
})

router.patch('/lost-found-reports/:reportId/status', requireAuth, validate(lostFoundStatusSchema), async (req, res, next) => {
  try {
    res.json(await bioActaService.updateLostFoundReportStatus(req.user, req.params.reportId, req.body.status))
  } catch (error) {
    next(error)
  }
})

router.post('/lost-found-reports/:reportId/contact', requireAuth, contactRequestLimiter, validate(lostFoundContactSchema), async (req, res, next) => {
  try {
    res.status(201).json(await bioActaService.createLostFoundContactMessage(req.user, req.params.reportId, req.body.message))
  } catch (error) {
    next(error)
  }
})

router.get('/lost-found-reports/messages/mine', requireAuth, async (req, res, next) => {
  try {
    res.json(await bioActaService.listMyLostFoundMessages(req.user))
  } catch (error) {
    next(error)
  }
})

router.post('/care-schedules/:scheduleId/logs', requireAuth, validate(careLogSchema), async (req, res, next) => {
  try {
    res.status(201).json(await bioActaService.logCareDose(req.user, req.params.scheduleId, req.body.result))
  } catch (error) {
    next(error)
  }
})

router.delete('/access-grants/:grantId', requireAuth, async (req, res, next) => {
  try {
    await bioActaService.revokeAccessGrant(req.user, req.params.grantId)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

router.patch('/access-grants/:grantId', requireAuth, validate(accessGrantUpdateSchema), async (req, res, next) => {
  try {
    res.json(await bioActaService.updateAccessGrant(req.user, req.params.grantId, req.body))
  } catch (error) {
    next(error)
  }
})

router.post('/access-grants/:grantId/unlock', requireAuth, accessGrantUnlockLimiter, validate(accessGrantUnlockSchema), async (req, res, next) => {
  try {
    const { grantId } = await bioActaService.unlockAccessGrant(req.user, req.params.grantId, req.body.password)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    }
    res.cookie(`bioacta_access_${grantId}`, signAccessGrantToken({ userId: req.user.id, grantId }), cookieOptions)
    res.json({ unlocked: true })
  } catch (error) {
    next(error)
  }
})

router.get('/professional/dashboard', requireAuth, async (req, res, next) => {
  try {
    res.json(await bioActaService.getProfessionalSummary(req.user))
  } catch (error) {
    next(error)
  }
})

router.get('/admin/audit-logs', requireAuth, requireRoles('superadmin', 'admin'), async (_req, res, next) => {
  try {
    res.json(await bioActaService.listAuditLogs())
  } catch (error) {
    next(error)
  }
})

module.exports = router

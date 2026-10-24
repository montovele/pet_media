const express = require('express')
const { rateLimit } = require('express-rate-limit')
const authController = require('./auth.controller')
const { registerSchema, loginSchema, accessGrantLoginSchema, updateProfileSchema } = require('./auth.validation')
const { requireAuth } = require('../../middleware/auth.middleware')
const { validate } = require('../../middleware/validate.middleware')

const router = express.Router()
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Has intentado iniciar varias sesiones. Espera un momento antes de volver a intentarlo.' },
})
const accessGrantLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Has intentado iniciar varios accesos. Espera un momento antes de volver a intentarlo.' },
})

router.post('/register', validate(registerSchema), authController.register)
router.post('/login', loginLimiter, validate(loginSchema), authController.login)
router.post('/access-grant-login', accessGrantLoginLimiter, validate(accessGrantLoginSchema), authController.loginAccessGrant)
router.post('/logout', authController.logout)
router.get('/me', requireAuth, authController.me)
router.get('/nearby', requireAuth, authController.nearby)
router.get('/users/:userId', requireAuth, authController.userSummary)
router.post('/follow/:userId', requireAuth, authController.followUser)
router.delete('/follow/:userId', requireAuth, authController.unfollowUser)
router.patch('/me', requireAuth, validate(updateProfileSchema), authController.updateProfile)

module.exports = router
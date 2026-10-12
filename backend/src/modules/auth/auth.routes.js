const express = require('express')
const authController = require('./auth.controller')
const { registerSchema, loginSchema, updateProfileSchema } = require('./auth.validation')
const { requireAuth } = require('../../middleware/auth.middleware')
const { validate } = require('../../middleware/validate.middleware')

const router = express.Router()

router.post('/register', validate(registerSchema), authController.register)
router.post('/login', validate(loginSchema), authController.login)
router.post('/logout', authController.logout)
router.get('/me', requireAuth, authController.me)
router.get('/nearby', requireAuth, authController.nearby)
router.get('/users/:userId', requireAuth, authController.userSummary)
router.post('/follow/:userId', requireAuth, authController.followUser)
router.delete('/follow/:userId', requireAuth, authController.unfollowUser)
router.patch('/me', requireAuth, validate(updateProfileSchema), authController.updateProfile)

module.exports = router
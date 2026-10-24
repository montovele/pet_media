const express = require('express')
const socialService = require('./social.service')
const { requireAuth } = require('../../middleware/auth.middleware')

const router = express.Router()

router.get('/callback', async (req, res) => {
  let clientUrl = (process.env.CLIENT_URL || 'http://localhost:5199').replace(/\/$/, '')
  try {
    if (req.query.error) {
      throw new Error(req.query.error_description || req.query.error_reason || 'La autorización de Meta fue cancelada.')
    }
    if (typeof req.query.code !== 'string' || typeof req.query.state !== 'string') {
      throw new Error('Meta no devolvió el código de autorización esperado.')
    }
    const result = await socialService.completeOAuth({ code: req.query.code, state: req.query.state })
    clientUrl = result.clientOrigin || clientUrl
    res.redirect(`${clientUrl}/settings/social?connected=${encodeURIComponent(result.platform)}`)
  } catch (error) {
    if (typeof req.query.state === 'string') clientUrl = socialService.getOAuthClientOrigin(req.query.state)
    const message = error.statusCode === 503
      ? 'Configura las credenciales de Meta en backend/.env.'
      : error.message || 'No se pudo completar la conexión social.'
    res.redirect(`${clientUrl}/settings/social?error=${encodeURIComponent(message)}`)
  }
})

router.use(requireAuth)

router.get('/config', async (_req, res, next) => {
  try {
    res.json(await socialService.getSocialConfigStatus())
  } catch (error) {
    next(error)
  }
})

router.post('/config', async (req, res, next) => {
  try {
    res.json(await socialService.saveSocialConfig(req.user.id, req.body || {}))
  } catch (error) {
    next(error)
  }
})

router.get('/accounts', async (req, res, next) => {
  try {
    res.json(await socialService.getAccounts(req.user.id))
  } catch (error) {
    next(error)
  }
})

router.get('/publications', async (req, res, next) => {
  try {
    res.json(await socialService.getPublications(req.user.id))
  } catch (error) {
    next(error)
  }
})

router.post('/publications', async (req, res, next) => {
  try {
    const entryId = typeof req.body?.entryId === 'string' ? req.body.entryId.trim() : ''
    const platforms = req.body?.platforms
    const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim() : ''
    if (!entryId || !Array.isArray(platforms) || platforms.length !== 1 || platforms[0] !== 'facebook') {
      const error = new Error('Selecciona una publicación y únicamente la cuenta de Facebook.')
      error.statusCode = 400
      throw error
    }
    if (caption.length > 2200) {
      const error = new Error('El texto no puede superar los 2.200 caracteres.')
      error.statusCode = 400
      throw error
    }
    if (!caption) {
      const error = new Error('Escribe un texto para publicar en Facebook.')
      error.statusCode = 400
      throw error
    }
    res.status(201).json([await socialService.publishFacebook(req.user.id, entryId, caption)])
  } catch (error) {
    next(error)
  }
})

router.post('/:platform/connect', async (req, res, next) => {
  try {
    const authorizationUrl = await socialService.createAuthorizationUrl(req.user.id, req.params.platform, req.get('origin'))
    res.json({ authorizationUrl })
  } catch (error) {
    next(error)
  }
})

router.delete('/:platform/disconnect', async (req, res, next) => {
  try {
    await socialService.disconnect(req.user.id, req.params.platform)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

module.exports = router
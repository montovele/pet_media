const express = require('express')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const adsService = require('./ads.service')
const { requireAuth, requireRoles } = require('../../middleware/auth.middleware')

const router = express.Router()
const imageDirectory = path.resolve(__dirname, '../../../uploads/ads')
const acceptedImageTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
])
const imageSignatures = new Map([
  ['image/jpeg', (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff],
  ['image/png', (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ['image/webp', (buffer) => buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'],
])

fs.mkdirSync(imageDirectory, { recursive: true })

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: imageDirectory,
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${acceptedImageTypes.get(file.mimetype)}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!acceptedImageTypes.has(file.mimetype)) {
      const error = new Error('La imagen debe ser JPG, PNG o WebP.')
      error.statusCode = 400
      callback(error)
      return
    }
    callback(null, true)
  },
})

router.get('/public', async (_req, res, next) => {
  try {
    res.json(await adsService.listPublicAds())
  } catch (error) {
    next(error)
  }
})

router.get('/pricing', async (_req, res, next) => {
  try {
    res.json(await adsService.getPricingRules())
  } catch (error) {
    next(error)
  }
})

router.post('/webhook', async (req, res, next) => {
  try {
    const event = adsService.verifyStripeWebhook(req.body, req.get('stripe-signature'))
    await adsService.processStripeEvent(event)
    res.json({ received: true })
  } catch (error) {
    next(error)
  }
})

router.get('/media/:filename', async (req, res, next) => {
  const filename = req.params.filename
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename)) {
    res.status(404).json({ message: 'Imagen de anuncio no encontrada.' })
    return
  }
  res.sendFile(filename, { root: imageDirectory }, (error) => {
    if (error && !res.headersSent) next(error)
  })
})

router.use(requireAuth)

router.post('/quote', async (req, res, next) => {
  try {
    res.json(await adsService.quoteCampaign(req.body?.durationDays))
  } catch (error) {
    next(error)
  }
})

router.post('/checkout', async (req, res, next) => {
  try {
    res.status(201).json(await adsService.createCheckoutSession(req.user.id, req.body || {}))
  } catch (error) {
    next(error)
  }
})

router.get('/my-orders', async (req, res, next) => {
  try {
    res.json(await adsService.listCustomerOrders(req.user.id))
  } catch (error) {
    next(error)
  }
})

router.get('/my-orders/:orderId', async (req, res, next) => {
  try {
    res.json(await adsService.getCustomerOrder(req.user.id, req.params.orderId))
  } catch (error) {
    next(error)
  }
})

router.post('/upload-image', imageUpload.single('image'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ message: 'Selecciona una imagen para el anuncio.' })
    return
  }
  try {
    const handle = await fs.promises.open(req.file.path, 'r')
    const signature = Buffer.alloc(12)
    await handle.read(signature, 0, signature.length, 0)
    await handle.close()
    if (!imageSignatures.get(req.file.mimetype)(signature)) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      res.status(400).json({ message: 'El archivo no coincide con una imagen JPG, PNG o WebP válida.' })
      return
    }
    res.status(201).json({ imageUrl: `/api/ads/media/${req.file.filename}` })
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => {})
    next(error)
  }
})

router.use(requireRoles('superadmin'))

router.get('/', async (_req, res, next) => {
  try {
    res.json(await adsService.listCampaigns())
  } catch (error) {
    next(error)
  }
})

router.put('/pricing', async (req, res, next) => {
  try {
    res.json(await adsService.updatePricingRules(req.user.id, req.body || {}))
  } catch (error) {
    next(error)
  }
})

router.get('/orders', async (_req, res, next) => {
  try {
    res.json(await adsService.listAdminOrders())
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await adsService.createCampaign(req.user.id, req.body || {}))
  } catch (error) {
    next(error)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    res.json(await adsService.updateCampaign(req.params.id, req.body || {}))
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await adsService.deleteCampaign(req.params.id)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

module.exports = router
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const express = require('express')
const multer = require('multer')
const QRCode = require('qrcode')
const animalService = require('./animals.service')
const bioActaService = require('./bioActa.service')
const { requireAnimalAccess } = require('./animals.access')
const { requireAuth } = require('../../middleware/auth.middleware')
const { validate } = require('../../middleware/validate.middleware')
const {
  animalSchema,
  duplicateSearchSchema,
  healthRecordSchema,
  careScheduleSchema,
  accessGrantSchema,
  visibilitySchema,
  transferSchema,
} = require('./animals.validation')
const pool = require('../../config/db')

const router = express.Router()
const uploadDirectory = path.resolve(__dirname, '../../../uploads')
const imageTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
])

fs.mkdirSync(uploadDirectory, { recursive: true })
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${imageTypes.get(file.mimetype)}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!imageTypes.has(file.mimetype)) {
      const error = new Error('La fotografía debe estar en formato JPG, PNG o WebP.')
      error.statusCode = 400
      callback(error)
      return
    }
    callback(null, true)
  },
})

router.get('/public/:publicId', async (req, res, next) => {
  try {
    res.json(await bioActaService.getPublicBioActa(req.params.publicId))
  } catch (error) {
    next(error)
  }
})

router.get('/public/photos/:photoId', async (req, res, next) => {
  try {
    const filename = await bioActaService.getPublicPhoto(req.params.photoId)
    res.sendFile(filename, { root: uploadDirectory }, (error) => {
      if (error && !res.headersSent) next(error)
    })
  } catch (error) {
    next(error)
  }
})

router.get('/photos/:photoId', requireAuth, async (req, res, next) => {
  try {
    const filename = await bioActaService.getPrivatePhoto(req.user, req.params.photoId)
    res.sendFile(filename, { root: uploadDirectory }, (error) => {
      if (error && !res.headersSent) next(error)
    })
  } catch (error) {
    next(error)
  }
})

router.use(requireAuth)

router.post('/duplicates', validate(duplicateSearchSchema), async (req, res, next) => {
  try {
    res.json(await animalService.findDuplicates(req.body))
  } catch (error) {
    next(error)
  }
})

router.post('/transfers', validate(transferSchema), async (req, res, next) => {
  try {
    res.status(201).json(await animalService.createTransfer(req.user, req.body.animalId, req.body.recipientEmail))
  } catch (error) {
    next(error)
  }
})

router.get('/transfers/incoming', async (req, res, next) => {
  try {
    res.json(await animalService.listTransfers(req.user))
  } catch (error) {
    next(error)
  }
})

router.get('/transfers/outgoing', async (req, res, next) => {
  try {
    res.json(await animalService.listOutgoingTransfers(req.user))
  } catch (error) {
    next(error)
  }
})

router.delete('/transfers/:transferId', async (req, res, next) => {
  try {
    await animalService.cancelTransfer(req.user, req.params.transferId)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

router.post('/transfers/:transferId/accept', async (req, res, next) => {
  try {
    res.json(await animalService.acceptTransfer(req.user, req.params.transferId))
  } catch (error) {
    next(error)
  }
})

router.post('/', validate(animalSchema), async (req, res, next) => {
  try {
    res.status(201).json(await animalService.createAnimal(req.user.id, req.body))
  } catch (error) {
    next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    res.json(await animalService.listAnimals(req.user))
  } catch (error) {
    next(error)
  }
})

router.get('/:animalId/health-records', async (req, res, next) => {
  try {
    res.json(await bioActaService.listHealthRecords(req.user, req.params.animalId))
  } catch (error) {
    next(error)
  }
})

router.post('/:animalId/health-records', validate(healthRecordSchema), async (req, res, next) => {
  try {
    res.status(201).json(await bioActaService.createHealthRecord(req.user, req.params.animalId, req.body))
  } catch (error) {
    next(error)
  }
})

router.get('/:animalId/care-schedules', async (req, res, next) => {
  try {
    res.json(await bioActaService.listCareSchedules(req.user, req.params.animalId))
  } catch (error) {
    next(error)
  }
})

router.post('/:animalId/care-schedules', validate(careScheduleSchema), async (req, res, next) => {
  try {
    res.status(201).json(await bioActaService.createCareSchedule(req.user, req.params.animalId, req.body))
  } catch (error) {
    next(error)
  }
})

router.get('/:animalId/access-grants', async (req, res, next) => {
  try {
    res.json(await bioActaService.listAccessGrants(req.user, req.params.animalId))
  } catch (error) {
    next(error)
  }
})

router.post('/:animalId/access-grants', validate(accessGrantSchema), async (req, res, next) => {
  try {
    res.status(201).json(await bioActaService.createAccessGrant(req.user, req.params.animalId, req.body))
  } catch (error) {
    next(error)
  }
})

router.post('/:animalId/photos', upload.single('photo'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ message: 'Selecciona una fotografía.' })
    return
  }
  try {
    const altText = typeof req.body.alt === 'string' ? req.body.alt.slice(0, 180) : ''
    res.status(201).json(await bioActaService.createPhoto(req.user, req.params.animalId, req.file.filename, altText))
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => {})
    next(error)
  }
})

router.post('/:animalId/public-visibility', validate(visibilitySchema), async (req, res, next) => {
  try {
    res.json(await animalService.setPublicVisibility(req.user, req.params.animalId, req.body.publicEnabled))
  } catch (error) {
    next(error)
  }
})

router.get('/:animalId/qr', async (req, res, next) => {
  try {
    const animal = await requireAnimalAccess(req.user, req.params.animalId)
    const [rows] = await pool.query(
      'SELECT public_enabled FROM animals WHERE id = ? LIMIT 1',
      [animal.id],
    )
    if (!rows.length || !rows[0].public_enabled) {
      const error = new Error('Activa explícitamente la vista pública antes de generar su QR.')
      error.statusCode = 409
      throw error
    }
    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5199').replace(/\/$/, '')
    const publicUrl = `${clientUrl}/bioacta/public/${encodeURIComponent(animal.public_id)}`
    const imageDataUrl = await QRCode.toDataURL(publicUrl, { errorCorrectionLevel: 'M', margin: 2, width: 320 })
    res.json({ publicUrl, imageDataUrl })
  } catch (error) {
    next(error)
  }
})

router.get('/:animalId', async (req, res, next) => {
  try {
    res.json(await animalService.getAnimal(req.user, req.params.animalId))
  } catch (error) {
    next(error)
  }
})

module.exports = router

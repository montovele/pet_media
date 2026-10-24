const { randomUUID } = require('crypto')
const fs = require('fs')
const path = require('path')
const express = require('express')
const multer = require('multer')
const pool = require('../../config/db')
const { requireAuth, getAccessGrantIds } = require('../../middleware/auth.middleware')
const { verifyToken } = require('../../utils/jwt')

const router = express.Router()
const uploadDirectory = path.resolve(__dirname, '../../../uploads')
const maxFilesPerUpload = 20
const maxFileSize = 150 * 1024 * 1024
const acceptedTypes = new Map([
  ['image/jpeg', { extension: '.jpg', type: 'image' }],
  ['image/png', { extension: '.png', type: 'image' }],
  ['image/webp', { extension: '.webp', type: 'image' }],
  ['image/gif', { extension: '.gif', type: 'image' }],
  ['image/avif', { extension: '.avif', type: 'image' }],
  ['image/bmp', { extension: '.bmp', type: 'image' }],
  ['video/mp4', { extension: '.mp4', type: 'video' }],
  ['video/webm', { extension: '.webm', type: 'video' }],
])

fs.mkdirSync(uploadDirectory, { recursive: true })

function authenticatedUser(req) {
  const authorization = req.get('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : req.cookies?.social_session
  if (!token) return null
  try {
    return verifyToken(token).userId
  } catch {
    return null
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${acceptedTypes.get(file.mimetype).extension}`)
    },
  }),
  limits: { fileSize: maxFileSize, files: maxFilesPerUpload },
  fileFilter: (_req, file, callback) => {
    if (!acceptedTypes.has(file.mimetype)) {
      const error = new Error('Usa JPG, PNG, WebP, GIF, AVIF, BMP, MP4 o WebM.')
      error.statusCode = 400
      callback(error)
      return
    }
    callback(null, true)
  },
})

router.post('/upload', requireAuth, upload.array('files', maxFilesPerUpload), async (req, res, next) => {
  const files = req.files || []
  if (!files.length) {
    res.status(400).json({ message: 'Selecciona al menos un archivo para subir.' })
    return
  }
  const connection = await pool.getConnection().catch(next)
  if (!connection) {
    await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})))
    return
  }
  try {
    await connection.beginTransaction()
    const uploaded = []
    for (const [position, file] of files.entries()) {
      const id = randomUUID()
      const type = acceptedTypes.get(file.mimetype).type
      await connection.query(
        'INSERT INTO story_media (id, user_id, filename, media_type, position) VALUES (?, ?, ?, ?, ?)',
        [id, req.user.id, file.filename, type, position],
      )
      uploaded.push({ id, type })
    }
    await connection.commit()
    const apiBase = (process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}/api`).replace(/\/$/, '')
    res.status(201).json({ files: uploaded.map((file) => ({ ...file, url: `${apiBase}/media/${file.id}` })) })
  } catch (error) {
    await connection.rollback().catch(() => {})
    await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})))
    next(error)
  } finally {
    connection.release()
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    let rows
    try {
      ;[rows] = await pool.query(
        `SELECT media.filename, media.user_id, media.story_id, activity_media.activity_id,
          activities.animal_id, animals.created_by AS animal_created_by,
          stories.visibility, stories.moderation_status, users.is_active
        FROM story_media media
        LEFT JOIN stories ON stories.id = media.story_id
        LEFT JOIN activity_media ON activity_media.media_id = media.id
        LEFT JOIN activities ON activities.id = activity_media.activity_id
        LEFT JOIN animals ON animals.id = activities.animal_id
        JOIN users ON users.id = media.user_id
        WHERE media.id = ?
          AND (
            media.story_id IS NOT NULL
            OR activity_media.activity_id IS NOT NULL
            OR users.avatar_url = CONCAT('/api/media/', media.id)
            OR users.cover_url = CONCAT('/api/media/', media.id)
          )
        LIMIT 1`,
        [req.params.id],
      )
    } catch (error) {
      if (error.code !== 'ER_NO_SUCH_TABLE') throw error
      ;[rows] = await pool.query(
        `SELECT media.filename, media.user_id, media.story_id,
          NULL AS activity_id, NULL AS animal_id, NULL AS animal_created_by,
          stories.visibility, stories.moderation_status, users.is_active
        FROM story_media media
        LEFT JOIN stories ON stories.id = media.story_id
        JOIN users ON users.id = media.user_id
        WHERE media.id = ?
          AND (
            media.story_id IS NOT NULL
            OR users.avatar_url = CONCAT('/api/media/', media.id)
            OR users.cover_url = CONCAT('/api/media/', media.id)
          )
        LIMIT 1`,
        [req.params.id],
      )
    }
    if (!rows.length) {
      try {
        const [brandSettings] = await pool.query(
          'SELECT logo_url FROM brand_settings WHERE id = 1 AND logo_url = ? LIMIT 1',
          [`/api/media/${req.params.id}`],
        )
        if (brandSettings.length) {
          ;[rows] = await pool.query(
            `SELECT media.filename, media.user_id, NULL AS story_id, NULL AS activity_id,
              NULL AS visibility, NULL AS moderation_status, users.is_active
            FROM story_media media JOIN users ON users.id = media.user_id
            WHERE media.id = ? AND media.media_type = 'image'
            LIMIT 1`,
            [req.params.id],
          )
        }
      } catch (error) {
        if (error.code !== 'ER_NO_SUCH_TABLE') throw error
      }
    }
    if (!rows.length) {
      res.status(404).json({ message: 'Archivo no encontrado' })
      return
    }
    const media = rows[0]
    const userId = authenticatedUser(req)
    const accessGrantIds = getAccessGrantIds(req.cookies, userId)
    let viewerCanModerate = false
    let viewerIsSuperadmin = false
    let viewerEmail = null
    if (userId) {
      const [viewers] = await pool.query('SELECT email, role, is_active FROM users WHERE id = ? LIMIT 1', [userId])
      const viewer = viewers[0]
      viewerEmail = viewer?.email || null
      const superadminEmails = new Set((process.env.SUPERADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
      const legacyModeratorEmails = new Set((process.env.MODERATOR_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
      viewerIsSuperadmin = Boolean(viewer?.is_active && (
        viewer.role === 'superadmin' || superadminEmails.has(viewer.email.toLowerCase())
      ))
      viewerCanModerate = Boolean(viewer?.is_active && (
        ['superadmin', 'admin', 'editor', 'moderator'].includes(viewer.role)
        || superadminEmails.has(viewer.email.toLowerCase())
        || legacyModeratorEmails.has(viewer.email.toLowerCase())
      ))
    }
    if (!media.is_active && !viewerCanModerate) {
      res.status(404).json({ message: 'Archivo no encontrado' })
      return
    }
    if (media.story_id && userId !== media.user_id) {
      const approved = media.moderation_status === 'approved' || viewerCanModerate
      let canViewStory = media.visibility === 'public' && approved
      if (media.visibility === 'followers' && approved && userId) {
        const [follows] = await pool.query(
          'SELECT 1 FROM user_follows WHERE follower_user_id = ? AND following_user_id = ? LIMIT 1',
          [userId, media.user_id],
        )
        canViewStory = follows.length > 0
      }
      if (!canViewStory) {
        res.status(userId ? 403 : 401).json({ message: 'No tienes permiso para ver este archivo' })
        return
      }
    }
    if (media.activity_id && userId !== media.user_id && !viewerIsSuperadmin) {
      const [animalAccess] = media.animal_id
        ? await pool.query(
          `SELECT 1 FROM animals
           WHERE id = ? AND (created_by = ? OR EXISTS (
             SELECT 1 FROM animal_custody
             WHERE animal_custody.animal_id = animals.id
               AND animal_custody.user_id = ? AND animal_custody.ended_at IS NULL
           ) OR EXISTS (
             SELECT 1 FROM access_grants
             WHERE access_grants.animal_id = animals.id AND access_grants.recipient_email = ?
               AND access_grants.revoked_at IS NULL
               AND (access_grants.expires_at IS NULL OR access_grants.expires_at > UTC_TIMESTAMP())
               AND (access_grants.password_hash IS NULL OR access_grants.id IN (?))
               AND (JSON_CONTAINS(access_grants.permissions, JSON_QUOTE('animal:read'))
                 OR JSON_CONTAINS(access_grants.permissions, JSON_QUOTE('animal:manage')))
           )) LIMIT 1`,
          [media.animal_id, userId, userId, viewerEmail, accessGrantIds.length ? accessGrantIds : ['']],
        )
        : [[]]
      if (!animalAccess.length) {
        res.status(userId ? 403 : 401).json({ message: 'No tienes permiso para ver este archivo' })
        return
      }
    }
    res.sendFile(media.filename, { root: uploadDirectory }, (error) => {
      if (error && !res.headersSent) next(error)
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
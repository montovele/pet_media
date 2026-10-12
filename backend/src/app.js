require('dotenv').config()

const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const authRoutes = require('./modules/auth/auth.routes')
const feedRoutes = require('./modules/feed/feed.routes')
const mediaRoutes = require('./modules/media/media.routes')
const activityRoutes = require('./modules/activities/activities.routes')
const photosRoutes = require('./modules/photos/photos.routes')
const albumsRoutes = require('./modules/albums/albums.routes')
const socialRoutes = require('./modules/social/social.routes')
const notificationsRoutes = require('./modules/notifications/notifications.routes')
const moderationRoutes = require('./modules/moderation/moderation.routes')
const adsRoutes = require('./modules/ads/ads.routes')
const brandRoutes = require('./modules/brand/brand.routes')
const { errorMiddleware, notFoundMiddleware } = require('./middleware/error.middleware')

const app = express()

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use('/api/ads/webhook', express.raw({ type: 'application/json' }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'API funcionando' })
})

app.use('/api/auth', authRoutes)
app.use('/api/brand', brandRoutes)
app.use('/api/media', mediaRoutes)
app.use('/api/activities', activityRoutes)
app.use('/api/photos', photosRoutes)
app.use('/api/albums', albumsRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/moderation', moderationRoutes)
app.use('/api/ads', adsRoutes)
app.use('/api', feedRoutes)
app.use(notFoundMiddleware)
app.use(errorMiddleware)

module.exports = app
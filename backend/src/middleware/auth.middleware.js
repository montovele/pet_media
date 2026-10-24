const { verifyToken, verifyAccessGrantToken, verifyAccessGrantSessionToken } = require('../utils/jwt')
const pool = require('../config/db')

function isAllowedAccessGuestRequest(method, path) {
  if (method === 'GET' && path === '/api/auth/me') return true
  if (method === 'POST' && ['/api/auth/logout', '/api/auth/access-grant-login'].includes(path)) return true
  if (method === 'GET' && path === '/api/brand') return true
  if (method === 'GET' && path === '/api/animals') return true
  return method === 'GET' && (
    /^\/api\/animals\/[0-9a-f-]{36}$/i.test(path)
    || /^\/api\/animals\/[0-9a-f-]{36}\/(health-records|care-schedules)$/i.test(path)
    || /^\/api\/animals\/photos\/[0-9a-f-]{36}$/i.test(path)
  )
}

function restrictAccessGuestRequests(req, res, next) {
  const path = `${req.baseUrl}${req.path}`
  if (!req.cookies?.bioacta_guest_session || isAllowedAccessGuestRequest(req.method, path)) return next()
  return res.status(403).json({ message: 'El acceso temporal solo permite consultar el expediente compartido.' })
}

function getAccessGrantIds(cookies, userId) {
  if (!userId) return []
  const accessGrantIds = []
  for (const [cookieName, grantToken] of Object.entries(cookies || {})) {
    if (!cookieName.startsWith('bioacta_access_')) continue
    try {
      const grant = verifyAccessGrantToken(grantToken)
      const grantId = cookieName.slice('bioacta_access_'.length)
      if (grant.userId === userId && grant.grantId === grantId) accessGrantIds.push(grantId)
    } catch (error) {
      if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) throw error
    }
  }
  return accessGrantIds
}

async function requireAuth(req, res, next) {
  const guestToken = req.cookies?.bioacta_guest_session
  if (guestToken) {
    try {
      const session = verifyAccessGrantSessionToken(guestToken)
      const [grants] = await pool.query(
        `SELECT id, animal_id, animal_ids, all_animals, recipient_email, role, permissions, expires_at
         FROM access_grants
         WHERE id = ? AND LOWER(recipient_email) = LOWER(?)
           AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
         LIMIT 1`,
        [session.grantId, session.email],
      )
      if (!grants.length) return res.status(401).json({ message: 'El acceso compartido venció o fue revocado.' })
      const grant = grants[0]
      req.user = {
        id: grant.id,
        email: grant.recipient_email,
        role: 'user',
        accessGrantIds: [grant.id],
        isAccessGuest: true,
        accessGrant: {
          id: grant.id,
          animalId: grant.animal_id,
          animalIds: grant.animal_ids ? (Array.isArray(grant.animal_ids) ? grant.animal_ids : JSON.parse(grant.animal_ids)) : [grant.animal_id],
          allAnimals: Boolean(grant.all_animals),
          role: grant.role,
          permissions: Array.isArray(grant.permissions) ? grant.permissions : JSON.parse(grant.permissions),
          expiresAt: grant.expires_at ? new Date(grant.expires_at).toISOString() : null,
        },
      }
      return next()
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
      if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
        return res.status(401).json({ message: 'La sesión temporal venció. Inicia sesión de nuevo con tu invitación.' })
      }
      return next(error)
    }
  }

  const authorization = req.get('authorization')
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null
  const token = req.cookies?.social_session || bearerToken

  if (!token) {
    return res.status(401).json({ message: 'No autorizado' })
  }

  try {
    const decoded = verifyToken(token)
    const [users] = await pool.query('SELECT id, email, role, is_active FROM users WHERE id = ? LIMIT 1', [decoded.userId])
    if (!users.length || !users[0].is_active) {
      return res.status(403).json({ message: 'Esta cuenta está desactivada. Contacta al equipo de moderación.' })
    }
    const superadminEmails = new Set((process.env.SUPERADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
    const legacyModeratorEmails = new Set((process.env.MODERATOR_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
    const role = superadminEmails.has(users[0].email.toLowerCase())
      ? 'superadmin'
      : users[0].role === 'user' && legacyModeratorEmails.has(users[0].email.toLowerCase())
        ? 'moderator'
        : users[0].role
    req.user = { id: decoded.userId, email: users[0].email, role, accessGrantIds: getAccessGrantIds(req.cookies, decoded.userId) }
    return next()
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
    return res.status(401).json({ message: 'Token inválido o expirado' })
  }
}

function optionalAuth(req, res, next) {
  const hasBearerToken = req.get('authorization')?.startsWith('Bearer ')
  if (!req.cookies?.social_session && !hasBearerToken) return next()
  return requireAuth(req, res, next)
}

async function requireModerator(req, res, next) {
  return requireRoles('superadmin', 'admin', 'editor', 'moderator')(req, res, next)
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'No tienes permisos para realizar esta acción.' })
    }
    return next()
  }
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireModerator,
  requireRoles,
  getAccessGrantIds,
  isAllowedAccessGuestRequest,
  restrictAccessGuestRequests,
}
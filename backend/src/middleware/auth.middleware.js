const { verifyToken } = require('../utils/jwt')
const pool = require('../config/db')

async function requireAuth(req, res, next) {
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
    req.user = { id: decoded.userId, role }
    return next()
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
    return res.status(401).json({ message: 'Token inválido o expirado' })
  }
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

module.exports = { requireAuth, requireModerator, requireRoles }
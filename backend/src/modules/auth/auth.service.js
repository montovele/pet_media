const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')
const pool = require('../../config/db')
const { signToken } = require('../../utils/jwt')
const defaultAvatarUrl = '/default-avatar.svg'

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    bio: user.bio || undefined,
    avatarUrl: user.avatar_url || defaultAvatarUrl,
    coverUrl: user.cover_url || null,
    role: isSuperadminEmail(user.email) ? 'superadmin' : (user.role || (isModeratorEmail(user.email) ? 'moderator' : 'user')),
    isModerator: ['superadmin', 'admin', 'editor', 'moderator'].includes(isSuperadminEmail(user.email) ? 'superadmin' : (user.role || (isModeratorEmail(user.email) ? 'moderator' : 'user'))),
  }
}

function isModeratorEmail(email) {
  const allowedEmails = (process.env.MODERATOR_EMAILS || '').split(',').map((value) => value.trim().toLowerCase())
  return allowedEmails.includes(String(email || '').toLowerCase())
}

function isSuperadminEmail(email) {
  return (process.env.SUPERADMIN_EMAILS || '').split(',').some((value) => value.trim().toLowerCase() === String(email || '').toLowerCase())
}

async function register({ name, email, password }) {
  const normalizedEmail = email.toLowerCase()
  const [existingUsers] = await pool.query(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [normalizedEmail],
  )
  if (existingUsers.length) {
    const error = new Error('El correo ya está registrado')
    error.statusCode = 409
    throw error
  }

  const id = randomUUID()
  const localPart = normalizedEmail.split('@')[0]
  const usernameBase = localPart.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 60) || 'usuario'
  const username = `${usernameBase}_${id.slice(0, 6)}`
  const passwordHash = await bcrypt.hash(password, 12)

  await pool.query(
    'INSERT INTO users (id, name, email, password_hash, username, avatar_url) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, normalizedEmail, passwordHash, username, defaultAvatarUrl],
  )

  return { id, name, username }
}

async function login({ email, password }) {
  const [users] = await pool.query(
    'SELECT id, name, email, username, avatar_url, cover_url, role, password_hash, is_active FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase()],
  )
  const user = users[0]
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    const error = new Error('Correo o contraseña incorrectos')
    error.statusCode = 401
    throw error
  }
  if (!user.is_active) {
    const error = new Error('Esta cuenta está desactivada. Contacta al equipo de moderación.')
    error.statusCode = 403
    throw error
  }

  return { user: publicUser(user), token: signToken({ userId: user.id }) }
}

async function getCurrentUser(userId) {
  const [users] = await pool.query(
    'SELECT id, name, email, username, bio, avatar_url, cover_url, role, is_active FROM users WHERE id = ? LIMIT 1',
    [userId],
  )
  if (!users.length) {
    const error = new Error('Usuario no encontrado')
    error.statusCode = 401
    throw error
  }
  if (!users[0].is_active) {
    const error = new Error('Esta cuenta está desactivada. Contacta al equipo de moderación.')
    error.statusCode = 403
    throw error
  }
  return publicUser(users[0])
}

async function updateProfile(userId, updates) {
  const allowedFields = {}

  if (typeof updates.name === 'string') {
    const name = updates.name.trim()
    if (!name) {
      const error = new Error('El nombre no puede quedar vacío')
      error.statusCode = 400
      throw error
    }
    allowedFields.name = name
  }

  if (typeof updates.bio === 'string') {
    allowedFields.bio = updates.bio.trim()
  }

  if (typeof updates.avatarUrl === 'string') {
    allowedFields.avatar_url = updates.avatarUrl.trim() || null
  }

  if (typeof updates.coverUrl === 'string') {
    allowedFields.cover_url = updates.coverUrl.trim() || null
  }

  const entries = Object.entries(allowedFields)
  if (!entries.length) {
    return getCurrentUser(userId)
  }

  const values = entries.map(([, value]) => value)
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ')
  values.push(userId)

  await pool.query(`UPDATE users SET ${assignments} WHERE id = ?`, values)
  return getCurrentUser(userId)
}

async function getNearbyUsers(currentUserId) {
  const [rows] = await pool.query(
    `SELECT
      u.id,
      u.name,
      u.username,
      u.avatar_url,
      u.bio,
      (
        SELECT a.location_name
        FROM activities a
        WHERE a.user_id = u.id
        ORDER BY a.activity_date DESC, a.created_at DESC
        LIMIT 1
      ) AS last_location,
      (
        SELECT a.created_at
        FROM activities a
        WHERE a.user_id = u.id
        ORDER BY a.activity_date DESC, a.created_at DESC
        LIMIT 1
      ) AS last_activity_at,
      CASE WHEN uf_current.follower_user_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_following,
      COALESCE(follower_counts.followers_count, 0) AS followers_count,
      COALESCE(following_counts.following_count, 0) AS following_count
    FROM users u
    LEFT JOIN user_follows uf_current ON uf_current.follower_user_id = ? AND uf_current.following_user_id = u.id
    LEFT JOIN (
      SELECT following_user_id, COUNT(*) AS followers_count
      FROM user_follows
      GROUP BY following_user_id
    ) follower_counts ON follower_counts.following_user_id = u.id
    LEFT JOIN (
      SELECT follower_user_id, COUNT(*) AS following_count
      FROM user_follows
      GROUP BY follower_user_id
    ) following_counts ON following_counts.follower_user_id = u.id
    WHERE u.id != ? AND u.is_active = TRUE
    ORDER BY last_activity_at DESC, u.created_at DESC
    LIMIT 6`,
    [currentUserId, currentUserId],
  )

  return rows.map((row) => {
    const lastActivityAt = row.last_activity_at ? new Date(row.last_activity_at) : null
    const now = Date.now()
    const diffMinutes = lastActivityAt ? (now - lastActivityAt.getTime()) / 60000 : Number.POSITIVE_INFINITY
    let status = 'Sin actividad reciente'
    let tone = 'offline'
    if (lastActivityAt) {
      if (diffMinutes < 30) {
        status = 'En línea'
        tone = 'online'
      } else if (diffMinutes < 1440) {
        status = 'Activo hoy'
        tone = 'away'
      } else if (diffMinutes < 10080) {
        status = 'Activo esta semana'
        tone = 'away'
      }
    }

    return {
      id: row.id,
      name: row.name,
      username: row.username || '@usuario',
      avatarUrl: row.avatar_url || defaultAvatarUrl,
      bio: row.bio || undefined,
      lastLocation: row.last_location || 'Sin ubicación',
      status,
      statusTone: tone,
      lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
      isFollowing: Boolean(row.is_following),
      followersCount: Number(row.followers_count || 0),
      followingCount: Number(row.following_count || 0),
    }
  })
}

async function getUserFollowSummary(currentUserId, targetUserId) {
  if (!targetUserId || targetUserId === currentUserId) {
    return {
      userId: targetUserId || currentUserId,
      isFollowing: false,
      followersCount: 0,
      followingCount: 0,
    }
  }

  const [rows] = await pool.query(
    `SELECT
      u.id,
      CASE WHEN uf_current.follower_user_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_following,
      (
        SELECT COUNT(*)
        FROM user_follows
        WHERE following_user_id = u.id
      ) AS followers_count,
      (
        SELECT COUNT(*)
        FROM user_follows
        WHERE follower_user_id = u.id
      ) AS following_count
    FROM users u
    LEFT JOIN user_follows uf_current ON uf_current.follower_user_id = ? AND uf_current.following_user_id = u.id
    WHERE u.id = ? AND u.is_active = TRUE
    LIMIT 1`,
    [currentUserId, targetUserId],
  )

  if (!rows.length) {
    const error = new Error('Usuario no encontrado o inactivo')
    error.statusCode = 404
    throw error
  }

  return {
    userId: rows[0].id,
    isFollowing: Boolean(rows[0].is_following),
    followersCount: Number(rows[0].followers_count || 0),
    followingCount: Number(rows[0].following_count || 0),
  }
}

async function toggleFollow(currentUserId, targetUserId, forceState) {
  if (!targetUserId) {
    const error = new Error('Selecciona un usuario para seguir.')
    error.statusCode = 400
    throw error
  }

  if (targetUserId === currentUserId) {
    const error = new Error('No puedes seguirte a ti mismo.')
    error.statusCode = 400
    throw error
  }

  const [targetRows] = await pool.query('SELECT id FROM users WHERE id = ? AND is_active = TRUE LIMIT 1', [targetUserId])
  if (!targetRows.length) {
    const error = new Error('Usuario no encontrado o inactivo.')
    error.statusCode = 404
    throw error
  }

  const [existingRows] = await pool.query(
    'SELECT 1 FROM user_follows WHERE follower_user_id = ? AND following_user_id = ? LIMIT 1',
    [currentUserId, targetUserId],
  )

  const shouldFollow = typeof forceState === 'boolean' ? forceState : !existingRows.length

  if (shouldFollow) {
    if (!existingRows.length) {
      await pool.query(
        'INSERT INTO user_follows (follower_user_id, following_user_id) VALUES (?, ?)',
        [currentUserId, targetUserId],
      )
    }
  } else {
    await pool.query(
      'DELETE FROM user_follows WHERE follower_user_id = ? AND following_user_id = ?',
      [currentUserId, targetUserId],
    )
  }

  const [followers] = await pool.query(
    'SELECT COUNT(*) AS followers_count FROM user_follows WHERE following_user_id = ?',
    [targetUserId],
  )
  const [following] = await pool.query(
    'SELECT COUNT(*) AS following_count FROM user_follows WHERE follower_user_id = ?',
    [targetUserId],
  )

  return {
    userId: targetUserId,
    isFollowing: shouldFollow,
    followersCount: Number(followers[0]?.followers_count || 0),
    followingCount: Number(following[0]?.following_count || 0),
  }
}

module.exports = {
  register,
  login,
  getCurrentUser,
  updateProfile,
  getNearbyUsers,
  getUserFollowSummary,
  toggleFollow,
}
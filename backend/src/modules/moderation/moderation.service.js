const { randomUUID } = require('crypto')
const pool = require('../../config/db')

async function listPublications(status = 'approved') {
  if (!['pending', 'approved', 'rejected', 'all'].includes(status)) {
    const error = new Error('Estado de revisión no válido.')
    error.statusCode = 400
    throw error
  }
  const statusFilter = status === 'all' ? '' : 'WHERE moderation_status = ?'
  const [rows] = await pool.query(
    `SELECT * FROM (
      SELECT
        p.id AS id,
        'post' AS kind,
        p.title AS title,
        p.caption AS caption,
        p.image_url AS image_url,
        p.media_type AS media_type,
        p.moderation_status AS moderation_status,
        p.moderation_note AS moderation_note,
        p.created_at AS created_at,
        u.id AS user_id,
        u.name AS user_name,
        u.username AS user_username,
        u.email AS user_email,
        u.is_active AS user_is_active
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.visibility = 'public'

      UNION ALL

      SELECT
        s.id AS id,
        'story' AS kind,
        s.title AS title,
        s.caption AS caption,
        s.image_url AS image_url,
        s.media_type AS media_type,
        s.moderation_status AS moderation_status,
        s.moderation_note AS moderation_note,
        s.created_at AS created_at,
        u.id AS user_id,
        u.name AS user_name,
        u.username AS user_username,
        u.email AS user_email,
        u.is_active AS user_is_active
      FROM stories s JOIN users u ON u.id = s.user_id
      WHERE s.visibility = 'public'
    ) AS public_content
    ${statusFilter}
    ORDER BY created_at DESC LIMIT 200`,
    status === 'all' ? [] : [status],
  )
  const storyIds = rows.filter((row) => row.kind === 'story').map((row) => row.id)
  const mediaByStory = new Map()
  if (storyIds.length) {
    const [mediaRows] = await pool.query(
      `SELECT id, story_id, media_type FROM story_media WHERE story_id IN (${storyIds.map(() => '?').join(', ')}) ORDER BY position ASC`,
      storyIds,
    )
    for (const media of mediaRows) {
      const items = mediaByStory.get(media.story_id) || []
      items.push({ id: media.id, url: `/api/media/${media.id}`, type: media.media_type })
      mediaByStory.set(media.story_id, items)
    }
  }

  return rows.map((row) => {
    const media = mediaByStory.get(row.id) || []
    if (!media.length && row.image_url) {
      media.push({ id: `${row.kind}-${row.id}-legacy`, url: row.image_url, type: row.media_type || 'image' })
    }
    return {
    id: row.id,
    kind: row.kind,
    title: row.title || '',
    caption: row.caption,
    imageUrl: media[0]?.url || row.image_url || undefined,
    mediaType: media[0]?.type || row.media_type || undefined,
    media,
    moderationStatus: row.moderation_status,
    moderationNote: row.moderation_note || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    user: {
      id: row.user_id,
      name: row.user_name,
      username: row.user_username,
      email: row.user_email,
      isActive: Boolean(row.user_is_active),
    },
    }
  })
}

async function reviewContent(moderatorId, kind, contentId, decision, reason) {
  if (!['post', 'story'].includes(kind) || !['approve', 'reject'].includes(decision)) {
    const error = new Error('La decisión o el tipo de contenido no son válidos.')
    error.statusCode = 400
    throw error
  }
  const normalizedReason = String(reason || '').trim()
  if (decision === 'reject' && normalizedReason.length < 8) {
    const error = new Error('Describe la infracción con al menos 8 caracteres para rechazar el contenido.')
    error.statusCode = 400
    throw error
  }

  const table = kind === 'story' ? 'stories' : 'posts'
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [items] = await connection.query(
      `SELECT id, visibility, moderation_status FROM ${table} WHERE id = ? FOR UPDATE`,
      [contentId],
    )
    if (!items.length || items[0].visibility !== 'public') {
      const error = new Error('No encontramos contenido público para revisar.')
      error.statusCode = 404
      throw error
    }
    const canRejectApproved = decision === 'reject' && items[0].moderation_status === 'approved'
    if (items[0].moderation_status !== 'pending' && !canRejectApproved) {
      const error = new Error('Este contenido ya fue revisado o no se puede cambiar desde este estado.')
      error.statusCode = 409
      throw error
    }
    const status = decision === 'approve' ? 'approved' : 'rejected'
    await connection.query(
      `UPDATE ${table} SET moderation_status = ?, moderation_note = ? WHERE id = ?`,
      [status, decision === 'reject' ? normalizedReason : null, contentId],
    )
    await connection.query(
      'INSERT INTO content_moderation_actions (id, moderator_id, content_id, content_kind, action, reason) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), moderatorId, contentId, kind, decision, normalizedReason || null],
    )
    await connection.commit()
    return { id: contentId, kind, moderationStatus: status, moderationNote: decision === 'reject' ? normalizedReason : null }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function listUsers() {
  const [rows] = await pool.query('SELECT id, name, email, role, is_active FROM users ORDER BY name ASC LIMIT 500')
  const superadminEmails = new Set((process.env.SUPERADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
  const legacyModeratorEmails = new Set((process.env.MODERATOR_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: superadminEmails.has(row.email.toLowerCase())
      ? 'superadmin'
      : row.role === 'user' && legacyModeratorEmails.has(row.email.toLowerCase())
        ? 'moderator'
        : row.role,
    isActive: Boolean(row.is_active),
  }))
}

async function assignRole(actorId, targetUserId, role) {
  if (!['admin', 'editor', 'moderator', 'user'].includes(role)) {
    const error = new Error('Rol no válido. No se puede asignar superadmin desde la interfaz.')
    error.statusCode = 400
    throw error
  }
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [users] = await connection.query('SELECT id, email, role FROM users WHERE id = ? FOR UPDATE', [targetUserId])
    if (!users.length) {
      const error = new Error('El usuario no existe.')
      error.statusCode = 404
      throw error
    }
    const protectedEmails = new Set((process.env.SUPERADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean))
    if (users[0].role === 'superadmin' || protectedEmails.has(users[0].email.toLowerCase())) {
      const error = new Error('No se puede cambiar el rol del superadministrador principal.')
      error.statusCode = 403
      throw error
    }
    const previousRole = users[0].role
    await connection.query('UPDATE users SET role = ? WHERE id = ?', [role, targetUserId])
    await connection.query(
      'INSERT INTO role_assignment_actions (id, actor_id, target_user_id, previous_role, new_role) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), actorId, targetUserId, previousRole, role],
    )
    await connection.commit()
    return { id: targetUserId, role }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function setUserStatus(moderatorId, moderatorRole, targetUserId, isActive, reason) {
  if (moderatorId === targetUserId) {
    const error = new Error('No puedes desactivar tu propia cuenta de moderación.')
    error.statusCode = 400
    throw error
  }
  const normalizedReason = String(reason || '').trim()
  if (normalizedReason.length < 8) {
    const error = new Error('Describe el motivo con al menos 8 caracteres.')
    error.statusCode = 400
    throw error
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [targetUsers] = await connection.query('SELECT id, email, role, is_active FROM users WHERE id = ? FOR UPDATE', [targetUserId])
    if (!targetUsers.length) {
      const error = new Error('El usuario no existe.')
      error.statusCode = 404
      throw error
    }
    const protectedEmails = new Set((process.env.SUPERADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()))
    const targetRole = protectedEmails.has(targetUsers[0].email.toLowerCase()) ? 'superadmin' : targetUsers[0].role
    const roleRank = { user: 0, editor: 1, moderator: 1, admin: 2, superadmin: 3 }
    if (!isActive && (targetRole === 'superadmin' || roleRank[targetRole] >= roleRank[moderatorRole])) {
      const error = new Error('No puedes desactivar una cuenta con un rol igual o superior al tuyo.')
      error.statusCode = 403
      throw error
    }
    const action = isActive ? 'reactivate' : 'deactivate'
    await connection.query(
      `UPDATE users SET is_active = ?, moderation_note = ?, deactivated_at = ?, deactivated_by = ? WHERE id = ?`,
      [isActive, isActive ? null : normalizedReason, isActive ? null : new Date(), isActive ? null : moderatorId, targetUserId],
    )
    await connection.query(
      'INSERT INTO moderation_actions (id, moderator_id, target_user_id, action, reason) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), moderatorId, targetUserId, action, normalizedReason],
    )
    await connection.commit()
    return { id: targetUserId, isActive, moderationNote: isActive ? null : normalizedReason }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function getSupervisionOverview() {
  const [statsRows] = await pool.query(`
    SELECT
      COUNT(*) AS total_users,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_users,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive_users,
      SUM(CASE WHEN role = 'superadmin' THEN 1 ELSE 0 END) AS superadmin_users,
      SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admin_users,
      SUM(CASE WHEN role = 'editor' THEN 1 ELSE 0 END) AS editor_users,
      SUM(CASE WHEN role = 'moderator' THEN 1 ELSE 0 END) AS moderator_users,
      SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS user_users
    FROM users
  `)

  const [userRows] = await pool.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.is_active,
      u.moderation_note,
      u.created_at,
      (
        SELECT COUNT(*)
        FROM posts p
        WHERE p.user_id = u.id
      ) AS posts_count,
      (
        SELECT COUNT(*)
        FROM stories s
        WHERE s.user_id = u.id
      ) AS stories_count,
      (
        SELECT COUNT(*)
        FROM activities a
        WHERE a.user_id = u.id
      ) AS activities_count,
      (
        SELECT COUNT(*)
        FROM comments c
        WHERE c.user_id = u.id
      ) AS comments_count,
      (
        SELECT COUNT(*)
        FROM reactions r
        WHERE r.user_id = u.id
      ) AS reactions_count,
      (
        SELECT MAX(created_at)
        FROM (
          SELECT created_at FROM posts WHERE user_id = u.id
          UNION ALL
          SELECT created_at FROM stories WHERE user_id = u.id
          UNION ALL
          SELECT created_at FROM activities WHERE user_id = u.id
          UNION ALL
          SELECT created_at FROM comments WHERE user_id = u.id
          UNION ALL
          SELECT created_at FROM reactions WHERE user_id = u.id
        ) AS activity_points
      ) AS last_activity_at
    FROM users u
    ORDER BY u.name ASC
    LIMIT 250
  `)

  const stats = statsRows[0] || {}
  const users = userRows.map((row) => {
    const activityTotal = Number(row.posts_count || 0) + Number(row.stories_count || 0) + Number(row.activities_count || 0) + Number(row.comments_count || 0) + Number(row.reactions_count || 0)
    const livenessScore = Math.min(100, Math.max(0, activityTotal * 12 + (row.role === 'superadmin' ? 10 : row.role === 'admin' ? 8 : row.role === 'moderator' ? 6 : row.role === 'editor' ? 4 : 2)))
    let level = 'Bajo'
    if (livenessScore >= 85) level = 'Alto'
    else if (livenessScore >= 60) level = 'Medio'
    else if (livenessScore >= 35) level = 'Moderado'

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: Boolean(row.is_active),
      moderationNote: row.moderation_note || null,
      createdAt: new Date(row.created_at).toISOString(),
      postsCount: Number(row.posts_count || 0),
      storiesCount: Number(row.stories_count || 0),
      activitiesCount: Number(row.activities_count || 0),
      commentsCount: Number(row.comments_count || 0),
      reactionsCount: Number(row.reactions_count || 0),
      totalActivity: activityTotal,
      lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at).toISOString() : null,
      level,
    }
  })

  return {
    stats: {
      totalUsers: Number(stats.total_users || 0),
      activeUsers: Number(stats.active_users || 0),
      inactiveUsers: Number(stats.inactive_users || 0),
      superadminUsers: Number(stats.superadmin_users || 0),
      adminUsers: Number(stats.admin_users || 0),
      editorUsers: Number(stats.editor_users || 0),
      moderatorUsers: Number(stats.moderator_users || 0),
      regularUsers: Number(stats.user_users || 0),
    },
    users,
  }
}

module.exports = { listPublications, reviewContent, listUsers, assignRole, setUserStatus, getSupervisionOverview }
const { randomUUID } = require('crypto')
const pool = require('../../config/db')
const { requireAnimalAccess } = require('../animals/animals.access')

function formatActivity(row) {
  return {
    id: row.id,
    animalId: row.animal_id,
    animalName: row.animal_name || undefined,
    animalSpecies: row.animal_species || undefined,
    title: row.title,
    description: row.description || undefined,
    date: row.activity_date,
    locationName: row.location_name || undefined,
    category: row.category,
    media: row.media_id ? [{ id: row.media_id, url: `/api/media/${row.media_id}`, type: row.media_type }] : [],
    video: row.media_type === 'video' && row.media_id
      ? { id: row.media_id, url: `/api/media/${row.media_id}`, type: 'video' }
      : undefined,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

async function getActivities(user) {
  const [rows] = await pool.query(
    `SELECT activities.id, activities.animal_id, animals.name AS animal_name, animals.species AS animal_species,
      activities.title, activities.description,
      DATE_FORMAT(activities.activity_date, '%Y-%m-%d') AS activity_date,
      activities.location_name, activities.category, activities.created_at,
      activity_media.media_id, story_media.media_type
    FROM activities
    LEFT JOIN animals ON animals.id = activities.animal_id
    LEFT JOIN activity_media ON activity_media.activity_id = activities.id
    LEFT JOIN story_media ON story_media.id = activity_media.media_id
    WHERE ? = 'superadmin'
      OR (activities.animal_id IS NULL AND activities.user_id = ?)
      OR animals.created_by = ?
      OR EXISTS (
        SELECT 1 FROM animal_custody
        WHERE animal_custody.animal_id = activities.animal_id
          AND animal_custody.user_id = ? AND animal_custody.ended_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM access_grants
        WHERE access_grants.animal_id = activities.animal_id
          AND access_grants.recipient_email = ?
          AND access_grants.revoked_at IS NULL
          AND (access_grants.expires_at IS NULL OR access_grants.expires_at > UTC_TIMESTAMP())
          AND (access_grants.password_hash IS NULL OR access_grants.id IN (?))
          AND (JSON_CONTAINS(access_grants.permissions, JSON_QUOTE('animal:read'))
            OR JSON_CONTAINS(access_grants.permissions, JSON_QUOTE('animal:manage')))
      )
    ORDER BY activities.activity_date DESC, activities.created_at DESC, story_media.position ASC`,
    [user.role, user.id, user.id, user.id, user.email, user.accessGrantIds?.length ? user.accessGrantIds : ['']],
  )
  const activities = new Map()
  for (const row of rows) {
    let activity = activities.get(row.id)
    if (!activity) {
      activity = formatActivity(row)
      activities.set(row.id, activity)
    } else if (row.media_id) {
      activity.media.push({ id: row.media_id, url: `/api/media/${row.media_id}`, type: row.media_type })
      if (row.media_type === 'video' && !activity.video) {
        activity.video = { id: row.media_id, url: `/api/media/${row.media_id}`, type: 'video' }
      }
    }
  }
  return [...activities.values()]
}

async function createActivity(user, values) {
  const id = randomUUID()
  const mediaIds = values.mediaIds || [values.mediaId || values.videoId].filter(Boolean)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await requireAnimalAccess(user, values.animalId, 'animal:read', connection)
    if (mediaIds.length) {
      const [media] = await connection.query(
        `SELECT id FROM story_media
        WHERE id IN (?) AND user_id = ? AND media_type IN ('image', 'video') AND story_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM activity_media WHERE media_id = story_media.id)
        FOR UPDATE`,
        [mediaIds, user.id],
      )
      if (media.length !== mediaIds.length) {
        const error = new Error('El archivo seleccionado no está disponible para esta actividad.')
        error.statusCode = 400
        throw error
      }
    }
    await connection.query(
      `INSERT INTO activities (id, user_id, animal_id, title, description, activity_date, location_name, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user.id, values.animalId, values.title, values.description || null, values.date, values.locationName || null, values.category],
    )
    if (mediaIds.length) {
      await connection.query(
        'INSERT INTO activity_media (activity_id, media_id, user_id) VALUES ?',
        [mediaIds.map((mediaId) => [id, mediaId, user.id])],
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  const activities = await getActivities(user)
  return activities.find((activity) => activity.id === id)
}

module.exports = { getActivities, createActivity }
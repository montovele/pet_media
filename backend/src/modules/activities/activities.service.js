const { randomUUID } = require('crypto')
const pool = require('../../config/db')

function formatActivity(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    date: row.activity_date,
    locationName: row.location_name || undefined,
    category: row.category,
    video: row.video_id ? { id: row.video_id, url: `/api/media/${row.video_id}`, type: 'video' } : undefined,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

async function getActivities(userId) {
  const [rows] = await pool.query(
    `SELECT activities.id, activities.title, activities.description,
      DATE_FORMAT(activities.activity_date, '%Y-%m-%d') AS activity_date,
      activities.location_name, activities.category, activities.created_at,
      activity_media.media_id AS video_id
    FROM activities
    LEFT JOIN activity_media ON activity_media.activity_id = activities.id
    WHERE activities.user_id = ? ORDER BY activities.activity_date DESC, activities.created_at DESC`,
    [userId],
  )
  return rows.map(formatActivity)
}

async function createActivity(userId, values) {
  const id = randomUUID()
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    if (values.videoId) {
      const [media] = await connection.query(
        `SELECT id FROM story_media
        WHERE id = ? AND user_id = ? AND media_type = 'video' AND story_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM activity_media WHERE media_id = story_media.id)
        LIMIT 1 FOR UPDATE`,
        [values.videoId, userId],
      )
      if (!media.length) {
        const error = new Error('El video seleccionado no está disponible para esta actividad.')
        error.statusCode = 400
        throw error
      }
    }
    await connection.query(
      `INSERT INTO activities (id, user_id, title, description, activity_date, location_name, category)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, values.title, values.description || null, values.date, values.locationName || null, values.category],
    )
    if (values.videoId) {
      await connection.query(
        'INSERT INTO activity_media (activity_id, media_id, user_id) VALUES (?, ?, ?)',
        [id, values.videoId, userId],
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  const activities = await getActivities(userId)
  return activities.find((activity) => activity.id === id)
}

module.exports = { getActivities, createActivity }
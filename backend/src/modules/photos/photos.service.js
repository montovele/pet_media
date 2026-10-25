const pool = require('../../config/db')

async function getPhotos(userId) {
  const [rows] = await pool.query(
    `SELECT photo_id AS id, photo_url AS url, title, created_at, source, media_type AS mediaType FROM (
      SELECT CONCAT('media:', media.id) AS photo_id, CONCAT('/api/media/', media.id) AS photo_url,
        COALESCE(story.title, 'Foto de historia') AS title, story.created_at, 'Historia' AS source,
        'image' AS media_type
      FROM story_media media JOIN stories story ON story.id = media.story_id
      WHERE media.user_id = ? AND media.media_type = 'image'
      UNION ALL
      SELECT CONCAT('story:', story.id) AS photo_id, story.image_url AS photo_url,
        COALESCE(story.title, 'Foto de historia') AS title, story.created_at, 'Historia' AS source,
        'image' AS media_type
      FROM stories story
      WHERE story.user_id = ? AND story.image_url IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM story_media media
          WHERE media.story_id = story.id AND CONCAT('/api/media/', media.id) = story.image_url
        )
      UNION ALL
      SELECT CONCAT('post:', post.id) AS photo_id, post.image_url AS photo_url,
        COALESCE(post.title, 'Foto de publicación') AS title, post.created_at, 'Publicación' AS source,
        'image' AS media_type
      FROM posts post
      WHERE post.user_id = ? AND post.image_url IS NOT NULL AND COALESCE(post.media_type, 'image') <> 'video'
      UNION ALL
      SELECT CONCAT('media:', media.id) AS photo_id, CONCAT('/api/media/', media.id) AS photo_url,
        COALESCE(activity.title, 'Multimedia de actividad') AS title, activity.activity_date AS created_at,
        'Actividad' AS source, media.media_type
      FROM activity_media attached
      JOIN activities activity ON activity.id = attached.activity_id
      JOIN story_media media ON media.id = attached.media_id
      WHERE attached.user_id = ? AND media.user_id = ?
    ) photos ORDER BY created_at DESC`,
    [userId, userId, userId, userId, userId],
  )
  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    createdAt: new Date(row.created_at).toISOString(),
    source: row.source,
    mediaType: row.mediaType,
  }))
}

async function getPhoto(userId, photoId) {
  const photos = await getPhotos(userId)
  const photo = photos.find((item) => item.id === photoId)
  if (!photo) {
    const error = new Error('Foto no encontrada')
    error.statusCode = 404
    throw error
  }
  return photo
}

module.exports = { getPhotos, getPhoto }
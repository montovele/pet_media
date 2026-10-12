const { randomUUID } = require('crypto')
const pool = require('../../config/db')
const { getPhotos } = require('../photos/photos.service')

async function getAlbums(userId) {
  const [albums] = await pool.query(
    'SELECT id, title, description, created_at FROM albums WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  )
  if (!albums.length) return []

  const [photos] = await pool.query(
    `SELECT album_id, photo_id, photo_url, position FROM album_photos
    WHERE user_id = ? AND album_id IN (${albums.map(() => '?').join(', ')}) ORDER BY position ASC`,
    [userId, ...albums.map((album) => album.id)],
  )
  const photosByAlbum = new Map()
  for (const photo of photos) {
    const items = photosByAlbum.get(photo.album_id) || []
    items.push({ id: photo.photo_id, url: photo.photo_url })
    photosByAlbum.set(photo.album_id, items)
  }
  return albums.map((album) => ({
    id: album.id,
    title: album.title,
    description: album.description || undefined,
    createdAt: new Date(album.created_at).toISOString(),
    photos: photosByAlbum.get(album.id) || [],
  }))
}

async function createAlbum(userId, values) {
  const availablePhotos = await getPhotos(userId)
  const photosById = new Map(availablePhotos.map((photo) => [photo.id, photo]))
  if (values.photoIds.some((photoId) => !photosById.has(photoId))) {
    const error = new Error('Una o más fotos no pertenecen a tu biblioteca.')
    error.statusCode = 400
    throw error
  }

  const connection = await pool.getConnection()
  const albumId = randomUUID()
  try {
    await connection.beginTransaction()
    await connection.query(
      'INSERT INTO albums (id, user_id, title, description) VALUES (?, ?, ?, ?)',
      [albumId, userId, values.title, values.description || null],
    )
    for (const [position, photoId] of values.photoIds.entries()) {
      const photo = photosById.get(photoId)
      await connection.query(
        'INSERT INTO album_photos (id, album_id, user_id, photo_id, photo_url, position) VALUES (?, ?, ?, ?, ?, ?)',
        [randomUUID(), albumId, userId, photo.id, photo.url, position],
      )
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const albums = await getAlbums(userId)
  return albums.find((album) => album.id === albumId)
}

async function getAlbum(userId, albumId) {
  const albums = await getAlbums(userId)
  const album = albums.find((item) => item.id === albumId)
  if (!album) {
    const error = new Error('Álbum no encontrado')
    error.statusCode = 404
    throw error
  }
  return album
}

module.exports = { getAlbums, getAlbum, createAlbum }
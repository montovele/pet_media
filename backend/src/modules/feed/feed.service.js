const { randomUUID } = require('crypto')
const fs = require('fs')
const path = require('path')
const pool = require('../../config/db')
const notificationsService = require('../notifications/notifications.service')
const uploadDirectory = path.resolve(__dirname, '../../../uploads')
const defaultAvatarUrl = '/default-avatar.svg'

function missingEntry() {
  const error = new Error('Publicación no encontrada')
  error.statusCode = 404
  return error
}

function formatEntry(row, kind, storyMedia = []) {
  const media = [...storyMedia]
  if (row.image_url && !media.some((item) => item.url === row.image_url)) {
    media.unshift({ id: `${row.id}-legacy`, url: row.image_url, type: row.media_type || 'image' })
  }
  return {
    id: row.id,
    kind,
    title: row.title || undefined,
    caption: row.caption,
    imageUrl: media[0]?.url || row.image_url || undefined,
    mediaType: media[0]?.type || row.media_type || undefined,
    media,
    visibility: row.visibility,
    moderationStatus: row.moderation_status,
    moderationNote: row.moderation_note || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    likes: Number(row.likes),
    comments: Number(row.comments),
    liked: Boolean(row.liked),
    isFollowedAuthor: Boolean(row.is_followed_author),
    author: {
      name: row.name,
      handle: row.username ? `@${row.username.replace(/^@/, '')}` : '',
      avatar: row.avatar_url || defaultAvatarUrl,
    },
  }
}

async function getStoryMedia(storyIds) {
  if (!storyIds.length) return new Map()
  const [rows] = await pool.query(
    `SELECT id, story_id, media_type FROM story_media WHERE story_id IN (${storyIds.map(() => '?').join(', ')}) ORDER BY position ASC`,
    storyIds,
  )
  const mediaByStory = new Map()
  for (const row of rows) {
    const media = mediaByStory.get(row.story_id) || []
    media.push({ id: row.id, url: `/api/media/${row.id}`, type: row.media_type })
    mediaByStory.set(row.story_id, media)
  }
  return mediaByStory
}

async function getFeed(userId) {
  const [posts] = await pool.query(
    `SELECT p.id, p.title, p.caption, p.image_url, p.media_type, p.visibility, p.moderation_status, p.moderation_note, p.created_at,
      u.name, u.username, u.avatar_url,
      EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_user_id = ? AND uf.following_user_id = p.user_id) AS is_followed_author,
      (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id AND r.type = 'like') AS likes,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments,
      EXISTS(SELECT 1 FROM reactions r WHERE r.post_id = p.id AND r.user_id = ? AND r.type = 'like') AS liked
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE u.is_active = TRUE AND (
      p.user_id = ?
      OR (p.moderation_status = 'approved' AND (
        p.visibility = 'public'
        OR (p.visibility = 'followers' AND EXISTS(
          SELECT 1 FROM user_follows uf WHERE uf.follower_user_id = ? AND uf.following_user_id = p.user_id
        ))
      ))
    )
    ORDER BY p.created_at DESC`,
    [userId, userId, userId, userId],
  )
  const [stories] = await pool.query(
    `SELECT s.id, s.title, s.caption, s.image_url, s.media_type, s.visibility, s.moderation_status, s.moderation_note, s.created_at,
      u.name, u.username, u.avatar_url,
      EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_user_id = ? AND uf.following_user_id = s.user_id) AS is_followed_author,
      (SELECT COUNT(*) FROM reactions r WHERE r.story_id = s.id AND r.type = 'like') AS likes,
      (SELECT COUNT(*) FROM comments c WHERE c.story_id = s.id) AS comments,
      EXISTS(SELECT 1 FROM reactions r WHERE r.story_id = s.id AND r.user_id = ? AND r.type = 'like') AS liked
    FROM stories s JOIN users u ON u.id = s.user_id
    WHERE u.is_active = TRUE AND (
      s.user_id = ?
      OR (s.moderation_status = 'approved' AND (
        s.visibility = 'public'
        OR (s.visibility = 'followers' AND EXISTS(
          SELECT 1 FROM user_follows uf WHERE uf.follower_user_id = ? AND uf.following_user_id = s.user_id
        ))
      ))
    )
    ORDER BY s.created_at DESC`,
    [userId, userId, userId, userId],
  )

  const mediaByStory = await getStoryMedia(stories.map((story) => story.id))
  return [
    ...posts.map((row) => ({ row, kind: 'post' })),
    ...stories.map((row) => ({ row, kind: 'story', media: mediaByStory.get(row.id) })),
  ]
    .sort((left, right) => Number(Boolean(right.row.is_followed_author)) - Number(Boolean(left.row.is_followed_author))
      || Date.parse(right.row.created_at) - Date.parse(left.row.created_at))
    .map(({ row, kind, media }) => formatEntry(row, kind, media))
}

async function getPublicStories() {
  const [rows] = await pool.query(
    `SELECT s.id, s.title, s.caption, s.image_url, s.media_type, s.visibility, s.moderation_status, s.moderation_note, s.created_at,
      u.name, u.username, u.avatar_url,
      (SELECT COUNT(*) FROM reactions r WHERE r.story_id = s.id AND r.type = 'like') AS likes,
      (SELECT COUNT(*) FROM comments c WHERE c.story_id = s.id) AS comments,
      FALSE AS liked
      , FALSE AS is_followed_author
    FROM stories s JOIN users u ON u.id = s.user_id
    WHERE s.visibility = 'public' AND s.moderation_status = 'approved' AND u.is_active = TRUE
    ORDER BY s.created_at DESC`,
  )
  const mediaByStory = await getStoryMedia(rows.map((story) => story.id))
  return rows.map((row) => formatEntry(row, 'story', mediaByStory.get(row.id)))
}

async function canViewEntry(connection, ownerId, userId, visibility, moderationStatus) {
  if (ownerId === userId) return true
  if (moderationStatus !== 'approved') return false
  if (visibility === 'public') return true
  if (visibility !== 'followers') return false
  const [follows] = await connection.query(
    'SELECT 1 FROM user_follows WHERE follower_user_id = ? AND following_user_id = ? LIMIT 1',
    [userId, ownerId],
  )
  return follows.length > 0
}

async function findEntry(connection, entryId, userId, lock = false) {
  const suffix = lock ? ' FOR UPDATE' : ''
  const [posts] = await connection.query(`SELECT id, user_id, visibility, moderation_status FROM posts WHERE id = ?${suffix}`, [entryId])
  if (posts.length) {
    if (!await canViewEntry(connection, posts[0].user_id, userId, posts[0].visibility, posts[0].moderation_status)) throw missingEntry()
    return { table: 'posts', target: 'post_id', ownerId: posts[0].user_id }
  }
  const [stories] = await connection.query(`SELECT id, user_id, visibility, moderation_status FROM stories WHERE id = ?${suffix}`, [entryId])
  if (stories.length) {
    if (!await canViewEntry(connection, stories[0].user_id, userId, stories[0].visibility, stories[0].moderation_status)) throw missingEntry()
    return { table: 'stories', target: 'story_id', ownerId: stories[0].user_id }
  }
  throw missingEntry()
}

async function toggleLike(userId, entryId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const entry = await findEntry(connection, entryId, userId, true)
    const [existing] = await connection.query(
      `SELECT id FROM reactions WHERE user_id = ? AND ${entry.target} = ? AND type = 'like' LIMIT 1`,
      [userId, entryId],
    )

    if (existing.length) {
      await connection.query('DELETE FROM reactions WHERE id = ?', [existing[0].id])
    } else {
      await connection.query(
        `INSERT INTO reactions (id, user_id, ${entry.target}, type) VALUES (?, ?, ?, 'like')`,
        [randomUUID(), userId, entryId],
      )
      if (entry.ownerId !== userId) {
        const [users] = await connection.query('SELECT name FROM users WHERE id = ? LIMIT 1', [userId])
        const actorName = users[0]?.name || 'Alguien'
        const contentName = entry.table === 'stories' ? 'tu historia' : 'tu publicación'
        await notificationsService.createForUser(
          entry.ownerId,
          'like',
          'Nuevo me gusta',
          `${actorName} indicó que le gusta ${contentName}.`,
          connection,
        )
      }
    }

    const [counts] = await connection.query(
      `SELECT COUNT(*) AS likes FROM reactions WHERE ${entry.target} = ? AND type = 'like'`,
      [entryId],
    )
    if (entry.table === 'posts') {
      await connection.query('UPDATE posts SET likes_count = ? WHERE id = ?', [counts[0].likes, entryId])
    }
    await connection.commit()
    return { liked: !existing.length, likes: Number(counts[0].likes) }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function getComments(entryId, userId) {
  const entry = await findEntry(pool, entryId, userId)
  const [rows] = await pool.query(
    `SELECT c.id, c.text, c.created_at, u.name, u.username, u.avatar_url,
      (SELECT COUNT(*) FROM comment_reactions cr WHERE cr.comment_id = c.id AND cr.type = 'like') AS likes,
      EXISTS(SELECT 1 FROM comment_reactions cr WHERE cr.comment_id = c.id AND cr.user_id = ? AND cr.type = 'like') AS liked
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.${entry.target} = ?
    ORDER BY likes DESC, c.created_at DESC`,
    [userId, entryId],
  )
  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    createdAt: new Date(row.created_at).toISOString(),
    likes: Number(row.likes),
    liked: Boolean(row.liked),
    author: {
      name: row.name,
      handle: row.username ? `@${row.username.replace(/^@/, '')}` : '',
      avatar: row.avatar_url || defaultAvatarUrl,
    },
  }))
}

async function addComment(userId, entryId, text) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const entry = await findEntry(connection, entryId, userId, true)
    const commentId = randomUUID()
    await connection.query(
      `INSERT INTO comments (id, user_id, ${entry.target}, text) VALUES (?, ?, ?, ?)`,
      [commentId, userId, entryId, text],
    )
    if (entry.ownerId !== userId) {
      const [users] = await connection.query('SELECT name FROM users WHERE id = ? LIMIT 1', [userId])
      const actorName = users[0]?.name || 'Alguien'
      const contentName = entry.table === 'stories' ? 'tu historia' : 'tu publicación'
      await notificationsService.createForUser(
        entry.ownerId,
        'comment',
        'Comentario nuevo',
        `${actorName} comentó ${contentName}: “${text.slice(0, 140)}${text.length > 140 ? '…' : ''}”`,
        connection,
      )
    }
    if (entry.table === 'posts') {
      await connection.query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?', [entryId])
    }
    await connection.commit()
    const comments = await getComments(entryId, userId)
    return comments.find((comment) => comment.id === commentId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function toggleCommentLike(userId, entryId, commentId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const entry = await findEntry(connection, entryId, userId, true)
    const [comments] = await connection.query(
      `SELECT id, user_id FROM comments WHERE id = ? AND ${entry.target} = ? FOR UPDATE`,
      [commentId, entryId],
    )
    if (!comments.length) {
      const error = new Error('No encontramos ese comentario en este contenido.')
      error.statusCode = 404
      throw error
    }

    const [existing] = await connection.query(
      "SELECT id FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND type = 'like' LIMIT 1",
      [commentId, userId],
    )
    if (existing.length) {
      await connection.query('DELETE FROM comment_reactions WHERE id = ?', [existing[0].id])
    } else {
      await connection.query(
        "INSERT INTO comment_reactions (id, comment_id, user_id, type) VALUES (?, ?, ?, 'like')",
        [randomUUID(), commentId, userId],
      )
      if (comments[0].user_id !== userId) {
        const [users] = await connection.query('SELECT name FROM users WHERE id = ? LIMIT 1', [userId])
        await notificationsService.createForUser(
          comments[0].user_id,
          'like',
          'Me gusta en tu comentario',
          `${users[0]?.name || 'Alguien'} indicó que le gusta tu comentario.`,
          connection,
        )
      }
    }

    const [counts] = await connection.query(
      "SELECT COUNT(*) AS likes FROM comment_reactions WHERE comment_id = ? AND type = 'like'",
      [commentId],
    )
    await connection.commit()
    return { liked: !existing.length, likes: Number(counts[0].likes) }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function createEntry(table, userId, values) {
  const id = randomUUID()
  const columns = table === 'posts'
    ? ['id', 'user_id', 'caption', 'visibility', 'moderation_status']
    : ['id', 'user_id', 'title', 'caption', 'image_url', 'media_type', 'visibility', 'moderation_status']
  const rowValues = table === 'posts'
    ? [id, userId, values.caption, values.visibility, values.visibility === 'public' ? 'pending' : 'approved']
    : [id, userId, values.title, values.caption, values.imageUrl || null, values.mediaType || null, values.visibility, values.visibility === 'public' ? 'pending' : 'approved']
  await pool.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    rowValues,
  )
  const entries = await getFeed(userId)
  return entries.find((entry) => entry.id === id)
}

async function createPost(userId, values) {
  return createEntry('posts', userId, values)
}

async function createStory(userId, values) {
  const connection = await pool.getConnection()
  const media = values.media || []
  try {
    await connection.beginTransaction()
    const id = randomUUID()
    const firstMedia = media[0]
    if (media.length) {
      const [uploadedMedia] = await connection.query(
        `SELECT id, media_type FROM story_media WHERE user_id = ? AND story_id IS NULL AND id IN (${media.map(() => '?').join(', ')}) FOR UPDATE`,
        [userId, ...media.map((item) => item.id)],
      )
      if (uploadedMedia.length !== media.length || media.some((item) => !uploadedMedia.some((uploaded) => uploaded.id === item.id && uploaded.media_type === item.type))) {
        const error = new Error('Uno o más archivos no están disponibles para esta historia.')
        error.statusCode = 400
        throw error
      }
    }
    await connection.query(
      'INSERT INTO stories (id, user_id, title, caption, image_url, media_type, visibility, moderation_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, values.title, values.caption, firstMedia ? `/api/media/${firstMedia.id}` : values.imageUrl || null, firstMedia?.type || values.mediaType || null, values.visibility, values.visibility === 'public' ? 'pending' : 'approved'],
    )
    for (const [position, item] of media.entries()) {
      await connection.query('UPDATE story_media SET story_id = ?, position = ? WHERE id = ? AND user_id = ? AND story_id IS NULL', [id, position, item.id, userId])
    }
    await connection.commit()
    const entries = await getFeed(userId)
    return entries.find((entry) => entry.id === id)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function updateStory(userId, storyId, values) {
  const connection = await pool.getConnection()
  const media = values.media || []
  let removedFilenames = []
  try {
    await connection.beginTransaction()
    const [stories] = await connection.query(
      'SELECT id, media_type FROM stories WHERE id = ? AND user_id = ? FOR UPDATE',
      [storyId, userId],
    )
    if (!stories.length) throw missingEntry()

    const [currentMedia] = await connection.query(
      'SELECT id, filename FROM story_media WHERE story_id = ? AND user_id = ? FOR UPDATE',
      [storyId, userId],
    )
    let availableMedia = []
    if (media.length) {
      const [rows] = await connection.query(
        `SELECT id, media_type, story_id FROM story_media
        WHERE user_id = ? AND (story_id = ? OR story_id IS NULL) AND id IN (${media.map(() => '?').join(', ')}) FOR UPDATE`,
        [userId, storyId, ...media.map((item) => item.id)],
      )
      availableMedia = rows
      if (availableMedia.length !== media.length || media.some((item) => !availableMedia.some((row) => row.id === item.id && row.media_type === item.type))) {
        const error = new Error('Uno o más archivos no están disponibles para esta historia.')
        error.statusCode = 400
        throw error
      }
    }

    const retainedIds = new Set(media.map((item) => item.id))
    const removedMedia = currentMedia.filter((item) => !retainedIds.has(item.id))
    if (removedMedia.length) {
      removedFilenames = removedMedia.map((item) => item.filename)
      await connection.query(
        `DELETE FROM story_media WHERE story_id = ? AND id IN (${removedMedia.map(() => '?').join(', ')})`,
        [storyId, ...removedMedia.map((item) => item.id)],
      )
    }

    for (const [position, item] of media.entries()) {
      await connection.query(
        'UPDATE story_media SET story_id = ?, position = ? WHERE id = ? AND user_id = ? AND (story_id IS NULL OR story_id = ?)',
        [storyId, position, item.id, userId, storyId],
      )
    }

    const firstMedia = media[0]
    const imageUrl = values.imageUrl || (firstMedia ? `/api/media/${firstMedia.id}` : null)
    const mediaType = values.imageUrl ? values.mediaType || stories[0].media_type : firstMedia?.type || null
    await connection.query(
      "UPDATE stories SET title = ?, caption = ?, image_url = ?, media_type = ?, visibility = ?, moderation_status = ?, moderation_note = NULL WHERE id = ? AND user_id = ?",
      [values.title, values.caption, imageUrl, mediaType, values.visibility, values.visibility === 'public' ? 'pending' : 'approved', storyId, userId],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  await Promise.all(removedFilenames.map((filename) => fs.promises.unlink(path.join(uploadDirectory, filename)).catch(() => {})))
  const entries = await getFeed(userId)
  return entries.find((entry) => entry.id === storyId)
}

async function deleteStory(userId, storyId) {
  const connection = await pool.getConnection()
  let filenames = []
  try {
    await connection.beginTransaction()
    const [stories] = await connection.query(
      'SELECT id FROM stories WHERE id = ? AND user_id = ? FOR UPDATE',
      [storyId, userId],
    )
    if (!stories.length) throw missingEntry()

    const [media] = await connection.query(
      'SELECT filename FROM story_media WHERE story_id = ? AND user_id = ? FOR UPDATE',
      [storyId, userId],
    )
    filenames = media.map((item) => item.filename)
    await connection.query('DELETE FROM stories WHERE id = ? AND user_id = ?', [storyId, userId])
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  await Promise.all(filenames.map((filename) => fs.promises.unlink(path.join(uploadDirectory, filename)).catch(() => {})))
}

module.exports = { getFeed, getPublicStories, toggleLike, getComments, addComment, toggleCommentLike, createPost, createStory, updateStory, deleteStory }
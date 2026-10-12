const { randomUUID } = require('crypto')
const pool = require('../../config/db')

function formatNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    createdAt: new Date(row.created_at).toISOString(),
    read: Boolean(row.read_flag),
  }
}

async function listForUser(userId) {
  const [rows] = await pool.query(
    `SELECT id, type, title, description, read_flag, created_at
    FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    [userId],
  )
  return rows.map(formatNotification)
}

async function markAllRead(userId) {
  await pool.query('UPDATE notifications SET read_flag = TRUE WHERE user_id = ? AND read_flag = FALSE', [userId])
}

async function createForUser(userId, type, title, description, connection = pool) {
  if (!userId) return
  await connection.query(
    'INSERT INTO notifications (id, user_id, type, title, description, read_flag) VALUES (?, ?, ?, ?, ?, FALSE)',
    [randomUUID(), userId, type, title, description],
  )
}

module.exports = { listForUser, markAllRead, createForUser }
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

async function createForUser(userId, type, title, description, connection = pool, dedupeKey = null) {
  if (!userId) return
  await connection.query(
    `INSERT INTO notifications (id, user_id, type, title, description, read_flag, dedupe_key)
     VALUES (?, ?, ?, ?, ?, FALSE, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [randomUUID(), userId, type, title, description, dedupeKey],
  )
}

async function createDueCareReminders() {
  const [rows] = await pool.query(
    `SELECT DISTINCT care_schedules.id AS schedule_id, care_schedules.name AS schedule_name,
      care_schedules.next_at, animals.id AS animal_id, animals.name AS animal_name,
      recipients.user_id
     FROM care_schedules
     JOIN animals ON animals.id = care_schedules.animal_id
     JOIN (
       SELECT animal_custody.animal_id, animal_custody.user_id
       FROM animal_custody
       WHERE animal_custody.ended_at IS NULL
       UNION
       SELECT access_grants.animal_id, users.id AS user_id
       FROM access_grants
       JOIN users ON LOWER(users.email) = LOWER(access_grants.recipient_email)
       WHERE access_grants.revoked_at IS NULL
         AND (access_grants.expires_at IS NULL OR access_grants.expires_at > UTC_TIMESTAMP())
         AND access_grants.password_hash IS NULL
         AND JSON_CONTAINS(access_grants.permissions, JSON_QUOTE('care:manage'))
     ) recipients ON recipients.animal_id = animals.id
     WHERE care_schedules.active = TRUE AND care_schedules.next_at <= UTC_TIMESTAMP()
     ORDER BY care_schedules.next_at ASC LIMIT 500`,
  )
  for (const row of rows) {
    const dueAt = row.next_at instanceof Date ? row.next_at.toISOString() : new Date(`${String(row.next_at).replace(' ', 'T')}Z`).toISOString()
    await createForUser(
      row.user_id,
      'care',
      'Recordatorio de cuidado',
      `${row.schedule_name} · ${row.animal_name || 'Animal'} requiere atención.`,
      pool,
      `care:${row.schedule_id}:${dueAt}:${row.user_id}`,
    )
  }
  return rows.length
}

module.exports = { listForUser, markAllRead, createForUser, createDueCareReminders }
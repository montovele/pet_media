const { randomUUID } = require('crypto')
const bcrypt = require('bcryptjs')
const pool = require('../../config/db')
const { requireAnimalAccess } = require('./animals.access')
const notificationsService = require('../notifications/notifications.service')

function notFound(message) {
  const error = new Error(message)
  error.statusCode = 404
  return error
}

function asUtcIso(value) {
  if (value instanceof Date) return value.toISOString()
  const normalized = String(value).replace(' ', 'T')
  return new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`).toISOString()
}

async function requireCustodyManager(user, animalId, executor = pool) {
  const [rows] = await executor.query(
    `SELECT animals.id FROM animals
     WHERE animals.id = ? AND (animals.created_by = ? OR EXISTS (
       SELECT 1 FROM animal_custody
       WHERE animal_custody.animal_id = animals.id AND animal_custody.user_id = ?
         AND animal_custody.role = 'caregiver' AND animal_custody.ended_at IS NULL
     )) LIMIT 1`,
    [animalId, user.id, user.id],
  )
  if (!rows.length) {
    const error = new Error('Solo la persona responsable actual puede realizar esta acción.')
    error.statusCode = 403
    throw error
  }
}

function formatHealth(row) {
  return {
    id: row.id,
    animalId: row.animal_id,
    type: row.record_type,
    description: row.description,
    date: row.record_date,
    details: row.details
      ? typeof row.details === 'string' ? JSON.parse(row.details) : row.details
      : {},
    source: row.source,
    professionalName: row.professional_name,
    certified: Boolean(row.certified),
  }
}

async function listHealthRecords(user, animalId) {
  await requireAnimalAccess(user, animalId, 'health:read')
  const [rows] = await pool.query(
    `SELECT id, animal_id, record_type, description, details,
      DATE_FORMAT(record_date, '%Y-%m-%d') AS record_date,
      source, professional_name, certified
     FROM health_records WHERE animal_id = ? ORDER BY record_date DESC, created_at DESC`,
    [animalId],
  )
  return rows.map(formatHealth)
}

async function createHealthRecord(user, animalId, values) {
  await requireAnimalAccess(user, animalId, 'health:manage')
  const id = randomUUID()
  await pool.query(
    `INSERT INTO health_records (id, animal_id, created_by, record_type, description, record_date, details, source, certified)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'caregiver', FALSE)`,
    [id, animalId, user.id, values.type, values.description, values.date, JSON.stringify(values.details || {})],
  )
  await pool.query(
    'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), user.id, 'health_record.created', 'health_record', id],
  )
  return (await listHealthRecords(user, animalId)).find((row) => row.id === id)
}

function formatSchedule(row) {
  return {
    id: row.id,
    animalId: row.animal_id,
    name: row.name,
    dose: row.dose,
    frequency: row.frequency,
    intervalValue: Number(row.interval_value),
    intervalUnit: row.interval_unit,
    nextAt: asUtcIso(row.next_at),
    timeZone: row.time_zone,
    active: Boolean(row.active),
  }
}

async function listCareSchedules(user, animalId) {
  await requireAnimalAccess(user, animalId, 'care:read')
  const [rows] = await pool.query(
    `SELECT id, animal_id, name, dose, frequency, interval_value, interval_unit, next_at, time_zone, active
     FROM care_schedules WHERE animal_id = ? ORDER BY active DESC, next_at`,
    [animalId],
  )
  const [logs] = await pool.query(
    `SELECT care_logs.id, care_logs.schedule_id, care_logs.result, care_logs.administered_at,
      users.name AS user_name
     FROM care_logs JOIN users ON users.id = care_logs.user_id
     WHERE care_logs.animal_id = ? ORDER BY care_logs.administered_at DESC LIMIT 200`,
    [animalId],
  )
  const logsBySchedule = new Map()
  for (const row of logs) {
    const scheduleLogs = logsBySchedule.get(row.schedule_id) || []
    scheduleLogs.push({
      id: row.id,
      result: row.result,
      administeredAt: asUtcIso(row.administered_at),
      userName: row.user_name,
    })
    logsBySchedule.set(row.schedule_id, scheduleLogs)
  }
  return rows.map((row) => ({
    ...formatSchedule(row),
    logs: logsBySchedule.get(row.id) || [],
  }))
}

async function createCareSchedule(user, animalId, values) {
  await requireAnimalAccess(user, animalId, 'care:manage')
  const id = randomUUID()
  await pool.query(
    `INSERT INTO care_schedules
      (id, animal_id, created_by, name, dose, frequency, interval_value, interval_unit, next_at, time_zone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, animalId, user.id, values.name, values.dose, values.frequency,
      values.intervalValue, values.intervalUnit,
      new Date(values.nextAt).toISOString().slice(0, 19).replace('T', ' '), values.timeZone,
    ],
  )
  await pool.query(
    'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), user.id, 'care_schedule.created', 'care_schedule', id],
  )
  return (await listCareSchedules(user, animalId)).find((row) => row.id === id)
}

function getNextOccurrence(scheduledAt, frequency, intervalValue, intervalUnit, now) {
  const nextAt = new Date(scheduledAt)
  if (frequency === 'Una vez') return null

  const intervalMs = {
    'Cada 12 horas': 12 * 60 * 60 * 1000,
    Diaria: 24 * 60 * 60 * 1000,
    Semanal: 7 * 24 * 60 * 60 * 1000,
    Personalizada: ({ hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000, weeks: 7 * 24 * 60 * 60 * 1000 })[intervalUnit] * intervalValue,
  }[frequency]
  if (intervalMs) {
    const overdueIntervals = Math.max(0, Math.floor((now - nextAt) / intervalMs) + 1)
    nextAt.setTime(nextAt.getTime() + overdueIntervals * intervalMs)
    return nextAt
  }

  const monthDifference = (now.getUTCFullYear() - nextAt.getUTCFullYear()) * 12
    + now.getUTCMonth() - nextAt.getUTCMonth()
  const targetMonth = nextAt.getUTCMonth() + Math.max(1, monthDifference)
  const day = nextAt.getUTCDate()
  nextAt.setUTCDate(1)
  nextAt.setUTCMonth(targetMonth)
  const lastDay = new Date(Date.UTC(nextAt.getUTCFullYear(), nextAt.getUTCMonth() + 1, 0)).getUTCDate()
  nextAt.setUTCDate(Math.min(day, lastDay))
  if (nextAt <= now) {
    const followingMonth = nextAt.getUTCMonth() + 1
    nextAt.setUTCDate(1)
    nextAt.setUTCMonth(followingMonth)
    const followingLastDay = new Date(Date.UTC(nextAt.getUTCFullYear(), nextAt.getUTCMonth() + 1, 0)).getUTCDate()
    nextAt.setUTCDate(Math.min(day, followingLastDay))
  }
  return nextAt
}

async function logCareDose(user, scheduleId, result = 'administered') {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.query(
      'SELECT id, animal_id, next_at, frequency, interval_value, interval_unit FROM care_schedules WHERE id = ? AND active = TRUE LIMIT 1 FOR UPDATE',
      [scheduleId],
    )
    if (!rows.length) throw notFound('No se encontró el cuidado activo.')
    const schedule = rows[0]
    await requireAnimalAccess(user, schedule.animal_id, 'care:manage', connection)
    await connection.query(
      'INSERT INTO care_logs (id, schedule_id, animal_id, user_id, result) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), scheduleId, schedule.animal_id, user.id, result],
    )
    const nextAt = getNextOccurrence(
      new Date(asUtcIso(schedule.next_at)),
      schedule.frequency,
      Number(schedule.interval_value),
      schedule.interval_unit,
      new Date(),
    )
    await connection.query(
      'UPDATE care_schedules SET next_at = COALESCE(?, next_at), active = ? WHERE id = ?',
      [nextAt ? nextAt.toISOString().slice(0, 19).replace('T', ' ') : null, nextAt !== null, scheduleId],
    )
    await connection.query(
      'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), user.id, 'care_dose.logged', 'care_schedule', scheduleId],
    )
    await connection.commit()
    return { scheduleId, result, administeredAt: new Date().toISOString(), nextAt: nextAt?.toISOString() ?? null }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function createLostFoundReport(user, values) {
  if (values.animalId) {
    if (!user) {
      const error = new Error('Inicia sesión para vincular un animal a este reporte.')
      error.statusCode = 401
      throw error
    }
    await requireAnimalAccess(user, values.animalId, 'animal:read')
  }
  const id = randomUUID()
  await pool.query(
    `INSERT INTO lost_found_reports
      (id, animal_id, user_id, report_type, species, report_date, location_approximate, description, contact_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, values.animalId, user?.id ?? null, values.type, values.species, values.date, values.location, values.description, values.contactMethod],
  )
  if (user) {
    await pool.query(
      'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), user.id, 'lost_found_report.created', 'lost_found_report', id],
    )
  }
  return { id, status: 'open' }
}

async function listMyLostFoundReports(user) {
  const [rows] = await pool.query(
    `SELECT id, report_type, species, report_date, location_approximate, description, contact_method, status, created_at
     FROM lost_found_reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    [user.id],
  )
  return rows.map((row) => ({
    id: row.id,
    type: row.report_type,
    species: row.species,
    date: row.report_date,
    location: row.location_approximate,
    description: row.description,
    contactMethod: row.contact_method,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

async function updateLostFoundReportStatus(user, reportId, status) {
  const [reports] = await pool.query(
    'SELECT id FROM lost_found_reports WHERE id = ? AND user_id = ? LIMIT 1',
    [reportId, user.id],
  )
  if (!reports.length) throw notFound('No se encontró un reporte propio para actualizar.')
  await pool.query(
    'UPDATE lost_found_reports SET status = ? WHERE id = ? AND user_id = ?',
    [status, reportId, user.id],
  )
  await pool.query(
    'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, changes) VALUES (?, ?, ?, ?, ?, ?)',
    [randomUUID(), user.id, 'lost_found_report.status_updated', 'lost_found_report', reportId, JSON.stringify({ status })],
  )
  return { id: reportId, status }
}

async function createLostFoundContactMessage(user, reportId, message, threadId = null) {
  let recipientUserId
  let conversationId = threadId
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    let report
    if (threadId) {
      const [messages] = await connection.query(
        `SELECT messages.sender_user_id, messages.recipient_user_id,
          reports.id AS report_id, reports.species
         FROM lost_found_messages messages
         JOIN lost_found_reports reports ON reports.id = messages.report_id
         WHERE messages.thread_id = ? AND messages.report_id = ? AND reports.status = 'open'
         ORDER BY messages.created_at DESC LIMIT 1 FOR UPDATE`,
        [threadId, reportId],
      )
      const previous = messages[0]
      if (!previous || ![previous.sender_user_id, previous.recipient_user_id].includes(user.id)) {
        throw notFound('La conversación no está disponible.')
      }
      report = previous
      recipientUserId = previous.sender_user_id === user.id
        ? previous.recipient_user_id
        : previous.sender_user_id
    } else {
      const [reports] = await connection.query(
        `SELECT id AS report_id, user_id, species FROM lost_found_reports
         WHERE id = ? AND user_id IS NOT NULL AND user_id <> ? AND status = 'open'
         LIMIT 1 FOR UPDATE`,
        [reportId, user.id],
      )
      if (!reports.length) throw notFound('El reporte no está disponible para recibir mensajes.')
      report = reports[0]
      recipientUserId = reports[0].user_id
      conversationId = randomUUID()
    }
    const id = randomUUID()
    await connection.query(
      `INSERT INTO lost_found_messages
        (id, report_id, sender_user_id, recipient_user_id, thread_id, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, reportId, user.id, recipientUserId, conversationId, message],
    )
    await connection.query(
      'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), user.id, 'lost_found_contact.created', 'lost_found_report', reportId],
    )
    await notificationsService.createForUser(
      recipientUserId,
      'lost_found',
      'Nuevo mensaje sobre un reporte',
      `Recibiste un mensaje privado sobre un reporte de ${report.species}.`,
      connection,
    )
    await connection.commit()
    return { id, threadId: conversationId, createdAt: new Date().toISOString() }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function listMyLostFoundMessages(user) {
  const [rows] = await pool.query(
    `SELECT lost_found_messages.id, lost_found_messages.report_id, lost_found_messages.message,
      lost_found_messages.thread_id, lost_found_messages.created_at,
      sender.name AS sender_name, recipient.name AS recipient_name,
      lost_found_messages.sender_user_id = ? AS is_outgoing,
      lost_found_reports.report_type, lost_found_reports.species
     FROM lost_found_messages
     JOIN lost_found_reports ON lost_found_reports.id = lost_found_messages.report_id
     JOIN users sender ON sender.id = lost_found_messages.sender_user_id
     JOIN users recipient ON recipient.id = lost_found_messages.recipient_user_id
     WHERE lost_found_messages.sender_user_id = ? OR lost_found_messages.recipient_user_id = ?
     ORDER BY lost_found_messages.created_at DESC LIMIT 100`,
    [user.id, user.id, user.id],
  )
  return rows.map((row) => ({
    id: row.id,
    reportId: row.report_id,
    threadId: row.thread_id,
    message: row.message,
    senderName: row.sender_name,
    recipientName: row.recipient_name,
    isOutgoing: Boolean(row.is_outgoing),
    reportType: row.report_type,
    species: row.species,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

async function listPublicLostFoundReports() {
  const [rows] = await pool.query(
    `SELECT id, report_type, species, report_date, location_approximate, description, created_at,
      user_id IS NOT NULL AS contact_available
     FROM lost_found_reports WHERE status = 'open' ORDER BY created_at DESC LIMIT 100`,
  )
  return rows.map((row) => ({
    id: row.id,
    type: row.report_type,
    species: row.species,
    date: row.report_date,
    location: row.location_approximate,
    description: row.description,
    contactAvailable: Boolean(row.contact_available),
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

async function listAccessGrants(user, animalId) {
  const isSuperadmin = user.role === 'superadmin'
  if (isSuperadmin) await requireAnimalAccess(user, animalId, 'animal:read')
  else await requireCustodyManager(user, animalId)
  const [rows] = await pool.query(
    `SELECT id, animal_id, animal_ids, all_animals, recipient_email, password_hash, role, permissions, expires_at, revoked_at
     FROM access_grants
     WHERE (? = TRUE OR created_by = ?)
       AND (animal_id = ? OR all_animals = TRUE
         OR (animal_ids IS NOT NULL AND JSON_CONTAINS(animal_ids, JSON_QUOTE(?))))
     ORDER BY created_at DESC`,
    [isSuperadmin, user.id, animalId, animalId],
  )
  return rows.map((row) => ({
    id: row.id,
    animalId: row.animal_id,
    animalIds: row.animal_ids ? (Array.isArray(row.animal_ids) ? row.animal_ids : JSON.parse(row.animal_ids)) : [row.animal_id],
    allAnimals: Boolean(row.all_animals),
    recipient: row.recipient_email,
    passwordProtected: Boolean(row.password_hash),
    role: row.role,
    permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
    expiresAt: row.expires_at ? asUtcIso(row.expires_at) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
  }))
}

async function createAccessGrant(user, animalId, values) {
  await requireCustodyManager(user, animalId)
  const animalIds = values.allAnimals
    ? []
    : [...new Set(values.animalIds?.length ? values.animalIds : [animalId])]
  for (const scopedAnimalId of animalIds) await requireCustodyManager(user, scopedAnimalId)
  const id = randomUUID()
  const permissions = [...new Set(['animal:read', ...values.permissions])]
  const passwordHash = await bcrypt.hash(values.password, 12)
  await pool.query(
    `INSERT INTO access_grants (id, animal_id, animal_ids, all_animals, created_by, recipient_email, password_hash, role, permissions, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, animalId, JSON.stringify(animalIds), Boolean(values.allAnimals), user.id,
      values.recipient.trim().toLowerCase(), passwordHash, values.role,
      JSON.stringify(permissions), values.expiresAt ? `${values.expiresAt} 23:59:59` : null,
    ],
  )
  await pool.query(
    'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), user.id, 'access_grant.created', 'access_grant', id],
  )
  return (await listAccessGrants(user, animalId)).find((row) => row.id === id)
}

async function updateAccessGrant(user, grantId, values) {
  const [rows] = await pool.query(
    'SELECT id, animal_id, animal_ids, all_animals, role, permissions, expires_at FROM access_grants WHERE id = ? LIMIT 1',
    [grantId],
  )
  if (!rows.length) throw notFound('No se encontró el acceso compartido.')
  const current = rows[0]
  await requireCustodyManager(user, current.animal_id)

  const allAnimals = values.allAnimals ?? Boolean(current.all_animals)
  const animalIds = allAnimals ? [] : values.animalIds
    ? [...new Set(values.animalIds)]
    : current.animal_ids
      ? (Array.isArray(current.animal_ids) ? current.animal_ids : JSON.parse(current.animal_ids))
      : [current.animal_id]
  if (!allAnimals) {
    if (!animalIds.length) {
      const error = new Error('Selecciona al menos un animal o elige todos tus animales.')
      error.statusCode = 400
      throw error
    }
    for (const animalId of animalIds) await requireCustodyManager(user, animalId)
  }
  const permissions = values.permissions
    ? [...new Set(['animal:read', ...values.permissions])]
    : (Array.isArray(current.permissions) ? current.permissions : JSON.parse(current.permissions))
  const expiresAt = values.expiresAt === undefined
    ? current.expires_at
    : values.expiresAt ? `${values.expiresAt} 23:59:59` : null
  const role = values.role ?? current.role
  const passwordHash = values.password ? await bcrypt.hash(values.password, 12) : null
  await pool.query(
    `UPDATE access_grants
     SET animal_ids = ?, all_animals = ?, permissions = ?, expires_at = ?, role = ?,
       password_hash = COALESCE(?, password_hash)
     WHERE id = ?`,
    [JSON.stringify(animalIds), allAnimals, JSON.stringify(permissions), expiresAt, role, passwordHash, grantId],
  )
  await pool.query(
    'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, changes) VALUES (?, ?, ?, ?, ?, ?)',
    [
      randomUUID(), user.id, 'access_grant.updated', 'access_grant', grantId,
      JSON.stringify({ animalIds, allAnimals, permissions, expiresAt, role, passwordChanged: Boolean(passwordHash) }),
    ],
  )
  return (await listAccessGrants(user, current.animal_id)).find((grant) => grant.id === grantId)
}

async function unlockAccessGrant(user, grantId, password) {
  const [rows] = await pool.query(
    `SELECT password_hash FROM access_grants
     WHERE id = ? AND LOWER(recipient_email) = LOWER(?)
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
     LIMIT 1`,
    [grantId, user.email],
  )
  if (!rows.length || !rows[0].password_hash || !(await bcrypt.compare(password, rows[0].password_hash))) {
    const error = new Error('La contraseña del acceso no es válida o el permiso ya no está disponible.')
    error.statusCode = 403
    throw error
  }
  return { grantId }
}

async function loginAccessGrant(grantId, email, password) {
  const [rows] = await pool.query(
    `SELECT id, animal_id, animal_ids, all_animals, recipient_email, password_hash, role, permissions, expires_at
     FROM access_grants
     WHERE id = ? AND LOWER(recipient_email) = LOWER(?)
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
     LIMIT 1`,
    [grantId, email.trim().toLowerCase()],
  )
  if (!rows.length || !rows[0].password_hash || !(await bcrypt.compare(password, rows[0].password_hash))) {
    const error = new Error('El correo o la contraseña temporal no corresponden a este acceso, o el permiso ya no está disponible.')
    error.statusCode = 401
    throw error
  }
  return formatAccessGrantLogin(rows[0])
}

function formatAccessGrantLogin(row) {
  return {
    grantId: row.id,
    animalId: row.animal_id,
    animalIds: row.animal_ids ? (Array.isArray(row.animal_ids) ? row.animal_ids : JSON.parse(row.animal_ids)) : [row.animal_id],
    allAnimals: Boolean(row.all_animals),
    email: row.recipient_email,
    role: row.role,
    permissions: Array.isArray(row.permissions) ? row.permissions : JSON.parse(row.permissions),
    expiresAt: row.expires_at ? asUtcIso(row.expires_at) : null,
  }
}

async function revokeAccessGrant(user, grantId) {
  const [rows] = await pool.query('SELECT id, animal_id FROM access_grants WHERE id = ? LIMIT 1', [grantId])
  if (!rows.length) throw notFound('No se encontró el acceso compartido.')
  await requireCustodyManager(user, rows[0].animal_id)
  await pool.query(
    'UPDATE access_grants SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL',
    [grantId],
  )
  await pool.query(
    'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), user.id, 'access_grant.revoked', 'access_grant', grantId],
  )
}

async function getPublicBioActa(publicId) {
  const [rows] = await pool.query(
    `SELECT id, public_id, name, species, sex, estimated_age, physical_description
     FROM animals WHERE public_id = ? AND public_enabled = TRUE LIMIT 1`,
    [publicId],
  )
  if (!rows.length) throw notFound('Bio-Acta pública no encontrada.')
  const animal = rows[0]
  const [photos] = await pool.query(
    'SELECT id, alt_text FROM animal_photos WHERE animal_id = ? ORDER BY created_at DESC',
    [animal.id],
  )
  const [health] = await pool.query(
    `SELECT record_type, record_date FROM health_records
     WHERE animal_id = ? AND certified = TRUE ORDER BY record_date DESC LIMIT 5`,
    [animal.id],
  )
  return {
    publicId: animal.public_id,
    name: animal.name,
    species: animal.species,
    sex: animal.sex,
    estimatedAge: animal.estimated_age,
    physicalDescription: animal.physical_description,
    photos: photos.map((photo) => ({
      url: `/api/animals/public/photos/${photo.id}`,
      alt: photo.alt_text || '',
    })),
    publicHealthSummary: health.map((record) => `${record.record_type} · ${record.record_date}`).join('\n') || null,
  }
}

async function getPublicPhoto(photoId) {
  const [rows] = await pool.query(
    `SELECT photos.filename FROM animal_photos photos
     JOIN animals ON animals.id = photos.animal_id
     WHERE photos.id = ? AND animals.public_enabled = TRUE LIMIT 1`,
    [photoId],
  )
  if (!rows.length) throw notFound('Foto pública no encontrada.')
  return rows[0].filename
}

async function getPrivatePhoto(user, photoId) {
  const [rows] = await pool.query(
    'SELECT id, animal_id, filename FROM animal_photos WHERE id = ? LIMIT 1',
    [photoId],
  )
  if (!rows.length) throw notFound('Foto no encontrada.')
  await requireAnimalAccess(user, rows[0].animal_id, 'animal:read')
  return rows[0].filename
}

async function createPhoto(user, animalId, filename, altText) {
  await requireCustodyManager(user, animalId)
  const id = randomUUID()
  await pool.query(
    'INSERT INTO animal_photos (id, animal_id, created_by, filename, alt_text) VALUES (?, ?, ?, ?, ?)',
    [id, animalId, user.id, filename, altText || null],
  )
  await pool.query(
    'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), user.id, 'animal.photo.added', 'animal_photo', id],
  )
  return { id, url: `/api/animals/photos/${id}`, alt: altText || '' }
}

async function getProfessionalSummary(user) {
  const error = new Error('La verificación profesional aún no está habilitada en el servidor.')
  error.statusCode = 501
  throw error
}

async function listAuditLogs() {
  const [rows] = await pool.query(
    `SELECT audit_logs.id, audit_logs.actor_id, users.email AS actor,
      audit_logs.action, audit_logs.entity_type, audit_logs.entity_id, audit_logs.created_at
     FROM audit_logs LEFT JOIN users ON users.id = audit_logs.actor_id
     ORDER BY audit_logs.created_at DESC LIMIT 200`,
  )
  return rows.map((row) => ({
    id: row.id,
    actor: row.actor || 'Cuenta eliminada',
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

module.exports = {
  listHealthRecords,
  createHealthRecord,
  listCareSchedules,
  createCareSchedule,
  getNextOccurrence,
  logCareDose,
  createLostFoundReport,
  listPublicLostFoundReports,
  listMyLostFoundReports,
  updateLostFoundReportStatus,
  createLostFoundContactMessage,
  listMyLostFoundMessages,
  listAccessGrants,
  createAccessGrant,
  updateAccessGrant,
  unlockAccessGrant,
  loginAccessGrant,
  revokeAccessGrant,
  getPublicBioActa,
  getPublicPhoto,
  getPrivatePhoto,
  createPhoto,
  getProfessionalSummary,
  listAuditLogs,
}

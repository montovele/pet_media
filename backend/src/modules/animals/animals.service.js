const { randomBytes, randomUUID } = require('crypto')
const pool = require('../../config/db')
const { requireAnimalAccess } = require('./animals.access')

function formatAnimal(row, photos = [], includeCreator = false) {
  return {
    id: row.id,
    publicId: row.public_id,
    species: row.species,
    name: row.name,
    sex: row.sex,
    estimatedAge: row.estimated_age,
    physicalDescription: row.physical_description,
    identityStatus: row.identity_status,
    publicEnabled: Boolean(row.public_enabled),
    ...(includeCreator && row.creator_id ? { createdBy: { id: row.creator_id, name: row.creator_name, email: row.creator_email } } : {}),
    photos,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

function notFoundError() {
  const error = new Error('Registro animal no encontrado')
  error.statusCode = 404
  return error
}

async function getPhotos(animalId, executor = pool) {
  const [rows] = await executor.query(
    `SELECT id, alt_text, created_at FROM animal_photos
     WHERE animal_id = ? ORDER BY created_at DESC`,
    [animalId],
  )
  return rows.map((row) => ({
    id: row.id,
    url: `/api/animals/photos/${row.id}`,
    alt: row.alt_text || '',
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

async function getPhotosByAnimalIds(animalIds, executor = pool) {
  if (!animalIds.length) return new Map()

  const placeholders = animalIds.map(() => '?').join(', ')
  const [rows] = await executor.query(
    `SELECT id, animal_id, alt_text, created_at FROM animal_photos
     WHERE animal_id IN (${placeholders}) ORDER BY created_at DESC`,
    animalIds,
  )
  const photosByAnimalId = new Map(animalIds.map((animalId) => [animalId, []]))
  for (const row of rows) {
    photosByAnimalId.get(row.animal_id).push({
      id: row.id,
      url: `/api/animals/photos/${row.id}`,
      alt: row.alt_text || '',
      createdAt: new Date(row.created_at).toISOString(),
    })
  }
  return photosByAnimalId
}

async function listAnimals(user) {
  if (user.role === 'superadmin') {
    const [rows] = await pool.query(
      `SELECT animals.id, animals.public_id, animals.species, animals.name, animals.sex,
        animals.estimated_age, animals.physical_description, animals.identity_status,
        animals.public_enabled, animals.created_at, users.id AS creator_id,
        users.name AS creator_name, users.email AS creator_email
       FROM animals LEFT JOIN users ON users.id = animals.created_by
       ORDER BY animals.created_at DESC`,
    )
    const photosByAnimalId = await getPhotosByAnimalIds(rows.map((row) => row.id))
    return rows.map((row) => formatAnimal(row, photosByAnimalId.get(row.id), true))
  }

  const [rows] = await pool.query(
    `SELECT DISTINCT animals.id, animals.public_id, animals.species, animals.name, animals.sex,
      animals.estimated_age, animals.physical_description, animals.identity_status,
      animals.public_enabled, animals.created_at
    FROM animals
    LEFT JOIN animal_custody ON animal_custody.animal_id = animals.id
      AND animal_custody.user_id = ? AND animal_custody.ended_at IS NULL
    LEFT JOIN access_grants ON (
      (access_grants.animal_ids IS NULL AND access_grants.animal_id = animals.id)
      OR (
        access_grants.all_animals = TRUE
        AND (
          animals.created_by = access_grants.created_by
          OR EXISTS (
            SELECT 1 FROM animal_custody grant_custody
            WHERE grant_custody.animal_id = animals.id
              AND grant_custody.user_id = access_grants.created_by
              AND grant_custody.role = 'caregiver'
              AND grant_custody.ended_at IS NULL
          )
        )
      )
      OR (access_grants.animal_ids IS NOT NULL AND JSON_CONTAINS(access_grants.animal_ids, JSON_QUOTE(animals.id)))
    )
      AND access_grants.recipient_email = ? AND access_grants.revoked_at IS NULL
      AND (access_grants.expires_at IS NULL OR access_grants.expires_at > UTC_TIMESTAMP())
      AND (access_grants.password_hash IS NULL OR access_grants.id IN (?))
    WHERE animals.created_by = ? OR animal_custody.id IS NOT NULL OR access_grants.id IS NOT NULL
    ORDER BY animals.created_at DESC`,
    [user.id, user.email, user.accessGrantIds?.length ? user.accessGrantIds : [''], user.id],
  )
  const photosByAnimalId = await getPhotosByAnimalIds(rows.map((row) => row.id))
  return rows.map((row) => formatAnimal(row, photosByAnimalId.get(row.id)))
}

async function getAnimal(user, animalId) {
  const access = await requireAnimalAccess(user, animalId, 'animal:read')
  const [rows] = await pool.query(
    `SELECT animals.id, animals.public_id, animals.species, animals.name, animals.sex,
      animals.estimated_age, animals.physical_description, animals.identity_status,
      animals.public_enabled, animals.created_at, users.id AS creator_id,
      users.name AS creator_name, users.email AS creator_email
     FROM animals LEFT JOIN users ON users.id = animals.created_by
     WHERE animals.id = ? LIMIT 1`,
    [access.id],
  )
  if (!rows.length) throw notFoundError()
  return formatAnimal(rows[0], await getPhotos(animalId), user.role === 'superadmin')
}

async function findDuplicates(values) {
  const name = values.name?.trim()
  const physicalDescription = values.physicalDescription?.trim()
  const identifiers = values.identifiers || []
  if (!name && !physicalDescription && !identifiers.length) return { matches: [], possiblePrivateMatch: false }
  const identifierClause = identifiers.map(() => '(identifier_type = ? AND LOWER(TRIM(reference_value)) = LOWER(TRIM(?)))').join(' OR ')
  const identifierParams = identifiers.flatMap((identifier) => [identifier.type, identifier.reference])
  const identifierMatch = identifierClause
    ? `EXISTS (SELECT 1 FROM animal_identifiers identifiers
        WHERE identifiers.animal_id = animals.id AND (${identifierClause}))`
    : 'FALSE'
  const [rows] = await pool.query(
    `SELECT public_id, species, name, sex, estimated_age, physical_description
     FROM animals
     WHERE public_enabled = TRUE AND LOWER(TRIM(species)) = LOWER(TRIM(?))
       AND ((? IS NOT NULL AND LOWER(TRIM(name)) = LOWER(TRIM(?)))
         OR (? IS NOT NULL AND LOWER(TRIM(physical_description)) = LOWER(TRIM(?)))
         OR ${identifierMatch})
     ORDER BY created_at DESC LIMIT 10`,
    [values.species, name || null, name || null, physicalDescription || null, physicalDescription || null, ...identifierParams],
  )
  let possiblePrivateMatch = false
  if (identifiers.length) {
    const [privateRows] = await pool.query(
      `SELECT 1 FROM animals
       WHERE public_enabled = FALSE AND LOWER(TRIM(species)) = LOWER(TRIM(?)) AND ${identifierMatch}
       LIMIT 1`,
      [values.species, ...identifierParams],
    )
    possiblePrivateMatch = privateRows.length > 0
  }
  return {
    matches: rows.map((row) => ({
      publicId: row.public_id,
      species: row.species,
      name: row.name,
      sex: row.sex,
      estimatedAge: row.estimated_age,
      physicalDescription: row.physical_description,
    })),
    possiblePrivateMatch,
  }
}

async function createAnimal(userId, values) {
  const id = randomUUID()
  const publicId = randomBytes(32).toString('base64url')
  const identityStatus = values.provisional ? 'provisional' : 'registered'
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.query(
      `INSERT INTO animals (id, public_id, created_by, species, name, sex, estimated_age,
        physical_description, identity_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, publicId, userId, values.species, values.name ?? null, values.sex ?? null,
        values.estimatedAge ?? null, values.physicalDescription ?? null, identityStatus,
      ],
    )
    await connection.query(
      "INSERT INTO animal_custody (id, animal_id, user_id, role) VALUES (?, ?, ?, 'caregiver')",
      [randomUUID(), id, userId],
    )
    for (const identifier of values.identifiers || []) {
      await connection.query(
        `INSERT INTO animal_identifiers
          (id, animal_id, created_by, identifier_type, reference_value)
         VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), id, userId, identifier.type, identifier.reference],
      )
    }
    await connection.query(
      'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), userId, 'animal.created', 'animal', id],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  return getAnimal({ id: userId, email: '' }, id)
}

async function setPublicVisibility(user, animalId, enabled) {
  const [owners] = await pool.query(
    `SELECT animals.id FROM animals WHERE animals.id = ? AND
     (animals.created_by = ? OR EXISTS (
       SELECT 1 FROM animal_custody WHERE animal_custody.animal_id = animals.id
         AND animal_custody.user_id = ? AND animal_custody.role = 'caregiver'
         AND animal_custody.ended_at IS NULL
     )) LIMIT 1`,
    [animalId, user.id, user.id],
  )
  if (!owners.length) {
    const error = new Error('Solo la persona responsable actual puede cambiar la visibilidad pública.')
    error.statusCode = 403
    throw error
  }
  await pool.query(
    `UPDATE animals SET public_enabled = ?
     WHERE id = ? AND (created_by = ? OR EXISTS (
       SELECT 1 FROM animal_custody WHERE animal_id = animals.id AND user_id = ? AND role = 'caregiver' AND ended_at IS NULL
     ))`,
    [enabled, animalId, user.id, user.id],
  )
  await pool.query(
    'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, changes) VALUES (?, ?, ?, ?, ?, ?)',
    [randomUUID(), user.id, 'animal.visibility.updated', 'animal', animalId, JSON.stringify({ publicEnabled: enabled })],
  )
  return getAnimal(user, animalId)
}

async function createTransfer(user, animalId, recipientEmail) {
  const id = randomUUID()
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [animals] = await connection.query(
      `SELECT id FROM animals WHERE id = ? AND (created_by = ? OR EXISTS (
        SELECT 1 FROM animal_custody WHERE animal_id = animals.id AND user_id = ?
          AND role = 'caregiver' AND ended_at IS NULL
      )) LIMIT 1 FOR UPDATE`,
      [animalId, user.id, user.id],
    )
    if (!animals.length) {
      const error = new Error('Solo la persona responsable actual puede transferir la custodia.')
      error.statusCode = 403
      throw error
    }
    const [recipients] = await connection.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND is_active = TRUE LIMIT 1 FOR UPDATE',
      [recipientEmail],
    )
    if (recipients[0]?.id === user.id) {
      const error = new Error('No puedes transferir la custodia a tu propia cuenta.')
      error.statusCode = 400
      throw error
    }
    const [pending] = await connection.query(
      "SELECT id FROM custody_transfers WHERE animal_id = ? AND status = 'pending' LIMIT 1 FOR UPDATE",
      [animalId],
    )
    if (pending.length) {
      const error = new Error('Ya existe una transferencia pendiente para este animal.')
      error.statusCode = 409
      throw error
    }
    await connection.query(
      `INSERT INTO custody_transfers
        (id, animal_id, from_user_id, to_user_id, recipient_email)
       VALUES (?, ?, ?, ?, ?)`,
      [id, animalId, user.id, recipients[0]?.id ?? null, recipientEmail.toLowerCase()],
    )
    await connection.query(
      'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), user.id, 'custody.transfer.requested', 'animal', animalId],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  return { id, animalId, recipientEmail, status: 'pending' }
}

async function listTransfers(user) {
  const [rows] = await pool.query(
    `SELECT transfers.id, transfers.animal_id, transfers.status, transfers.created_at,
      animals.name AS animal_name, animals.species, users.email AS from_email
     FROM custody_transfers transfers
     JOIN animals ON animals.id = transfers.animal_id
     JOIN users ON users.id = transfers.from_user_id
     WHERE (transfers.to_user_id = ? OR (transfers.to_user_id IS NULL AND LOWER(transfers.recipient_email) = LOWER(?)))
       AND transfers.status = 'pending'
     ORDER BY transfers.created_at DESC`,
    [user.id, user.email],
  )
  return rows.map((row) => ({
    id: row.id,
    animalId: row.animal_id,
    animalName: row.animal_name,
    species: row.species,
    fromEmail: row.from_email,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

async function listOutgoingTransfers(user) {
  const [rows] = await pool.query(
    `SELECT transfers.id, transfers.animal_id, transfers.recipient_email, transfers.created_at,
      animals.name AS animal_name, animals.species
     FROM custody_transfers transfers
     JOIN animals ON animals.id = transfers.animal_id
     WHERE transfers.from_user_id = ? AND transfers.status = 'pending'
     ORDER BY transfers.created_at DESC`,
    [user.id],
  )
  return rows.map((row) => ({
    id: row.id,
    animalId: row.animal_id,
    animalName: row.animal_name,
    species: row.species,
    recipientEmail: row.recipient_email,
    status: 'pending',
    createdAt: new Date(row.created_at).toISOString(),
  }))
}

async function cancelTransfer(user, transferId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [transfers] = await connection.query(
      `SELECT id, animal_id FROM custody_transfers
       WHERE id = ? AND from_user_id = ? AND status = 'pending' LIMIT 1 FOR UPDATE`,
      [transferId, user.id],
    )
    if (!transfers.length) throw notFoundError()
    const animalId = transfers[0].animal_id
    const [custody] = await connection.query(
      `SELECT id FROM animal_custody
       WHERE animal_id = ? AND user_id = ? AND role = 'caregiver' AND ended_at IS NULL LIMIT 1`,
      [animalId, user.id],
    )
    if (!custody.length) {
      const error = new Error('Solo la persona responsable actual puede cancelar la transferencia.')
      error.statusCode = 403
      throw error
    }
    await connection.query(
      "UPDATE custody_transfers SET status = 'cancelled', resolved_at = UTC_TIMESTAMP() WHERE id = ?",
      [transferId],
    )
    await connection.query(
      'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), user.id, 'custody.transfer.cancelled', 'animal', animalId],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function acceptTransfer(user, transferId) {
  const userId = user.id
  const connection = await pool.getConnection()
  let animalId
  try {
    await connection.beginTransaction()
    const [transfers] = await connection.query(
      `SELECT id, animal_id, from_user_id FROM custody_transfers
       WHERE id = ? AND (to_user_id = ? OR (to_user_id IS NULL AND LOWER(recipient_email) = LOWER(?)))
         AND status = 'pending' LIMIT 1 FOR UPDATE`,
      [transferId, userId, user.email],
    )
    if (!transfers.length) {
      const error = new Error('No existe una transferencia pendiente para tu cuenta.')
      error.statusCode = 404
      throw error
    }
    const transfer = transfers[0]
    animalId = transfer.animal_id
    await connection.query('SELECT id FROM animals WHERE id = ? LIMIT 1 FOR UPDATE', [animalId])
    await connection.query(
      `UPDATE animal_custody SET ended_at = UTC_TIMESTAMP()
       WHERE animal_id = ? AND ended_at IS NULL`,
      [animalId],
    )
    await connection.query(
      "INSERT INTO animal_custody (id, animal_id, user_id, role) VALUES (?, ?, ?, 'caregiver')",
      [randomUUID(), animalId, userId],
    )
    await connection.query('UPDATE animals SET created_by = ? WHERE id = ?', [userId, animalId])
    await connection.query(
      'UPDATE access_grants SET revoked_at = UTC_TIMESTAMP() WHERE animal_id = ? AND revoked_at IS NULL',
      [animalId],
    )
    await connection.query(
      `UPDATE custody_transfers SET status = 'cancelled', resolved_at = UTC_TIMESTAMP()
       WHERE animal_id = ? AND status = 'pending' AND id <> ?`,
      [animalId, transferId],
    )
    await connection.query(
      "UPDATE custody_transfers SET to_user_id = ?, status = 'accepted', resolved_at = UTC_TIMESTAMP() WHERE id = ?",
      [userId, transferId],
    )
    await connection.query(
      'INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), userId, 'custody.transfer.accepted', 'animal', animalId],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  return getAnimal(user, animalId)
}

module.exports = {
  getPhotos,
  listAnimals,
  getAnimal,
  findDuplicates,
  createAnimal,
  setPublicVisibility,
  createTransfer,
  listTransfers,
  listOutgoingTransfers,
  cancelTransfer,
  acceptTransfer,
}

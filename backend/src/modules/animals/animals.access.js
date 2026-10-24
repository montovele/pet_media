const pool = require('../../config/db')

function forbiddenError() {
  const error = new Error('No tienes permiso para consultar o modificar este expediente.')
  error.statusCode = 403
  return error
}

async function requireAnimalAccess(user, animalId, permission = null, executor = pool) {
  if (user.role === 'superadmin' && (!permission || permission.endsWith(':read'))) {
    const [animals] = await executor.query(
      'SELECT id, public_id, created_by FROM animals WHERE id = ? LIMIT 1',
      [animalId],
    )
    if (animals.length) return animals[0]
    throw forbiddenError()
  }

  const [rows] = await executor.query(
    `SELECT animals.id, animals.public_id, animals.created_by
     FROM animals
     WHERE animals.id = ?
       AND (
         animals.created_by = ?
         OR EXISTS (
           SELECT 1 FROM animal_custody
           WHERE animal_custody.animal_id = animals.id
             AND animal_custody.user_id = ?
             AND animal_custody.ended_at IS NULL
         )
         OR EXISTS (
           SELECT 1 FROM access_grants
           WHERE (
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
             AND access_grants.recipient_email = ?
             AND access_grants.revoked_at IS NULL
             AND (access_grants.expires_at IS NULL OR access_grants.expires_at > UTC_TIMESTAMP())
             AND (access_grants.password_hash IS NULL OR access_grants.id IN (?))
             AND (
               ? IS NULL
               OR ? = 'animal:read'
               OR JSON_CONTAINS(access_grants.permissions, JSON_QUOTE(?))
               OR (? = 'health:read' AND JSON_CONTAINS(access_grants.permissions, JSON_QUOTE('health:manage')))
               OR (? = 'care:read' AND JSON_CONTAINS(access_grants.permissions, JSON_QUOTE('care:manage')))
               OR (? = 'animal:read' AND JSON_CONTAINS(access_grants.permissions, JSON_QUOTE('animal:manage')))
             )
         )
       )
     LIMIT 1`,
    [
      animalId,
      user.id,
      user.id,
      user.email,
      user.accessGrantIds?.length ? user.accessGrantIds : [''],
      permission,
      permission,
      permission,
      permission,
      permission,
      permission,
    ],
  )
  if (!rows.length) throw forbiddenError()
  return rows[0]
}

module.exports = { requireAnimalAccess }

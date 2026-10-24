const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

process.env.JWT_SECRET = 'test-only-access-grant-secret-at-least-32-characters'

const {
  signAccessGrantSessionToken,
  verifyAccessGrantSessionToken,
} = require('../src/utils/jwt')
const { accessGrantLoginSchema } = require('../src/modules/auth/auth.validation')
const { isAllowedAccessGuestRequest } = require('../src/middleware/auth.middleware')
const pool = require('../src/config/db')
const bioActaService = require('../src/modules/animals/bioActa.service')
const app = require('../src/app')
const { requireAnimalAccess } = require('../src/modules/animals/animals.access')

test('temporary access login requires the invitation id, authorized email, and password', () => {
  const grantId = '8a85d4d9-32c8-4e96-8d0a-34e7aad91111'
  assert.equal(accessGrantLoginSchema.safeParse({
    grantId,
    email: 'caregiver@example.com',
    password: 'temporary-password',
  }).success, true)
  assert.equal(accessGrantLoginSchema.safeParse({
    grantId: 'not-a-uuid',
    email: 'caregiver@example.com',
    password: 'temporary-password',
  }).success, false)
  assert.equal(accessGrantLoginSchema.safeParse({
    grantId,
    email: 'not-an-email',
    password: 'temporary-password',
  }).success, false)
})

test('temporary session token is signed for the grant session audience', () => {
  const claims = {
    grantId: '8a85d4d9-32c8-4e96-8d0a-34e7aad91111',
    email: 'caregiver@example.com',
  }
  const token = signAccessGrantSessionToken(claims)

  assert.deepEqual(
    { grantId: verifyAccessGrantSessionToken(token).grantId, email: verifyAccessGrantSessionToken(token).email },
    claims,
  )
  assert.throws(() => jwt.verify(token, process.env.JWT_SECRET, { audience: 'bioacta-access-grant' }))
})

test('temporary sessions are restricted to the shared animal read endpoints', () => {
  const animalId = 'c08623b6-0a78-4450-9fc8-44249520b522'
  assert.equal(isAllowedAccessGuestRequest('GET', '/api/auth/me'), true)
  assert.equal(isAllowedAccessGuestRequest('POST', '/api/auth/logout'), true)
  assert.equal(isAllowedAccessGuestRequest('GET', `/api/animals/${animalId}`), true)
  assert.equal(isAllowedAccessGuestRequest('GET', `/api/animals/${animalId}/health-records`), true)
  assert.equal(isAllowedAccessGuestRequest('GET', `/api/animals/${animalId}/care-schedules`), true)
  assert.equal(isAllowedAccessGuestRequest('POST', `/api/animals/${animalId}/health-records`), false)
  assert.equal(isAllowedAccessGuestRequest('GET', '/api/auth/nearby'), false)
  assert.equal(isAllowedAccessGuestRequest('GET', `/api/animals/${animalId}/access-grants`), false)
})

test('standard login can resolve a unique active temporary access by email and password', async () => {
  const originalQuery = pool.query
  const grant = {
    id: '8a85d4d9-32c8-4e96-8d0a-34e7aad91111',
    animal_id: 'c08623b6-0a78-4450-9fc8-44249520b522',
    recipient_email: 'caregiver@example.com',
    password_hash: await bcrypt.hash('temporary-password', 4),
    role: 'Cuidador',
    permissions: JSON.stringify(['animal:read', 'health:read']),
  }
  pool.query = async (_query, params) => {
    assert.deepEqual(params, ['caregiver@example.com'])
    return [[grant], []]
  }
  try {
    assert.deepEqual(
      await bioActaService.findAccessGrantLogin(' Caregiver@example.com ', 'temporary-password'),
      {
        grantId: grant.id,
        animalId: grant.animal_id,
        animalIds: [grant.animal_id],
        allAnimals: false,
        email: grant.recipient_email,
        role: 'Cuidador',
        permissions: ['animal:read', 'health:read'],
        expiresAt: null,
      },
    )
    assert.equal(await bioActaService.findAccessGrantLogin('caregiver@example.com', 'wrong-password'), null)
  } finally {
    pool.query = originalQuery
  }
})

test('access grant administration only lists grants owned by the current caretaker and matching the animal scope', async () => {
  const originalQuery = pool.query
  const user = { id: 'owner-id', role: 'user' }
  const animalId = 'c08623b6-0a78-4450-9fc8-44249520b522'
  const queries = []
  pool.query = async (query, params) => {
    queries.push({ query, params })
    if (query.includes('SELECT animals.id FROM animals')) return [[{ id: animalId }], []]
    if (query.includes('FROM access_grants')) return [[], []]
    throw new Error(`Unexpected query in access grant list test: ${query}`)
  }
  try {
    assert.deepEqual(await bioActaService.listAccessGrants(user, animalId), [])
    assert.match(queries[1].query, /WHERE \(\? = TRUE OR created_by = \?\)/)
    assert.match(queries[1].query, /animal_id = \? OR all_animals = TRUE/)
    assert.deepEqual(queries[1].params, [false, user.id, animalId, animalId])
  } finally {
    pool.query = originalQuery
  }
})

test('standard login requires an invitation link when credentials match multiple grants', async () => {
  const originalQuery = pool.query
  const passwordHash = await bcrypt.hash('temporary-password', 4)
  pool.query = async () => [[
    {
      id: '8a85d4d9-32c8-4e96-8d0a-34e7aad91111',
      animal_id: 'c08623b6-0a78-4450-9fc8-44249520b522',
      recipient_email: 'caregiver@example.com',
      password_hash: passwordHash,
      role: 'Cuidador',
      permissions: '["animal:read"]',
    },
    {
      id: '2c0c61a7-0872-4ca9-bff1-901a5297b733',
      animal_id: 'a8700541-12a5-4dda-a334-904eb92ef933',
      recipient_email: 'caregiver@example.com',
      password_hash: passwordHash,
      role: 'Cuidador',
      permissions: '["animal:read"]',
    },
  ], []]
  try {
    await assert.rejects(
      bioActaService.findAccessGrantLogin('caregiver@example.com', 'temporary-password'),
      { statusCode: 409 },
    )
  } finally {
    pool.query = originalQuery
  }
})

test('POST /auth/login accepts temporary credentials and issues a restricted guest session', async () => {
  const originalQuery = pool.query
  const grant = {
    id: '8a85d4d9-32c8-4e96-8d0a-34e7aad91111',
    animal_id: 'c08623b6-0a78-4450-9fc8-44249520b522',
    recipient_email: 'caregiver@example.com',
    password_hash: await bcrypt.hash('temporary-password', 4),
    role: 'Cuidador',
    permissions: JSON.stringify(['animal:read', 'health:read']),
    revoked_at: null,
    expires_at: null,
  }
  pool.query = async (query) => {
    if (query.includes('FROM users WHERE email = ?')) return [[], []]
    if (query.includes('FROM access_grants')) return [[grant], []]
    throw new Error(`Unexpected query in access login test: ${query}`)
  }
  const server = app.listen(0)
  try {
    await new Promise((resolve) => server.once('listening', resolve))
    const baseUrl = `http://127.0.0.1:${server.address().port}`
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: grant.recipient_email, password: 'temporary-password' }),
    })
    assert.equal(loginResponse.status, 200)
    assert.equal((await loginResponse.json()).user.isAccessGuest, true)

    const setCookie = loginResponse.headers.get('set-cookie')
    const guestCookie = setCookie?.match(/bioacta_guest_session=([^;,]+)/)?.[0]
    assert.ok(guestCookie)

    const sessionResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: guestCookie },
    })
    assert.equal(sessionResponse.status, 200)
    assert.equal((await sessionResponse.json()).accessGrant.animalId, grant.animal_id)

    const restrictedResponse = await fetch(`${baseUrl}/api/auth/nearby`, {
      headers: { cookie: guestCookie },
    })
    assert.equal(restrictedResponse.status, 403)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    pool.query = originalQuery
  }
})

test('animal access checks enforce selected animal scope and care read permission', async () => {
  const queries = []
  const executor = {
    async query(sql, parameters) {
      queries.push({ sql, parameters })
      return [[{ id: parameters[0], public_id: 'public-id', created_by: 'owner-id' }], []]
    },
  }
  await requireAnimalAccess({
    id: 'grant-id',
    email: 'caregiver@example.com',
    accessGrantIds: ['grant-id'],
  }, 'c08623b6-0a78-4450-9fc8-44249520b522', 'care:read', executor)

  assert.match(queries[0].sql, /JSON_CONTAINS\(access_grants\.animal_ids/)
  assert.match(queries[0].sql, /access_grants\.all_animals = TRUE/)
  assert.match(queries[0].sql, /JSON_QUOTE\('care:manage'\)/)
  assert.deepEqual(queries[0].parameters.slice(-6), Array(6).fill('care:read'))
})

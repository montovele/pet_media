const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-only-access-grant-secret-at-least-32-characters'

const { signAccessGrantToken } = require('../src/utils/jwt')
const { getAccessGrantIds } = require('../src/middleware/auth.middleware')

test('access grant cookie is bound to its recipient and grant id', () => {
  const userId = 'user-123'
  const grantId = 'grant-456'
  const token = signAccessGrantToken({ userId, grantId })

  assert.deepEqual(
    getAccessGrantIds({ [`bioacta_access_${grantId}`]: token }, userId),
    [grantId],
  )
  assert.deepEqual(
    getAccessGrantIds({ [`bioacta_access_${grantId}`]: token }, 'another-user'),
    [],
  )
  assert.deepEqual(
    getAccessGrantIds({ 'bioacta_access_another-grant': token }, userId),
    [],
  )
})

test('expired or invalid access grant cookies are ignored', () => {
  const expiredToken = jwt.sign(
    { userId: 'user-123', grantId: 'grant-456', aud: 'bioacta-access-grant', exp: 1 },
    process.env.JWT_SECRET,
  )

  assert.deepEqual(
    getAccessGrantIds({
      bioacta_access_expired: expiredToken,
      bioacta_access_invalid: 'not-a-token',
    }, 'user-123'),
    [],
  )
})

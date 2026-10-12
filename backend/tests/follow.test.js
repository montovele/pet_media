const test = require('node:test')
const assert = require('node:assert/strict')
const pool = require('../src/config/db')
const authService = require('../src/modules/auth/auth.service')

const originalQuery = pool.query.bind(pool)

test('toggleFollow creates follow relation and returns follow state', async () => {
  let callCount = 0
  pool.query = async (sql, params) => {
    callCount += 1

    if (sql.includes('SELECT id FROM users WHERE id = ? AND is_active = TRUE LIMIT 1')) {
      return [[{ id: params[0] }]]
    }

    if (sql.includes('SELECT 1 FROM user_follows WHERE follower_user_id = ? AND following_user_id = ? LIMIT 1')) {
      return [[]]
    }

    if (sql.includes('INSERT INTO user_follows')) {
      return [{ insertId: 'follow-1' }]
    }

    if (sql.includes('COUNT(*) AS followers_count')) {
      return [[{ followers_count: 1 }]]
    }

    if (sql.includes('COUNT(*) AS following_count')) {
      return [[{ following_count: 0 }]]
    }

    return [[]]
  }

  const result = await authService.toggleFollow('user-1', 'user-2')

  assert.equal(result.userId, 'user-2')
  assert.equal(result.isFollowing, true)
  assert.equal(result.followersCount, 1)
  assert.equal(result.followingCount, 0)
  assert.ok(callCount >= 4)

  pool.query = originalQuery
})

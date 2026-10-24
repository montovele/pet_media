const test = require('node:test')
const assert = require('node:assert/strict')
const { activitySchema } = require('../src/modules/activities/activities.validation')

const animalId = '10000000-0000-4000-8000-000000000001'

test('activity schema accepts a walk associated with an animal', () => {
  const result = activitySchema.parse({
    animalId,
    title: 'Caminata de la mañana',
    date: '2026-10-23',
    category: 'walk',
  })
  assert.equal(result.animalId, animalId)
  assert.equal(result.category, 'walk')
})

test('activity schema requires a valid animal identity', () => {
  const withoutAnimal = activitySchema.safeParse({
    title: 'Caminata de la mañana',
    date: '2026-10-23',
    category: 'walk',
  })
  const invalidAnimal = activitySchema.safeParse({
    animalId: 'not-a-uuid',
    title: 'Caminata de la mañana',
    date: '2026-10-23',
    category: 'walk',
  })
  assert.equal(withoutAnimal.success, false)
  assert.equal(invalidAnimal.success, false)
})

test('activity schema accepts multiple attached images and videos', () => {
  const mediaIds = [
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
  ]
  const result = activitySchema.parse({
    animalId,
    title: 'Momento especial',
    date: '2026-10-23',
    category: 'other',
    mediaIds,
  })
  assert.deepEqual(result.mediaIds, mediaIds)
})

test('activity schema still accepts a legacy single attachment', () => {
  const mediaId = '20000000-0000-4000-8000-000000000001'
  const result = activitySchema.parse({
    animalId,
    title: 'Momento especial',
    date: '2026-10-23',
    mediaId,
  })
  assert.equal(result.mediaId, mediaId)
})

test('activity schema rejects duplicate media and mixed formats', () => {
  const result = activitySchema.safeParse({
    animalId,
    title: 'Momento especial',
    date: '2026-10-23',
    mediaIds: [
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
    ],
    mediaId: '30000000-0000-4000-8000-000000000001',
  })
  assert.equal(result.success, false)
})
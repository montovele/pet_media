const test = require('node:test')
const assert = require('node:assert/strict')
const { getNextOccurrence } = require('../src/modules/animals/bioActa.service')

test('daily schedule advances beyond missed occurrences', () => {
  const next = getNextOccurrence(
    new Date('2026-01-01T09:00:00.000Z'),
    'Diaria',
    1,
    'days',
    new Date('2026-01-03T09:00:00.000Z'),
  )
  assert.equal(next.toISOString(), '2026-01-04T09:00:00.000Z')
})

test('custom interval advances by its configured unit', () => {
  const next = getNextOccurrence(
    new Date('2026-01-01T00:00:00.000Z'),
    'Personalizada',
    8,
    'hours',
    new Date('2026-01-02T01:00:00.000Z'),
  )
  assert.equal(next.toISOString(), '2026-01-02T08:00:00.000Z')
})

test('monthly recurrence clamps to the last day of a shorter month', () => {
  const next = getNextOccurrence(
    new Date('2026-01-31T09:00:00.000Z'),
    'Mensual',
    1,
    'days',
    new Date('2026-02-01T09:00:00.000Z'),
  )
  assert.equal(next.toISOString(), '2026-02-28T09:00:00.000Z')
})

test('one-time schedule does not recur after its dose is logged', () => {
  assert.equal(
    getNextOccurrence(
      new Date('2026-01-01T09:00:00.000Z'),
      'Una vez',
      1,
      'days',
      new Date('2026-01-01T09:00:00.000Z'),
    ),
    null,
  )
})

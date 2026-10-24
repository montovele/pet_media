const test = require('node:test')
const assert = require('node:assert/strict')
const {
  animalSchema,
  duplicateSearchSchema,
  healthRecordSchema,
  careScheduleSchema,
  lostFoundReportSchema,
  lostFoundStatusSchema,
  lostFoundContactSchema,
  accessGrantSchema,
  accessGrantUpdateSchema,
  accessGrantUnlockSchema,
} = require('../src/modules/animals/animals.validation')

test('animal schema accepts the minimum identity fields', () => {
  const result = animalSchema.parse({ species: 'Perro' })
  assert.equal(result.species, 'Perro')
})

test('animal schema trims optional descriptive fields', () => {
  const result = animalSchema.parse({
    species: '  Gato  ',
    name: '  Moka  ',
    estimatedAge: '  Aproximadamente 2 años  ',
  })
  assert.equal(result.species, 'Gato')
  assert.equal(result.name, 'Moka')
  assert.equal(result.estimatedAge, 'Aproximadamente 2 años')
})

test('animal schema rejects unknown fields', () => {
  assert.equal(animalSchema.safeParse({ species: 'Perro', ownerId: 'user-1' }).success, false)
})

test('animal schema rejects an invalid species value', () => {
  assert.equal(animalSchema.safeParse({ species: ' ' }).success, false)
})

test('animal schema accepts provisional identity and private identifiers', () => {
  const result = animalSchema.parse({
    species: 'Perro',
    provisional: true,
    identifiers: [{ type: 'microchip', reference: '  985121000123456  ' }],
  })
  assert.equal(result.provisional, true)
  assert.equal(result.identifiers[0].reference, '985121000123456')
})

test('duplicate search limits identifier collection size', () => {
  const identifiers = Array.from({ length: 9 }, (_, index) => ({ type: 'other', reference: `ref-${index}` }))
  assert.equal(duplicateSearchSchema.safeParse({ species: 'Perro', identifiers }).success, false)
})

test('health records cannot be certified by a caregiver request', () => {
  assert.equal(healthRecordSchema.safeParse({
    type: 'Vacuna',
    description: 'Aplicada',
    date: '2026-10-23',
    certified: true,
  }).success, false)
})

test('health records accept structured vaccine details without allowing certification', () => {
  const result = healthRecordSchema.safeParse({
    type: 'Vacuna',
    description: 'Aplicación registrada por la persona cuidadora.',
    date: '2026-10-23',
    details: { productName: 'Vacuna triple', dose: '1 ml', lotNumber: 'L-123', nextDueDate: '2027-10-23' },
  })
  assert.equal(result.success, true)
})

test('care schedules accept supported recurrence and custom intervals', () => {
  assert.equal(careScheduleSchema.safeParse({
    name: 'Medicamento',
    dose: '1 tableta',
    frequency: 'Personalizada',
    intervalValue: 8,
    intervalUnit: 'hours',
    nextAt: '2030-10-23T16:00:00.000Z',
    timeZone: 'America/Mexico_City',
  }).success, true)
  assert.equal(careScheduleSchema.safeParse({
    name: 'Medicamento',
    dose: null,
    frequency: 'Diaria',
    nextAt: '2030-10-23T16:00:00.000Z',
    timeZone: 'Not/A_Timezone',
  }).success, false)
})

test('lost and found reports require a safe contact method and approximate location', () => {
  const result = lostFoundReportSchema.safeParse({
    type: 'found',
    animalId: null,
    species: 'Perro',
    date: '2026-10-23',
    location: 'Centro',
    description: 'Perro con collar azul visto cerca del parque.',
    contactMethod: 'Mensaje en la plataforma',
  })
  assert.equal(result.success, true)
})

test('lost and found reports support owner-managed lifecycle and private contact messages', () => {
  assert.equal(lostFoundStatusSchema.safeParse({ status: 'resolved' }).success, true)
  assert.equal(lostFoundStatusSchema.safeParse({ status: 'deleted' }).success, false)
  assert.equal(lostFoundContactSchema.safeParse({ message: 'Puedo ayudar con información.' }).success, true)
  assert.equal(lostFoundContactSchema.safeParse({ message: 'hola' }).success, false)
})

test('access grants accept only the supported least-privilege permissions', () => {
  assert.equal(accessGrantSchema.safeParse({
    recipient: 'caregiver@example.com',
    password: 'a-secure-access-key',
    role: 'Cuidador',
    permissions: ['health:read', 'care:read'],
    expiresAt: null,
  }).success, true)
  assert.equal(accessGrantSchema.safeParse({
    recipient: 'caregiver@example.com',
    password: 'a-secure-access-key',
    role: 'Cuidador',
    permissions: ['admin:all'],
    expiresAt: null,
  }).success, false)
})

test('access grants require a dedicated password of at least ten characters', () => {
  const values = {
    recipient: 'caregiver@example.com',
    role: 'Cuidador',
    permissions: ['health:read'],
    expiresAt: null,
  }
  assert.equal(accessGrantSchema.safeParse({ ...values, password: 'short' }).success, false)
  assert.equal(accessGrantSchema.safeParse({ ...values, password: 'a-secure-access-key' }).success, true)
  assert.equal(accessGrantUnlockSchema.safeParse({ password: 'x' }).success, true)
})

test('access grant scopes can select all animals or a bounded set with independent read permissions', () => {
  const grant = {
    recipient: 'caregiver@example.com',
    password: 'a-secure-access-key',
    role: 'Cuidador',
    permissions: ['health:read', 'care:read'],
    expiresAt: null,
  }
  assert.equal(accessGrantSchema.safeParse({
    ...grant,
    allAnimals: true,
  }).success, true)
  assert.equal(accessGrantSchema.safeParse({
    ...grant,
    allAnimals: false,
    animalIds: ['8a85d4d9-32c8-4e96-8d0a-34e7aad91111'],
  }).success, true)
  assert.equal(accessGrantSchema.safeParse({
    ...grant,
    permissions: [],
    animalIds: ['8a85d4d9-32c8-4e96-8d0a-34e7aad91111'],
  }).success, false)
})

test('access grant updates allow partial fields while requiring a scope when switching to selected animals', () => {
  assert.equal(accessGrantUpdateSchema.safeParse({ permissions: ['care:read'] }).success, true)
  assert.equal(accessGrantUpdateSchema.safeParse({ allAnimals: true }).success, true)
  assert.equal(accessGrantUpdateSchema.safeParse({ allAnimals: false }).success, false)
  assert.equal(accessGrantUpdateSchema.safeParse({
    allAnimals: false,
    animalIds: ['8a85d4d9-32c8-4e96-8d0a-34e7aad91111'],
  }).success, true)
})
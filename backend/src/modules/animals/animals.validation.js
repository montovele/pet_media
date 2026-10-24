const { z } = require('zod')

const identifierSchema = z.object({
  type: z.enum(['microchip', 'tattoo', 'registry', 'other']),
  reference: z.string().trim().min(1).max(120),
}).strict()

const animalSchema = z.object({
  species: z.string().trim().min(2).max(80),
  name: z.string().trim().min(1).max(120).nullable().optional(),
  sex: z.string().trim().min(1).max(40).nullable().optional(),
  estimatedAge: z.string().trim().min(1).max(120).nullable().optional(),
  physicalDescription: z.string().trim().min(1).max(2000).nullable().optional(),
  provisional: z.boolean().optional(),
  identifiers: z.array(identifierSchema).max(8).optional(),
}).strict()

const duplicateSearchSchema = animalSchema.pick({
  species: true,
  name: true,
  physicalDescription: true,
  identifiers: true,
})

const healthRecordSchema = z.object({
  type: z.enum(['Vacuna', 'Enfermedad', 'Alergia', 'Cirugía', 'Tratamiento', 'Medicamento', 'Otro']),
  description: z.string().trim().min(1).max(4000),
  date: z.iso.date(),
  details: z.object({
    productName: z.string().trim().max(160).nullable().optional(),
    dose: z.string().trim().max(100).nullable().optional(),
    lotNumber: z.string().trim().max(100).nullable().optional(),
    nextDueDate: z.iso.date().nullable().optional(),
  }).strict().optional(),
}).strict()

const careScheduleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dose: z.string().trim().max(100).nullable(),
  frequency: z.enum(['Cada 12 horas', 'Diaria', 'Semanal', 'Mensual', 'Personalizada', 'Una vez']),
  intervalValue: z.number().int().min(1).max(365).optional().default(1),
  intervalUnit: z.enum(['hours', 'days', 'weeks']).optional().default('days'),
  nextAt: z.iso.datetime({ local: true }),
  timeZone: z.string().trim().min(1).max(80).refine((timeZone) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone })
      return true
    } catch {
      return false
    }
  }, 'La zona horaria no es válida.'),
}).strict()
  .refine((values) => values.nextAt > new Date().toISOString(), {
    message: 'La próxima fecha debe estar en el futuro.',
    path: ['nextAt'],
  })
  .refine((values) => values.frequency === 'Personalizada' || (values.intervalValue === 1 && values.intervalUnit === 'days'), {
    message: 'El intervalo personalizado solo aplica a la frecuencia personalizada.',
    path: ['intervalValue'],
  })

const lostFoundReportSchema = z.object({
  type: z.enum(['lost', 'found']),
  animalId: z.uuid().nullable(),
  species: z.string().trim().min(2).max(80),
  date: z.iso.date(),
  location: z.string().trim().min(2).max(180),
  description: z.string().trim().min(5).max(2000),
  contactMethod: z.string().trim().min(3).max(180),
}).strict()

const accessGrantFields = {
  recipient: z.email().trim().max(180),
  password: z.string().min(10).max(128),
  role: z.enum(['Cuidador', 'Veterinario', 'Refugio', 'Hogar temporal', 'Rescatista']),
  permissions: z.array(z.enum(['health:read', 'health:manage', 'care:read', 'care:manage', 'animal:read', 'animal:manage'])).min(1).max(6),
  animalIds: z.array(z.uuid()).max(100).optional(),
  allAnimals: z.boolean().optional().default(false),
  expiresAt: z.iso.date().nullable(),
}

const accessGrantObjectSchema = z.object(accessGrantFields).strict()

const accessGrantSchema = accessGrantObjectSchema.refine(
  (values) => !values.expiresAt || values.expiresAt >= new Date().toISOString().slice(0, 10),
  { message: 'La fecha de expiración no puede estar en el pasado.', path: ['expiresAt'] },
)

const accessGrantUpdateSchema = z.object({
  ...accessGrantFields,
  allAnimals: z.boolean().optional(),
}).strict().omit({
  recipient: true,
  password: true,
}).partial().extend({
  password: z.string().min(10).max(128).optional(),
}).strict().refine(
  (values) => values.allAnimals !== false || Boolean(values.animalIds?.length),
  { message: 'Selecciona al menos un animal o elige todos tus animales.', path: ['animalIds'] },
).refine(
  (values) => !values.expiresAt || values.expiresAt >= new Date().toISOString().slice(0, 10),
  { message: 'La fecha de expiración no puede estar en el pasado.', path: ['expiresAt'] },
)

const accessGrantUnlockSchema = z.object({
  password: z.string().min(1).max(128),
}).strict()

const visibilitySchema = z.object({
  publicEnabled: z.boolean(),
}).strict()

const transferSchema = z.object({
  animalId: z.uuid(),
  recipientEmail: z.email().trim().max(180),
}).strict()

const careLogSchema = z.object({
  result: z.enum(['administered', 'skipped']),
}).strict()

const lostFoundStatusSchema = z.object({
  status: z.enum(['open', 'resolved', 'closed']),
}).strict()

const lostFoundContactSchema = z.object({
  message: z.string().trim().min(10).max(1000),
  threadId: z.uuid().nullable().optional(),
}).strict()

module.exports = {
  animalSchema,
  duplicateSearchSchema,
  healthRecordSchema,
  careScheduleSchema,
  lostFoundReportSchema,
  accessGrantSchema,
  accessGrantUpdateSchema,
  accessGrantUnlockSchema,
  visibilitySchema,
  transferSchema,
  careLogSchema,
  lostFoundStatusSchema,
  lostFoundContactSchema,
}
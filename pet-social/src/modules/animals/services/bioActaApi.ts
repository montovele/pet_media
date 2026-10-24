import { z } from 'zod'
import { api } from '../../../services/api/client'

const healthRecordSchema = z.object({
  id: z.string(),
  animalId: z.string().uuid(),
  type: z.string(),
  description: z.string(),
  date: z.string(),
  details: z.object({
    productName: z.string().nullable().optional(),
    dose: z.string().nullable().optional(),
    lotNumber: z.string().nullable().optional(),
    nextDueDate: z.string().nullable().optional(),
  }).default({}),
  source: z.enum(['caregiver', 'professional']),
  professionalName: z.string().nullable().optional(),
  certified: z.boolean(),
})

const careScheduleSchema = z.object({
  id: z.string(),
  animalId: z.string().uuid(),
  name: z.string(),
  dose: z.string().nullable(),
  frequency: z.string(),
  intervalValue: z.number().int().positive(),
  intervalUnit: z.enum(['hours', 'days', 'weeks']),
  nextAt: z.string(),
  timeZone: z.string(),
  active: z.boolean(),
  logs: z.array(z.object({
    id: z.string(),
    result: z.enum(['administered', 'skipped']),
    administeredAt: z.string(),
    userName: z.string(),
  })).default([]),
})

const accessGrantSchema = z.object({
  id: z.string(),
  animalId: z.string().uuid(),
  animalIds: z.array(z.string().uuid()).default([]),
  allAnimals: z.boolean().default(false),
  recipient: z.string(),
  passwordProtected: z.boolean().default(false),
  role: z.string(),
  permissions: z.array(z.string()),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
})

const publicBioActaSchema = z.object({
  publicId: z.string(),
  name: z.string().nullable(),
  species: z.string(),
  sex: z.string().nullable(),
  estimatedAge: z.string().nullable(),
  physicalDescription: z.string().nullable(),
  photos: z.array(z.object({ url: z.string(), alt: z.string().optional() })),
  publicHealthSummary: z.string().nullable().optional(),
})

const qrResponseSchema = z.object({
  publicUrl: z.string().url(),
  imageDataUrl: z.string().startsWith('data:image/'),
})

const auditLogSchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  createdAt: z.string(),
})

const professionalSummarySchema = z.object({
  organizationName: z.string().nullable(),
  animalCount: z.number().int().nonnegative(),
  pendingCertifications: z.number().int().nonnegative(),
  verifiedProfessional: z.boolean(),
})

const lostFoundReportSchema = z.object({
  id: z.string(),
  type: z.enum(['lost', 'found']),
  species: z.string(),
  date: z.string(),
  location: z.string(),
  description: z.string(),
  contactMethod: z.string(),
  status: z.enum(['open', 'resolved', 'closed']),
  createdAt: z.string(),
})

const lostFoundMessageSchema = z.object({
  id: z.string(),
  reportId: z.string(),
  threadId: z.string(),
  message: z.string(),
  senderName: z.string(),
  recipientName: z.string(),
  isOutgoing: z.boolean(),
  reportType: z.enum(['lost', 'found']),
  species: z.string(),
  createdAt: z.string(),
})

export type HealthRecord = z.infer<typeof healthRecordSchema>
export type CareSchedule = z.infer<typeof careScheduleSchema>
export type AccessGrant = z.infer<typeof accessGrantSchema>
export type PublicBioActa = z.infer<typeof publicBioActaSchema>
export type AuditLog = z.infer<typeof auditLogSchema>
export type ProfessionalSummary = z.infer<typeof professionalSummarySchema>
export type LostFoundReport = z.infer<typeof lostFoundReportSchema>
export type LostFoundMessage = z.infer<typeof lostFoundMessageSchema>
export type HealthRecordDraft = Pick<HealthRecord, 'type' | 'description' | 'date' | 'details'>
export type CareScheduleDraft = Pick<CareSchedule, 'name' | 'dose' | 'frequency' | 'intervalValue' | 'intervalUnit' | 'nextAt' | 'timeZone'>
export type AccessGrantDraft = Pick<AccessGrant, 'recipient' | 'role' | 'permissions' | 'expiresAt' | 'animalIds' | 'allAnimals'> & { password: string }
export type AccessGrantUpdate = Partial<Pick<AccessGrant, 'role' | 'permissions' | 'expiresAt' | 'animalIds' | 'allAnimals'>> & { password?: string }

export const bioActaApi = {
  async listHealthRecords(animalId: string) {
    const { data } = await api.get<unknown>(`/animals/${encodeURIComponent(animalId)}/health-records`)
    return z.array(healthRecordSchema).parse(data)
  },
  async createHealthRecord(animalId: string, values: HealthRecordDraft) {
    const { data } = await api.post<unknown>(`/animals/${encodeURIComponent(animalId)}/health-records`, values)
    return healthRecordSchema.parse(data)
  },
  async listCareSchedules(animalId: string) {
    const { data } = await api.get<unknown>(`/animals/${encodeURIComponent(animalId)}/care-schedules`)
    return z.array(careScheduleSchema).parse(data)
  },
  async createCareSchedule(animalId: string, values: CareScheduleDraft) {
    const { data } = await api.post<unknown>(`/animals/${encodeURIComponent(animalId)}/care-schedules`, values)
    return careScheduleSchema.parse(data)
  },
  async logCareDose(scheduleId: string, result: 'administered' | 'skipped') {
    const { data } = await api.post<unknown>(`/care-schedules/${encodeURIComponent(scheduleId)}/logs`, { result })
    return z.object({ scheduleId: z.string(), result: z.enum(['administered', 'skipped']), administeredAt: z.string(), nextAt: z.string().nullable() }).parse(data)
  },
  async createLostFoundReport(values: {
    type: 'lost' | 'found'
    animalId: string | null
    species: string
    date: string
    location: string
    description: string
    contactMethod: string
  }) {
    await api.post('/lost-found-reports', values)
  },
  async listPublicLostFoundReports() {
    const { data } = await api.get<unknown>('/public/lost-found-reports')
    return z.array(z.object({
      id: z.string(),
      type: z.enum(['lost', 'found']),
      species: z.string(),
      date: z.string(),
      location: z.string(),
      description: z.string(),
      contactAvailable: z.boolean(),
      createdAt: z.string(),
    })).parse(data)
  },
  async listMyLostFoundReports() {
    const { data } = await api.get<unknown>('/lost-found-reports/mine')
    return z.array(lostFoundReportSchema).parse(data)
  },
  async updateLostFoundReportStatus(reportId: string, status: LostFoundReport['status']) {
    const { data } = await api.patch<unknown>(`/lost-found-reports/${encodeURIComponent(reportId)}/status`, { status })
    return z.object({ id: z.string(), status: z.enum(['open', 'resolved', 'closed']) }).parse(data)
  },
  async contactLostFoundReport(reportId: string, message: string, threadId?: string) {
    const { data } = await api.post<unknown>(`/lost-found-reports/${encodeURIComponent(reportId)}/contact`, { message, threadId })
    return z.object({ id: z.string(), threadId: z.string(), createdAt: z.string() }).parse(data)
  },
  async listMyLostFoundMessages() {
    const { data } = await api.get<unknown>('/lost-found-reports/messages/mine')
    return z.array(lostFoundMessageSchema).parse(data)
  },
  async listAccessGrants(animalId: string) {
    const { data } = await api.get<unknown>(`/animals/${encodeURIComponent(animalId)}/access-grants`)
    return z.array(accessGrantSchema).parse(data)
  },
  async createAccessGrant(animalId: string, values: AccessGrantDraft) {
    const { data } = await api.post<unknown>(`/animals/${encodeURIComponent(animalId)}/access-grants`, values)
    return accessGrantSchema.parse(data)
  },
  async updateAccessGrant(grantId: string, values: AccessGrantUpdate) {
    const { data } = await api.patch<unknown>(`/access-grants/${encodeURIComponent(grantId)}`, values)
    return accessGrantSchema.parse(data)
  },
  async revokeAccessGrant(grantId: string) {
    await api.delete(`/access-grants/${encodeURIComponent(grantId)}`)
  },
  async unlockAccessGrant(grantId: string, password: string) {
    const { data } = await api.post<unknown>(`/access-grants/${encodeURIComponent(grantId)}/unlock`, { password })
    return z.object({ unlocked: z.literal(true) }).parse(data)
  },
  async getPublicBioActa(publicId: string) {
    const { data } = await api.get<unknown>(`/animals/public/${encodeURIComponent(publicId)}`)
    return publicBioActaSchema.parse(data)
  },
  async getQr(animalId: string) {
    const { data } = await api.get<unknown>(`/animals/${encodeURIComponent(animalId)}/qr`)
    return qrResponseSchema.parse(data)
  },
  async getProfessionalSummary() {
    const { data } = await api.get<unknown>('/professional/dashboard')
    return professionalSummarySchema.parse(data)
  },
  async listAuditLogs() {
    const { data } = await api.get<unknown>('/admin/audit-logs')
    return z.array(auditLogSchema).parse(data)
  },
}

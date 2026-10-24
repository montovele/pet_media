import { z } from 'zod'
import { api } from '../../../services/api/client'

const animalSchema = z.object({
  id: z.string().uuid(),
  publicId: z.string().min(40),
  species: z.string(),
  name: z.string().nullable(),
  sex: z.string().nullable(),
  estimatedAge: z.string().nullable(),
  physicalDescription: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.object({ id: z.string().uuid(), name: z.string(), email: z.string().email() }).optional(),
  identityStatus: z.enum(['provisional', 'registered']).default('registered'),
  publicEnabled: z.boolean().default(false),
  photos: z.array(z.object({
    id: z.string(),
    url: z.string(),
    alt: z.string(),
    createdAt: z.string(),
  })).default([]),
})

export type AnimalRecord = z.infer<typeof animalSchema>
export type AnimalDraft = Pick<AnimalRecord, 'species' | 'name' | 'sex' | 'estimatedAge' | 'physicalDescription'> & {
  provisional?: boolean
  identifiers?: Array<{ type: 'microchip' | 'tattoo' | 'registry' | 'other'; reference: string }>
}

const duplicateSchema = z.object({
  publicId: z.string(),
  species: z.string(),
  name: z.string().nullable(),
  sex: z.string().nullable(),
  estimatedAge: z.string().nullable(),
  physicalDescription: z.string().nullable(),
})
const duplicateResultSchema = z.object({
  matches: z.array(duplicateSchema),
  possiblePrivateMatch: z.boolean(),
})

const transferSchema = z.object({
  id: z.string(),
  animalId: z.string().uuid(),
  animalName: z.string().nullable(),
  species: z.string(),
  fromEmail: z.string().email(),
  status: z.literal('pending'),
  createdAt: z.string(),
})
const outgoingTransferSchema = z.object({
  id: z.string(),
  animalId: z.string().uuid(),
  animalName: z.string().nullable(),
  species: z.string(),
  recipientEmail: z.string().email(),
  status: z.literal('pending'),
  createdAt: z.string(),
})

export const animalsApi = {
  async list() {
    const { data } = await api.get<unknown>('/animals')
    return z.array(animalSchema).parse(data) as AnimalRecord[]
  },
  async get(animalId: string) {
    const { data } = await api.get<unknown>(`/animals/${encodeURIComponent(animalId)}`)
    return animalSchema.parse(data) as AnimalRecord
  },
  async create(values: AnimalDraft) {
    const { data } = await api.post<unknown>('/animals', values)
    return animalSchema.parse(data) as AnimalRecord
  },
  async findDuplicates(values: Pick<AnimalDraft, 'species' | 'name' | 'physicalDescription' | 'identifiers'>) {
    const { data } = await api.post<unknown>('/animals/duplicates', values)
    return duplicateResultSchema.parse(data)
  },
  async uploadPhoto(animalId: string, file: File, alt: string) {
    const formData = new FormData()
    formData.append('photo', file)
    formData.append('alt', alt)
    const { data } = await api.post<unknown>(`/animals/${encodeURIComponent(animalId)}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return z.object({ id: z.string(), url: z.string(), alt: z.string() }).parse(data)
  },
  async setPublicVisibility(animalId: string, publicEnabled: boolean) {
    const { data } = await api.post<unknown>(`/animals/${encodeURIComponent(animalId)}/public-visibility`, { publicEnabled })
    return animalSchema.parse(data) as AnimalRecord
  },
  async createTransfer(animalId: string, recipientEmail: string) {
    const { data } = await api.post<unknown>('/animals/transfers', { animalId, recipientEmail })
    return z.object({ id: z.string(), animalId: z.string().uuid(), recipientEmail: z.string().email(), status: z.literal('pending') }).parse(data)
  },
  async listIncomingTransfers() {
    const { data } = await api.get<unknown>('/animals/transfers/incoming')
    return z.array(transferSchema).parse(data)
  },
  async listOutgoingTransfers() {
    const { data } = await api.get<unknown>('/animals/transfers/outgoing')
    return z.array(outgoingTransferSchema).parse(data)
  },
  async cancelTransfer(transferId: string) {
    await api.delete(`/animals/transfers/${encodeURIComponent(transferId)}`)
  },
  async acceptTransfer(transferId: string) {
    const { data } = await api.post<unknown>(`/animals/transfers/${encodeURIComponent(transferId)}/accept`)
    return animalSchema.parse(data) as AnimalRecord
  },
}
import { z } from 'zod'
import { api } from '../../../services/api/client'

const brandSchema = z.object({
  name: z.string().min(2).max(80),
  logoUrl: z.string().nullable(),
}).transform((brand) => {
  const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
  return {
    ...brand,
    logoUrl: brand.logoUrl ? new URL(brand.logoUrl, apiBase).toString() : null,
  }
})

export const brandApi = {
  async get() {
    const { data } = await api.get<unknown>('/brand')
    return brandSchema.parse(data)
  },
  async update(values: { name?: string; logoUrl?: string | null }) {
    const { data } = await api.patch<unknown>('/brand', values)
    return brandSchema.parse(data)
  },
}
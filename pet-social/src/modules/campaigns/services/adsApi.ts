import { z } from 'zod'
import { api } from '../../../services/api/client'

const adSchema = z.object({
  id: z.string(),
  brandName: z.string(),
  headline: z.string(),
  body: z.string(),
  imageUrl: z.string().optional(),
  ctaLabel: z.string(),
  destinationUrl: z.string().refine((value) => value.startsWith('/') && !value.startsWith('//') || URL.canParse(value), 'Destino inválido.'),
})

const campaignSchema = adSchema.extend({
  status: z.enum(['draft', 'active', 'paused', 'archived']),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const pricingSchema = z.object({
  currency: z.enum(['mxn', 'usd']),
  pricePerDayCents: z.number().int(),
  minDurationDays: z.number().int(),
  maxDurationDays: z.number().int(),
  checkoutEnabled: z.boolean(),
  stripeReady: z.boolean(),
  updatedAt: z.string(),
})
const quoteSchema = z.object({
  durationDays: z.number().int(),
  currency: z.enum(['mxn', 'usd']),
  unitPriceCents: z.number().int(),
  totalAmountCents: z.number().int(),
})
const orderSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  brandName: z.string(),
  headline: z.string(),
  body: z.string().default(''),
  imageUrl: z.string().optional(),
  ctaLabel: z.string().optional(),
  destinationUrl: z.string().optional(),
  campaignStatus: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  durationDays: z.number().int(),
  unitPriceCents: z.number().int(),
  totalAmountCents: z.number().int(),
  currency: z.enum(['mxn', 'usd']),
  status: z.enum(['checkout_pending', 'paid', 'expired', 'failed', 'refunded']),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
})

export type BrandAd = z.infer<typeof adSchema>
export type AdCampaign = z.infer<typeof campaignSchema>
export type AdCampaignInput = Pick<AdCampaign, 'brandName' | 'headline' | 'body' | 'imageUrl' | 'ctaLabel' | 'destinationUrl' | 'status' | 'startsAt' | 'endsAt'>
export type AdPricingRules = z.infer<typeof pricingSchema>
export type AdQuote = z.infer<typeof quoteSchema>
export type AdOrder = z.infer<typeof orderSchema>
export type CustomerCampaignInput = Pick<AdCampaignInput, 'brandName' | 'headline' | 'body' | 'imageUrl' | 'ctaLabel' | 'destinationUrl'> & { durationDays: number }

export function resolveAdImageUrl(value?: string) {
  if (!value) return undefined
  const apiBase = new URL(api.defaults.baseURL || '/', window.location.origin)
  return new URL(value, apiBase).toString()
}

export const adsApi = {
  async listPublic() {
    const { data } = await api.get<unknown>('/ads/public')
    return z.array(adSchema).parse(data) as BrandAd[]
  },
  async listCampaigns() {
    const { data } = await api.get<unknown>('/ads')
    return z.array(campaignSchema).parse(data) as AdCampaign[]
  },
  async createCampaign(input: AdCampaignInput) {
    const { data } = await api.post<unknown>('/ads', input)
    return campaignSchema.parse(data) as AdCampaign
  },
  async updateCampaign(id: string, input: AdCampaignInput) {
    const { data } = await api.put<unknown>(`/ads/${id}`, input)
    return campaignSchema.parse(data) as AdCampaign
  },
  async uploadImage(file: File) {
    const formData = new FormData()
    formData.append('image', file)
    const { data } = await api.post<unknown>('/ads/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const result = z.object({ imageUrl: z.string().startsWith('/api/ads/media/') }).parse(data)
    return result.imageUrl
  },
  async getPricing() {
    const { data } = await api.get<unknown>('/ads/pricing')
    return pricingSchema.parse(data) as AdPricingRules
  },
  async quote(durationDays: number) {
    const { data } = await api.post<unknown>('/ads/quote', { durationDays })
    return quoteSchema.parse(data) as AdQuote
  },
  async startCheckout(input: CustomerCampaignInput) {
    const { data } = await api.post<unknown>('/ads/checkout', input)
    return z.object({ orderId: z.string(), checkoutUrl: z.string().url(), quote: quoteSchema }).parse(data)
  },
  async listMyOrders() {
    const { data } = await api.get<unknown>('/ads/my-orders')
    return z.array(orderSchema).parse(data) as AdOrder[]
  },
  async getMyOrder(orderId: string) {
    const { data } = await api.get<unknown>(`/ads/my-orders/${encodeURIComponent(orderId)}`)
    return orderSchema.parse(data) as AdOrder
  },
  async updatePricing(input: Omit<AdPricingRules, 'stripeReady' | 'updatedAt'>) {
    const { data } = await api.put<unknown>('/ads/pricing', input)
    return pricingSchema.parse(data) as AdPricingRules
  },
  async listAdminOrders() {
    const { data } = await api.get<unknown>('/ads/orders')
    return z.array(orderSchema.extend({ customerEmail: z.string() })).parse(data)
  },
  async deleteCampaign(id: string) {
    await api.delete(`/ads/${id}`)
  },
}
<script setup lang="ts">
import axios from 'axios'
import { computed, nextTick, onMounted, ref } from 'vue'
import { AlertTriangle, ArrowUpRight, Check, ChevronDown, ChevronUp, CirclePause, CirclePlay, ExternalLink, Megaphone, Plus, Save, Trash2 } from 'lucide-vue-next'
import { adsApi, resolveAdImageUrl, type AdCampaign, type AdCampaignInput, type AdOrder, type AdPricingRules } from '../services/adsApi'

const campaigns = ref<AdCampaign[]>([])
const orders = ref<AdOrder[]>([])
const pricing = ref<AdPricingRules | null>(null)
const pricingDraft = ref({ currency: 'mxn' as 'mxn' | 'usd', pricePerDay: 49, minDurationDays: 1, maxDurationDays: 30, checkoutEnabled: true })
const selectedId = ref<string | null>(null)
const expandedOrderId = ref('')
const busy = ref(false)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const form = ref<AdCampaignInput>(blankCampaign())
const editorSection = ref<HTMLElement | null>(null)
const selectedCampaign = computed(() => campaigns.value.find((campaign) => campaign.id === selectedId.value))
const previewImageUrl = computed(() => resolveAdImageUrl(form.value.imageUrl || undefined))
const activeCount = computed(() => {
  const now = Date.now()
  return campaigns.value.filter((campaign) => campaign.status === 'active'
    && (!campaign.startsAt || Date.parse(campaign.startsAt) <= now)
    && (!campaign.endsAt || Date.parse(campaign.endsAt) > now)).length
})
const statusLabels = { draft: 'Borrador', active: 'Activa', paused: 'Pausada', archived: 'Archivada' }
const orderStatusLabels: Record<AdOrder['status'], string> = {
  checkout_pending: 'Pago pendiente', paid: 'Pagado', expired: 'Checkout expirado', failed: 'Pago fallido', refunded: 'Reembolsado',
}

function requestErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error) && typeof error.response?.data?.message === 'string') return error.response.data.message
  return error instanceof Error ? error.message : fallback
}

function blankCampaign(): AdCampaignInput {
  return {
    brandName: '',
    headline: '',
    body: '',
    imageUrl: '',
    ctaLabel: 'Conocer más',
    destinationUrl: '',
    status: 'draft',
    startsAt: null,
    endsAt: null,
  }
}

function toDatetimeLocal(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function toIso(value: string | null) {
  return value ? new Date(value).toISOString() : null
}

function beginNewCampaign() {
  selectedId.value = null
  form.value = blankCampaign()
  error.value = ''
  notice.value = ''
}

function editCampaign(campaign: AdCampaign) {
  selectedId.value = campaign.id
  form.value = {
    brandName: campaign.brandName,
    headline: campaign.headline,
    body: campaign.body,
    imageUrl: campaign.imageUrl || '',
    ctaLabel: campaign.ctaLabel,
    destinationUrl: campaign.destinationUrl,
    status: campaign.status,
    startsAt: toDatetimeLocal(campaign.startsAt),
    endsAt: toDatetimeLocal(campaign.endsAt),
  }
  error.value = ''
  notice.value = ''
  void nextTick(() => {
    editorSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

async function loadCampaigns() {
  loading.value = true
  error.value = ''
  try {
    campaigns.value = await adsApi.listCampaigns()
  } catch (requestError) {
    error.value = requestErrorMessage(requestError, 'No se pudieron cargar las campañas.')
  } finally {
    loading.value = false
  }
}

async function loadPricingAndOrders() {
  try {
    const [currentPricing, currentOrders] = await Promise.all([adsApi.getPricing(), adsApi.listAdminOrders()])
    pricing.value = currentPricing
    orders.value = currentOrders as AdOrder[]
    pricingDraft.value = {
      currency: currentPricing.currency,
      pricePerDay: currentPricing.pricePerDayCents / 100,
      minDurationDays: currentPricing.minDurationDays,
      maxDurationDays: currentPricing.maxDurationDays,
      checkoutEnabled: currentPricing.checkoutEnabled,
    }
  } catch (requestError) {
    error.value = requestErrorMessage(requestError, 'No se pudieron cargar las tarifas y los pedidos.')
  }
}

async function savePricing() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    pricing.value = await adsApi.updatePricing({
      currency: pricingDraft.value.currency,
      pricePerDayCents: Math.round(Number(pricingDraft.value.pricePerDay) * 100),
      minDurationDays: Number(pricingDraft.value.minDurationDays),
      maxDurationDays: Number(pricingDraft.value.maxDurationDays),
      checkoutEnabled: pricingDraft.value.checkoutEnabled,
    })
    notice.value = 'Reglas de contratación guardadas. Los próximos pedidos usarán esta tarifa.'
  } catch (requestError) {
    error.value = requestErrorMessage(requestError, 'No se pudieron guardar las reglas de contratación.')
  } finally {
    busy.value = false
  }
}

async function uploadCampaignImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  error.value = ''
  notice.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    error.value = 'Elige una imagen JPG, PNG o WebP.'
    return
  }
  if (file.size > 8 * 1024 * 1024) {
    error.value = 'La imagen no puede superar los 8 MB.'
    return
  }
  busy.value = true
  try {
    form.value.imageUrl = await adsApi.uploadImage(file)
    notice.value = 'Imagen guardada en el almacenamiento local.'
  } catch (requestError) {
    error.value = requestErrorMessage(requestError, 'No se pudo guardar la imagen localmente.')
  } finally {
    busy.value = false
  }
}

async function saveCampaign() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const payload = { ...form.value, startsAt: toIso(form.value.startsAt), endsAt: toIso(form.value.endsAt) }
    const saved = selectedId.value
      ? await adsApi.updateCampaign(selectedId.value, payload)
      : await adsApi.createCampaign(payload)
    campaigns.value = [saved, ...campaigns.value.filter((campaign) => campaign.id !== saved.id)]
    selectedId.value = saved.id
    form.value = {
      brandName: saved.brandName,
      headline: saved.headline,
      body: saved.body,
      imageUrl: saved.imageUrl || '',
      ctaLabel: saved.ctaLabel,
      destinationUrl: saved.destinationUrl,
      status: saved.status,
      startsAt: toDatetimeLocal(saved.startsAt),
      endsAt: toDatetimeLocal(saved.endsAt),
    }
    notice.value = saved.status === 'active' ? 'Campaña guardada y activa en los feeds.' : 'Campaña guardada como contenido administrado.'
  } catch (requestError) {
    error.value = requestErrorMessage(requestError, 'No se pudo guardar la campaña.')
  } finally {
    busy.value = false
  }
}

async function removeCampaign(campaign: AdCampaign) {
  if (!window.confirm(`¿Eliminar la campaña de ${campaign.brandName}?`)) return
  busy.value = true
  error.value = ''
  try {
    await adsApi.deleteCampaign(campaign.id)
    campaigns.value = campaigns.value.filter((item) => item.id !== campaign.id)
    if (selectedId.value === campaign.id) beginNewCampaign()
    notice.value = 'Campaña eliminada.'
  } catch (requestError) {
    error.value = requestErrorMessage(requestError, 'No se pudo eliminar la campaña.')
  } finally {
    busy.value = false
  }
}

function statusClass(status: AdCampaign['status']) {
  return `campaign-status status-${status}`
}

function orderRemainingDays(order: AdOrder) {
  if (order.status !== 'paid' || !order.endsAt) return null
  return Math.max(0, Math.ceil((Date.parse(order.endsAt) - Date.now()) / 86_400_000))
}

function formatOrderDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Pendiente'
}

onMounted(() => { void loadCampaigns(); void loadPricingAndOrders() })
</script>

<template>
  <main class="ads-manager">
    <header class="ads-heading">
      <div>
        <span class="eyebrow"><Megaphone :size="14" /> ESTUDIO DE CAMPAÑAS</span>
        <h1>Anuncios de marca</h1>
        <p>Diseña mensajes patrocinados que convivan con las historias. Cada anuncio aparece identificado como tal.</p>
      </div>
      <button class="new-campaign-button" type="button" @click="beginNewCampaign"><Plus :size="16" /> Nueva campaña</button>
    </header>

    <section class="campaign-overview" aria-label="Resumen de campañas">
      <div><span>Campañas</span><strong>{{ campaigns.length }}</strong></div>
      <div><span>Activas ahora</span><strong>{{ activeCount }}</strong></div>
      <p><CirclePlay :size="16" /> Las campañas activas y vigentes se insertan de forma aleatoria en Inicio y Explorar.</p>
    </section>

    <p v-if="error" class="ads-feedback is-error" role="alert"><AlertTriangle :size="15" />{{ error }}</p>
    <p v-if="notice" class="ads-feedback is-notice" role="status"><Check :size="15" />{{ notice }}</p>

    <section v-if="pricing" class="pricing-rules" aria-labelledby="pricing-rules-title">
      <header class="pricing-rules-heading"><div><span class="eyebrow">CONTROL COMERCIAL · SUPERADMIN</span><h2 id="pricing-rules-title">Tarifas y duración</h2></div><span class="stripe-status" :class="pricing.stripeReady ? 'stripe-ready' : 'stripe-unready'"><span></span>{{ pricing.stripeReady ? 'Stripe listo' : 'Falta configurar Stripe' }}</span></header>
      <form class="pricing-rules-form" @submit.prevent="savePricing">
        <label><span>Precio por día</span><span class="price-input"><input v-model.number="pricingDraft.pricePerDay" type="number" min="1" max="100000" step="0.01" required /><select v-model="pricingDraft.currency" aria-label="Moneda"><option value="mxn">MXN</option><option value="usd">USD</option></select></span></label>
        <label><span>Días mínimos</span><input v-model.number="pricingDraft.minDurationDays" type="number" min="1" max="365" required /></label>
        <label><span>Días máximos</span><input v-model.number="pricingDraft.maxDurationDays" type="number" min="1" max="365" required /></label>
        <label class="checkout-enable"><input v-model="pricingDraft.checkoutEnabled" type="checkbox" /><span>Permitir nuevas contrataciones</span></label>
        <button class="save-campaign-button" type="submit" :disabled="busy"><Save :size="14" /> Guardar reglas</button>
      </form>
      <p class="pricing-footnote">Los importes de los pedidos existentes no cambian. El anuncio del cliente se activa únicamente tras el webhook de pago verificado de Stripe.</p>
    </section>

    <div class="ads-workspace">
      <section ref="editorSection" class="campaign-editor" aria-labelledby="campaign-editor-title" tabindex="-1">
        <header class="editor-heading"><div><span class="eyebrow">CREATIVIDAD</span><h2 id="campaign-editor-title">{{ selectedId ? 'Editar campaña' : 'Nueva campaña' }}</h2></div><span v-if="selectedCampaign" :class="statusClass(selectedCampaign.status)">{{ statusLabels[selectedCampaign.status] }}</span></header>
        <form class="campaign-form" @submit.prevent="saveCampaign">
          <label><span>Marca</span><input v-model="form.brandName" maxlength="100" required placeholder="Nombre de la marca" /></label>
          <label><span>Titular</span><input v-model="form.headline" maxlength="120" required placeholder="Una idea que se recuerde" /></label>
          <label><span>Texto</span><textarea v-model="form.body" maxlength="500" required rows="3" placeholder="Presenta la propuesta en pocas líneas" /><small>{{ form.body.length }} / 500</small></label>
          <label class="campaign-image-field"><span>Imagen del anuncio · almacenamiento local</span><input type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy" @change="uploadCampaignImage" /><small>{{ busy ? 'Subiendo al servidor…' : 'JPG, PNG o WebP · máximo 8 MB. La imagen se guarda en el servidor.' }}</small><span v-if="form.imageUrl" class="campaign-image-current">Imagen cargada localmente <button type="button" :disabled="busy" @click="form.imageUrl = ''">Quitar imagen</button></span></label>
          <div class="field-pair">
            <label><span>Texto del botón</span><input v-model="form.ctaLabel" maxlength="40" required placeholder="Conocer más" /></label>
            <label><span>Destino · URL o ruta interna</span><input v-model="form.destinationUrl" type="text" inputmode="url" required placeholder="https://marca.com o /explore" /></label>
          </div>
          <div class="field-pair date-pair">
            <label><span>Inicia · opcional</span><input v-model="form.startsAt" type="datetime-local" /></label>
            <label><span>Termina · opcional</span><input v-model="form.endsAt" type="datetime-local" /></label>
          </div>
          <label><span>Estado</span><select v-model="form.status"><option value="draft">Borrador</option><option value="active">Activa</option><option value="paused">Pausada</option><option value="archived">Archivada</option></select><small>Solo una campaña activa y dentro de sus fechas aparece en los feeds.</small></label>
          <div class="editor-actions">
            <button class="save-campaign-button" type="submit" :disabled="busy"><Save :size="15" /> {{ busy ? 'Guardando…' : selectedId ? 'Guardar cambios' : 'Guardar campaña' }}</button>
            <button v-if="selectedId" class="delete-campaign-button" type="button" :disabled="busy" aria-label="Eliminar campaña" title="Eliminar campaña" @click="selectedCampaign && removeCampaign(selectedCampaign)"><Trash2 :size="16" /></button>
          </div>
        </form>
      </section>

      <aside class="campaign-preview-column">
        <span class="eyebrow">VISTA PREVIA EN EL FEED</span>
        <article class="ad-preview-card">
          <div class="ad-preview-media">
            <img v-if="previewImageUrl" :src="previewImageUrl" :alt="form.headline || 'Vista previa de campaña'" />
            <div v-else class="preview-placeholder"><Megaphone :size="28" /><span>Imagen de campaña</span></div>
          </div>
          <div class="ad-preview-content">
            <div class="preview-disclosure"><span>ANUNCIO</span><span>{{ form.brandName || 'Nombre de marca' }}</span></div>
            <h3>{{ form.headline || 'El titular de tu campaña' }}</h3>
            <p>{{ form.body || 'Aquí aparecerá el texto de presentación de la marca.' }}</p>
            <span class="preview-cta">{{ form.ctaLabel || 'Conocer más' }} <ArrowUpRight :size="14" /></span>
          </div>
        </article>
        <p class="preview-note"><CirclePause :size="14" /> Borradores y campañas pausadas solo son visibles en este estudio.</p>
      </aside>
    </div>

    <section class="campaign-library" aria-labelledby="campaign-library-title">
      <header class="library-heading"><div><span class="eyebrow">BIBLIOTECA</span><h2 id="campaign-library-title">Campañas y ejemplos</h2></div><button class="refresh-campaigns" type="button" :disabled="loading" @click="loadCampaigns">{{ loading ? 'Actualizando…' : 'Actualizar' }}</button></header>
      <div v-if="campaigns.length" class="campaign-grid">
        <article v-for="campaign in campaigns" :key="campaign.id" class="campaign-item" :class="{ selected: selectedId === campaign.id }">
          <img v-if="campaign.imageUrl" :src="resolveAdImageUrl(campaign.imageUrl)" :alt="campaign.headline" loading="lazy" />
          <div v-else class="campaign-item-placeholder"><Megaphone :size="20" /></div>
          <div class="campaign-item-copy"><div><strong>{{ campaign.brandName }}</strong><span :class="statusClass(campaign.status)">{{ statusLabels[campaign.status] }}</span></div><h3>{{ campaign.headline }}</h3><p>{{ campaign.body }}</p><small>Botón: {{ campaign.ctaLabel }}</small></div>
          <button class="edit-campaign-button" type="button" :aria-label="`Editar campaña de ${campaign.brandName}`" @click="editCampaign(campaign)">Editar campaña</button>
        </article>
      </div>
      <div v-else class="campaign-empty"><Megaphone :size="21" /><p>{{ loading ? 'Cargando campañas…' : 'Aún no hay campañas. Crea una o vuelve a cargar los ejemplos.' }}</p></div>
    </section>

    <section class="ad-orders-section" aria-labelledby="ad-orders-title">
      <header class="library-heading"><div><span class="eyebrow">VENTAS</span><h2 id="ad-orders-title">Contrataciones y pagos</h2></div><button class="refresh-campaigns" type="button" @click="loadPricingAndOrders">Actualizar</button></header>
      <div v-if="orders.length" class="ad-orders-table-wrap">
        <table class="ad-orders-table">
          <thead><tr><th>Cliente</th><th>Marca</th><th>Duración</th><th>Importe</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
          <tbody>
            <template v-for="order in orders" :key="order.id">
              <tr>
                <td>{{ (order as AdOrder & { customerEmail?: string }).customerEmail || 'Cuenta eliminada' }}</td>
                <td>{{ order.brandName }}</td><td>{{ order.durationDays }} días</td>
                <td>{{ new Intl.NumberFormat('es-MX', { style: 'currency', currency: order.currency.toUpperCase() }).format(order.totalAmountCents / 100) }}</td>
                <td><span class="order-state" :class="`order-${order.status}`">{{ orderStatusLabels[order.status] }}</span></td>
                <td>{{ new Date(order.createdAt).toLocaleDateString('es-MX') }}</td>
                <td><button class="order-detail-admin-toggle" type="button" :aria-expanded="expandedOrderId === order.id" @click="expandedOrderId = expandedOrderId === order.id ? '' : order.id">{{ expandedOrderId === order.id ? 'Cerrar' : 'Detalle' }}<ChevronUp v-if="expandedOrderId === order.id" :size="13" /><ChevronDown v-else :size="13" /></button></td>
              </tr>
              <tr v-if="expandedOrderId === order.id" class="order-detail-admin-row">
                <td colspan="7">
                  <div class="order-detail-admin">
                    <img v-if="order.imageUrl" :src="resolveAdImageUrl(order.imageUrl)" :alt="order.headline" />
                    <span v-else class="order-detail-admin-placeholder"><Megaphone :size="19" /></span>
                    <div class="order-detail-admin-copy"><span class="eyebrow">{{ order.brandName }} · {{ order.durationDays }} DÍAS</span><h3>{{ order.headline }}</h3><p>{{ order.body || 'Sin descripción adicional.' }}</p><a v-if="order.destinationUrl" :href="order.destinationUrl" target="_blank" rel="noopener noreferrer">{{ order.ctaLabel || 'Abrir destino' }} <ExternalLink :size="12" /></a></div>
                    <dl><div><dt>Pago confirmado</dt><dd>{{ formatOrderDate(order.paidAt) }}</dd></div><div><dt>Inicio</dt><dd>{{ formatOrderDate(order.startsAt || null) }}</dd></div><div><dt>Vencimiento</dt><dd>{{ formatOrderDate(order.endsAt || null) }}</dd></div><div><dt>Tiempo restante</dt><dd>{{ orderRemainingDays(order) === null ? 'Aún no iniciada' : orderRemainingDays(order) === 0 ? 'Finalizada' : `${orderRemainingDays(order)} días` }}</dd></div></dl>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <p v-else class="campaign-empty">Todavía no hay pedidos de anuncios.</p>
    </section>
  </main>
</template>

<style scoped>
.ads-manager { width: min(100%, 1120px); margin: 0 auto; padding: 8px 0 54px; }
.ads-heading, .library-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
.ads-heading { margin-bottom: 20px; }
.ads-heading .eyebrow { display: inline-flex; align-items: center; gap: 5px; color: #68806d; }
.ads-heading h1 { margin: 8px 0 6px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 35px; font-weight: 500; line-height: 1.06; }
.ads-heading p { max-width: 530px; margin: 0; color: #7b8980; font-size: 10px; line-height: 1.55; }
.new-campaign-button, .save-campaign-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 38px; padding: 0 12px; border: 0; border-radius: 4px; color: white; background: #386b4d; cursor: pointer; font-size: 10px; font-weight: 700; }
.campaign-overview { display: grid; grid-template-columns: 100px 120px minmax(0, 1fr); align-items: center; gap: 17px; padding: 12px 0; border-top: 1px solid #e4e9e2; border-bottom: 1px solid #e4e9e2; }
.campaign-overview > div { display: grid; gap: 3px; }
.campaign-overview > div span { color: #839087; font-size: 9px; }
.campaign-overview > div strong { color: #30483a; font-family: 'Newsreader', Georgia, serif; font-size: 21px; font-weight: 500; }
.campaign-overview > p { display: flex; align-items: center; justify-self: end; gap: 7px; margin: 0; color: #718076; font-size: 9px; }
.ads-feedback { display: flex; align-items: center; gap: 7px; margin: 13px 0 0; padding: 9px 11px; border-radius: 4px; font-size: 10px; }
.ads-feedback.is-error { color: #9d473d; background: #fcf1ef; }
.ads-feedback.is-notice { color: #36734d; background: #eef6ee; }
.ads-workspace { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(280px, .95fr); gap: 24px; margin-top: 21px; }
.campaign-editor { padding: 15px; border: 1px solid #e2e8e0; border-radius: 6px; background: #fff; }
.editor-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid #edf0eb; }
.editor-heading h2, .library-heading h2 { margin: 5px 0 0; color: #2e4236; font-family: 'Newsreader', Georgia, serif; font-size: 21px; font-weight: 500; }
.campaign-form { display: grid; gap: 11px; padding-top: 13px; }
.campaign-form label { display: grid; gap: 5px; min-width: 0; color: #5b6a60; font-size: 9px; font-weight: 700; }
.campaign-form input, .campaign-form textarea, .campaign-form select { width: 100%; min-height: 35px; padding: 8px 9px; border: 1px solid #dfe6df; border-radius: 4px; color: var(--ink); background: #fff; font: inherit; font-size: 10px; font-weight: 400; }
.campaign-form input[type="file"] { padding: 5px; color: #68766c; background: #fbfcfa; }
.campaign-form input[type="file"]::file-selector-button { min-height: 25px; margin-right: 8px; padding: 0 8px; border: 1px solid #dce6dc; border-radius: 3px; color: #3b6549; background: #eff5ee; cursor: pointer; font: inherit; }
.campaign-image-current { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #3b704c; font-size: 9px; font-weight: 600; }
.campaign-image-current button { border: 0; color: #a34b42; background: transparent; cursor: pointer; font: inherit; font-size: 9px; font-weight: 700; }
.campaign-form textarea { resize: vertical; line-height: 1.5; }
.campaign-form small { color: #8a968e; font-size: 8px; font-weight: 400; }
.field-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.editor-actions { display: flex; justify-content: flex-end; gap: 7px; padding-top: 2px; }
.save-campaign-button:disabled, .delete-campaign-button:disabled { opacity: .6; cursor: wait; }
.delete-campaign-button { display: grid; width: 36px; height: 36px; place-items: center; border: 1px solid #ead9d5; border-radius: 4px; color: #a34b42; background: #fff; cursor: pointer; }
.campaign-preview-column { display: grid; align-content: start; gap: 9px; }
.ad-preview-card { overflow: hidden; border: 1px solid #e0e7df; border-radius: 7px; background: #fff; }
.ad-preview-media { height: 200px; overflow: hidden; background: #e9eee7; }
.ad-preview-media img { display: block; width: 100%; height: 100%; object-fit: cover; }
.preview-placeholder { display: grid; height: 100%; align-content: center; justify-items: center; gap: 8px; color: #738578; background: #e9eee7; font-size: 9px; }
.ad-preview-content { display: grid; justify-items: start; gap: 8px; padding: 14px; }
.preview-disclosure { display: inline-flex; align-items: center; gap: 8px; color: #7c8980; font-size: 8px; }
.preview-disclosure span:first-child { padding: 4px 5px; border-radius: 3px; color: #44694d; background: #edf4ec; font-size: 7px; font-weight: 800; letter-spacing: .04em; }
.ad-preview-content h3 { margin: 0; color: #293f32; font-family: 'Newsreader', Georgia, serif; font-size: 21px; font-weight: 500; line-height: 1.15; }
.ad-preview-content p { margin: 0; color: #77847b; font-size: 9px; line-height: 1.55; }
.preview-cta { display: inline-flex; align-items: center; gap: 6px; min-height: 31px; padding: 0 9px; border-radius: 4px; color: white; background: #386b4d; font-size: 8px; font-weight: 700; }
.preview-note { display: flex; align-items: flex-start; gap: 6px; margin: 0; color: #89958d; font-size: 8px; line-height: 1.5; }
.campaign-library { margin-top: 28px; }
.pricing-rules { display: grid; gap: 12px; margin-top: 18px; padding: 14px; border: 1px solid #e2e8e0; border-radius: 6px; background: #fff; }
.pricing-rules-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid #edf0eb; }
.pricing-rules-heading h2, .ad-orders-section h2 { margin: 4px 0 0; color: #2e4236; font-family: 'Newsreader', Georgia, serif; font-size: 20px; font-weight: 500; }
.stripe-status { display: inline-flex; align-items: center; gap: 6px; padding: 5px 7px; border-radius: 4px; font-size: 8px; font-weight: 700; }
.stripe-status > span { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.stripe-ready { color: #32714a; background: #e8f3e9; }
.stripe-unready { color: #96631a; background: #fff3d7; }
.pricing-rules-form { display: grid; grid-template-columns: 1.3fr .8fr .8fr auto auto; align-items: end; gap: 10px; }
.pricing-rules-form > label { display: grid; gap: 5px; min-width: 0; color: #5b6a60; font-size: 9px; font-weight: 700; }
.pricing-rules-form input:not([type="checkbox"]), .price-input select { width: 100%; min-height: 34px; padding: 6px 8px; border: 1px solid #dfe6df; border-radius: 4px; color: var(--ink); background: #fff; font-size: 10px; }
.price-input { display: flex; gap: 5px; }
.price-input select { width: 70px; }
.pricing-rules-form .checkout-enable { display: flex; align-items: center; min-height: 34px; white-space: nowrap; }
.checkout-enable input { accent-color: #386b4d; }
.pricing-rules-form .save-campaign-button { min-height: 34px; font-size: 9px; }
.pricing-footnote { margin: 0; color: #7f8d83; font-size: 8px; line-height: 1.5; }
.ad-orders-section { margin-top: 28px; }
.ad-orders-table-wrap { overflow-x: auto; }
.ad-orders-table { width: 100%; border-collapse: collapse; text-align: left; }
.ad-orders-table th, .ad-orders-table td { padding: 10px 8px; border-bottom: 1px solid #e8ece6; color: #59685e; font-size: 9px; white-space: nowrap; }
.ad-orders-table th { color: #839087; font-size: 8px; font-weight: 700; }
.order-detail-admin-toggle { display: inline-flex; align-items: center; gap: 3px; padding: 4px 0; border: 0; color: #3b704c; background: transparent; cursor: pointer; font-size: 8px; font-weight: 700; }
.order-detail-admin-row td { white-space: normal; background: #fafcf9; }
.order-detail-admin { display: grid; grid-template-columns: 110px minmax(150px, 1fr) minmax(280px, 1fr); align-items: center; gap: 13px; padding: 7px 0; }
.order-detail-admin > img, .order-detail-admin-placeholder { width: 110px; aspect-ratio: 1.45; object-fit: cover; border-radius: 4px; color: #718577; background: #e9eee7; }
.order-detail-admin-placeholder { display: grid; place-items: center; }
.order-detail-admin-copy h3 { margin: 4px 0; color: #2c4034; font-family: 'Newsreader', Georgia, serif; font-size: 16px; font-weight: 500; }
.order-detail-admin-copy p { margin: 0; color: #758178; font-size: 8px; line-height: 1.5; }
.order-detail-admin-copy a { display: inline-flex; align-items: center; gap: 4px; margin-top: 5px; color: #3b704c; font-size: 8px; font-weight: 700; }
.order-detail-admin dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
.order-detail-admin dl div { display: grid; gap: 3px; }
.order-detail-admin dt { color: #87938a; font-size: 8px; }
.order-detail-admin dd { margin: 0; color: #46584b; font-size: 8px; font-weight: 700; }
.order-state { padding: 4px 6px; border-radius: 3px; font-size: 8px; font-weight: 700; }
.order-paid { color: #317149; background: #e8f3e9; }
.order-checkout_pending { color: #8d671d; background: #fff3d7; }
.order-expired, .order-failed, .order-refunded { color: #8c554e; background: #f7eae7; }
.library-heading { padding-bottom: 10px; border-bottom: 1px solid #e2e8e0; }
.refresh-campaigns { border: 0; color: #54715c; background: transparent; cursor: pointer; font-size: 9px; font-weight: 700; }
.campaign-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding-top: 12px; }
.campaign-item { position: relative; overflow: hidden; border: 1px solid #e2e8e0; border-radius: 6px; background: #fff; cursor: pointer; transition: border-color .16s ease, transform .16s ease; }
.campaign-item:hover, .campaign-item.selected { border-color: #8daa94; transform: translateY(-1px); }
.campaign-item > img, .campaign-item-placeholder { display: grid; width: 100%; height: 122px; place-items: center; object-fit: cover; color: #77877a; background: #e9eee7; }
.campaign-item-copy { display: grid; gap: 6px; padding: 11px; }
.campaign-item-copy > div { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.campaign-item-copy > div > strong { overflow: hidden; color: #48584d; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.campaign-status { flex: 0 0 auto; padding: 4px 5px; border-radius: 3px; font-size: 7px; font-weight: 800; }
.status-draft { color: #796128; background: #f8f0db; }
.status-active { color: #32714a; background: #e8f3e9; }
.status-paused { color: #74615d; background: #f1ece9; }
.status-archived { color: #78817c; background: #edf0ed; }
.campaign-item-copy h3 { margin: 0; color: #304539; font-family: 'Newsreader', Georgia, serif; font-size: 16px; font-weight: 500; line-height: 1.15; }
.campaign-item-copy p { display: -webkit-box; overflow: hidden; min-height: 38px; margin: 0; color: #7c8880; font-size: 8px; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.campaign-item-copy small { color: #64806c; font-size: 7px; }
.edit-campaign-button { position: absolute; top: 7px; right: 7px; padding: 5px 7px; border: 1px solid rgba(255,255,255,.8); border-radius: 3px; color: #2c4535; background: rgba(255,255,255,.92); cursor: pointer; font-size: 8px; font-weight: 700; }
.campaign-empty { display: flex; align-items: center; gap: 8px; padding: 19px 0; color: #7c8980; font-size: 9px; }
.campaign-empty p { margin: 0; }
@media (max-width: 850px) { .ads-workspace { grid-template-columns: 1fr; } .campaign-preview-column { max-width: 560px; } .campaign-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 850px) { .pricing-rules-form { grid-template-columns: repeat(2, minmax(0, 1fr)); } .pricing-rules-form .save-campaign-button { grid-column: 2; } }
@media (max-width: 850px) { .order-detail-admin { grid-template-columns: 90px minmax(0, 1fr); } .order-detail-admin > img, .order-detail-admin-placeholder { width: 90px; } .order-detail-admin dl { grid-column: 1 / -1; } }
@media (max-width: 560px) { .ads-heading { align-items: flex-start; flex-direction: column; } .ads-heading h1 { font-size: 30px; } .campaign-overview { grid-template-columns: 70px 90px; gap: 11px; } .campaign-overview > p { grid-column: 1 / -1; justify-self: start; } .field-pair, .campaign-grid { grid-template-columns: 1fr; } }
</style>
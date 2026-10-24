<script setup lang="ts">
import axios from 'axios'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AlertTriangle, CalendarClock, Check, ChevronDown, ChevronUp, CreditCard, ExternalLink, ImagePlus, LoaderCircle, Megaphone, ShieldCheck, Video } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { adsApi, resolveAdImageUrl, type AdOrder, type AdPricingRules } from '../services/adsApi'

const route = useRoute()
const rules = ref<AdPricingRules | null>(null)
const orders = ref<AdOrder[]>([])
const expandedOrderId = ref('')
const loading = ref(true)
const uploading = ref(false)
const checkingPayment = ref(false)
const submitting = ref(false)
const error = ref('')
const notice = ref('')
const durationDays = ref(7)
const quote = ref<{ durationDays: number; currency: 'mxn' | 'usd'; unitPriceCents: number; totalAmountCents: number } | null>(null)
const imageUrl = ref('')
const mediaType = ref<'image' | 'video' | 'none'>('none')
const mediaPreviewUrl = ref('')
const dragActive = ref(false)
const form = ref({
  brandName: '',
  headline: '',
  body: '',
  ctaLabel: 'Conocer más',
  destinationUrl: '',
})
let paymentPollTimer: ReturnType<typeof setTimeout> | undefined

const priceLabel = computed(() => {
  const currency = rules.value?.currency.toUpperCase() || 'MXN'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format((quote.value?.totalAmountCents || 0) / 100)
})
const unitPriceLabel = computed(() => {
  const currency = rules.value?.currency.toUpperCase() || 'MXN'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format((rules.value?.pricePerDayCents || 0) / 100)
})

function messageFrom(errorValue: unknown, fallback: string) {
  if (axios.isAxiosError(errorValue) && typeof errorValue.response?.data?.message === 'string') return errorValue.response.data.message
  return errorValue instanceof Error ? errorValue.message : fallback
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}

async function refreshQuote() {
  quote.value = null
  error.value = ''
  if (!rules.value || durationDays.value < rules.value.minDurationDays || durationDays.value > rules.value.maxDurationDays) return
  try {
    quote.value = await adsApi.quote(durationDays.value)
  } catch (requestError) {
    error.value = messageFrom(requestError, 'No se pudo calcular el precio.')
  }
}

async function loadOrders() {
  try {
    orders.value = await adsApi.listMyOrders()
  } catch (requestError) {
    error.value = messageFrom(requestError, 'No se pudo cargar tu historial de anuncios.')
  }
}

async function inspectCheckoutReturn() {
  const sessionId = typeof route.query.session_id === 'string' ? route.query.session_id : ''
  const wasCancelled = route.query.cancelled === '1'
  if (wasCancelled) notice.value = 'El pago se canceló. Tu campaña no se publicó y puedes volver a intentarlo.'
  if (!sessionId) return
  checkingPayment.value = true
  try {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const order = await adsApi.getMyOrder(sessionId)
      orders.value = [order, ...orders.value.filter((item) => item.id !== order.id)]
      if (order.status === 'paid') {
        notice.value = 'Pago confirmado. Tu campaña quedó activada y aparecerá durante el periodo contratado.'
        return
      }
      if (order.status !== 'checkout_pending') {
        notice.value = order.status === 'expired' ? 'El checkout expiró. Puedes volver a contratar la campaña.' : 'El pago no se completó; la campaña permanece sin publicar.'
        return
      }
      await new Promise((resolve) => { paymentPollTimer = setTimeout(resolve, 2500) })
    }
    notice.value = 'El pago sigue verificándose con Stripe. La campaña se activará cuando llegue la confirmación segura.'
  } catch (requestError) {
    error.value = messageFrom(requestError, 'No se pudo verificar el estado del pago.')
  } finally {
    checkingPayment.value = false
  }
}

function clearMediaPreview() {
  if (mediaPreviewUrl.value) {
    URL.revokeObjectURL(mediaPreviewUrl.value)
    mediaPreviewUrl.value = ''
  }
  mediaType.value = 'none'
}

async function handleSelectedMedia(file?: File) {
  if (!file) return
  error.value = ''

  if (file.type.startsWith('image/')) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      error.value = 'Elige una imagen JPG, PNG o WebP.'
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      error.value = 'La imagen no puede superar los 8 MB.'
      return
    }
    clearMediaPreview()
    uploading.value = true
    try {
      imageUrl.value = await adsApi.uploadImage(file)
      mediaType.value = 'image'
    } catch (requestError) {
      error.value = messageFrom(requestError, 'No se pudo subir la creatividad.')
    } finally {
      uploading.value = false
    }
    return
  }

  if (file.type.startsWith('video/')) {
    if (file.size > 32 * 1024 * 1024) {
      error.value = 'El video no puede superar los 32 MB.'
      return
    }
    clearMediaPreview()
    mediaPreviewUrl.value = URL.createObjectURL(file)
    mediaType.value = 'video'
    notice.value = 'Vista previa de video cargada. La publicación final sigue el flujo de imagen en la plataforma.'
    return
  }

  error.value = 'El contenido debe ser una imagen o un video compatible.'
}

async function handleImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  await handleSelectedMedia(file)
}

function onMediaDrop(event: DragEvent) {
  dragActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void handleSelectedMedia(file)
}

async function beginCheckout() {
  if (!quote.value || !rules.value?.stripeReady || !rules.value.checkoutEnabled) return
  submitting.value = true
  error.value = ''
  try {
    const result = await adsApi.startCheckout({
      ...form.value,
      imageUrl: imageUrl.value || undefined,
      durationDays: durationDays.value,
    })
    window.location.assign(result.checkoutUrl)
  } catch (requestError) {
    error.value = messageFrom(requestError, 'No se pudo iniciar el pago seguro.')
    submitting.value = false
  }
}

function statusLabel(status: AdOrder['status']) {
  return ({ checkout_pending: 'Pago pendiente', paid: 'Pagado · campaña activa', expired: 'Checkout expirado', failed: 'Pago fallido', refunded: 'Reembolsado · campaña pausada' })[status]
}

function formatOrderDate(value: string | null) {
  if (!value) return 'Pendiente de confirmación'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function remainingDays(order: AdOrder) {
  if (order.status !== 'paid' || !order.endsAt) return null
  return Math.max(0, Math.ceil((Date.parse(order.endsAt) - Date.now()) / 86_400_000))
}

function campaignProgress(order: AdOrder) {
  if (!order.startsAt || !order.endsAt) return 0
  const total = Date.parse(order.endsAt) - Date.parse(order.startsAt)
  if (total <= 0) return 100
  return Math.min(100, Math.max(0, ((Date.now() - Date.parse(order.startsAt)) / total) * 100))
}

function toggleOrderDetails(orderId: string) {
  expandedOrderId.value = expandedOrderId.value === orderId ? '' : orderId
}

onMounted(async () => {
  loading.value = true
  try {
    rules.value = await adsApi.getPricing()
    durationDays.value = rules.value.minDurationDays
    await refreshQuote()
    await Promise.all([loadOrders(), inspectCheckoutReturn()])
  } catch (requestError) {
    error.value = messageFrom(requestError, 'No se pudo cargar la contratación de anuncios.')
  } finally {
    loading.value = false
  }
})

watch(durationDays, () => { if (!loading.value) void refreshQuote() })
onBeforeUnmount(() => {
  if (paymentPollTimer) clearTimeout(paymentPollTimer)
  clearMediaPreview()
})
</script>

<template>
  <main class="ad-checkout-page">
    <header class="checkout-heading">
      <span class="eyebrow"><Megaphone :size="14" /> PROMOCIÓN PARA MARCAS</span>
      <h1>Haz visible tu propuesta</h1>
      <p>Crea un anuncio transparente que aparecerá entre las historias públicas durante el tiempo que elijas.</p>
    </header>

    <p v-if="error" class="checkout-feedback is-error" role="alert"><AlertTriangle :size="15" />{{ error }}</p>
    <p v-if="notice" class="checkout-feedback is-notice" role="status"><Check :size="15" />{{ notice }}</p>
    <p v-if="loading || checkingPayment" class="checkout-loading"><LoaderCircle class="spin" :size="15" />{{ loading ? 'Cargando tarifas…' : 'Verificando pago con Stripe…' }}</p>

    <section v-if="rules" class="checkout-grid">
      <form class="campaign-details" @submit.prevent="beginCheckout">
        <span class="eyebrow">1 · TU ANUNCIO</span>
        <label><span>Nombre de marca</span><input v-model="form.brandName" maxlength="100" required placeholder="Ej. Café de Barrio" /></label>
        <label><span>Titular</span><input v-model="form.headline" maxlength="120" required placeholder="Una pausa sabe mejor cerca" /></label>
        <label><span>Mensaje</span><textarea v-model="form.body" maxlength="500" rows="3" required placeholder="Cuenta a la comunidad qué hace especial tu propuesta." /><small>{{ form.body.length }} / 500</small></label>
        <label class="media-upload-label"><span>Contenido multimedia · imagen o video</span>
          <div class="media-upload-zone" :class="{ active: dragActive, 'has-video': mediaType === 'video', 'has-image': mediaType === 'image' }" @dragover.prevent="dragActive = true" @dragleave.prevent="dragActive = false" @drop.prevent="onMediaDrop">
            <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" :disabled="uploading || submitting" @change="handleImageChange" />
            <div class="media-upload-content">
              <div class="media-upload-icon" :class="{ pulse: dragActive }">
                <ImagePlus v-if="mediaType !== 'video'" :size="18" />
                <Video v-else :size="18" />
              </div>
              <div class="media-upload-copy">
                <strong>{{ mediaType === 'video' ? 'Video listo para vista previa' : mediaType === 'image' ? 'Imagen cargada correctamente' : 'Arrastra la creatividad aquí' }}</strong>
                <small>{{ uploading ? 'Subiendo medios…' : mediaType === 'video' ? 'Formato compatible: MP4 o WebM · vista previa local' : imageUrl ? 'La imagen ya está subida y lista para usar' : 'JPG, PNG, WebP, MP4 o WebM · máximo 32 MB' }}</small>
              </div>
            </div>
          </div>
        </label>
        <label><span>Destino del botón</span><input v-model="form.destinationUrl" type="text" inputmode="url" required placeholder="https://tu-marca.com" /></label>
        <label><span>Texto del botón</span><input v-model="form.ctaLabel" maxlength="40" required placeholder="Conocer más" /></label>
        <label class="duration-control"><span>2 · Tiempo al aire</span><span class="duration-stepper"><button type="button" aria-label="Restar un día" :disabled="durationDays <= rules.minDurationDays" @click="durationDays -= 1">−</button><input v-model.number="durationDays" type="number" :min="rules.minDurationDays" :max="rules.maxDurationDays" /><button type="button" aria-label="Sumar un día" :disabled="durationDays >= rules.maxDurationDays" @click="durationDays += 1">+</button><small>días</small></span><small>Elige entre {{ rules.minDurationDays }} y {{ rules.maxDurationDays }} días. Tarifas: {{ unitPriceLabel }} por día.</small></label>
        <button class="checkout-submit" type="submit" :disabled="submitting || uploading || !quote || !rules.checkoutEnabled || !rules.stripeReady">
          <LoaderCircle v-if="submitting" class="spin" :size="16" />
          <CreditCard v-else :size="16" />
          {{ submitting ? 'Abriendo pago seguro…' : `Continuar al pago · ${priceLabel}` }}
        </button>
        <p v-if="!rules.checkoutEnabled" class="setup-warning">La contratación está pausada temporalmente por la administración.</p>
        <p v-else-if="!rules.stripeReady" class="setup-warning">El checkout aún no está disponible. La plataforma necesita completar la configuración segura de Stripe.</p>
        <p v-else class="secure-note"><ShieldCheck :size="14" /> El pago se procesa en Stripe. El anuncio solo se activa cuando el pago queda confirmado.</p>
      </form>

      <aside class="checkout-summary">
        <span class="eyebrow">RESUMEN</span>
        <article class="checkout-ad-preview">
          <video v-if="mediaType === 'video' && mediaPreviewUrl" :src="mediaPreviewUrl" controls playsinline muted class="media-preview-video" />
          <img v-else-if="imageUrl" :src="resolveAdImageUrl(imageUrl)" :alt="form.headline || 'Creatividad del anuncio'" />
          <div v-else class="preview-empty"><ImagePlus :size="22" /><span>La creatividad es opcional</span></div>
          <div><span class="ad-disclosure">ANUNCIO · {{ form.brandName || 'TU MARCA' }}</span><h2>{{ form.headline || 'Tu titular aparecerá aquí' }}</h2><p>{{ form.body || 'Escribe el mensaje que quieres compartir con la comunidad.' }}</p></div>
        </article>
        <dl class="price-breakdown">
          <div><dt>Duración</dt><dd>{{ durationDays }} {{ durationDays === 1 ? 'día' : 'días' }}</dd></div>
          <div><dt>Precio diario</dt><dd>{{ unitPriceLabel }}</dd></div>
          <div class="price-total"><dt>Total</dt><dd>{{ quote ? money(quote.totalAmountCents, quote.currency) : '—' }}</dd></div>
        </dl>
        <p class="summary-disclosure">Tu campaña no se publica mientras esté en checkout pendiente. Tras la confirmación, se activa por {{ durationDays }} días y queda identificada como anuncio patrocinado.</p>
      </aside>
    </section>

    <section class="order-history">
      <header><div><span class="eyebrow">ACTIVIDAD COMERCIAL</span><h2>Tus campañas contratadas</h2></div><button type="button" @click="loadOrders">Actualizar</button></header>
      <div v-if="orders.length" class="order-list">
        <article v-for="order in orders" :key="order.id" class="order-item">
          <div class="order-row">
            <div><strong>{{ order.brandName }}</strong><span>{{ order.headline }}</span></div>
            <span>{{ order.durationDays }} días</span>
            <strong>{{ money(order.totalAmountCents, order.currency) }}</strong>
            <span class="order-state" :class="`order-${order.status}`">{{ statusLabel(order.status) }}</span>
            <button class="order-detail-toggle" type="button" :aria-expanded="expandedOrderId === order.id" :aria-label="expandedOrderId === order.id ? 'Ocultar detalle' : 'Ver detalle de contratación'" @click="toggleOrderDetails(order.id)">
              {{ expandedOrderId === order.id ? 'Ocultar detalle' : 'Ver detalle' }}
              <ChevronUp v-if="expandedOrderId === order.id" :size="14" /><ChevronDown v-else :size="14" />
            </button>
          </div>
          <section v-if="expandedOrderId === order.id" class="order-detail" :aria-label="`Detalle de ${order.brandName}`">
            <div class="order-detail-creative">
              <img v-if="order.imageUrl" :src="resolveAdImageUrl(order.imageUrl)" :alt="order.headline" />
              <div v-else class="order-detail-placeholder"><Megaphone :size="22" /></div>
              <div><span class="ad-disclosure">ANUNCIO · {{ order.brandName }}</span><h3>{{ order.headline }}</h3><p>{{ order.body || 'Sin descripción adicional.' }}</p><a v-if="order.destinationUrl" :href="order.destinationUrl" target="_blank" rel="noopener noreferrer">{{ order.ctaLabel || 'Abrir destino' }} <ExternalLink :size="13" /></a></div>
            </div>
            <div class="order-detail-facts">
              <div><span>Contratación</span><strong>{{ formatOrderDate(order.createdAt) }}</strong></div>
              <div><span>Pago confirmado</span><strong>{{ formatOrderDate(order.paidAt) }}</strong></div>
              <div><span>Inicio de campaña</span><strong>{{ formatOrderDate(order.startsAt || null) }}</strong></div>
              <div><span>Fin de campaña</span><strong>{{ formatOrderDate(order.endsAt || null) }}</strong></div>
              <div><span>Precio diario</span><strong>{{ money(order.unitPriceCents, order.currency) }}</strong></div>
              <div><span>Total pagado</span><strong>{{ money(order.totalAmountCents, order.currency) }}</strong></div>
            </div>
            <div v-if="remainingDays(order) !== null" class="order-runtime">
              <div><strong>{{ remainingDays(order) === 0 ? 'Campaña finalizada' : `${remainingDays(order)} días restantes` }}</strong><span>{{ order.durationDays }} días contratados</span></div>
              <div class="order-runtime-track" role="progressbar" aria-label="Progreso de la campaña" :aria-valuenow="Math.round(campaignProgress(order))" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${campaignProgress(order)}%` }" /></div>
            </div>
            <p v-else class="order-detail-note"><CalendarClock :size="15" /> La vigencia comienza cuando el pago queda confirmado.</p>
          </section>
        </article>
      </div>
      <p v-else class="order-empty">Los pedidos, pagos y campañas activadas aparecerán aquí.</p>
    </section>
  </main>
</template>

<style scoped>
.ad-checkout-page { width: min(100%, 1040px); margin: 0 auto; padding: 8px 0 54px; }
.checkout-heading { max-width: 650px; margin-bottom: 22px; }
.checkout-heading > .eyebrow { display: inline-flex; align-items: center; gap: 6px; color: #627c68; }
.checkout-heading h1 { margin: 8px 0 5px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 36px; font-weight: 500; line-height: 1.08; }
.checkout-heading p { margin: 0; color: #79877e; font-size: 10px; line-height: 1.55; }
.checkout-feedback { display: flex; align-items: center; gap: 7px; margin: 0 0 12px; padding: 9px 11px; font-size: 10px; }
.checkout-feedback.is-error { color: #a0473d; background: #fcf1ef; }
.checkout-feedback.is-notice { color: #32714a; background: #eaf5eb; }
.checkout-loading { display: flex; align-items: center; gap: 7px; color: #68796d; font-size: 10px; }
.checkout-grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr); gap: 26px; align-items: start; }
.campaign-details { display: grid; gap: 12px; padding: 16px; border: 1px solid #e2e8e0; border-radius: 6px; background: #fff; }
.campaign-details > .eyebrow { color: #67816c; }
.campaign-details label { display: grid; gap: 5px; color: #56665b; font-size: 9px; font-weight: 700; }
.campaign-details input, .campaign-details textarea { width: 100%; min-height: 36px; padding: 8px 10px; border: 1px solid #dfe6df; border-radius: 4px; color: var(--ink); background: #fff; font: inherit; font-size: 10px; font-weight: 400; }
.campaign-details textarea { resize: vertical; line-height: 1.5; }
.campaign-details label > small { color: #849188; font-size: 8px; font-weight: 400; }
.media-upload-label { display: grid; gap: 7px; }
.media-upload-zone { position: relative; overflow: hidden; display: block; min-height: 89px; padding: 12px; border: 1.5px dashed #c8dac8; border-radius: 10px; background: linear-gradient(135deg, #f6faf4 0%, #eef6ef 100%); transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease, background .2s ease; }
.media-upload-zone.active { border-color: #4c8b63; background: linear-gradient(135deg, #f1fbf3 0%, #ebf7ef 100%); box-shadow: 0 0 0 5px rgba(76, 139, 99, .08); transform: translateY(-1px); }
.media-upload-zone.has-image { border-style: solid; border-color: #d2ead8; }
.media-upload-zone.has-video { border-style: solid; border-color: #cfd8ff; background: linear-gradient(135deg, #f5f7ff 0%, #eef2ff 100%); }
.media-upload-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.media-upload-content { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; }
.media-upload-icon { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: rgba(55, 109, 75, .12); color: #2e6a47; box-shadow: inset 0 1px 0 rgba(255,255,255,.5); transition: transform .2s ease, background .2s ease; }
.media-upload-zone.active .media-upload-icon, .media-upload-zone.has-image .media-upload-icon, .media-upload-zone.has-video .media-upload-icon { transform: scale(1.04); }
.media-upload-zone.has-video .media-upload-icon { background: rgba(87, 103, 220, .12); color: #4f5fc7; }
.media-upload-copy { display: grid; gap: 4px; }
.media-upload-copy strong { color: #264730; font-size: 10px; }
.media-upload-copy small { color: #718176; font-size: 8px; line-height: 1.45; }
.media-upload-icon.pulse { animation: media-breath 1s ease-in-out infinite; }
.duration-control { padding-top: 2px; }
.duration-stepper { display: flex; align-items: center; gap: 7px; }
.duration-stepper button { width: 34px; height: 34px; border: 1px solid #dce5dc; border-radius: 4px; color: #40634a; background: #f6f9f5; cursor: pointer; font-size: 18px; }
.duration-stepper button:disabled { opacity: .4; cursor: not-allowed; }
.duration-stepper input { width: 75px; min-height: 34px; text-align: center; font-weight: 700; }
.duration-stepper small { color: #748278; font-size: 9px; font-weight: 400; }
.checkout-submit { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; border: 0; border-radius: 4px; color: #fff; background: #376d4b; cursor: pointer; font-size: 10px; font-weight: 800; }
.checkout-submit:disabled { opacity: .5; cursor: not-allowed; }
.secure-note { display: flex; align-items: center; gap: 6px; margin: -3px 0 0; color: #748378; font-size: 8px; line-height: 1.5; }
.setup-warning { margin: -2px 0 0; color: #9a641f; font-size: 9px; line-height: 1.5; }
.checkout-summary { position: sticky; top: 18px; display: grid; gap: 10px; }
.checkout-summary > .eyebrow { color: #708075; }
.checkout-ad-preview { overflow: hidden; border: 1px solid #e0e7df; border-radius: 6px; background: #fff; }
.checkout-ad-preview > img, .media-preview-video { display: block; width: 100%; max-height: 190px; object-fit: cover; }
.media-preview-video { background: #0f1a15; }
.preview-empty { display: grid; min-height: 110px; place-items: center; align-content: center; gap: 6px; color: #849187; background: #f2f5f0; font-size: 9px; }
.checkout-ad-preview > div:last-child { padding: 12px; }
.ad-disclosure { color: #4b7254; font-size: 7px; font-weight: 800; letter-spacing: .04em; }
.checkout-ad-preview h2 { margin: 6px 0 4px; color: #2c4034; font-family: 'Newsreader', Georgia, serif; font-size: 20px; font-weight: 500; line-height: 1.15; }
.checkout-ad-preview p { margin: 0; color: #79867d; font-size: 9px; line-height: 1.55; }
.price-breakdown { display: grid; gap: 8px; margin: 0; padding: 12px; border: 1px solid #e5eae3; border-radius: 5px; background: #fff; }
.price-breakdown > div { display: flex; justify-content: space-between; gap: 10px; color: #718076; font-size: 9px; }
.price-breakdown dd { margin: 0; color: #3b4b40; font-weight: 700; }
.price-breakdown .price-total { padding-top: 9px; border-top: 1px solid #e9eee7; color: #263c2e; font-size: 12px; font-weight: 800; }
.price-total dd { color: #2f6945; font-size: 15px; }
.summary-disclosure { margin: 0; color: #7d8980; font-size: 8px; line-height: 1.55; }
.order-history { margin-top: 28px; }
.order-history header { display: flex; justify-content: space-between; align-items: end; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid #e3e9e1; }
.order-history header .eyebrow { color: #728176; }
.order-history h2 { margin: 4px 0 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 22px; font-weight: 500; }
.order-history header button { border: 0; color: #3f704c; background: transparent; cursor: pointer; font-size: 9px; font-weight: 700; }
.order-list { display: grid; }
.order-item { border-bottom: 1px solid #edf0eb; }
.order-row { display: grid; grid-template-columns: minmax(0, 1fr) 60px 95px minmax(135px, auto) auto; align-items: center; gap: 10px; padding: 11px 1px; font-size: 9px; }
.order-row > div { display: grid; gap: 3px; }
.order-row > div strong { color: #34463a; }
.order-row > div span { color: #859188; }
.order-row > strong { color: #3b4a3f; text-align: right; }
.order-state { justify-self: end; padding: 4px 6px; border-radius: 3px; font-size: 8px; font-weight: 700; }
.order-detail-toggle { display: inline-flex; align-items: center; gap: 4px; padding: 5px 0 5px 5px; border: 0; color: #3f704c; background: transparent; cursor: pointer; font-size: 9px; font-weight: 700; }
.order-detail { display: grid; gap: 15px; margin: 0 0 14px; padding: 14px; border: 1px solid #e3e9e1; border-radius: 6px; background: #fbfcfa; animation: order-detail-enter .2s ease both; }
.order-detail-creative { display: grid; grid-template-columns: minmax(120px, 190px) minmax(0, 1fr); gap: 14px; align-items: center; }
.order-detail-creative > img, .order-detail-placeholder { width: 100%; aspect-ratio: 1.5; object-fit: cover; border-radius: 4px; background: #e9eee7; }
.order-detail-placeholder { display: grid; place-items: center; color: #718577; }
.order-detail-creative h3 { margin: 5px 0; color: #2c4034; font-family: 'Newsreader', Georgia, serif; font-size: 19px; font-weight: 500; }
.order-detail-creative p { margin: 0; color: #758178; font-size: 9px; line-height: 1.55; }
.order-detail-creative a { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; color: #3b704c; font-size: 9px; font-weight: 700; }
.order-detail-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding-top: 12px; border-top: 1px solid #e8ede6; }
.order-detail-facts div { display: grid; gap: 4px; min-width: 0; }
.order-detail-facts span, .order-runtime span { color: #87938a; font-size: 8px; }
.order-detail-facts strong { color: #46584b; overflow-wrap: anywhere; font-size: 9px; }
.order-runtime { display: grid; gap: 8px; }
.order-runtime > div:first-child { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.order-runtime > div:first-child strong { color: #32714a; font-size: 11px; }
.order-runtime-track { height: 5px; overflow: hidden; border-radius: 999px; background: #e5ece4; }
.order-runtime-track span { display: block; height: 100%; border-radius: inherit; background: #5b9a69; transition: width .25s ease; }
.order-detail-note { display: flex; align-items: center; gap: 6px; margin: 0; color: #827244; font-size: 9px; }
@keyframes order-detail-enter { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes media-breath { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(57, 111, 79, 0); } 50% { transform: scale(1.1); box-shadow: 0 0 0 7px rgba(57, 111, 79, .08); } }
.order-paid { color: #317149; background: #e8f3e9; }
.order-checkout_pending { color: #8d671d; background: #fff3d7; }
.order-expired, .order-failed, .order-refunded { color: #8c554e; background: #f7eae7; }
.order-empty { margin: 0; padding: 15px 0; color: #849087; font-size: 9px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 760px) { .checkout-grid { grid-template-columns: 1fr; } .checkout-summary { position: static; grid-row: 1; } }
@media (max-width: 540px) { .ad-checkout-page { padding-top: 3px; } .checkout-heading h1 { font-size: 31px; } .campaign-details { padding: 13px; } .order-row { grid-template-columns: minmax(0, 1fr) auto; } .order-row > strong { text-align: left; } .order-state { justify-self: start; } .order-detail-creative { grid-template-columns: 1fr; } .order-detail-creative > img, .order-detail-placeholder { max-height: 180px; } .order-detail-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Facebook, LoaderCircle, Send, Share2, X } from 'lucide-vue-next'
import { useSocialStore } from '../../../stores/social'
import type { FeedEntry } from '../../../types/content'
import type { SocialPlatform } from '../types/social.types'

const props = defineProps<{ modelValue: boolean; story: FeedEntry }>()
const emit = defineEmits<{ close: []; published: [] }>()
const social = useSocialStore()
const selectedPlatforms = ref<SocialPlatform[]>([])
const caption = ref('')
const submitted = ref(false)
const maxPostLength = 2200
const attributionUrl = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
  ? ''
  : new URL('/explore', window.location.origin).toString()
const attributionText = computed(() => `Compartido desde Entre Momentos\nUna red social para historias y recuerdos.\nTe invitamos a conocer la comunidad${attributionUrl ? `: ${attributionUrl}` : '.'}`)
const maxCaptionLength = computed(() => maxPostLength - attributionText.value.length - 2)

const platforms = [
  { id: 'facebook' as const, label: 'Facebook', icon: Facebook, note: 'Publicación en tu Página conectada' },
]
const connectedPlatforms = computed(() => new Set(social.connectedAccounts.map((account) => account.platform)))
const imageCount = computed(() => (props.story.media || []).filter((media) => media.type === 'image').length)
const videoCount = computed(() => (props.story.media || []).filter((media) => media.type === 'video').length)
const hasUnsupportedMedia = computed(() => videoCount.value > 0 || imageCount.value > 10)
const canPublish = computed(() => selectedPlatforms.value.length > 0 && !social.publishing && !submitted.value && !hasUnsupportedMedia.value)

watch(() => props.modelValue, async (opened) => {
  if (!opened) return
  caption.value = props.story.caption.slice(0, maxCaptionLength.value)
  selectedPlatforms.value = []
  submitted.value = false
  social.actionError = ''
  await social.loadAccounts()
  selectedPlatforms.value = connectedPlatforms.value.has('facebook') ? ['facebook'] : []
})

async function publish() {
  if (!canPublish.value) return
  const success = await social.publishEntry({
    entryId: props.story.id,
    platforms: ['facebook'],
    caption: caption.value.trim(),
  })
  if (success) {
    submitted.value = true
    emit('published')
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="social-dialog-backdrop" @click.self="emit('close')">
      <section class="social-dialog" role="dialog" aria-modal="true" aria-labelledby="social-dialog-title">
        <header class="social-dialog-header">
          <div><span class="eyebrow">DISTRIBUCIÓN SOCIAL</span><h2 id="social-dialog-title">Publicar en redes</h2></div>
          <button class="icon-button" type="button" aria-label="Cerrar" @click="emit('close')"><X :size="19" /></button>
        </header>

        <div class="social-story-preview">
          <img v-if="story.imageUrl && story.mediaType !== 'video'" :src="story.imageUrl" :alt="story.title || 'Vista previa de la historia'" />
          <video v-else-if="story.imageUrl" :src="story.imageUrl" muted playsinline />
          <div class="social-preview-copy"><strong>{{ story.title || 'Historia personal' }}</strong><span>{{ story.caption }}</span></div>
        </div>
        <p v-if="imageCount > 1 && !videoCount" class="social-message">Se compartirán {{ imageCount }} fotos en una sola publicación de Facebook. El máximo es 10.</p>
        <p v-if="imageCount > 10" class="social-error" role="alert">Facebook permite hasta 10 imágenes por publicación. Reduce los archivos de esta historia para continuar.</p>
        <p v-if="videoCount" class="social-error" role="alert">Esta historia contiene video. La carga de video en Facebook requiere otro flujo y aún no está habilitada.</p>

        <div class="social-platform-heading"><span class="field-label">Selecciona las cuentas</span><RouterLink to="/settings/social" @click="emit('close')">Administrar cuentas</RouterLink></div>
        <div class="social-platform-list">
          <label v-for="platform in platforms" :key="platform.id" class="social-platform-option" :class="{ 'is-disabled': !connectedPlatforms.has(platform.id) }">
            <input v-model="selectedPlatforms" type="checkbox" :value="platform.id" :disabled="!connectedPlatforms.has(platform.id) || submitted" />
            <span class="social-platform-icon"><component :is="platform.icon" :size="19" /></span>
            <span class="social-platform-copy"><strong>{{ platform.label }}</strong><small>{{ connectedPlatforms.has(platform.id) ? platform.note : 'Conecta una cuenta para publicar' }}</small></span>
            <span class="social-platform-status" :class="{ connected: connectedPlatforms.has(platform.id) }">{{ connectedPlatforms.has(platform.id) ? 'Conectada' : 'Desconectada' }}</span>
          </label>
        </div>

        <label class="field-label" for="social-caption">Texto para compartir</label>
        <textarea id="social-caption" v-model="caption" rows="3" :maxlength="maxCaptionLength" :disabled="submitted" />
        <div class="social-caption-count">{{ caption.length + attributionText.length + 2 }} / 2.200 caracteres, incluida la atribución</div>
        <p class="social-attribution-preview">Se añadirá al final: {{ attributionText }}</p>
        <p v-if="!social.accountsLoading && social.accountsError" class="social-error" role="alert">{{ social.accountsError }}</p>
        <p v-if="!social.accountsLoading && !social.accountsError && !social.connectedAccounts.length" class="social-message">No hay cuentas conectadas. Vincula Instagram o Facebook antes de publicar.</p>
        <p v-if="social.actionError" class="social-error" role="alert">{{ social.actionError }}</p>
        <p v-if="submitted" class="social-success" role="status"><Check :size="16" /> Publicado en Facebook. Puedes consultar el resultado en publicaciones externas.</p>

        <footer class="social-dialog-footer">
          <RouterLink v-if="submitted" class="text-link" to="/social/publications" @click="emit('close')">Ver estado de publicación</RouterLink>
          <span v-else class="social-dialog-note"><Share2 :size="14" /> Publicarás en la Página de Facebook conectada</span>
          <button v-if="!submitted" class="button-primary" type="button" :disabled="!canPublish" @click="publish">
            <LoaderCircle v-if="social.publishing" class="spin" :size="16" />
            <Send v-else :size="15" />
            {{ social.publishing ? 'Enviando…' : 'Publicar ahora' }}
          </button>
          <button v-else class="button-primary" type="button" @click="emit('close')">Listo</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.social-dialog-backdrop { position: fixed; z-index: 60; inset: 0; display: grid; place-items: center; overflow: auto; padding: 18px; background: rgba(26,39,31,.5); backdrop-filter: blur(5px); }
.social-dialog { width: min(100%, 530px); max-height: min(92vh, 850px); overflow: auto; padding: 22px; border: 1px solid #e5eae2; border-radius: 9px; background: #fff; box-shadow: 0 24px 80px rgba(16,32,22,.23); }
.social-dialog-header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 15px; border-bottom: 1px solid #edf0eb; }
.social-dialog-header h2 { margin: 5px 0 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 26px; font-weight: 500; }
.social-story-preview { display: flex; gap: 12px; margin: 16px 0; padding: 10px; border-radius: 6px; background: #f5f7f3; }
.social-story-preview > img, .social-story-preview > video { width: 70px; height: 70px; flex: 0 0 auto; border-radius: 4px; object-fit: cover; background: #e2e9e1; }
.social-preview-copy { min-width: 0; display: grid; align-content: center; gap: 5px; }
.social-preview-copy strong { overflow: hidden; color: var(--ink); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.social-preview-copy span { display: -webkit-box; overflow: hidden; color: #77857b; font-size: 10px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.social-platform-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 3px 0 8px; }
.social-platform-heading a { color: var(--green); font-size: 10px; font-weight: 700; }
.social-platform-list { display: grid; gap: 7px; margin-bottom: 14px; }
.social-platform-option { min-height: 56px; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid #e6ebe4; border-radius: 6px; cursor: pointer; }
.social-platform-option:has(input:checked) { border-color: #a8c8b2; background: #f4f8f3; }
.social-platform-option.is-disabled { cursor: default; opacity: .62; }
.social-platform-option input { accent-color: var(--green); }
.social-platform-icon { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; color: var(--green); background: #e8f0e9; }
.social-platform-copy { min-width: 0; display: grid; flex: 1; gap: 3px; }
.social-platform-copy strong { color: #36463c; font-size: 11px; }
.social-platform-copy small { overflow: hidden; color: #8a968e; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.social-platform-status { color: #9a7464; font-size: 9px; }
.social-platform-status.connected { color: #43815b; }
.field-label { display: block; margin: 10px 0 6px; color: #536158; font-size: 11px; font-weight: 700; }
textarea { width: 100%; resize: vertical; padding: 10px; border: 1px solid #e1e8df; border-radius: 5px; color: var(--ink); background: #fbfcfa; font: inherit; font-size: 11px; line-height: 1.5; }
.social-caption-count { margin-top: 4px; color: #9aa49c; font-size: 9px; text-align: right; }
.social-message, .social-error, .social-success { margin: 10px 0 0; color: #7f8d83; font-size: 10px; line-height: 1.5; }
.social-error { color: #b65345; }
.social-success { display: flex; align-items: center; gap: 6px; color: #33734d; }
.social-dialog-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 15px; padding-top: 14px; border-top: 1px solid #edf0eb; }
.social-dialog-note { display: inline-flex; align-items: center; gap: 5px; color: #869389; font-size: 9px; }
.social-dialog-footer .button-primary { min-height: 38px; font-size: 10px; }
.social-dialog-footer .button-primary:disabled { cursor: not-allowed; opacity: .55; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 520px) { .social-dialog { padding: 17px 14px; } .social-platform-status { display: none; } .social-dialog-note { max-width: 145px; line-height: 1.4; } }
</style>

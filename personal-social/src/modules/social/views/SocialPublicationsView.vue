<script setup lang="ts">
import { onMounted } from 'vue'
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, ExternalLink, LoaderCircle, RefreshCw } from 'lucide-vue-next'
import { useSocialStore } from '../../../stores/social'
import type { SocialPublicationStatus } from '../types/social.types'

const social = useSocialStore()
const statusPresentation: Record<SocialPublicationStatus, { label: string; icon: typeof Clock3 }> = {
  PENDING: { label: 'Pendiente', icon: Clock3 },
  PROCESSING: { label: 'Publicando', icon: LoaderCircle },
  PUBLISHED: { label: 'Publicado', icon: CheckCircle2 },
  FAILED: { label: 'Error', icon: AlertCircle },
}

onMounted(() => social.loadPublications())

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <main class="social-publications-page">
    <RouterLink class="social-return-link" to="/settings/social"><ArrowLeft :size="15" /> Cuentas conectadas</RouterLink>
    <header class="social-page-heading">
      <div><span class="eyebrow">DISTRIBUCIÓN SOCIAL</span><h1>Publicaciones externas</h1><p>Consulta el estado de las historias enviadas a Instagram y Facebook.</p></div>
      <button class="icon-button" type="button" aria-label="Actualizar publicaciones" :disabled="social.publicationsLoading" @click="social.loadPublications()"><RefreshCw :size="17" /></button>
    </header>

    <p v-if="social.publicationsLoading" class="social-page-message"><LoaderCircle class="spin" :size="15" /> Consultando publicaciones…</p>
    <div v-else-if="social.publicationsError" class="social-publications-error" role="alert"><AlertCircle :size="18" /><p>{{ social.publicationsError }}</p></div>
    <section v-else-if="social.publications.length" class="social-publication-list" aria-live="polite">
      <article v-for="publication in social.publications" :key="publication.id" class="social-publication-card">
        <div class="publication-platform-mark" :class="`platform-${publication.platform}`">{{ publication.platform === 'instagram' ? 'IG' : 'f' }}</div>
        <div class="publication-main">
          <div class="publication-heading"><h2>{{ publication.storyTitle }}</h2><span class="publication-status" :class="`status-${publication.status.toLowerCase()}`"><component :is="statusPresentation[publication.status].icon" :size="13" />{{ statusPresentation[publication.status].label }}</span></div>
          <p class="publication-caption">{{ publication.caption }}</p>
          <div class="publication-meta"><span>{{ publication.platform === 'instagram' ? 'Instagram' : 'Facebook' }}</span><span>·</span><time :datetime="publication.createdAt">{{ formatDate(publication.createdAt) }}</time></div>
          <p v-if="publication.errorMessage" class="publication-error">{{ publication.errorMessage }}</p>
        </div>
        <a v-if="publication.status === 'PUBLISHED' && publication.externalUrl" class="publication-open" :href="publication.externalUrl" target="_blank" rel="noreferrer" :aria-label="`Abrir publicación en ${publication.platform}`"><ExternalLink :size="16" /></a>
      </article>
    </section>
    <section v-else class="social-publications-empty">
      <span class="eyebrow">AÚN SIN ENVÍOS</span>
      <h2>Las publicaciones externas aparecerán aquí</h2>
      <p>Conecta Instagram o Facebook y comparte una historia para ver sus estados.</p>
      <RouterLink class="button-secondary" to="/settings/social">Configurar cuentas <ArrowLeft :size="14" /></RouterLink>
    </section>
  </main>
</template>

<style scoped>
.social-publications-page { width: min(100%, 850px); margin: 0 auto; padding: 8px 0 50px; }
.social-return-link { display: inline-flex; align-items: center; gap: 6px; color: #64786b; font-size: 10px; font-weight: 600; }
.social-return-link:hover { color: var(--green); }
.social-page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 15px; margin: 18px 0 20px; }
.social-page-heading h1 { margin: 7px 0 6px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 34px; font-weight: 500; line-height: 1.06; }
.social-page-heading p { margin: 0; color: #7f8d83; font-size: 11px; line-height: 1.55; }
.social-page-message { display: flex; align-items: center; gap: 7px; color: #7e8c82; font-size: 11px; }
.social-publications-error { display: flex; align-items: flex-start; gap: 9px; padding: 14px; border: 1px solid #f0d5cf; border-radius: 6px; color: #b65345; background: #fcf3f1; }
.social-publications-error p { margin: 0; font-size: 11px; line-height: 1.5; }
.social-publication-list { display: grid; gap: 9px; }
.social-publication-card { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid #e4e9e2; border-radius: 7px; background: rgba(255,255,255,.9); }
.publication-platform-mark { width: 35px; height: 35px; display: grid; flex: 0 0 auto; place-items: center; border-radius: 9px; color: #785c9c; background: #f0eaf4; font-size: 12px; font-weight: 700; }
.platform-facebook { color: #456c9c; background: #eaf0f8; font-family: Arial, sans-serif; font-size: 20px; }
.publication-main { min-width: 0; flex: 1; }
.publication-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.publication-heading h2 { margin: 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 18px; font-weight: 500; }
.publication-status { display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; }
.status-pending { color: #8c7133; background: #f6efd9; }
.status-processing { color: #557b94; background: #e8f0f5; }
.status-published { color: #367249; background: #e7f2e8; }
.status-failed { color: #ac5044; background: #faeae7; }
.publication-caption { overflow: hidden; margin: 7px 0; color: #69776d; font-size: 10px; line-height: 1.5; text-overflow: ellipsis; }
.publication-meta { display: flex; gap: 6px; color: #9aa49c; font-size: 9px; }
.publication-error { margin: 8px 0 0; color: #b65345; font-size: 10px; }
.publication-open { display: grid; place-items: center; width: 31px; height: 31px; flex: 0 0 auto; border: 1px solid #e5eae2; border-radius: 50%; color: #78877d; }
.publication-open:hover { color: var(--green); background: #f0f6f0; }
.social-publications-empty { min-height: 290px; display: grid; justify-items: center; align-content: center; padding: 25px; border-top: 1px solid #e4e9e2; text-align: center; }
.social-publications-empty .eyebrow { color: #89998d; }
.social-publications-empty h2 { margin: 8px 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 24px; font-weight: 500; }
.social-publications-empty p { max-width: 360px; margin: 0 0 14px; color: #849188; font-size: 11px; line-height: 1.6; }
.social-publications-empty .button-secondary { text-decoration: none; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 620px) { .social-page-heading h1 { font-size: 29px; } .social-publication-card { gap: 9px; padding: 11px; } .publication-heading h2 { font-size: 16px; } }
</style>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowRight, Check, ExternalLink, Facebook, Instagram, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useSocialStore } from '../../../stores/social'
import type { SocialPlatform } from '../types/social.types'

const social = useSocialStore()
const route = useRoute()
const router = useRouter()
const connecting = ref<SocialPlatform | null>(null)
const disconnecting = ref<SocialPlatform | null>(null)
const callbackSuccess = ref(false)
const form = ref({ appId: '', appSecret: '', redirectUri: '', graphVersion: 'v25.0' })
const savingConfig = ref(false)
const configSaved = ref(false)
const graphVersions = ['v25.0', 'v24.0', 'v23.0', 'v22.0']
const platforms = [
  { id: 'instagram' as const, name: 'Instagram', icon: Instagram, description: 'Necesita una cuenta de Creador o Empresa vinculada a una Página de Facebook que administres.' },
  { id: 'facebook' as const, name: 'Facebook', icon: Facebook, description: 'Publica en las páginas que administras en Facebook.' },
]
const connectedCount = computed(() => social.connectedAccounts.length)

function syncFormFromConfig() {
  form.value.appId = social.config.appId || form.value.appId || ''
  form.value.redirectUri = social.config.redirectUri || form.value.redirectUri || 'http://localhost:4020/api/social/callback'
  form.value.graphVersion = social.config.graphVersion || form.value.graphVersion || 'v25.0'
  if (!social.config.hasAppSecret) {
    form.value.appSecret = ''
  }
}

function handleOAuthMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin || event.data?.type !== 'social-oauth-result') return
  callbackSuccess.value = event.data.connected === true
  social.actionError = typeof event.data.error === 'string' ? event.data.error : ''
  void social.loadAccounts()
}

onMounted(async () => {
  window.addEventListener('message', handleOAuthMessage)
  await social.loadConfig()
  syncFormFromConfig()
  await social.loadAccounts()
  if (typeof route.query.connected === 'string') {
    callbackSuccess.value = true
    social.actionError = ''
    window.opener?.postMessage({ type: 'social-oauth-result', connected: true }, window.location.origin)
    if (window.opener) window.close()
    await router.replace({ name: 'social-accounts' })
  } else if (typeof route.query.error === 'string') {
    social.actionError = route.query.error
    window.opener?.postMessage({ type: 'social-oauth-result', error: route.query.error }, window.location.origin)
    if (window.opener) window.close()
    await router.replace({ name: 'social-accounts' })
  }
})

onBeforeUnmount(() => window.removeEventListener('message', handleOAuthMessage))

function accountFor(platform: SocialPlatform) {
  return social.accounts.find((account) => account.platform === platform && account.connected)
}

async function saveMetaConfig() {
  savingConfig.value = true
  configSaved.value = false
  try {
    if (await social.saveConfig(form.value)) {
      syncFormFromConfig()
      if (form.value.appSecret) {
        form.value.appSecret = ''
      }
      configSaved.value = true
    }
  } finally {
    savingConfig.value = false
  }
}

async function connect(platform: SocialPlatform) {
  connecting.value = platform
  await social.startConnection(platform)
  connecting.value = null
}

async function disconnect(platform: SocialPlatform) {
  if (!window.confirm(`¿Desconectar ${platform === 'instagram' ? 'Instagram' : 'Facebook'}?`)) return
  disconnecting.value = platform
  await social.disconnect(platform)
  disconnecting.value = null
}
</script>

<template>
  <main class="social-settings-page">
    <header class="social-page-heading">
      <div><span class="eyebrow">DISTRIBUCIÓN SOCIAL</span><h1>Cuentas conectadas</h1><p>Conecta tus cuentas para preparar publicaciones externas desde tus historias.</p></div>
      <RouterLink class="text-link" to="/social/publications">Ver publicaciones <ArrowRight :size="15" /></RouterLink>
    </header>

    <section class="social-privacy-note"><ShieldCheck :size="18" /><p><strong>Conexión protegida</strong> La autorización se gestiona en el backend. Esta aplicación nunca guarda tus tokens de redes sociales.</p></section>

    <div v-if="!social.config.configured" class="social-config-banner" role="status">
      <strong>Configuración de Meta requerida</strong>
      <p>{{ social.config.message }}</p>
      <small v-if="social.config.missing.length">Faltan: {{ social.config.missing.join(', ') }}</small>
    </div>

    <form class="social-config-form" @submit.prevent="saveMetaConfig">
      <label class="social-config-field"><span>App ID</span><input v-model="form.appId" type="text" placeholder="Meta app ID" /><a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">Abrir panel de apps <ExternalLink :size="11" /></a></label>
      <label class="social-config-field"><span>App Secret</span><input v-model="form.appSecret" type="password" autocomplete="new-password" :placeholder="social.config.hasAppSecret ? 'Secreto guardado. Escribe uno nuevo para reemplazarlo' : 'Déjalo vacío para conservar el secreto guardado'" /><small v-if="social.config.hasAppSecret" class="secret-status">Secreto guardado correctamente. Deja este campo vacío para conservarlo.</small><a href="https://developers.facebook.com/docs/facebook-login/security/#appsecret" target="_blank" rel="noopener noreferrer">Ubicación y seguridad del secreto <ExternalLink :size="11" /></a></label>
      <label class="social-config-field"><span>Redirect URI</span><input v-model="form.redirectUri" type="url" placeholder="http://localhost:4020/api/social/callback" /><a href="https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/#logindialog" target="_blank" rel="noopener noreferrer">Configurar URI OAuth válida <ExternalLink :size="11" /></a></label>
      <label class="social-config-field"><span>Graph API Version</span><select v-model="form.graphVersion"><option v-for="version in graphVersions" :key="version" :value="version">{{ version }}</option></select><a href="https://developers.facebook.com/docs/graph-api/guides/versioning/" target="_blank" rel="noopener noreferrer">Versiones y ciclo de soporte <ExternalLink :size="11" /></a></label>
      <button class="button-primary" type="submit" :disabled="savingConfig">{{ savingConfig ? 'Guardando…' : 'Guardar configuración' }}</button>
    </form>
    <p v-if="configSaved" class="social-page-success" role="status">Configuración de Meta guardada correctamente.</p>
    <nav class="social-doc-links" aria-label="Documentación oficial de Meta">
      <span>Documentación:</span>
      <a href="https://developers.facebook.com/docs/permissions/" target="_blank" rel="noopener noreferrer">Permisos solicitados <ExternalLink :size="11" /></a>
      <a href="https://developers.facebook.com/docs/instagram-api/guides/content-publishing/" target="_blank" rel="noopener noreferrer">Publicación en Instagram <ExternalLink :size="11" /></a>
      <a href="https://developers.facebook.com/docs/facebook-login/security/#strict_mode" target="_blank" rel="noopener noreferrer">Seguridad y URI exacta <ExternalLink :size="11" /></a>
    </nav>

    <div class="social-account-list">
      <article v-for="platform in platforms" :key="platform.id" class="social-account-card">
        <span class="social-account-icon"><component :is="platform.icon" :size="22" /></span>
        <div class="social-account-info">
          <div class="social-account-title"><h2>{{ platform.name }}</h2><span v-if="accountFor(platform.id)" class="social-connected-badge"><Check :size="12" /> Conectada</span><span v-else class="social-disconnected-badge">Sin conectar</span></div>
          <p>{{ accountFor(platform.id)?.accountName || platform.description }}</p>
          <small v-if="accountFor(platform.id)?.connectedAt">Conectada {{ new Date(accountFor(platform.id)!.connectedAt!).toLocaleDateString('es-MX') }}</small>
        </div>
        <button v-if="accountFor(platform.id)" class="button-secondary social-account-action" type="button" :disabled="disconnecting === platform.id" @click="disconnect(platform.id)">
          <LoaderCircle v-if="disconnecting === platform.id" class="spin" :size="15" />
          <span v-else>Desconectar</span>
        </button>
        <button v-else class="button-primary social-account-action" type="button" :disabled="connecting === platform.id" @click="connect(platform.id)">
          <LoaderCircle v-if="connecting === platform.id" class="spin" :size="15" />
          <span v-else>Conectar</span>
        </button>
      </article>
    </div>

    <p v-if="social.accountsLoading" class="social-page-message">Consultando cuentas conectadas…</p>
    <p v-if="social.accountsError" class="social-page-error" role="alert">{{ social.accountsError }}</p>
    <p v-if="callbackSuccess" class="social-page-success" role="status">Cuenta conectada correctamente.</p>
    <p v-if="social.actionError" class="social-page-error" role="alert">{{ social.actionError }}</p>
    <div v-if="!social.accountsLoading && !social.accountsError && !social.actionError && !connectedCount" class="social-empty-note">
      Configura META_APP_ID, META_APP_SECRET y META_REDIRECT_URI en backend/.env para conectar Meta. El flujo OAuth debe completarse desde el backend.
    </div>

    <footer class="social-page-footer"><span>El backend debe validar los permisos y el tipo de contenido admitido por cada plataforma.</span><button class="icon-button subtle" type="button" aria-label="Actualizar cuentas" :disabled="social.accountsLoading" @click="social.loadAccounts()"><RefreshCw :size="16" /></button></footer>
  </main>
</template>

<style scoped>
.social-settings-page { width: min(100%, 850px); margin: 0 auto; padding: 12px 0 50px; }
.social-page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 15px; margin-bottom: 21px; }
.social-page-heading h1 { margin: 7px 0 6px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 34px; font-weight: 500; line-height: 1.06; }
.social-page-heading p { max-width: 460px; margin: 0; color: #7f8d83; font-size: 11px; line-height: 1.55; }
.social-page-heading > .text-link { flex: 0 0 auto; }
.social-privacy-note { display: flex; align-items: flex-start; gap: 10px; padding: 13px 15px; border: 1px solid #dce9de; border-radius: 7px; color: var(--green); background: #eff6ef; }
.social-privacy-note p { margin: 0; color: #63746a; font-size: 10px; line-height: 1.55; }
.social-privacy-note strong { display: block; margin-bottom: 2px; color: #3d654d; font-size: 10px; }
.social-config-banner { margin: 15px 0 10px; padding: 13px 14px; border: 1px solid #e4d7a2; border-radius: 7px; color: #7c6021; background: #fff9ea; }
.social-config-banner strong { display: block; margin-bottom: 4px; }
.social-config-banner p, .social-config-banner small { margin: 0; color: #7a6224; font-size: 10px; line-height: 1.55; }
.social-config-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 11px; margin: 16px 0 18px; }
.social-config-field { display: grid; gap: 5px; color: #66766c; font-size: 10px; font-weight: 700; }
.social-config-field input, .social-config-field select { width: 100%; min-height: 36px; padding: 8px 10px; border: 1px solid #dfdfdf; border-radius: 6px; color: var(--ink); background: white; }
.secret-status { display: block; margin-top: -2px; color: #3f6d49; font-size: 9px; font-weight: 600; }
.social-config-field a, .social-doc-links a { display: inline-flex; align-items: center; gap: 4px; width: fit-content; color: var(--green); font-size: 9px; font-weight: 600; }
.social-doc-links { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 15px; margin: -7px 0 18px; color: #849188; font-size: 9px; }
.social-config-form button { grid-column: 1 / -1; justify-self: flex-end; min-height: 38px; }
.social-account-list { display: grid; gap: 10px; margin-top: 17px; }
.social-account-card { display: flex; align-items: center; gap: 13px; min-height: 95px; padding: 15px; border: 1px solid #e4e9e2; border-radius: 7px; background: rgba(255,255,255,.9); }
.social-account-icon { width: 43px; height: 43px; display: grid; flex: 0 0 auto; place-items: center; border-radius: 11px; color: var(--green); background: #eaf1e9; }
.social-account-info { min-width: 0; flex: 1; }
.social-account-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.social-account-title h2 { margin: 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 20px; font-weight: 500; }
.social-account-info p { margin: 5px 0 0; color: #77857b; font-size: 10px; line-height: 1.5; }
.social-account-info small { display: block; margin-top: 5px; color: #95a097; font-size: 9px; }
.social-connected-badge, .social-disconnected-badge { display: inline-flex; align-items: center; gap: 3px; padding: 3px 6px; border-radius: 4px; color: #367249; background: #e7f2e8; font-size: 9px; font-weight: 700; }
.social-disconnected-badge { color: #897e63; background: #f4f0e4; }
.social-account-action { min-width: 100px; min-height: 36px; font-size: 10px; }
.social-account-action:disabled { opacity: .65; cursor: wait; }
.social-page-message, .social-page-error { margin: 11px 0 0; color: #7c8b81; font-size: 10px; }
.social-page-error { color: #b65345; }
.social-page-success { margin: 11px 0 0; padding: 10px 12px; border: 1px solid #d5e5d5; border-radius: 5px; color: #3b704c; background: #eff7ee; font-size: 10px; }
.social-empty-note { margin-top: 14px; color: #88958c; font-size: 10px; line-height: 1.55; }
.social-page-footer { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-top: 22px; padding-top: 12px; border-top: 1px solid #e4e9e2; color: #929e95; font-size: 9px; line-height: 1.5; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 620px) { .social-page-heading { align-items: flex-start; flex-direction: column; } .social-page-heading h1 { font-size: 30px; } .social-account-card { gap: 9px; padding: 12px; } .social-account-icon { width: 37px; height: 37px; } .social-account-action { min-width: 81px; padding: 0 9px; } }
</style>

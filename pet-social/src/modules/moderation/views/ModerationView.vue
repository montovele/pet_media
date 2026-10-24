<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, Check, Eye, LoaderCircle, RefreshCw, ShieldCheck, UserRoundX, UserRoundCheck, Save } from 'lucide-vue-next'
import { moderationApi, type ModerationPublication, type ModerationRole, type ModerationUser } from '../services/moderationApi'
import { api } from '../../../services/api/client'
import { useAuthStore } from '../../../stores/auth'

const auth = useAuthStore()
const publications = ref<ModerationPublication[]>([])
const users = ref<ModerationUser[]>([])
const roleDrafts = ref<Record<string, ModerationRole>>({})
const activeTab = ref<'pending' | 'approved' | 'users'>('pending')
const expandedPublication = ref<string | null>(null)
const reasons = ref<Record<string, string>>({})
const reviewReasons = ref<Record<string, string>>({})
const loading = ref(false)
const busyUserId = ref<string | null>(null)
const busyPublicationId = ref<string | null>(null)
const busyRoleUserId = ref<string | null>(null)
const error = ref('')
const notice = ref('')
const isSuperadmin = computed(() => auth.user?.role === 'superadmin')

function resolveMediaUrl(value?: string) {
  if (!value) return ''
  const apiBase = new URL(api.defaults.baseURL || window.location.origin, window.location.origin)
  return new URL(value, apiBase).toString()
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function loadPublications(status: 'pending' | 'approved' = activeTab.value === 'approved' ? 'approved' : 'pending') {
  loading.value = true
  error.value = ''
  try {
    publications.value = await moderationApi.listPublications(status)
  } catch (requestError) {
    error.value = requestError instanceof Error
      ? `No se pudo cargar la bandeja de moderación: ${requestError.message}`
      : 'No se pudo cargar la bandeja de moderación. Verifica tu permiso de moderador y la conexión.'
  } finally {
    loading.value = false
  }
}

async function loadUsers() {
  loading.value = true
  error.value = ''
  try {
    users.value = await moderationApi.listUsers()
    roleDrafts.value = Object.fromEntries(users.value.map((user) => [user.id, user.role === 'superadmin' ? 'user' : user.role]))
  } catch {
    error.value = 'No se pudo cargar la gestión de usuarios. Esta sección requiere rol de superadministrador.'
  } finally {
    loading.value = false
  }
}

async function selectTab(tab: 'pending' | 'approved' | 'users') {
  activeTab.value = tab
  publications.value = []
  notice.value = ''
  if (tab === 'users') await loadUsers()
  else await loadPublications(tab)
}

async function reviewPublication(publication: ModerationPublication, decision: 'approve' | 'reject') {
  const key = `${publication.kind}-${publication.id}`
  const reason = reviewReasons.value[key]?.trim() || ''
  if (decision === 'reject' && reason.length < 8) {
    error.value = 'Describe la infracción con al menos 8 caracteres antes de rechazar.'
    return
  }
  busyPublicationId.value = key
  error.value = ''
  notice.value = ''
  try {
    await moderationApi.reviewContent(publication, decision, reason)
    publications.value = publications.value.filter((item) => item.id !== publication.id || item.kind !== publication.kind)
    reviewReasons.value[key] = ''
    notice.value = decision === 'approve'
      ? `Se aprobó la publicación de ${publication.user.name}; ya es visible públicamente.`
      : `Se rechazó la publicación de ${publication.user.name}; no será visible públicamente.`
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'No se pudo registrar la decisión.'
  } finally {
    busyPublicationId.value = null
  }
}

async function saveRole(user: ModerationUser) {
  const role = roleDrafts.value[user.id]
  if (!role || role === user.role || user.role === 'superadmin') return
  busyRoleUserId.value = user.id
  error.value = ''
  notice.value = ''
  try {
    await moderationApi.assignRole(user.id, role)
    users.value = users.value.map((item) => item.id === user.id ? { ...item, role } : item)
    notice.value = `Se actualizó el rol de ${user.name} a ${role}.`
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'No se pudo cambiar el rol.'
  } finally {
    busyRoleUserId.value = null
  }
}

async function setUserStatus(publication: ModerationPublication, isActive: boolean) {
  const reason = reasons.value[publication.user.id]?.trim() || ''
  if (reason.length < 8) {
    error.value = 'Escribe un motivo de al menos 8 caracteres antes de aplicar la medida.'
    return
  }
  busyUserId.value = publication.user.id
  error.value = ''
  notice.value = ''
  try {
    const result = await moderationApi.setUserStatus(publication.user.id, isActive, reason)
    publications.value = publications.value.map((item) => item.user.id === result.id
      ? { ...item, user: { ...item.user, isActive: result.isActive } }
      : item)
    reasons.value[publication.user.id] = ''
    notice.value = isActive
      ? `Se reactivó la cuenta de ${publication.user.name}.`
      : `Se desactivó la cuenta de ${publication.user.name}.`
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'No se pudo actualizar el estado de la cuenta.'
  } finally {
    busyUserId.value = null
  }
}

onMounted(() => void loadPublications())
</script>

<template>
  <main class="moderation-page">
    <header class="moderation-heading">
      <div>
        <span class="eyebrow"><ShieldCheck :size="13" /> MODERACIÓN</span>
        <h1>Revisión de publicaciones</h1>
        <p>{{ activeTab === 'pending' ? 'El contenido público espera aprobación antes de mostrarse.' : activeTab === 'approved' ? 'Consulta el contenido ya visible para la comunidad.' : 'Asigna responsabilidades sin otorgar acceso de superadministrador.' }}</p>
      </div>
      <button class="icon-button" type="button" aria-label="Actualizar bandeja" :disabled="loading" @click="activeTab === 'users' ? loadUsers() : loadPublications()"><RefreshCw :size="16" /></button>
    </header>

    <nav class="moderation-tabs" aria-label="Secciones de moderación">
      <button type="button" :aria-pressed="activeTab === 'pending'" @click="selectTab('pending')">Pendientes</button>
      <button type="button" :aria-pressed="activeTab === 'approved'" @click="selectTab('approved')">Publicadas</button>
      <button v-if="isSuperadmin" type="button" :aria-pressed="activeTab === 'users'" @click="selectTab('users')">Usuarios y roles</button>
    </nav>

    <p v-if="error" class="moderation-error" role="alert"><AlertTriangle :size="16" />{{ error }}</p>
    <p v-if="notice" class="moderation-notice" role="status"><Check :size="16" />{{ notice }}</p>
    <p v-if="loading" class="moderation-loading"><LoaderCircle class="spin" :size="16" /> Cargando {{ activeTab === 'users' ? 'usuarios' : 'publicaciones' }}…</p>

    <section v-if="!loading && activeTab !== 'users' && publications.length" class="moderation-list" aria-live="polite">
      <article v-for="publication in publications" :key="`${publication.kind}-${publication.id}`" class="moderation-item">
        <div class="moderation-item-header">
          <div class="moderation-item-main">
            <span class="moderation-kind">{{ publication.kind === 'story' ? 'Historia' : 'Publicación' }}</span>
            <h2>{{ publication.title || 'Sin título' }}</h2>
            <p class="moderation-author">{{ publication.user.name }} · @{{ publication.user.username }} · {{ publication.user.email }}</p>
            <time :datetime="publication.createdAt">{{ formatDate(publication.createdAt) }}</time>
          </div>
          <div class="moderation-badges">
            <span class="moderation-state" :class="`status-${publication.moderationStatus}`">{{ publication.moderationStatus === 'pending' ? 'Pendiente' : publication.moderationStatus === 'approved' ? 'Aprobada' : 'Rechazada' }}</span>
            <span class="moderation-state" :class="publication.user.isActive ? 'is-active' : 'is-disabled'">{{ publication.user.isActive ? 'Cuenta activa' : 'Cuenta desactivada' }}</span>
          </div>
        </div>

        <button class="review-toggle" type="button" :aria-expanded="expandedPublication === `${publication.kind}-${publication.id}`" @click="expandedPublication = expandedPublication === `${publication.kind}-${publication.id}` ? null : `${publication.kind}-${publication.id}`">
          <Eye :size="15" /> {{ expandedPublication === `${publication.kind}-${publication.id}` ? 'Cerrar revisión' : 'Revisar publicación' }}
        </button>

        <div v-if="expandedPublication === `${publication.kind}-${publication.id}`" class="publication-preview">
          <p>{{ publication.caption }}</p>
          <div v-if="publication.media.length" class="publication-media-grid">
            <template v-for="(media, index) in publication.media" :key="media.id">
              <video v-if="media.type === 'video'" :src="resolveMediaUrl(media.url)" controls preload="metadata" />
              <img v-else :src="resolveMediaUrl(media.url)" :alt="`${publication.title || 'Publicación'} · imagen ${index + 1}`" loading="lazy" />
            </template>
          </div>
          <video v-else-if="publication.imageUrl && publication.mediaType === 'video'" :src="resolveMediaUrl(publication.imageUrl)" controls preload="metadata" />
          <img v-else-if="publication.imageUrl" :src="resolveMediaUrl(publication.imageUrl)" :alt="publication.title || 'Imagen de publicación'" />
          <p v-if="publication.moderationNote" class="moderation-rejection-note">Motivo de rechazo: {{ publication.moderationNote }}</p>

          <div v-if="publication.moderationStatus === 'pending' || publication.moderationStatus === 'approved'" class="content-decision">
            <label :for="`review-reason-${publication.kind}-${publication.id}`">{{ publication.moderationStatus === 'pending' ? 'Motivo si rechazas (mínimo 8 caracteres)' : 'Motivo para retirar esta publicación (mínimo 8 caracteres)' }}</label>
            <textarea :id="`review-reason-${publication.kind}-${publication.id}`" v-model="reviewReasons[`${publication.kind}-${publication.id}`]" rows="2" maxlength="1000" placeholder="Describe qué norma de la comunidad incumple" />
            <div class="decision-buttons">
              <button v-if="publication.moderationStatus === 'pending'" class="moderation-reactivate" type="button" :disabled="busyPublicationId === `${publication.kind}-${publication.id}`" @click="reviewPublication(publication, 'approve')">
                <LoaderCircle v-if="busyPublicationId === `${publication.kind}-${publication.id}`" class="spin" :size="15" />
                <Check v-else :size="15" /> Aprobar y publicar
              </button>
              <button class="moderation-deactivate" type="button" :disabled="busyPublicationId === `${publication.kind}-${publication.id}` || (reviewReasons[`${publication.kind}-${publication.id}`]?.trim().length ?? 0) < 8" @click="reviewPublication(publication, 'reject')">
                <AlertTriangle :size="15" /> {{ publication.moderationStatus === 'pending' ? 'Rechazar' : 'Retirar publicación' }}
              </button>
            </div>
          </div>

          <div class="moderation-action">
            <label :for="`reason-${publication.user.id}`">Motivo para cambiar el estado de la cuenta</label>
            <textarea :id="`reason-${publication.user.id}`" v-model="reasons[publication.user.id]" rows="2" maxlength="1000" placeholder="Describe la infracción observada (mínimo 8 caracteres)" />
            <button v-if="publication.user.isActive" class="moderation-deactivate" type="button" :disabled="busyUserId === publication.user.id || (reasons[publication.user.id]?.trim().length ?? 0) < 8" @click="setUserStatus(publication, false)">
              <LoaderCircle v-if="busyUserId === publication.user.id" class="spin" :size="15" />
              <UserRoundX v-else :size="15" /> Desactivar cuenta
            </button>
            <button v-else class="moderation-reactivate" type="button" :disabled="busyUserId === publication.user.id || (reasons[publication.user.id]?.trim().length ?? 0) < 8" @click="setUserStatus(publication, true)">
              <LoaderCircle v-if="busyUserId === publication.user.id" class="spin" :size="15" />
              <UserRoundCheck v-else :size="15" /> Reactivar cuenta
            </button>
          </div>
        </div>
      </article>
    </section>

    <section v-if="!loading && activeTab === 'users' && isSuperadmin" class="role-user-list" aria-live="polite">
      <article v-for="user in users" :key="user.id" class="role-user-row">
        <div class="role-user-info"><strong>{{ user.name }}</strong><span>{{ user.email }}</span></div>
        <span v-if="user.role === 'superadmin'" class="role-superadmin">Superadministrador protegido</span>
        <template v-else>
          <select v-model="roleDrafts[user.id]" :aria-label="`Rol de ${user.name}`">
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
            <option value="editor">Editor</option>
            <option value="moderator">Moderador</option>
          </select>
          <button class="role-save" type="button" :disabled="busyRoleUserId === user.id || roleDrafts[user.id] === user.role" @click="saveRole(user)">
            <LoaderCircle v-if="busyRoleUserId === user.id" class="spin" :size="15" />
            <Save v-else :size="15" /> Guardar rol
          </button>
        </template>
      </article>
      <p v-if="!users.length" class="role-empty">No hay usuarios para mostrar.</p>
    </section>

    <section v-if="!loading && !error && activeTab !== 'users' && !publications.length" class="moderation-empty">
      <ShieldCheck :size="25" />
      <h2>{{ activeTab === 'pending' ? 'No hay publicaciones pendientes' : 'Aún no hay publicaciones aprobadas' }}</h2>
      <p>{{ activeTab === 'pending' ? 'El contenido público nuevo aparecerá aquí antes de ser visible.' : 'El contenido aprobado aparecerá aquí.' }}</p>
    </section>
  </main>
</template>

<style scoped>
.moderation-page { width: min(100%, 900px); margin: 0 auto; padding: 8px 0 50px; }
.moderation-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
.moderation-heading h1 { margin: 7px 0 6px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 34px; font-weight: 500; line-height: 1.08; }
.moderation-heading p { margin: 0; color: #7f8d83; font-size: 11px; line-height: 1.5; }
.moderation-list { display: grid; gap: 11px; }
.moderation-item { padding: 15px; border: 1px solid #e4e9e2; border-radius: 7px; background: #fff; }
.moderation-item-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.moderation-badges { display: flex; flex-wrap: wrap; gap: 6px; }
.moderation-item-main { min-width: 0; }
.moderation-kind { color: #63806e; font-size: 9px; font-weight: 700; text-transform: uppercase; }
.moderation-item h2 { margin: 5px 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 20px; font-weight: 500; }
.moderation-author, .moderation-item time { display: block; margin: 3px 0; color: #7d8981; font-size: 10px; overflow-wrap: anywhere; }
.moderation-state { flex: 0 0 auto; padding: 5px 7px; border-radius: 4px; font-size: 9px; font-weight: 700; }
.moderation-state.is-active { color: #32714a; background: #e8f3e9; }
.moderation-state.is-disabled { color: #a5483d; background: #faeae7; }
.moderation-state.status-pending { color: #8a6419; background: #fff3d7; }
.moderation-state.status-approved { color: #32714a; background: #e8f3e9; }
.moderation-state.status-rejected { color: #a5483d; background: #faeae7; }
.review-toggle { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 6px 0; border: 0; color: var(--green); background: transparent; cursor: pointer; font-size: 10px; font-weight: 700; }
.publication-preview { margin-top: 10px; padding-top: 12px; border-top: 1px solid #edf0eb; }
.publication-preview > p { margin: 0 0 10px; color: #536158; font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
.publication-media-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 8px; margin: 12px 0 14px; }
.publication-media-grid > img, .publication-media-grid > video, .publication-preview > img, .publication-preview > video { display: block; width: 100%; max-height: 460px; object-fit: contain; background: #f0f2ee; }
.moderation-action { display: grid; justify-items: start; gap: 7px; padding-top: 12px; border-top: 1px solid #edf0eb; }
.moderation-action label { color: #536158; font-size: 10px; font-weight: 700; }
.moderation-action textarea { width: 100%; resize: vertical; padding: 9px 10px; border: 1px solid #dfe6df; border-radius: 5px; color: var(--ink); background: #fbfcfa; font: inherit; font-size: 11px; line-height: 1.5; }
.content-decision { display: grid; gap: 8px; padding: 12px 0; border-top: 1px solid #edf0eb; }
.content-decision label { color: #536158; font-size: 10px; font-weight: 700; }
.content-decision textarea { width: 100%; resize: vertical; padding: 9px 10px; border: 1px solid #dfe6df; border-radius: 5px; color: var(--ink); background: #fbfcfa; font: inherit; font-size: 11px; line-height: 1.5; }
.decision-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.role-user-list { display: grid; }
.role-user-row { display: flex; align-items: center; gap: 12px; min-height: 66px; padding: 10px 2px; border-bottom: 1px solid #e8ece6; }
.role-user-info { display: grid; flex: 1; gap: 4px; min-width: 0; }
.role-user-info strong { color: var(--ink); font-size: 11px; }
.role-user-info span { color: #7f8d83; font-size: 10px; overflow-wrap: anywhere; }
.role-user-row select { min-height: 34px; padding: 5px 8px; border: 1px solid #dfe6df; border-radius: 5px; background: #fff; color: var(--ink); font-size: 10px; }
.role-save { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 34px; padding: 0 9px; border: 1px solid #dce6dc; border-radius: 5px; color: #3b704c; background: #f4f8f3; cursor: pointer; font-size: 10px; font-weight: 700; }
.role-save:disabled { opacity: .5; cursor: not-allowed; }
.role-superadmin { padding: 6px 8px; border-radius: 4px; color: #584d2d; background: #f7f1df; font-size: 9px; font-weight: 700; }
.role-empty { color: #7f8d83; font-size: 11px; }
.moderation-rejection-note { color: #a5483d !important; }
.moderation-tabs { display: flex; gap: 5px; margin: 0 0 16px; border-bottom: 1px solid #e4e9e2; }
.moderation-tabs button { padding: 9px 12px; border: 0; border-bottom: 2px solid transparent; color: #748178; background: transparent; cursor: pointer; font-size: 10px; font-weight: 700; }
.moderation-tabs button[aria-pressed="true"] { border-bottom-color: var(--green); color: var(--green); }
.moderation-deactivate, .moderation-reactivate { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 11px; border: 0; border-radius: 5px; color: #fff; background: #a9483f; cursor: pointer; font-size: 10px; font-weight: 700; }
.moderation-reactivate { background: #387454; }
.moderation-deactivate:disabled, .moderation-reactivate:disabled { opacity: .5; cursor: not-allowed; }
.moderation-error, .moderation-notice { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 10px 12px; border-radius: 5px; font-size: 10px; line-height: 1.5; }
.moderation-error { color: #a5483d; border: 1px solid #f0d5cf; background: #fcf3f1; }
.moderation-notice { color: #32714a; border: 1px solid #d6e7d7; background: #eff7ef; }
.moderation-loading { display: flex; align-items: center; gap: 7px; color: #7f8d83; font-size: 11px; }
.moderation-empty { display: grid; justify-items: center; padding: 55px 22px; border-top: 1px solid #e4e9e2; color: #829087; text-align: center; }
.moderation-empty h2 { margin: 10px 0 4px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 22px; font-weight: 500; }
.moderation-empty p { margin: 0; font-size: 11px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 620px) { .moderation-heading { align-items: flex-start; } .moderation-heading h1 { font-size: 29px; } .moderation-item-header { flex-direction: column; } .role-user-row { align-items: stretch; flex-wrap: wrap; } .role-user-info { flex-basis: 100%; } .moderation-tabs button { padding-inline: 8px; } }
</style>
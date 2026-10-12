<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, Check, LoaderCircle, ShieldAlert, ShieldCheck, UserRoundX } from 'lucide-vue-next'
import { moderationApi, type SupervisionOverview, type SupervisionUser } from '../services/moderationApi'

const overview = ref<SupervisionOverview | null>(null)
const loading = ref(false)
const error = ref('')
const notice = ref('')
const activeOnly = ref(false)
const selectedUserId = ref<string | null>(null)
const actionReason = ref('')
const actionBusy = ref(false)

const filteredUsers = computed(() => {
  if (!overview.value) return []
  return overview.value.users.filter((user) => (!activeOnly.value || user.isActive) && (!selectedUserId.value || user.id === selectedUserId.value))
})

const selectedUser = computed(() => overview.value?.users.find((user) => user.id === selectedUserId.value) || null)

function formatDate(value: string | null) {
  if (!value) return 'Sin actividad reciente'
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function levelClass(level: SupervisionUser['level']) {
  return `level-${level.toLowerCase().replace(/\s+/g, '-')}`
}

async function loadOverview() {
  loading.value = true
  error.value = ''
  try {
    overview.value = await moderationApi.listSupervisionOverview()
    if (!selectedUserId.value && overview.value.users.length) selectedUserId.value = overview.value.users[0].id
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'No se pudo cargar la supervisión.'
  } finally {
    loading.value = false
  }
}

async function toggleUserStatus(user: SupervisionUser, isActive: boolean) {
  const reason = actionReason.value.trim()
  if (reason.length < 8) {
    error.value = 'Escribe un motivo con al menos 8 caracteres antes de desactivar o reactivar.'
    return
  }
  actionBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    const result = await moderationApi.setUserStatus(user.id, isActive, reason)
    if (!overview.value) return
    overview.value = {
      ...overview.value,
      users: overview.value.users.map((item) => item.id === user.id ? { ...item, isActive: result.isActive, moderationNote: result.moderationNote } : item),
      stats: {
        ...overview.value.stats,
        activeUsers: overview.value.stats.activeUsers + (result.isActive && !user.isActive ? 1 : !result.isActive && user.isActive ? -1 : 0),
        inactiveUsers: overview.value.stats.inactiveUsers + (result.isActive && !user.isActive ? -1 : !result.isActive && user.isActive ? 1 : 0),
      },
    }
    notice.value = result.isActive ? `La cuenta de ${user.name} quedó reactivada.` : `La cuenta de ${user.name} quedó desactivada por incumplimiento de reglas.`
    actionReason.value = ''
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : 'No se pudo cambiar el estado de la cuenta.'
  } finally {
    actionBusy.value = false
  }
}

onMounted(() => { void loadOverview() })
</script>

<template>
  <main class="supervision-page">
    <header class="supervision-header">
      <div>
        <span class="eyebrow"><ShieldCheck :size="13" /> VISIÓN DE SUPERADMIN</span>
        <h1>Panorama del usuario</h1>
        <p>Revisa actividad, nivel de implicación y posibles incumplimientos para decidir si se mantiene activa la cuenta o se aplica una sanción.</p>
      </div>
    </header>

    <p v-if="error" class="supervision-feedback is-error" role="alert"><AlertTriangle :size="15" />{{ error }}</p>
    <p v-if="notice" class="supervision-feedback is-notice" role="status"><Check :size="15" />{{ notice }}</p>
    <p v-if="loading" class="supervision-loading"><LoaderCircle class="spin" :size="15" /> Cargando panorama…</p>

    <section v-if="overview" class="supervision-metrics">
      <article><span>Total</span><strong>{{ overview.stats.totalUsers }}</strong></article>
      <article><span>Activas</span><strong>{{ overview.stats.activeUsers }}</strong></article>
      <article><span>Inactivas</span><strong>{{ overview.stats.inactiveUsers }}</strong></article>
      <article><span>Roles</span><strong>{{ overview.stats.adminUsers + overview.stats.editorUsers + overview.stats.moderatorUsers + overview.stats.superadminUsers }}</strong></article>
    </section>

    <section v-if="overview" class="supervision-layout">
      <div class="supervision-list-panel">
        <header class="panel-header">
          <div><span class="eyebrow">USUARIOS</span><h2>Actividad y nivel</h2></div>
          <label class="toggle-filter"><input v-model="activeOnly" type="checkbox" /> Solo activas</label>
        </header>

        <div v-if="filteredUsers.length" class="person-list">
          <button v-for="user in filteredUsers" :key="user.id" class="person-card" :class="selectedUserId === user.id ? 'is-selected' : ''" type="button" @click="selectedUserId = user.id">
            <div class="person-head">
              <div>
                <strong>{{ user.name }}</strong>
                <span>{{ user.email }}</span>
              </div>
              <span class="level-badge" :class="levelClass(user.level)">{{ user.level }}</span>
            </div>
            <div class="stat-row">
              <span>Posts</span><strong>{{ user.postsCount }}</strong>
              <span>Stories</span><strong>{{ user.storiesCount }}</strong>
              <span>Actividades</span><strong>{{ user.activitiesCount }}</strong>
              <span>Acciones</span><strong>{{ user.commentsCount + user.reactionsCount }}</strong>
            </div>
            <small>Última actividad: {{ formatDate(user.lastActivityAt) }}</small>
          </button>
        </div>
        <p v-else class="empty-state">No hay usuarios que coincidan con el filtro.</p>
      </div>

      <aside v-if="selectedUser" class="supervision-detail">
        <span class="eyebrow">DETALLES</span>
        <h2>{{ selectedUser.name }}</h2>
        <p class="detail-email">{{ selectedUser.email }}</p>
        <div class="detail-tags">
          <span>{{ selectedUser.role }}</span>
          <span :class="selectedUser.isActive ? 'tag-active' : 'tag-inactive'">{{ selectedUser.isActive ? 'Activo' : 'Inactivo' }}</span>
          <span :class="levelClass(selectedUser.level)">{{ selectedUser.level }}</span>
        </div>

        <dl class="detail-stats">
          <div><dt>Posts</dt><dd>{{ selectedUser.postsCount }}</dd></div>
          <div><dt>Stories</dt><dd>{{ selectedUser.storiesCount }}</dd></div>
          <div><dt>Actividades</dt><dd>{{ selectedUser.activitiesCount }}</dd></div>
          <div><dt>Comentarios</dt><dd>{{ selectedUser.commentsCount }}</dd></div>
          <div><dt>Reacciones</dt><dd>{{ selectedUser.reactionsCount }}</dd></div>
          <div><dt>Total</dt><dd>{{ selectedUser.totalActivity }}</dd></div>
        </dl>

        <div class="detail-note">
          <strong>Última actividad</strong>
          <span>{{ formatDate(selectedUser.lastActivityAt) }}</span>
        </div>
        <div v-if="selectedUser.moderationNote" class="detail-warning">
          <ShieldAlert :size="14" />{{ selectedUser.moderationNote }}
        </div>

        <label class="action-reason">
          <span>Motivo de sanción o reactivación</span>
          <textarea v-model="actionReason" rows="3" maxlength="1000" placeholder="Describe la infracción o el motivo para reactivar la cuenta." />
        </label>

        <div class="action-buttons">
          <button v-if="selectedUser.isActive" class="danger-button" type="button" :disabled="actionBusy" @click="toggleUserStatus(selectedUser, false)"><LoaderCircle v-if="actionBusy" class="spin" :size="15" /><UserRoundX v-else :size="15" /> Desactivar</button>
          <button v-else class="success-button" type="button" :disabled="actionBusy" @click="toggleUserStatus(selectedUser, true)"><LoaderCircle v-if="actionBusy" class="spin" :size="15" /><ShieldCheck v-else :size="15" /> Reactivar</button>
        </div>
      </aside>
    </section>
  </main>
</template>

<style scoped>
.supervision-page { width: min(100%, 1100px); margin: 0 auto; padding: 8px 0 54px; }
.supervision-header { margin-bottom: 18px; }
.supervision-header h1 { margin: 7px 0 6px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 34px; font-weight: 500; }
.supervision-header p { margin: 0; color: #7a877d; font-size: 11px; line-height: 1.55; }
.supervision-feedback { display: flex; align-items: center; gap: 7px; margin: 0 0 12px; padding: 9px 11px; font-size: 10px; }
.supervision-feedback.is-error { background: #fcf1ef; color: #9b4d45; }
.supervision-feedback.is-notice { background: #eaf5eb; color: #2d6d48; }
.supervision-loading { display: flex; align-items: center; gap: 7px; color: #6a786f; font-size: 10px; }
.supervision-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 16px 0 18px; }
.supervision-metrics article { padding: 12px 14px; border: 1px solid #e3e8e1; border-radius: 6px; background: #fff; }
.supervision-metrics article span { display: block; color: #7b857d; font-size: 9px; }
.supervision-metrics article strong { display: block; margin-top: 4px; color: var(--ink); font-size: 24px; }
.supervision-layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.8fr); gap: 20px; }
.supervision-list-panel, .supervision-detail { padding: 14px; border: 1px solid #e2e8e0; border-radius: 7px; background: #fff; }
.panel-header { display: flex; justify-content: space-between; align-items: end; gap: 8px; margin-bottom: 12px; }
.panel-header h2 { margin: 5px 0 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 23px; font-weight: 500; }
.toggle-filter { display: inline-flex; align-items: center; gap: 7px; color: #66776a; font-size: 9px; }
.person-list { display: grid; gap: 10px; }
.person-card { width: 100%; text-align: left; padding: 11px 12px; border: 1px solid #e3e9e1; border-radius: 6px; background: #fafcf9; cursor: pointer; }
.person-card.is-selected { border-color: #4b795d; background: #f2faf4; }
.person-head { display: flex; justify-content: space-between; gap: 10px; align-items: start; }
.person-head strong { display: block; color: var(--ink); font-size: 12px; }
.person-head span { display: block; color: #77857d; font-size: 9px; }
.level-badge { flex: 0 0 auto; padding: 4px 7px; border-radius: 4px; font-size: 8px; font-weight: 800; }
.level-bajo { color: #8b4a37; background: #fbeae6; }
.level-moderado { color: #8e6d18; background: #fff4d5; }
.level-medio { color: #2c6d4e; background: #eaf5ed; }
.level-alto { color: #2a5b9d; background: #e7eefb; }
.stat-row { display: grid; grid-template-columns: repeat(4, auto); justify-content: start; gap: 8px 12px; margin: 10px 0 6px; font-size: 9px; color: #73827a; }
.stat-row strong { color: var(--ink); }
.person-card small { color: #7a887f; font-size: 8px; }
.empty-state { margin: 0; padding: 20px 0; color: #78857d; font-size: 9px; }
.supervision-detail h2 { margin: 7px 0 4px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 26px; }
.detail-email { margin: 0; color: #73837a; font-size: 9px; }
.detail-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0; }
.detail-tags span { padding: 4px 7px; border-radius: 4px; font-size: 8px; font-weight: 700; }
.tag-active { background: #eaf5eb; color: #2d6d48; }
.tag-inactive { background: #fceae7; color: #a24d44; }
.detail-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px; margin: 0 0 14px; }
.detail-stats div { padding: 8px 10px; border: 1px solid #e3e8e1; border-radius: 5px; background: #fafdf9; }
.detail-stats dt { color: #718178; font-size: 8px; }
.detail-stats dd { margin: 4px 0 0; color: var(--ink); font-size: 13px; font-weight: 700; }
.detail-note { display: grid; gap: 4px; padding: 10px 0; border-top: 1px solid #edf1ee; color: #627369; font-size: 9px; }
.detail-warning { display: flex; align-items: center; gap: 6px; padding: 9px 10px; border-radius: 5px; background: #fff4d5; color: #7d5d16; font-size: 9px; }
.action-reason { display: grid; gap: 6px; margin-top: 14px; }
.action-reason span { color: #5f6d65; font-size: 9px; font-weight: 700; }
.action-reason textarea { width: 100%; min-height: 80px; resize: vertical; border: 1px solid #dfe8df; border-radius: 5px; padding: 8px 10px; font: inherit; font-size: 9px; }
.action-buttons { display: flex; gap: 8px; margin-top: 12px; }
.danger-button, .success-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; flex: 1; min-height: 38px; border: 0; border-radius: 5px; color: white; cursor: pointer; font-size: 9px; font-weight: 800; }
.danger-button { background: #aa4a43; }
.success-button { background: #38714f; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 850px) { .supervision-layout { grid-template-columns: 1fr; } .supervision-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>

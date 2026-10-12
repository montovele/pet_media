<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { Bell, CheckCheck, LoaderCircle, RefreshCw, Sparkles } from 'lucide-vue-next'
import { useNotificationsStore } from '../stores/notifications'

const notifications = useNotificationsStore()
const orderedNotifications = computed(() => notifications.items)
const unreadCount = computed(() => notifications.unreadCount)

onMounted(() => void notifications.loadNotifications())

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function badgeType(type: string) {
  return {
    story: { label: 'Historia', tone: 'story' },
    like: { label: 'Me gusta', tone: 'like' },
    comment: { label: 'Comentario', tone: 'comment' },
    social: { label: 'Social', tone: 'social' },
  }[type] ?? { label: 'Actualización', tone: 'story' }
}
</script>

<template>
  <main class="notifications-page">
    <header class="notifications-header">
      <div>
        <span class="eyebrow"><Bell :size="13" /> NOTIFICACIONES</span>
        <h1>Actividad reciente</h1>
      </div>
      <button v-if="unreadCount" class="button-secondary" type="button" @click="notifications.markAllRead()">
        <CheckCheck :size="15" /> Marcar como leídas
      </button>
      <button class="icon-button" type="button" aria-label="Actualizar notificaciones" :disabled="notifications.loading" @click="notifications.loadNotifications()">
        <RefreshCw :size="16" />
      </button>
    </header>

    <p v-if="notifications.loading && !notifications.loaded" class="notifications-message"><LoaderCircle class="spin" :size="15" /> Cargando actividad…</p>
    <div v-else-if="notifications.error && !notifications.loaded" class="notifications-error" role="alert"><p>{{ notifications.error }}</p><button class="button-secondary" type="button" @click="notifications.loadNotifications()">Reintentar</button></div>
    <section v-else-if="notifications.items.length" class="notifications-list">
      <article v-for="item in orderedNotifications" :key="item.id" class="notification-card" :class="{ 'is-unread': !item.read }">
        <span class="notification-icon" :class="badgeType(item.type).tone">
          <Sparkles :size="15" />
        </span>
        <div class="notification-body">
          <div class="notification-top">
            <strong>{{ item.title }}</strong>
            <span class="notification-pill">{{ badgeType(item.type).label }}</span>
          </div>
          <p>{{ item.description }}</p>
          <time :datetime="item.createdAt">{{ formatDate(item.createdAt) }}</time>
        </div>
      </article>
    </section>

    <section v-else-if="!notifications.loading" class="empty-state notifications-empty">
      <span class="empty-icon"><Bell :size="22" /></span>
      <h2>Sin actividad todavía</h2>
      <p>Cuando alguien reaccione o publique algo relacionado contigo, aparecerá aquí.</p>
    </section>
  </main>
</template>

<style scoped>
.notifications-page {
  width: min(100%, 820px);
  margin: 0 auto;
  padding: 4px 0 40px;
}

.notifications-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.notifications-header h1 {
  margin: 8px 0 0;
  color: var(--ink);
  font-family: 'Newsreader', Georgia, serif;
  font-size: 36px;
  font-weight: 500;
  line-height: 1.06;
}

.notifications-list {
  display: grid;
  gap: 12px;
}

.notifications-message { display: flex; align-items: center; gap: 8px; color: #7c8b81; font-size: 11px; }
.notifications-error { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px; border: 1px solid #f0d5cf; border-radius: 6px; color: #b65345; background: #fcf3f1; }
.notifications-error p { margin: 0; font-size: 11px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.notification-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #e7ebe5;
  border-radius: 8px;
  background: rgba(255,255,255,.85);
}

.notification-card.is-unread {
  border-color: #dfeadf;
  background: #f7faf6;
}

.notification-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 11px;
}

.notification-icon.story { color: #6d7148; background: #f1e7bc; }
.notification-icon.like { color: #aa5b4f; background: #f7ded7; }
.notification-icon.comment { color: #3b6f67; background: #dfeee8; }
.notification-icon.social { color: #5a568d; background: #eee9f8; }

.notification-body {
  min-width: 0;
  flex: 1;
}

.notification-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.notification-top strong {
  color: var(--ink);
  font-size: 12px;
}

.notification-pill {
  padding: 4px 7px;
  border-radius: 999px;
  color: #577265;
  background: #ecf3ee;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.notification-body p {
  margin: 7px 0 4px;
  color: #5f6f67;
  font-size: 11px;
  line-height: 1.55;
}

.notification-body time {
  color: #93a096;
  font-size: 9px;
}

.notifications-empty {
  margin-top: 18px;
}

@media (max-width: 620px) {
  .notifications-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .notifications-header h1 {
    font-size: 30px;
  }

  .button-secondary {
    width: 100%;
    justify-content: center;
  }
}
</style>

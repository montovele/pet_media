<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Aperture, ArrowUp, Bell, BookOpen, CalendarDays, House, Images, Instagram, LogOut, Megaphone, Pencil, Plus, ShieldCheck, Share2, Sparkles, UserRound } from 'lucide-vue-next'
import CreateStoryDialog from './components/CreateStoryDialog.vue'
import { useFeedStore } from './stores/feed'
import { useUiStore } from './stores/ui'
import { useAuthStore } from './stores/auth'
import { useNotificationsStore } from './modules/notifications/stores/notifications'
import { useBrandStore } from './modules/brand/stores/brand'
import { useRoute, useRouter } from 'vue-router'
import { DEFAULT_AVATAR_URL } from './utils/avatar'

const feed = useFeedStore()
const ui = useUiStore()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const brand = useBrandStore()
const route = useRoute()
const router = useRouter()
const defaultProfile = {
  name: 'Mariana López',
  avatarUrl: DEFAULT_AVATAR_URL,
}
const isPublicRoute = computed(() => route.meta.publicOnly === true)
const unreadNotifications = computed(() => notifications.unreadCount)
const showScrollTop = ref(false)
function updateScrollTopVisibility() {
  showScrollTop.value = window.scrollY > 420
}
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}
onMounted(() => {
  updateScrollTopVisibility()
  window.addEventListener('scroll', updateScrollTopVisibility, { passive: true })
  void brand.load()
})
onUnmounted(() => window.removeEventListener('scroll', updateScrollTopVisibility))
watch(() => auth.authenticated, (authenticated) => {
  if (authenticated) void notifications.loadNotifications()
  else notifications.clear()
}, { immediate: true })
const profileUser = computed(() => ({
  ...defaultProfile,
  ...(auth.user ?? {}),
}))
const navigationItems = computed(() => {
  const adItem = auth.user?.role === 'superadmin'
    ? { to: '/admin/ads', label: 'Anuncios', icon: Megaphone }
    : { to: '/ads/checkout', label: 'Promocionar mi marca', icon: Megaphone }

  return [
    { to: '/home', label: 'Inicio', icon: House },
    { to: '/stories', label: 'Historias', icon: BookOpen },
    { to: '/activities', label: 'Actividades', icon: CalendarDays },
    { to: '/photos', label: 'Fotos', icon: Images },
    { to: '/albums', label: 'Álbumes', icon: Aperture },
    { to: '/profile', label: 'Mi perfil', icon: UserRound },
    { to: '/notifications', label: 'Notificaciones', icon: Bell },
    { to: '/settings/social', label: 'Cuentas sociales', icon: Share2 },
    { to: '/social/publications', label: 'Publicaciones externas', icon: Instagram },
    ...(auth.user?.role === 'superadmin' ? [{ to: '/admin/brand', label: 'Marca', icon: Aperture }] : []),
    adItem,
    ...(auth.user?.role === 'superadmin' ? [{ to: '/supervision', label: 'Supervisión', icon: ShieldCheck }] : []),
    ...(auth.user?.isModerator ? [{ to: '/moderation', label: auth.user.role === 'superadmin' ? 'Administración' : 'Moderación', icon: ShieldCheck }] : []),
  ]
})

async function publishStory(story: Parameters<typeof feed.saveStory>[0]) {
  if (await feed.saveStory(story)) ui.closeStoryDialog()
}

async function handleLogout() {
  await auth.logout()
  await router.push({ name: 'public-home' })
}
</script>

<template>
  <RouterView v-if="isPublicRoute" />
  <template v-else>
  <header class="app-header">
    <RouterLink class="brand" to="/home" :aria-label="`${brand.name}, inicio`">
      <span class="brand-mark" :class="{ 'brand-mark--custom': brand.logoUrl }">
        <img v-if="brand.logoUrl" class="brand-logo" :src="brand.logoUrl" alt="" />
        <Aperture v-else :size="20" :stroke-width="2.1" />
      </span>
      <span class="brand-name">{{ brand.name }}</span>
    </RouterLink>
    <div class="header-context"><Sparkles :size="15" /> Un diario para compartir</div>
    <div class="header-actions">
      <RouterLink v-if="auth.user?.role === 'superadmin'" class="icon-button" to="/admin/brand" aria-label="Editar identidad de marca" title="Editar identidad de marca"><Pencil :size="16" /></RouterLink>
      <RouterLink class="icon-button notification-button" to="/notifications" aria-label="Notificaciones">
        <Bell :size="18" /><span v-if="unreadNotifications" class="notification-dot"></span>
      </RouterLink>
      <RouterLink to="/profile" aria-label="Abrir mi perfil">
        <img class="header-avatar" :src="profileUser.avatarUrl" :alt="profileUser.name" />
      </RouterLink>
      <button v-if="auth.authenticated" class="logout-button" type="button" @click="handleLogout" aria-label="Cerrar sesión">
        <LogOut :size="16" />
        <span>Cerrar sesión</span>
      </button>
    </div>
  </header>

  <div class="app-body">
    <aside class="sidebar">
      <span class="sidebar-label">TU ESPACIO</span>
      <nav class="sidebar-nav" aria-label="Navegación principal">
        <RouterLink v-for="item in navigationItems" :key="item.to" class="nav-link" :to="item.to" :title="item.label">
          <component :is="item.icon" :size="18" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
      <div class="sidebar-divider"></div>
      <div class="sidebar-note">
        <span class="sidebar-note-icon"><Sparkles :size="16" /></span>
        <p><strong>Un recuerdo al día</strong>es una forma bonita de volver a estar presente.</p>
      </div>
      <div class="sidebar-profile">
        <img class="avatar" :src="profileUser.avatarUrl" :alt="profileUser.name" />
        <div><strong>{{ profileUser.name }}</strong><span>Tu espacio personal</span></div>
      </div>
    </aside>

    <main class="main-content"><RouterView /></main>
  </div>

  <nav class="mobile-nav" aria-label="Navegación móvil">
    <RouterLink to="/home" aria-label="Inicio"><House :size="20" /></RouterLink>
    <RouterLink to="/stories" aria-label="Historias"><BookOpen :size="20" /></RouterLink>
    <button class="mobile-create" type="button" aria-label="Crear historia" @click="ui.openStoryDialog()"><Plus :size="23" /></button>
    <RouterLink to="/activities" aria-label="Actividades"><CalendarDays :size="20" /></RouterLink>
    <RouterLink v-if="auth.user?.role === 'superadmin'" to="/admin/ads" aria-label="Administrar anuncios"><Megaphone :size="19" /></RouterLink>
    <RouterLink v-else to="/ads/checkout" aria-label="Promocionar mi marca"><Megaphone :size="19" /></RouterLink>
    <RouterLink to="/profile" aria-label="Mi perfil"><UserRound :size="20" /></RouterLink>
  </nav>

  <CreateStoryDialog :model-value="ui.storyDialogOpen" :publishing="feed.storyPublishing" :story="ui.editingStory" @close="ui.closeStoryDialog()" @publish="publishStory" />
  <p v-if="feed.actionError" class="app-action-error" role="alert">{{ feed.actionError }}</p>
  </template>
  <button v-if="showScrollTop" class="scroll-top-button" type="button" aria-label="Volver arriba" title="Volver arriba" @click="scrollToTop">
    <ArrowUp :size="19" :stroke-width="2.2" />
  </button>
</template>

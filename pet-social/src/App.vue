<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ArrowUp, BookOpen, House, LogOut, Megaphone, Palette, PawPrint, Pencil, ShieldCheck, Sparkles, UserRound } from 'lucide-vue-next'
import CreateStoryDialog from './components/CreateStoryDialog.vue'
import { useAuthStore } from './stores/auth'
import { useFeedStore } from './stores/feed'
import { useUiStore } from './stores/ui'
import { useBrandStore } from './modules/brand/stores/brand'
import { useRoute, useRouter } from 'vue-router'
import { DEFAULT_AVATAR_URL } from './utils/avatar'

const auth = useAuthStore()
const feed = useFeedStore()
const ui = useUiStore()
const brand = useBrandStore()
const route = useRoute()
const router = useRouter()
const defaultProfile = {
  name: 'Mariana López',
  avatarUrl: DEFAULT_AVATAR_URL,
}
const isPublicRoute = computed(() => route.meta.publicOnly === true)
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
const profileUser = computed(() => ({
  ...defaultProfile,
  ...(auth.user ?? {}),
}))
const accessLanding = computed(() => {
  const grant = auth.user?.accessGrant
  if (!grant) return '/animals'
  const animalId = grant.animalIds[0] ?? grant.animalId
  if (grant.permissions.includes('health:read') || grant.permissions.includes('health:manage')) return `/bioacta/salud?animalId=${encodeURIComponent(animalId)}`
  if (grant.permissions.includes('care:read') || grant.permissions.includes('care:manage')) return `/bioacta/cuidados?animalId=${encodeURIComponent(animalId)}`
  return `/animals/${encodeURIComponent(animalId)}`
})
const navigationItems = computed(() => {
  if (auth.user?.isAccessGuest) {
    return [{ to: accessLanding.value, label: 'Expediente compartido', icon: ShieldCheck }]
  }
  const adItem = auth.user?.role === 'superadmin'
    ? { to: '/admin/campaigns', label: 'Anuncios', icon: Megaphone }
    : { to: '/campaigns/checkout', label: 'Promocionar mi marca', icon: Megaphone }

  return [
    { to: '/home', label: 'Panel de cuidado', icon: House },
    { to: '/bioacta/inicio', label: 'BIO-ACTA', icon: ShieldCheck },
    { to: '/animals', label: auth.user?.role === 'superadmin' ? 'Registros animales' : 'Mis animales', icon: PawPrint },
    { to: '/stories', label: 'Historias', icon: BookOpen },
    { to: '/profile', label: 'Mi cuenta', icon: UserRound },
    ...(auth.user?.role === 'superadmin' ? [{ to: '/admin/brand', label: 'Marca y estilo', icon: Palette }] : []),
    adItem,
    ...(auth.user?.role === 'superadmin' ? [{ to: '/supervision', label: 'Supervisión', icon: ShieldCheck }] : []),
    ...(auth.user?.isModerator ? [{ to: '/moderation', label: auth.user.role === 'superadmin' ? 'Administración' : 'Moderación', icon: ShieldCheck }] : []),
  ]
})

async function handleLogout() {
  await auth.logout()
  await router.push({ name: 'public-home' })
}

async function publishStory(story: Parameters<typeof feed.saveStory>[0]) {
  if (await feed.saveStory(story)) ui.closeStoryDialog()
}
</script>

<template>
  <RouterView v-if="isPublicRoute" />
  <template v-else>
    <header class="app-header">
      <RouterLink class="brand" to="/home" :aria-label="`${brand.name}, panel de cuidado`">
        <span class="brand-mark" :class="{ 'brand-mark--custom': brand.logoUrl }">
          <img v-if="brand.logoUrl" class="brand-logo" :src="brand.logoUrl" alt="" />
          <PawPrint v-else :size="20" :stroke-width="2.1" />
        </span>
        <span class="brand-name">{{ brand.name }}</span>
      </RouterLink>
      <div class="header-context"><Sparkles :size="15" /> Identidad que acompaña toda su vida</div>
      <div class="header-actions">
        <RouterLink v-if="auth.user?.role === 'superadmin'" class="icon-button" to="/admin/brand" aria-label="Configuración de marca" title="Configuración de marca"><Pencil :size="16" /></RouterLink>
        <RouterLink v-if="!auth.user?.isAccessGuest" to="/profile" aria-label="Abrir mi cuenta"><img class="header-avatar" :src="profileUser.avatarUrl" :alt="profileUser.name" /></RouterLink>
        <span v-else class="header-context">Acceso temporal</span>
        <button v-if="auth.authenticated" class="logout-button" type="button" @click="handleLogout" :aria-label="auth.user?.isAccessGuest ? 'Cerrar acceso temporal' : 'Cerrar sesión'"><LogOut :size="16" /><span>{{ auth.user?.isAccessGuest ? 'Cerrar acceso' : 'Cerrar sesión' }}</span></button>
      </div>
    </header>

    <div class="app-body">
      <aside class="sidebar">
        <span class="sidebar-label">{{ brand.name }}</span>
        <nav class="sidebar-nav" aria-label="Navegación principal">
          <RouterLink v-for="item in navigationItems" :key="item.to" class="nav-link" :to="item.to" :title="item.label">
            <component :is="item.icon" :size="18" :stroke-width="1.8" /><span>{{ item.label }}</span>
          </RouterLink>
        </nav>
        <div class="sidebar-divider"></div>
        <div class="sidebar-note"><span class="sidebar-note-icon"><PawPrint :size="16" /></span><p><strong>{{ auth.user?.isAccessGuest ? 'Acceso limitado' : 'Una vida, una identidad' }}</strong>{{ auth.user?.isAccessGuest ? 'Consulta solo la información autorizada.' : 'Su historia permanece a través de cada etapa.' }}</p></div>
        <div class="sidebar-profile"><img class="avatar" :src="profileUser.avatarUrl" :alt="profileUser.name" /><div><strong>{{ profileUser.name }}</strong><span>{{ auth.user?.isAccessGuest ? 'Invitado temporal' : 'Persona cuidadora' }}</span></div></div>
      </aside>
      <main class="main-content"><RouterView /></main>
    </div>

    <nav class="mobile-nav" aria-label="Navegación móvil">
      <RouterLink v-if="!auth.user?.isAccessGuest" to="/home" aria-label="Panel de cuidado"><House :size="20" /></RouterLink>
      <RouterLink :to="accessLanding" :aria-label="auth.user?.isAccessGuest ? 'Expediente compartido' : 'Mis animales'"><PawPrint :size="20" /></RouterLink>
      <RouterLink v-if="!auth.user?.isAccessGuest" to="/stories" aria-label="Historias"><BookOpen :size="20" /></RouterLink>
      <RouterLink v-if="!auth.user?.isAccessGuest" to="/profile" aria-label="Mi cuenta"><UserRound :size="20" /></RouterLink>
    </nav>
  </template>
  <CreateStoryDialog
    :model-value="ui.storyDialogOpen"
    :publishing="feed.storyPublishing"
    :story="ui.editingStory"
    :error="feed.actionError"
    @close="ui.closeStoryDialog()"
    @publish="publishStory"
  />
  <button v-if="showScrollTop" class="scroll-top-button" type="button" aria-label="Volver arriba" title="Volver arriba" @click="scrollToTop">
    <ArrowUp :size="19" :stroke-width="2.2" />
  </button>
</template>

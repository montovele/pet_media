<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight, Camera, ImagePlus, Plus, Send, Sparkles, Video } from 'lucide-vue-next'
import FeedEntryCard from '../components/FeedEntryCard.vue'
import BrandAdCard from '../modules/ads/components/BrandAdCard.vue'
import { adsApi, type BrandAd } from '../modules/ads/services/adsApi'
import { authApi, type NearbyUser } from '../modules/auth/services/authApi'
import { useAuthStore } from '../stores/auth'
import { useFeedStore } from '../stores/feed'
import { useUiStore } from '../stores/ui'
import { DEFAULT_AVATAR_URL, resolveAvatarUrl } from '../utils/avatar'

const route = useRoute()
const feed = useFeedStore()
const ui = useUiStore()
const auth = useAuthStore()
const sponsoredAds = ref<BrandAd[]>([])
const nearbyUsers = ref<NearbyUser[]>([])

onMounted(() => {
  void feed.loadFeed()
  void adsApi.listPublic().then((ads) => { sponsoredAds.value = ads }).catch(() => {})
  void authApi.getNearbyUsers().then((users) => { nearbyUsers.value = users }).catch(() => { nearbyUsers.value = [] })
})
const currentUserAvatar = computed(() => auth.user?.avatarUrl ?? DEFAULT_AVATAR_URL)
const currentUserName = computed(() => auth.user?.name ?? 'Mariana López')
const filter = computed(() => String(route.meta.filter ?? 'all'))
const pageTitle = computed(() => String(route.meta.title ?? 'Tu espacio'))
const composerText = ref('')
const searchText = ref('')
const isStoryDialogOpen = computed({
  get: () => ui.storyDialogOpen,
  set: (value: boolean) => { ui.storyDialogOpen = value },
})
const storyItems = computed(() => feed.stories)
const visibleEntries = computed(() => {
  let entries = feed.entries
  if (filter.value === 'story') {
    entries = entries.filter((entry) => entry.kind === 'story')
  }
  const query = searchText.value.trim().toLocaleLowerCase()
  if (query) {
    entries = entries.filter((entry) => `${entry.title ?? ''} ${entry.caption} ${entry.author.name} ${entry.place ?? ''}`.toLocaleLowerCase().includes(query))
  }
  return entries
})

function resolvePeopleAvatar(person: NearbyUser) {
  const apiBase = new URL(import.meta.env.VITE_API_URL || 'http://localhost:4000/api', window.location.origin)
  return resolveAvatarUrl(person.avatarUrl || DEFAULT_AVATAR_URL, apiBase)
}

async function publishPost() {
  if (!composerText.value.trim()) return
  if (await feed.addPost(composerText.value.trim())) composerText.value = ''
}

async function toggleFollow(person: NearbyUser) {
  try {
    const result = await authApi.toggleFollow(person.id, !person.isFollowing)
    person.isFollowing = result.isFollowing
    person.followersCount = result.followersCount
    person.followingCount = result.followingCount
  } catch {
    // Ignore UI errors and keep the interaction silent for a small follow toggle.
  }
}

</script>

<template>
  <div class="home-grid">
    <main class="feed-column">
      <section class="welcome-section">
        <div class="welcome-copy">
          <span class="eyebrow"><Sparkles :size="13" /> MI RINCÓN SOCIAL</span>
          <h1 v-if="filter === 'all'">Lo cotidiano también <em>merece quedarse.</em></h1>
          <h1 v-else>{{ pageTitle }}</h1>
          <p>Un lugar para guardar lo que hoy te hizo sonreír.</p>
        </div>
        <button class="button-primary welcome-create" type="button" @click="isStoryDialogOpen = true"><Plus :size="18" /> Crear historia</button>
      </section>

      <section class="story-strip" aria-labelledby="stories-heading">
        <div class="section-heading">
          <div><span class="eyebrow">EN CÍRCULO</span><h2 id="stories-heading">Momentos recientes</h2></div>
          <RouterLink to="/stories" class="text-link">Ver todas <ArrowRight :size="15" /></RouterLink>
        </div>
        <div class="story-row">
          <button class="story-avatar story-avatar--new" type="button" @click="isStoryDialogOpen = true">
            <span class="story-ring story-ring--empty"><span class="story-plus"><Plus :size="17" /></span></span>
            <span>Tu historia</span>
          </button>
          <button v-for="story in storyItems" :key="story.id" class="story-avatar" type="button" @click="$router.push(`/stories/${story.id}`)">
            <span class="story-ring"><img :src="story.author.avatar" :alt="`Historia de ${story.author.name}`" /></span>
            <span>{{ story.author.name.split(' ')[0] }}</span>
          </button>
          <button class="story-avatar" type="button" @click="$router.push('/activities')">
            <span class="story-ring story-ring--gold"><span class="story-letter">M</span></span>
            <span>Momentos</span>
          </button>
        </div>
      </section>

      <form class="composer" @submit.prevent="publishPost">
        <div class="composer-top">
          <img class="avatar" :src="currentUserAvatar" :alt="currentUserName" />
          <label class="visually-hidden" for="quick-post">¿Qué quieres guardar hoy?</label>
          <input id="quick-post" v-model="composerText" placeholder="¿Qué quieres guardar hoy?" maxlength="500" />
          <button class="composer-submit" type="submit" :disabled="!composerText.trim()" aria-label="Publicar"><Send :size="18" /></button>
        </div>
        <div class="composer-bottom">
          <button type="button" @click="isStoryDialogOpen = true"><ImagePlus :size="17" /><span>Foto</span></button>
          <button type="button" @click="isStoryDialogOpen = true"><Video :size="17" /><span>Video</span></button>
          <span class="composer-private"><span class="privacy-dot"></span> Público</span>
        </div>
      </form>

      <div class="feed-toolbar">
        <div><span class="eyebrow">TU LÍNEA DEL TIEMPO</span><h2>{{ filter === 'all' ? 'Lo que está pasando' : pageTitle }}</h2></div>
        <label class="feed-search"><Camera :size="15" /><input v-model="searchText" type="search" placeholder="Buscar en tu espacio" aria-label="Buscar publicaciones" /></label>
      </div>

      <section v-if="visibleEntries.length" class="feed-list" aria-live="polite">
        <template v-for="(entry, index) in visibleEntries" :key="entry.id">
          <p v-if="entry.isFollowedAuthor && !visibleEntries[index - 1]?.isFollowedAuthor" class="feed-group-label">DE LAS PERSONAS QUE SIGUES</p>
          <p v-if="!entry.isFollowedAuthor && visibleEntries[index - 1]?.isFollowedAuthor" class="feed-group-label feed-group-label--discover">MÁS PUBLICACIONES</p>
          <FeedEntryCard :entry="entry" @toggle-like="feed.toggleLike" />
          <BrandAdCard v-if="sponsoredAds.length && (index + 1) % 4 === 0" :ad="sponsoredAds[Math.floor(index / 4) % sponsoredAds.length]" />
        </template>
        <BrandAdCard v-if="sponsoredAds.length && visibleEntries.length < 4" :ad="sponsoredAds[0]" />
      </section>
      <section v-else-if="feed.feedLoading" class="empty-state"><p>Cargando publicaciones guardadas…</p></section>
      <section v-else-if="feed.feedError" class="empty-state" role="alert"><p>{{ feed.feedError }}</p></section>
      <section v-else class="empty-state">
        <span class="empty-icon"><Sparkles :size="23" /></span>
        <h2>Aún no hay momentos por aquí</h2>
        <p>Cuando publiques una historia o actividad, la encontrarás en este espacio.</p>
        <button class="button-secondary" type="button" @click="isStoryDialogOpen = true">Crear una historia</button>
        <BrandAdCard v-if="sponsoredAds.length" class="empty-feed-ad" :ad="sponsoredAds[0]" />
      </section>
      <p v-if="feed.actionError" class="feed-error" role="alert">{{ feed.actionError }}</p>
    </main>

    <aside class="right-rail">
      <section class="week-panel">
        <div class="panel-topline"><span class="eyebrow">TU SEMANA</span><span class="week-spark">✳</span></div>
        <h2>Pequeños momentos,<br /><em>grandes recuerdos.</em></h2>
        <div class="week-stats">
          <div><strong>{{ feed.entries.length }}</strong><span>momentos</span></div>
          <div><strong>{{ storyItems.length + 2 }}</strong><span>días activos</span></div>
        </div>
        <div class="week-days" aria-label="Actividad de la semana">
          <span class="is-active">L</span><span class="is-active">M</span><span>Mi</span><span class="is-active">J</span><span>V</span><span>S</span><span>D</span>
        </div>
      </section>

      <section class="prompt-panel">
        <span class="prompt-icon"><Sparkles :size="17" /></span>
        <span class="eyebrow">UNA IDEA PARA HOY</span>
        <p>¿Qué pequeño detalle te gustaría recordar dentro de un año?</p>
        <button class="text-link" type="button" @click="isStoryDialogOpen = true">Guardar un momento <ArrowRight :size="15" /></button>
      </section>

      <section class="people-panel">
        <div class="section-heading compact"><div><span class="eyebrow">CERCA DE TI</span><h2>Personas</h2></div><button class="icon-button subtle" aria-label="Ver personas"><ArrowRight :size="16" /></button></div>
        <div v-if="nearbyUsers.length" v-for="person in nearbyUsers" :key="person.id" class="person-row">
          <img class="avatar avatar--small" :src="resolvePeopleAvatar(person)" :alt="person.name" />
          <div>
            <strong>{{ person.name }}</strong>
            <span>{{ person.lastLocation }} · {{ person.status }}</span>
            <span class="person-follow-meta">{{ person.followersCount }} seguidores</span>
          </div>
          <div class="person-actions">
            <button class="person-follow" type="button" :class="{ 'is-following': person.isFollowing }" @click="toggleFollow(person)">
              {{ person.isFollowing ? 'Siguiendo' : 'Seguir' }}
            </button>
            <span class="online-dot" :class="person.statusTone === 'away' ? 'is-away' : ''" :aria-label="person.status" />
          </div>
        </div>
        <p v-else class="people-empty">Todavía no hay personas activas cerca de ti.</p>
      </section>
      <p class="rail-footer">Privado por naturaleza <span>·</span> Hecho para recordar</p>
    </aside>
  </div>

</template>

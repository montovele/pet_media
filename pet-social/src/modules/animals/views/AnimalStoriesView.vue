<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BookOpen, CalendarDays, Clock3, Eye, LockKeyhole, MapPin, PawPrint, Plus, Tag } from 'lucide-vue-next'
import { activitiesApi } from '../../activities/services/activitiesApi'
import { activityCategoryLabels } from '../../activities/services/activityValidation'
import type { Activity, FeedEntry, FeedMedia } from '../../../types/content'
import { animalsApi, type AnimalRecord } from '../services/animalsApi'
import { bioActaApi, type HealthRecord } from '../services/bioActaApi'
import { useAuthStore } from '../../../stores/auth'
import { useFeedStore } from '../../../stores/feed'
import { useUiStore } from '../../../stores/ui'

const auth = useAuthStore()
const feed = useFeedStore()
const ui = useUiStore()
const animals = ref<AnimalRecord[]>([])
const activities = ref<Activity[]>([])
const healthRecords = ref<HealthRecord[]>([])
const selectedAnimalId = ref('all')
const loading = ref(true)
const error = ref('')
const ownHandle = computed(() => {
  const username = auth.user?.username?.replace(/^@/, '')
  return username ? `@${username}` : ''
})
const createdStories = computed(() => feed.stories
  .filter((story) => ownHandle.value && story.author.handle === ownHandle.value)
  .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)))

type HistoryItem =
  | { kind: 'activity'; id: string; animalId: string; date: string; createdAt: string; title: string; description?: string; category: Activity['category']; locationName?: string; media?: Activity['media']; video?: Activity['video'] }
  | { kind: 'health'; id: string; animalId: string; date: string; createdAt: string; title: string; description: string; certified: boolean; professionalName?: string | null }

const historyItems = computed<HistoryItem[]>(() => {
  const selected = (animalId: string) => selectedAnimalId.value === 'all' || animalId === selectedAnimalId.value
  const activityItems: HistoryItem[] = activities.value
    .filter((activity) => activity.animalId && selected(activity.animalId))
    .map((activity) => ({
      kind: 'activity',
      id: activity.id,
      animalId: activity.animalId as string,
      date: activity.date,
      createdAt: activity.createdAt,
      title: activity.title,
      description: activity.description,
      category: activity.category,
      locationName: activity.locationName,
      media: activity.media,
      video: activity.video,
    }))
  const healthItems: HistoryItem[] = healthRecords.value
    .filter((record) => selected(record.animalId))
    .map((record) => ({
      kind: 'health',
      id: record.id,
      animalId: record.animalId,
      date: record.date,
      createdAt: record.date,
      title: record.type,
      description: record.description,
      certified: record.certified,
      professionalName: record.professionalName,
    }))
  return [...activityItems, ...healthItems]
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
})

onMounted(async () => {
  loading.value = true
  error.value = ''
  void feed.loadFeed()
  try {
    const [animalRecords, activityRecords] = await Promise.all([animalsApi.list(), activitiesApi.list()])
    const healthByAnimal = await Promise.all(animalRecords.map((animal) => bioActaApi.listHealthRecords(animal.id)))
    animals.value = animalRecords
    activities.value = activityRecords
    healthRecords.value = healthByAnimal.flat()
  } catch {
    error.value = 'No pudimos cargar la historia. Inténtalo de nuevo.'
  } finally {
    loading.value = false
  }
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

function animalLabel(animalId: string) {
  const animal = animals.value.find((item) => item.id === animalId)
  return animal ? `${animal.name || 'Sin nombre'} · ${animal.species}` : 'Animal'
}

function storyPreviewMedia(story: FeedEntry): FeedMedia | undefined {
  return story.media?.[0] ?? (story.imageUrl
    ? { id: `${story.id}-legacy-media`, url: story.imageUrl, type: story.mediaType ?? 'image' }
    : undefined)
}

function formatStoryDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
}
</script>

<template>
  <main class="animal-stories-page">
    <header class="animal-stories-hero">
      <span class="pet-eyebrow"><PawPrint :size="14" /> BIOGRAFÍA ANIMAL</span>
      <h1>Historias de vida</h1>
      <p>Una línea de tiempo para conservar caminatas, actividades y momentos importantes de cada animal.</p>
      <RouterLink class="stories-add-action" to="/activities"><Plus :size="16" /> Registrar caminata o actividad</RouterLink>
    </header>

    <section class="created-stories" aria-labelledby="created-stories-title">
      <div class="created-stories-heading">
        <div><span class="pet-eyebrow">TUS RECUERDOS</span><h2 id="created-stories-title">Historias creadas</h2><p>Abre una historia para leer el detalle y recorrer todas sus fotos y videos.</p></div>
        <button class="story-create-button" type="button" @click="ui.openStoryDialog()"><Plus :size="15" /> Crear historia</button>
      </div>
      <p v-if="feed.feedLoading && !feed.feedLoaded" class="created-stories-state">Cargando tus historias…</p>
      <p v-else-if="feed.feedError" class="stories-error" role="alert">{{ feed.feedError }}</p>
      <div v-else-if="createdStories.length" class="created-stories-grid">
        <article v-for="(story, index) in createdStories" :key="story.id" class="created-story-card" :style="{ '--story-index': index }">
          <RouterLink class="created-story-cover" :to="{ name: 'story-detail', params: { id: story.id } }" :aria-label="`Ver detalle de ${story.title || 'historia'}`">
            <template v-if="storyPreviewMedia(story)">
              <video v-if="storyPreviewMedia(story)?.type === 'video'" :src="storyPreviewMedia(story)?.url" muted preload="metadata" />
              <img v-else :src="storyPreviewMedia(story)?.url" :alt="story.title || 'Imagen de la historia'" loading="lazy" />
            </template>
            <BookOpen v-else :size="26" />
            <span v-if="story.media?.length || story.imageUrl" class="created-story-media-count">{{ story.media?.length || 1 }} {{ (story.media?.length || 1) === 1 ? 'archivo' : 'archivos' }}</span>
          </RouterLink>
          <div class="created-story-copy">
            <div class="created-story-meta"><span>{{ formatStoryDate(story.createdAt) }}</span><span><LockKeyhole :size="12" />{{ story.visibility === 'public' ? 'Pública' : story.visibility === 'followers' ? 'Seguidores' : 'Privada' }}</span></div>
            <h3>{{ story.title || 'Un momento para recordar' }}</h3>
            <p>{{ story.caption }}</p>
            <RouterLink class="created-story-detail" :to="{ name: 'story-detail', params: { id: story.id } }"><Eye :size="14" /> Ver detalle y multimedia</RouterLink>
          </div>
        </article>
      </div>
      <div v-else-if="feed.feedLoaded" class="created-stories-empty">
        <BookOpen :size="20" />
        <p>Aún no has creado historias personales.</p>
        <button type="button" @click="ui.openStoryDialog()">Crea la primera</button>
      </div>
    </section>

    <section class="stories-toolbar" aria-label="Filtros del historial">
      <div><span class="pet-eyebrow">LÍNEA DE TIEMPO</span><h2>Momentos que permanecen</h2></div>
      <label class="stories-filter"><span>Animal</span><select v-model="selectedAnimalId"><option value="all">Todos los animales</option><option v-for="animal in animals" :key="animal.id" :value="animal.id">{{ animal.name || 'Sin nombre' }} · {{ animal.species }}</option></select></label>
    </section>

    <p v-if="error" class="stories-error" role="alert">{{ error }}</p>
    <section v-if="loading" class="stories-state"><Clock3 :size="19" /><p>Cargando historias…</p></section>
    <section v-else-if="historyItems.length" class="stories-timeline" aria-live="polite">
      <article v-for="(event, index) in historyItems" :key="`${event.kind}:${event.id}`" class="life-event" :style="{ '--event-index': index }">
        <div class="life-event-marker"><CalendarDays :size="17" /></div>
        <div class="life-event-content">
          <time :datetime="event.date">{{ formatDate(event.date) }}</time>
          <RouterLink class="life-event-animal" :to="{ name: 'animal-detail', params: { animalId: event.animalId } }"><PawPrint :size="13" />{{ animalLabel(event.animalId) }}</RouterLink>
          <h3>{{ event.title }}</h3>
          <p v-if="event.description" class="life-event-description">{{ event.description }}</p>
          <template v-if="event.kind === 'activity'">
            <template v-for="media in event.media ?? (event.video ? [event.video] : [])" :key="media.id">
              <img v-if="media.type === 'image'" class="life-event-video" :src="media.url" :alt="`Imagen de ${event.title}`" crossorigin="use-credentials" />
              <video v-else class="life-event-video" :src="media.url" controls preload="metadata" crossorigin="use-credentials" :aria-label="`Video de ${event.title}`" />
            </template>
          </template>
          <div v-if="event.kind === 'activity'" class="life-event-meta"><span><Tag :size="13" />{{ activityCategoryLabels[event.category] }}</span><span v-if="event.locationName"><MapPin :size="13" />{{ event.locationName }}</span></div>
          <span v-else class="bioacta-badge" :class="{ 'bioacta-badge--verified': event.certified }">{{ event.certified ? `Certificado · ${event.professionalName || 'Profesional'}` : 'Declarado · no certificado' }}</span>
        </div>
      </article>
    </section>
    <section v-else-if="animals.length" class="stories-empty">
      <span class="stories-empty-icon"><CalendarDays :size="22" /></span>
      <span class="pet-eyebrow">LA HISTORIA SE CONSTRUYE CON EL TIEMPO</span>
      <h2>Aún no hay momentos en esta línea de vida.</h2>
      <p>Registra una caminata, un viaje o una actividad para empezar a conservar la biografía del animal.</p>
      <RouterLink class="stories-add-action" :to="selectedAnimalId === 'all' ? '/activities' : { path: '/activities', query: { animalId: selectedAnimalId } }"><Plus :size="16" /> Añadir el primer momento</RouterLink>
    </section>
    <section v-else class="stories-empty">
      <span class="stories-empty-icon"><PawPrint :size="22" /></span>
      <span class="pet-eyebrow">PRIMERO, LA IDENTIDAD</span>
      <h2>Registra un animal para comenzar su historia.</h2>
      <p>Las caminatas y actividades se vinculan al animal y permanecen en su línea de vida.</p>
      <RouterLink class="stories-add-action" to="/animals"><Plus :size="16" /> Registrar animal</RouterLink>
    </section>
    <p class="stories-privacy"><Clock3 :size="15" /> Esta línea de vida es privada y solo visible dentro de tu cuenta.</p>
  </main>
</template>

<style scoped>
.animal-stories-page {
  --story-ink: #203a32;
  --story-muted: #74847b;
  --story-line: #e4e9e1;
  --story-green: var(--green);
  --story-green-deep: var(--green-deep);
  --story-paper: rgba(255, 253, 248, .88);
  width: min(100%, 940px);
  margin: 0 auto;
  padding: 8px 0 52px;
  color: var(--story-ink);
}
.animal-stories-hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: clamp(25px, 5vw, 45px);
  border: 1px solid rgba(213, 225, 214, .9);
  border-radius: 20px;
  background:
    radial-gradient(ellipse at 88% 12%, rgba(219, 233, 211, .82), transparent 36%),
    linear-gradient(125deg, #fffdf8 4%, #f3f6ed 100%);
  box-shadow: 0 18px 48px rgba(36, 61, 47, .07);
  animation: stories-hero-enter .7s cubic-bezier(.2,.7,.2,1) both;
}
.animal-stories-hero::after {
  position: absolute;
  z-index: -1;
  right: -38px;
  bottom: -112px;
  width: 280px;
  height: 280px;
  border: 1px solid rgba(40, 107, 85, .09);
  border-radius: 50%;
  content: '';
  box-shadow: 0 0 0 28px rgba(40, 107, 85, .025), 0 0 0 58px rgba(40, 107, 85, .02);
  animation: stories-orbit 18s linear infinite;
}
.pet-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--story-green);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.35px;
}
.animal-stories-hero h1 {
  margin: 14px 0 8px;
  color: var(--story-ink);
  font-family: 'Newsreader', Georgia, serif;
  font-size: clamp(37px, 6vw, 53px);
  font-weight: 500;
  letter-spacing: -.6px;
  line-height: .98;
}
.animal-stories-hero > p {
  max-width: 500px;
  margin: 0;
  color: var(--story-muted);
  font-size: 12px;
  line-height: 1.75;
}
.stories-add-action, .story-create-button {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  transition: color .22s ease, background .22s ease, border-color .22s ease, box-shadow .22s ease, transform .22s cubic-bezier(.2,.7,.2,1);
}
.stories-add-action {
  margin-top: 20px;
  padding: 0 16px;
  color: white;
  background: var(--story-green);
  box-shadow: 0 7px 16px rgba(40, 107, 85, .17);
}
.stories-add-action:hover {
  transform: translateY(-2px);
  background: var(--story-green-deep);
  box-shadow: 0 10px 22px rgba(40, 107, 85, .23);
}
.created-stories {
  margin-top: 22px;
  padding: clamp(19px, 3vw, 28px);
  border: 1px solid var(--story-line);
  border-radius: 18px;
  background: var(--story-paper);
  box-shadow: 0 10px 32px rgba(36, 61, 47, .045);
  animation: stories-section-enter .62s .08s cubic-bezier(.2,.7,.2,1) both;
}
.created-stories-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 19px;
}
.created-stories-heading h2, .stories-toolbar h2 {
  margin: 6px 0 0;
  color: var(--story-ink);
  font-family: 'Newsreader', Georgia, serif;
  font-size: clamp(23px, 3vw, 29px);
  font-weight: 500;
  letter-spacing: -.2px;
}
.created-stories-heading p {
  margin: 7px 0 0;
  color: var(--story-muted);
  font-size: 10px;
  line-height: 1.6;
}
.story-create-button {
  flex: 0 0 auto;
  min-height: 38px;
  padding: 0 14px;
  border-color: #d5e2d7;
  color: var(--story-green-deep);
  background: #f6f9f3;
  cursor: pointer;
}
.story-create-button:hover {
  transform: translateY(-2px);
  border-color: #b8d0bd;
  background: #eaf3e9;
  box-shadow: 0 7px 17px rgba(40, 107, 85, .09);
}
.created-stories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
  gap: 15px;
}
.created-story-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e5e9e2;
  border-radius: 13px;
  background: #fffefa;
  box-shadow: 0 4px 14px rgba(36, 61, 47, .035);
  animation: story-card-enter .55s both;
  animation-delay: calc(min(var(--story-index, 0), 8) * 55ms + 100ms);
  transition: border-color .25s ease, box-shadow .3s ease, transform .3s cubic-bezier(.2,.7,.2,1);
}
.created-story-card:hover {
  transform: translateY(-5px);
  border-color: #c5d8c8;
  box-shadow: 0 15px 32px rgba(36, 61, 47, .1);
}
.created-story-cover {
  position: relative;
  height: 178px;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #548269;
  background: linear-gradient(145deg, #edf4e9, #e4eee7 56%, #f5efe0);
}
.created-story-cover::after {
  position: absolute;
  inset: 35% 0 0;
  background: linear-gradient(transparent, rgba(18, 38, 29, .28));
  content: '';
  opacity: .45;
  pointer-events: none;
  transition: opacity .3s ease;
}
.created-story-card:hover .created-story-cover::after { opacity: .8; }
.created-story-cover > svg { opacity: .65; animation: stories-float 4s ease-in-out infinite; }
.created-story-cover img, .created-story-cover video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform .65s cubic-bezier(.2,.7,.2,1), filter .35s ease;
}
.created-story-card:hover .created-story-cover img,
.created-story-card:hover .created-story-cover video { transform: scale(1.055); }
.created-story-media-count {
  position: absolute;
  z-index: 1;
  right: 11px;
  bottom: 10px;
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border: 1px solid rgba(255,255,255,.3);
  border-radius: 999px;
  color: white;
  background: rgba(25, 43, 34, .68);
  font-size: 9px;
  font-weight: 600;
  backdrop-filter: blur(8px);
}
.created-story-copy { padding: 14px 15px 15px; }
.created-story-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #859188;
  font-size: 9px;
}
.created-story-meta span:last-child { display: inline-flex; align-items: center; gap: 5px; }
.created-story-copy h3 {
  overflow: hidden;
  margin: 11px 0 6px;
  color: #283d34;
  font-family: 'Newsreader', Georgia, serif;
  font-size: 20px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.created-story-copy > p {
  display: -webkit-box;
  min-height: 34px;
  overflow: hidden;
  margin: 0;
  color: #6d7c72;
  font-size: 10px;
  line-height: 1.65;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.created-story-detail {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 13px;
  color: var(--story-green);
  font-size: 9px;
  font-weight: 700;
  transition: gap .2s ease, color .2s ease;
}
.created-story-detail:hover { gap: 9px; color: var(--story-green-deep); }
.created-stories-state, .created-stories-empty {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 88px;
  padding: 16px;
  border: 1px dashed #d5e1d6;
  border-radius: 12px;
  color: var(--story-muted);
  background: #fafbf7;
  font-size: 10px;
}
.created-stories-empty > svg { color: var(--story-green); }
.created-stories-empty p { margin: 0; }
.created-stories-empty button {
  margin-left: auto;
  padding: 7px 12px;
  border: 0;
  border-radius: 999px;
  color: var(--story-green-deep);
  background: #eaf3e9;
  cursor: pointer;
  font-size: 9px;
  font-weight: 700;
  transition: background .2s ease, transform .2s ease;
}
.created-stories-empty button:hover { transform: translateY(-1px); background: #dcebdd; }
.stories-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-top: 26px;
  padding: 0 2px 15px;
  border-bottom: 1px solid #dfe7df;
  animation: stories-section-enter .6s .14s both;
}
.stories-filter {
  display: grid;
  gap: 6px;
  color: #75847a;
  font-size: 9px;
  font-weight: 700;
}
.stories-filter select {
  min-width: 210px;
  min-height: 40px;
  padding: 0 34px 0 12px;
  border: 1px solid #dce5dc;
  border-radius: 9px;
  color: #30463f;
  background: #fffdf8;
  font-size: 10px;
  box-shadow: 0 3px 10px rgba(36, 61, 47, .035);
  transition: border-color .2s ease, box-shadow .2s ease;
}
.stories-filter select:focus { border-color: #8bad92; outline: 3px solid rgba(40, 107, 85, .12); }
.stories-timeline {
  position: relative;
  display: grid;
  padding: 20px 0 8px;
}
.stories-timeline::before {
  position: absolute;
  top: 38px;
  bottom: 46px;
  left: 22px;
  width: 2px;
  border-radius: 4px;
  background: linear-gradient(#b7d2bd, #dfe9df 85%, transparent);
  content: '';
  transform-origin: top;
  animation: timeline-draw .8s .15s ease both;
}
.life-event {
  position: relative;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 13px;
  padding: 8px 0 17px;
  animation: story-card-enter .58s cubic-bezier(.2,.7,.2,1) both;
  animation-delay: calc(min(var(--event-index, 0), 10) * 65ms + 180ms);
}
.life-event-marker {
  position: relative;
  z-index: 1;
  width: 45px;
  height: 45px;
  display: grid;
  place-items: center;
  border: 1px solid #d2e1d4;
  border-radius: 14px;
  color: var(--story-green);
  background: #f7faf4;
  box-shadow: 0 3px 10px rgba(40, 107, 85, .06);
  transition: color .25s ease, background .25s ease, transform .3s cubic-bezier(.2,.7,.2,1), box-shadow .25s ease;
}
.life-event:hover .life-event-marker {
  transform: translateY(-2px) rotate(-4deg);
  color: white;
  background: var(--story-green);
  box-shadow: 0 7px 16px rgba(40, 107, 85, .2);
}
.life-event-content {
  min-width: 0;
  padding: 17px 19px 16px;
  border: 1px solid var(--story-line);
  border-radius: 14px;
  background: var(--story-paper);
  box-shadow: 0 5px 16px rgba(36, 61, 47, .035);
  transition: border-color .25s ease, box-shadow .3s ease, transform .3s cubic-bezier(.2,.7,.2,1);
}
.life-event:hover .life-event-content {
  transform: translateY(-2px);
  border-color: #cfddcf;
  box-shadow: 0 12px 26px rgba(36, 61, 47, .07);
}
.life-event time {
  display: block;
  color: #96784c;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .25px;
  text-transform: capitalize;
}
.life-event-animal {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  color: var(--story-green);
  font-size: 9px;
  font-weight: 700;
  transition: color .2s ease;
}
.life-event-animal:hover { color: var(--story-green-deep); }
.life-event-content h3 {
  margin: 6px 0 7px;
  color: #263c33;
  font-family: 'Newsreader', Georgia, serif;
  font-size: 23px;
  font-weight: 500;
  line-height: 1.2;
}
.life-event-description {
  margin: 0;
  color: #68796e;
  font-size: 11px;
  line-height: 1.75;
  white-space: pre-wrap;
}
.life-event-video {
  display: block;
  width: min(100%, 600px);
  max-height: 370px;
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid #e2e9e1;
  border-radius: 10px;
  background: #243a32;
  object-fit: contain;
  animation: media-reveal .5s .08s both;
}
.life-event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 13px;
  color: #728278;
  font-size: 9px;
}
.life-event-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px;
  border: 1px solid #e6ece4;
  border-radius: 999px;
  background: #fafbf7;
}
.bioacta-badge {
  display: inline-flex;
  margin-top: 12px;
  padding: 6px 10px;
  border: 1px solid #e7e4d7;
  border-radius: 999px;
  color: #82754f;
  background: #faf7ed;
  font-size: 9px;
  font-weight: 700;
}
.bioacta-badge--verified {
  border-color: #d4e6d6;
  color: var(--green);
  background: #eff7ed;
}
.stories-state {
  min-height: 210px;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 10px;
  color: #7c8a80;
  font-size: 11px;
  animation: stories-section-enter .5s ease both;
}
.stories-state svg { color: var(--story-green); animation: stories-float 2.4s ease-in-out infinite; }
.stories-error {
  margin: 15px 0;
  padding: 13px 15px;
  border: 1px solid #f0d6ce;
  border-radius: 10px;
  color: #963d31;
  background: #fff6f1;
  font-size: 10px;
  line-height: 1.55;
  animation: stories-section-enter .35s ease both;
}
.stories-empty {
  min-height: 300px;
  display: grid;
  justify-items: center;
  align-content: center;
  margin-top: 18px;
  padding: 32px 20px;
  border: 1px dashed #d4e2d5;
  border-radius: 17px;
  background: linear-gradient(145deg, rgba(255,253,248,.9), rgba(241,247,239,.72));
  text-align: center;
  animation: stories-section-enter .65s cubic-bezier(.2,.7,.2,1) both;
}
.stories-empty-icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  margin-bottom: 12px;
  border: 1px solid #d7e7d8;
  border-radius: 18px;
  color: var(--story-green);
  background: #edf6eb;
  box-shadow: 0 8px 20px rgba(40, 107, 85, .08);
  animation: stories-float 3.5s ease-in-out infinite;
}
.stories-empty h2 {
  max-width: 440px;
  margin: 9px 0 6px;
  color: #243b32;
  font-family: 'Newsreader', Georgia, serif;
  font-size: 26px;
  font-weight: 500;
}
.stories-empty > p { max-width: 420px; margin: 0; color: #75867d; font-size: 10px; line-height: 1.7; }
.stories-empty .stories-add-action { margin-top: 16px; }
.stories-privacy {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px 2px 0;
  border-top: 1px solid #e3e9e1;
  color: #829087;
  font-size: 9px;
}
.stories-privacy svg { flex: 0 0 auto; color: var(--story-green); }
@keyframes stories-hero-enter {
  from { opacity: 0; transform: translateY(13px) scale(.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes stories-section-enter {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes story-card-enter {
  from { opacity: 0; transform: translateY(15px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes media-reveal {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes timeline-draw {
  from { transform: scaleY(0); }
  to { transform: scaleY(1); }
}
@keyframes stories-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes stories-orbit {
  to { transform: rotate(360deg); }
}
@media (max-width: 680px) {
  .animal-stories-page { padding-top: 0; }
  .animal-stories-hero { padding: 24px 21px; border-radius: 16px; }
  .animal-stories-hero h1 { font-size: 38px; }
  .created-stories { padding: 18px 15px; border-radius: 15px; }
  .created-stories-heading { align-items: flex-start; }
  .created-stories-heading p { max-width: 360px; }
  .created-story-cover { height: 165px; }
  .stories-toolbar { align-items: flex-start; flex-direction: column; }
  .stories-filter, .stories-filter select { width: 100%; }
  .stories-timeline { padding-top: 15px; }
  .stories-timeline::before { left: 16px; }
  .life-event { grid-template-columns: 34px minmax(0, 1fr); gap: 9px; }
  .life-event-marker { width: 34px; height: 34px; border-radius: 11px; }
  .life-event-content { padding: 14px 13px; }
  .life-event-content h3 { font-size: 21px; }
  .life-event-video { max-height: 290px; }
}
@media (max-width: 420px) {
  .created-stories-heading { flex-direction: column; align-items: stretch; }
  .story-create-button { align-self: flex-start; }
  .created-stories-grid { grid-template-columns: 1fr; }
  .created-story-cover { height: 190px; }
  .created-stories-empty { align-items: flex-start; flex-wrap: wrap; }
  .created-stories-empty button { margin-left: auto; }
  .life-event { grid-template-columns: 29px minmax(0, 1fr); gap: 7px; }
  .life-event-marker { width: 29px; height: 29px; border-radius: 9px; }
  .stories-timeline::before { left: 13px; }
  .life-event-content { padding: 12px 10px; }
  .life-event-meta { gap: 6px; }
}
@media (prefers-reduced-motion: reduce) {
  .animal-stories-hero::after, .created-story-cover > svg, .stories-state svg, .stories-empty-icon { animation: none; }
  .animal-stories-hero, .created-stories, .created-stories-grid, .created-story-card, .stories-toolbar, .life-event, .life-event-video, .stories-state, .stories-error, .stories-empty { animation: none; }
}
</style>
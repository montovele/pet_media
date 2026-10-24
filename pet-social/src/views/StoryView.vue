<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ChevronLeft, ChevronRight, Film, Heart, LockKeyhole, MapPin, Pencil, Trash2 } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useFeedStore } from '../stores/feed'
import { useUiStore } from '../stores/ui'
import SponsoredAdPlacement from '../modules/campaigns/components/SponsoredAdPlacement.vue'
import type { StoryBlock } from '../types/content'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const feed = useFeedStore()
const ui = useUiStore()
const loading = ref(true)
const story = computed(() => feed.entries.find((entry) => entry.id === route.params.id
  && entry.kind === 'story'
  && (auth.authenticated || entry.visibility === 'public')))
const activeMediaIndex = ref(0)
const canEditStory = computed(() => {
  const username = auth.user?.username?.replace(/^@/, '')
  return auth.authenticated && !!username && story.value?.author.handle === `@${username}`
})
const blocks = computed<StoryBlock[]>(() => {
  if (!story.value) return []
  if (story.value.blocks?.length) return [...story.value.blocks].sort((left, right) => left.position - right.position)

  const storyBlocks: StoryBlock[] = [
    { id: `${story.value.id}-text`, type: 'text', position: 0, text: story.value.caption },
  ]
  const media = story.value.media?.length
    ? story.value.media
    : story.value.imageUrl
      ? [{ id: `${story.value.id}-legacy-media`, url: story.value.imageUrl, type: story.value.mediaType ?? 'image' as const }]
      : []
  media.forEach((item, index) => storyBlocks.push({
    id: item.id,
    type: item.type,
    position: index + 1,
    mediaUrl: item.url,
    alt: story.value?.title,
  }))
  return storyBlocks
})
const textBlocks = computed(() => blocks.value.filter((block) => block.type === 'text'))
const mediaBlocks = computed(() => blocks.value.filter((block) => block.type !== 'text' && block.mediaUrl))
const activeMedia = computed(() => mediaBlocks.value[activeMediaIndex.value])

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(new Date(value))
}

async function loadStory() {
  loading.value = true
  if (auth.authenticated) await feed.loadFeed(true)
  else await feed.loadPublicStories()
  activeMediaIndex.value = 0
  loading.value = false
}

watch(() => route.params.id, () => { void loadStory() }, { immediate: true })
watch(() => story.value?.id, () => { activeMediaIndex.value = 0 })
watch(() => mediaBlocks.value.length, () => { activeMediaIndex.value = 0 })

function moveMedia(direction: -1 | 1) {
  const count = mediaBlocks.value.length
  if (count < 2) return
  activeMediaIndex.value = (activeMediaIndex.value + direction + count) % count
}

function selectMedia(index: number) {
  activeMediaIndex.value = index
}

async function deleteStory() {
  if (!story.value || !window.confirm('¿Quieres eliminar esta historia? Esta acción no se puede deshacer.')) return
  if (await feed.deleteStory(story.value.id)) await router.replace('/stories')
}

const visibilityLabel = computed(() => {
  if (!story.value) return ''
  return story.value.visibility === 'public' ? 'Público' : story.value.visibility === 'private' ? 'Solo yo' : 'Seguidores'
})
</script>

<template>
  <main class="story-reader">
    <RouterLink class="story-back" :to="auth.authenticated ? '/stories' : '/explore'"><ArrowLeft :size="16" /> {{ auth.authenticated ? 'Mis historias' : 'Historias públicas' }}</RouterLink>

    <section v-if="loading" class="story-not-found" aria-live="polite"><span class="eyebrow">CARGANDO HISTORIA</span><p>Recuperando el detalle y sus archivos multimedia…</p></section>

    <article v-else-if="story" class="story-article">
      <header class="story-article-header">
        <div class="story-author">
          <img :src="story.author.avatar" :alt="`Foto de ${story.author.name}`" />
          <div><strong>{{ story.author.name }}</strong><span>{{ formatCreatedAt(story.createdAt) }}</span></div>
        </div>
        <span class="story-visibility"><LockKeyhole :size="13" /> {{ visibilityLabel }}</span>
        <div v-if="canEditStory" class="story-owner-actions">
          <button class="story-edit-button" type="button" @click="ui.openStoryEditor(story)"><Pencil :size="14" /> Editar</button>
          <button class="story-edit-button story-delete-button" type="button" @click="deleteStory"><Trash2 :size="14" /> Eliminar</button>
        </div>
      </header>

      <div class="story-intro">
        <span class="eyebrow">UNA HISTORIA PERSONAL</span>
        <h1>{{ story.title || 'Un momento para recordar' }}</h1>
        <p v-if="story.place" class="story-location"><MapPin :size="15" /> {{ story.place }}</p>
      </div>

      <div class="story-blocks">
        <p v-for="block in textBlocks" :key="block.id" class="story-text-block">{{ block.text }}</p>
        <div v-if="mediaBlocks.length > 1" class="story-carousel" role="region" :aria-label="`Galería de ${mediaBlocks.length} elementos`">
          <Transition name="story-media-swap" mode="out-in">
            <video v-if="activeMedia.type === 'video'" :key="activeMedia.id" class="story-carousel-media" :src="activeMedia.mediaUrl" controls preload="metadata" :aria-label="activeMedia.alt || story.title || 'Video de la historia'" />
            <img v-else :key="activeMedia.id" class="story-carousel-media" :src="activeMedia.mediaUrl" :alt="activeMedia.alt || story.title || 'Imagen de la historia'" />
          </Transition>
          <button class="story-carousel-arrow story-carousel-arrow--previous" type="button" aria-label="Medio anterior" @click="moveMedia(-1)"><ChevronLeft :size="21" /></button>
          <button class="story-carousel-arrow story-carousel-arrow--next" type="button" aria-label="Medio siguiente" @click="moveMedia(1)"><ChevronRight :size="21" /></button>
          <div class="story-carousel-footer"><span>{{ activeMediaIndex + 1 }} <span>/</span> {{ mediaBlocks.length }}</span><div class="story-carousel-progress" role="progressbar" :aria-valuenow="activeMediaIndex + 1" :aria-valuemin="1" :aria-valuemax="mediaBlocks.length"><span :style="{ transform: `scaleX(${(activeMediaIndex + 1) / mediaBlocks.length})` }"></span></div></div>
        </div>
        <figure v-else-if="activeMedia" class="story-media-block">
          <Transition name="story-media-swap" mode="out-in">
            <img v-if="activeMedia.type === 'image'" :key="activeMedia.id" :src="activeMedia.mediaUrl" :alt="activeMedia.alt || story.title || 'Imagen de la historia'" />
            <video v-else :key="activeMedia.id" :src="activeMedia.mediaUrl" controls preload="metadata" :aria-label="activeMedia.alt || story.title || 'Video de la historia'" />
          </Transition>
        </figure>
        <nav v-if="mediaBlocks.length > 1" class="story-media-thumbnails" aria-label="Seleccionar archivo multimedia">
          <button
            v-for="(media, index) in mediaBlocks"
            :key="media.id"
            class="story-media-thumbnail"
            :class="{ 'story-media-thumbnail--active': activeMediaIndex === index }"
            type="button"
            :aria-label="`Mostrar ${media.type === 'video' ? 'video' : 'imagen'} ${index + 1}`"
            :aria-current="activeMediaIndex === index ? 'true' : undefined"
            @click="selectMedia(index)"
          >
            <img v-if="media.type === 'image'" :src="media.mediaUrl" alt="" loading="lazy" />
            <span v-else><Film :size="18" /></span>
            <span class="story-media-thumbnail-index">{{ String(index + 1).padStart(2, '0') }}</span>
          </button>
        </nav>
      </div>

      <footer class="story-article-footer">
        <span class="public-story-note"><Heart :size="16" /> {{ story.likes }} {{ story.likes === 1 ? 'reacción' : 'reacciones' }}</span>
        <RouterLink class="story-back-bottom" :to="auth.authenticated ? '/stories' : '/explore'">{{ auth.authenticated ? 'Volver a mis historias' : 'Explorar más historias' }}</RouterLink>
      </footer>
    </article>

    <section v-else class="story-not-found">
      <span class="eyebrow">HISTORIA NO DISPONIBLE</span>
      <h1>No encontramos este momento</h1>
      <p v-if="feed.feedError" role="alert">{{ feed.feedError }}</p>
      <p v-else>Puede que se haya eliminado o que ya no tengas acceso.</p>
      <RouterLink class="story-back" :to="auth.authenticated ? '/stories' : '/explore'"><ArrowLeft :size="16" /> Volver a historias</RouterLink>
    </section>
    <SponsoredAdPlacement v-if="story" />

  </main>
</template>

<style scoped>
.story-reader {
  --reader-ink: #203a32;
  --reader-muted: #74847b;
  --reader-line: #e4e9e1;
  --reader-green: var(--green);
  width: min(100%, 860px);
  margin: 0 auto;
  padding: 9px 0 52px;
}
.story-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px 0 9px;
  border: 1px solid transparent;
  border-radius: 999px;
  color: #60756a;
  font-size: 10px;
  font-weight: 700;
  transition: color .2s ease, background .2s ease, border-color .2s ease, transform .2s ease;
}
.story-back:hover {
  transform: translateX(-2px);
  border-color: #dce7dc;
  color: var(--reader-green);
  background: rgba(255,253,248,.8);
}
.story-article {
  position: relative;
  overflow: hidden;
  margin-top: 11px;
  padding: clamp(23px, 5vw, 50px);
  border: 1px solid rgba(220, 230, 220, .95);
  border-radius: 21px;
  background:
    radial-gradient(ellipse at 100% 0%, rgba(230, 239, 226, .56), transparent 31%),
    rgba(255, 253, 248, .96);
  box-shadow: 0 20px 55px rgba(35, 55, 42, .08);
  animation: story-detail-enter .7s cubic-bezier(.2,.7,.2,1) both;
}
.story-article-header {
  display: flex;
  align-items: center;
  gap: 13px;
  padding-bottom: 21px;
  border-bottom: 1px solid #e9eee7;
  animation: story-detail-enter .55s .07s both;
}
.story-author { display: flex; align-items: center; gap: 11px; margin-right: auto; min-width: 0; }
.story-author img {
  width: 45px;
  height: 45px;
  flex: 0 0 auto;
  border: 2px solid white;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 1px #dce6dc, 0 4px 12px rgba(35,55,42,.09);
}
.story-author div { display: grid; gap: 4px; min-width: 0; }
.story-author strong { overflow: hidden; color: var(--reader-ink); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.story-author span { color: var(--reader-muted); font-size: 9px; }
.story-visibility {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding: 7px 10px;
  border: 1px solid #e4eae1;
  border-radius: 999px;
  color: #6f7e73;
  background: rgba(255,255,255,.7);
  font-size: 9px;
  font-weight: 600;
}
.story-owner-actions { display: flex; align-items: center; gap: 7px; }
.story-edit-button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid #dfe8de;
  border-radius: 999px;
  color: #536a5c;
  background: rgba(255,255,255,.8);
  cursor: pointer;
  font-size: 9px;
  font-weight: 700;
  transition: color .2s ease, background .2s ease, border-color .2s ease, transform .2s ease, box-shadow .2s ease;
}
.story-edit-button:hover {
  transform: translateY(-2px);
  border-color: #b9cbbc;
  color: var(--reader-green);
  background: #f5f8f3;
  box-shadow: 0 5px 13px rgba(35,55,42,.07);
}
.story-delete-button { color: #a74d42; }
.story-delete-button:hover { border-color: #e4beb7; color: #963d31; background: #fff5f3; }
.story-intro {
  padding: 29px 0 24px;
  animation: story-detail-enter .6s .14s both;
}
.story-intro > .eyebrow { color: var(--reader-green); }
.story-article h1, .story-not-found h1 {
  margin: 11px 0 13px;
  color: var(--reader-ink);
  font-family: 'Newsreader', Georgia, serif;
  font-size: clamp(36px, 7vw, 58px);
  font-weight: 500;
  letter-spacing: -.7px;
  line-height: .98;
}
.story-location {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 7px 11px;
  border: 1px solid #e8ece4;
  border-radius: 999px;
  color: #74847b;
  background: rgba(255,255,255,.62);
  font-size: 10px;
}
.story-blocks { display: grid; gap: 21px; }
.story-text-block {
  max-width: 690px;
  margin: 0;
  padding: 0 0 4px;
  color: #48574d;
  font-family: 'Newsreader', Georgia, serif;
  font-size: clamp(19px, 2.8vw, 23px);
  line-height: 1.65;
  white-space: pre-wrap;
  animation: story-detail-enter .6s .22s both;
}
.story-media-block {
  overflow: hidden;
  margin: 0;
  border: 1px solid #e1e9df;
  border-radius: 15px;
  background: #243a32;
  box-shadow: 0 12px 28px rgba(27, 48, 36, .1);
}
.story-media-block img, .story-media-block video {
  display: block;
  width: 100%;
  max-height: min(72vh, 720px);
  object-fit: contain;
  animation: story-media-enter .52s both;
}
.story-carousel {
  position: relative;
  height: clamp(300px, 62vw, 640px);
  min-height: 300px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.18);
  border-radius: 16px;
  background:
    radial-gradient(ellipse at 50% 48%, rgba(94, 119, 99, .23), transparent 60%),
    #1d3029;
  box-shadow: 0 16px 36px rgba(27, 48, 36, .16);
  animation: story-media-enter .65s .12s both;
}
.story-carousel-media { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; }
.story-media-swap-enter-active, .story-media-swap-leave-active { transition: opacity .25s ease, transform .3s ease; }
.story-media-swap-enter-from { opacity: 0; transform: scale(.985); }
.story-media-swap-leave-to { opacity: 0; transform: scale(1.01); }
.story-carousel-arrow {
  position: absolute;
  z-index: 2;
  top: 50%;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255,255,255,.58);
  border-radius: 50%;
  color: white;
  background: rgba(25,36,29,.56);
  cursor: pointer;
  transform: translateY(-50%);
  backdrop-filter: blur(10px);
  transition: background .2s ease, border-color .2s ease, box-shadow .2s ease, scale .2s ease;
}
.story-carousel-arrow:hover { scale: 1.07; border-color: white; background: rgba(25,36,29,.86); box-shadow: 0 5px 18px rgba(0,0,0,.18); }
.story-carousel-arrow--previous { left: 16px; }
.story-carousel-arrow--next { right: 16px; }
.story-carousel-footer {
  position: absolute;
  z-index: 2;
  right: 17px;
  bottom: 16px;
  left: 17px;
  display: flex;
  align-items: center;
  gap: 13px;
  color: white;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 5px rgba(0,0,0,.7);
}
.story-carousel-footer > span > span { padding: 0 3px; color: rgba(255,255,255,.66); }
.story-carousel-progress { height: 3px; flex: 1; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.36); }
.story-carousel-progress span { display: block; width: 100%; height: 100%; border-radius: inherit; background: #fffdf8; transform-origin: left center; transition: transform .32s cubic-bezier(.2,.7,.2,1); }
.story-media-thumbnails {
  display: flex;
  gap: 9px;
  overflow-x: auto;
  padding: 3px 2px 5px;
  scrollbar-color: #c6d6c8 transparent;
  scrollbar-width: thin;
}
.story-media-thumbnail {
  position: relative;
  width: 66px;
  height: 56px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 9px;
  color: #eaf2e9;
  background: #2b4338;
  cursor: pointer;
  opacity: .72;
  transition: opacity .2s ease, border-color .2s ease, transform .2s ease, box-shadow .2s ease;
}
.story-media-thumbnail:hover { transform: translateY(-2px); opacity: 1; }
.story-media-thumbnail--active { border-color: var(--reader-green); opacity: 1; box-shadow: 0 0 0 2px rgba(40,107,85,.14); }
.story-media-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
.story-media-thumbnail > span:first-child:not(.story-media-thumbnail-index) { display: grid; place-items: center; width: 100%; height: 100%; }
.story-media-thumbnail-index {
  position: absolute;
  right: 4px;
  bottom: 3px;
  padding: 1px 4px;
  border-radius: 4px;
  color: white;
  background: rgba(20,33,27,.68);
  font-size: 8px;
  line-height: 1.4;
}
.story-article-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid #e9eee7;
}
.public-story-note { display: inline-flex; align-items: center; gap: 7px; color: #78877d; font-size: 10px; }
.public-story-note svg { color: var(--brand-secondary); }
.story-back-bottom {
  display: inline-flex;
  align-items: center;
  min-height: 35px;
  padding: 0 13px;
  border: 1px solid #dfe8de;
  border-radius: 999px;
  color: var(--reader-green);
  background: #fbfcf8;
  font-size: 9px;
  font-weight: 700;
  transition: color .2s ease, background .2s ease, transform .2s ease;
}
.story-back-bottom:hover { transform: translateY(-1px); color: var(--green-deep); background: #eff6ed; }
.story-not-found {
  min-height: 270px;
  display: grid;
  justify-items: start;
  align-content: center;
  gap: 11px;
  margin-top: 12px;
  padding: clamp(25px, 5vw, 50px);
  border: 1px solid var(--reader-line);
  border-radius: 19px;
  background: rgba(255,253,248,.9);
  box-shadow: 0 15px 40px rgba(35,55,42,.06);
  animation: story-detail-enter .55s ease both;
}
.story-not-found .eyebrow { color: #a3694b; }
.story-not-found h1 { max-width: 550px; margin: 0; }
.story-not-found p { margin: 0 0 5px; color: var(--reader-muted); font-size: 11px; line-height: 1.65; }
@keyframes story-detail-enter {
  from { opacity: 0; transform: translateY(13px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes story-media-enter {
  from { opacity: 0; transform: scale(.99); }
  to { opacity: 1; transform: scale(1); }
}
@media (max-width: 680px) {
  .story-reader { padding-top: 1px; }
  .story-article { padding: 24px 20px; border-radius: 17px; }
  .story-article-header { flex-wrap: wrap; gap: 10px; padding-bottom: 17px; }
  .story-author { width: 100%; }
  .story-owner-actions { margin-left: auto; }
  .story-intro { padding: 24px 0 19px; }
  .story-carousel { height: 62vh; min-height: 260px; max-height: 530px; border-radius: 12px; }
  .story-carousel-arrow { width: 39px; height: 39px; }
  .story-carousel-arrow--previous { left: 10px; }
  .story-carousel-arrow--next { right: 10px; }
  .story-media-block, .story-media-block img, .story-media-block video { border-radius: 12px; }
}
@media (max-width: 420px) {
  .story-article { padding: 19px 14px; }
  .story-visibility { margin-right: auto; }
  .story-edit-button { min-height: 32px; padding: 0 9px; }
  .story-intro h1 { font-size: 37px; }
  .story-carousel { height: 58vh; min-height: 230px; }
  .story-carousel-footer { right: 12px; bottom: 12px; left: 12px; }
  .story-article-footer { align-items: flex-start; flex-wrap: wrap; }
  .story-back-bottom { margin-left: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .story-article, .story-article-header, .story-intro, .story-text-block, .story-media-block img,
  .story-media-block video, .story-carousel, .story-not-found { animation: none; }
  .story-media-swap-enter-active, .story-media-swap-leave-active { transition: none; }
}
</style>
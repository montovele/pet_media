<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, LockKeyhole, MapPin, Pencil, Trash2 } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useFeedStore } from '../stores/feed'
import { useUiStore } from '../stores/ui'
import SponsoredAdPlacement from '../modules/ads/components/SponsoredAdPlacement.vue'
import type { StoryBlock } from '../types/content'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const feed = useFeedStore()
const ui = useUiStore()
onMounted(() => { void feed.loadPublicStories() })
const story = computed(() => feed.entries.find((entry) => entry.id === route.params.id && entry.kind === 'story' && entry.visibility === 'public'))
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

watch(() => story.value?.id, () => { activeMediaIndex.value = 0 })
watch(() => mediaBlocks.value.length, () => { activeMediaIndex.value = 0 })

function moveMedia(direction: -1 | 1) {
  const count = mediaBlocks.value.length
  if (count < 2) return
  activeMediaIndex.value = (activeMediaIndex.value + direction + count) % count
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
    <RouterLink class="story-back" to="/explore"><ArrowLeft :size="16" /> Historias públicas</RouterLink>

    <article v-if="story" class="story-article">
      <header class="story-article-header">
        <div class="story-author">
          <img :src="story.author.avatar" :alt="`Foto de ${story.author.name}`" />
          <div><strong>{{ story.author.name }}</strong><span>{{ story.createdAt }}</span></div>
        </div>
        <span class="story-visibility"><LockKeyhole :size="13" /> {{ visibilityLabel }}</span>
        <button v-if="canEditStory && story" class="story-edit-button" type="button" @click="ui.openStoryEditor(story)"><Pencil :size="14" /> Editar</button>
        <button v-if="canEditStory && story" class="story-edit-button story-delete-button" type="button" @click="deleteStory"><Trash2 :size="14" /> Eliminar</button>
      </header>

      <span class="eyebrow">UNA HISTORIA PERSONAL</span>
      <h1>{{ story.title || 'Un momento para recordar' }}</h1>
      <p v-if="story.place" class="story-location"><MapPin :size="15" /> {{ story.place }}</p>

      <div class="story-blocks">
        <p v-for="block in textBlocks" :key="block.id" class="story-text-block">{{ block.text }}</p>
        <div v-if="mediaBlocks.length > 1" class="story-carousel" role="region" :aria-label="`Galería de ${mediaBlocks.length} elementos`">
          <video v-if="activeMedia.type === 'video'" class="story-carousel-media" :src="activeMedia.mediaUrl" controls preload="metadata" :aria-label="activeMedia.alt || story.title || 'Video de la historia'" />
          <img v-else class="story-carousel-media" :src="activeMedia.mediaUrl" :alt="activeMedia.alt || story.title || 'Imagen de la historia'" />
          <button class="story-carousel-arrow story-carousel-arrow--previous" type="button" aria-label="Medio anterior" @click="moveMedia(-1)"><ChevronLeft :size="21" /></button>
          <button class="story-carousel-arrow story-carousel-arrow--next" type="button" aria-label="Medio siguiente" @click="moveMedia(1)"><ChevronRight :size="21" /></button>
          <div class="story-carousel-footer"><span>{{ activeMediaIndex + 1 }} <span>/</span> {{ mediaBlocks.length }}</span><div class="story-carousel-progress" role="progressbar" :aria-valuenow="activeMediaIndex + 1" :aria-valuemin="1" :aria-valuemax="mediaBlocks.length"><span :style="{ transform: `scaleX(${(activeMediaIndex + 1) / mediaBlocks.length})` }"></span></div></div>
        </div>
        <figure v-else-if="activeMedia" class="story-media-block">
          <img v-if="activeMedia.type === 'image'" :src="activeMedia.mediaUrl" :alt="activeMedia.alt || story.title || 'Imagen de la historia'" />
          <video v-else :src="activeMedia.mediaUrl" controls preload="metadata" :aria-label="activeMedia.alt || story.title || 'Video de la historia'" />
        </figure>
      </div>

      <footer class="story-article-footer">
        <span class="public-story-note"><Heart :size="16" /> {{ story.likes }} {{ story.likes === 1 ? 'reacción' : 'reacciones' }}</span>
        <RouterLink class="story-back-bottom" to="/explore">Explorar más historias</RouterLink>
      </footer>
    </article>

    <section v-else class="story-not-found">
      <span class="eyebrow">HISTORIA NO DISPONIBLE</span>
      <h1>No encontramos este momento</h1>
      <p>Puede que se haya eliminado o que ya no tengas acceso.</p>
      <RouterLink class="story-back" to="/stories"><ArrowLeft :size="16" /> Volver a historias</RouterLink>
    </section>
    <SponsoredAdPlacement v-if="story" />

  </main>
</template>

<style scoped>
.story-reader { width: min(100%, 790px); margin: 0 auto; padding: 12px 0 44px; }
.story-back { display: inline-flex; align-items: center; gap: 7px; color: #60756a; font-size: 11px; font-weight: 600; }
.story-back:hover, .story-back-bottom:hover { color: var(--green); }
.story-article { margin-top: 19px; padding: clamp(19px, 4vw, 38px); border: 1px solid #e5eae2; border-radius: 8px; background: rgba(255,255,255,.92); box-shadow: var(--shadow); }
.story-article-header { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding-bottom: 23px; border-bottom: 1px solid #edf0eb; }
.story-author { display: flex; align-items: center; gap: 10px; }
.story-author img { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; }
.story-author div { display: grid; gap: 3px; }
.story-author strong { color: var(--ink); font-size: 11px; }
.story-author span { color: var(--muted); font-size: 10px; }
.story-visibility { display: inline-flex; align-items: center; gap: 5px; color: #7c8a80; font-size: 10px; }
.story-edit-button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; border: 1px solid #e3e9e1; border-radius: 6px; color: #536a5c; background: white; cursor: pointer; font-size: 10px; font-weight: 600; }
.story-edit-button:hover { border-color: #b9cbbc; background: #f5f8f3; }
.story-delete-button { color: #a74d42; }
.story-delete-button:hover { border-color: #e4beb7; background: #fff5f3; }
.story-article > .eyebrow { margin-top: 25px; color: var(--green); }
.story-article h1, .story-not-found h1 { margin: 8px 0 10px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: clamp(30px, 5vw, 46px); font-weight: 500; line-height: 1.05; letter-spacing: 0; }
.story-location { display: flex; align-items: center; gap: 5px; margin: 0; color: #85948a; font-size: 11px; }
.story-blocks { display: grid; gap: 19px; margin-top: 22px; }
.story-text-block { margin: 0; color: #48574d; font-family: 'Newsreader', Georgia, serif; font-size: 20px; line-height: 1.55; white-space: pre-wrap; }
.story-media-block { overflow: hidden; margin: 0; border-radius: 6px; background: #edf1eb; }
.story-media-block img, .story-media-block video { display: block; width: 100%; max-height: 620px; object-fit: cover; }
.story-carousel { position: relative; min-height: 300px; height: clamp(300px, 58vw, 620px); overflow: hidden; border-radius: 7px; background: #26352c; }
.story-carousel-media { display: block; width: 100%; height: 100%; object-fit: contain; }
.story-carousel-arrow { position: absolute; top: 50%; width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.68); border-radius: 50%; color: white; background: rgba(25,36,29,.58); cursor: pointer; transform: translateY(-50%); backdrop-filter: blur(8px); }
.story-carousel-arrow:hover { background: rgba(25,36,29,.84); }
.story-carousel-arrow--previous { left: 15px; }
.story-carousel-arrow--next { right: 15px; }
.story-carousel-footer { position: absolute; right: 16px; bottom: 15px; left: 16px; display: flex; align-items: center; gap: 12px; color: white; font-size: 11px; font-variant-numeric: tabular-nums; text-shadow: 0 1px 5px rgba(0,0,0,.7); }
.story-carousel-footer > span > span { padding: 0 2px; color: rgba(255,255,255,.68); }
.story-carousel-progress { height: 3px; flex: 1; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.38); }
.story-carousel-progress span { display: block; width: 100%; height: 100%; border-radius: inherit; background: white; transform-origin: left center; transition: transform .24s ease; }
.story-article-footer { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin-top: 25px; padding-top: 16px; border-top: 1px solid #edf0eb; }
.public-story-note { display: inline-flex; align-items: center; gap: 7px; color: #78877d; font-size: 11px; }
.story-back-bottom { color: var(--green); font-size: 10px; font-weight: 700; }
.story-not-found { display: grid; justify-items: start; gap: 10px; padding: 80px 20px; }
.story-not-found .eyebrow { color: var(--coral); }
.story-not-found h1 { max-width: 500px; }
.story-not-found p { margin: 0 0 7px; color: var(--muted); font-size: 12px; }
@media (max-width: 620px) {
  .story-reader { padding-top: 3px; }
  .story-article { margin-top: 14px; padding: 17px 14px; }
  .story-article-header { padding-bottom: 17px; }
  .story-text-block { font-size: 18px; }
  .story-media-block img, .story-media-block video { max-height: 60vh; }
  .story-carousel { min-height: 230px; height: 65vh; max-height: 500px; }
  .story-article-footer { flex-wrap: wrap; }
  .story-back-bottom { margin-left: auto; }
}
</style>
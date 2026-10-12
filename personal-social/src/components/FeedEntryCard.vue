<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bookmark, ChevronLeft, ChevronRight, Facebook, Heart, MapPin, MessageCircle, MoreHorizontal, Pencil, Send, Trash2, UsersRound, X } from 'lucide-vue-next'
import type { FeedEntry } from '../types/content'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useFeedStore } from '../stores/feed'
import { useUiStore } from '../stores/ui'
import SocialPublishDialog from '../modules/social/components/SocialPublishDialog.vue'

const props = defineProps<{ entry: FeedEntry }>()
const emit = defineEmits<{ toggleLike: [id: string] }>()
const route = useRoute()
const auth = useAuthStore()
const feed = useFeedStore()
const ui = useUiStore()
const publicMode = computed(() => route.meta.publicOnly === true)
const showSocialPublish = ref(false)
const canPublishSocial = computed(() => {
  const username = auth.user?.username?.replace(/^@/, '')
  return !publicMode.value && auth.authenticated && !!username && props.entry.author.handle === `@${username}`
})
const canEditStory = computed(() => {
  const username = auth.user?.username?.replace(/^@/, '')
  return !publicMode.value && auth.authenticated && props.entry.kind === 'story' && !!username && props.entry.author.handle === `@${username}`
})
const commentsOpen = ref(false)
const draftComment = ref('')
const commentSort = ref<'popular' | 'recent'>('popular')
const comments = computed(() => feed.commentsFor(props.entry.id))
const orderedComments = computed(() => [...comments.value].sort((left, right) => commentSort.value === 'popular'
  ? right.likes - left.likes || Date.parse(right.createdAt) - Date.parse(left.createdAt)
  : Date.parse(right.createdAt) - Date.parse(left.createdAt)))
const mediaItems = computed(() => props.entry.media?.length
  ? props.entry.media
  : props.entry.imageUrl
    ? [{ id: `${props.entry.id}-legacy-media`, url: props.entry.imageUrl, type: props.entry.mediaType ?? 'image' as const }]
    : [])
  const activeMediaIndex = ref(0)
  const activeMedia = computed(() => mediaItems.value[activeMediaIndex.value])
  watch(() => mediaItems.value.length, () => { activeMediaIndex.value = 0 })
const kindLabel = computed(() => ({ story: 'HISTORIA', post: 'PUBLICACIÓN' })[props.entry.kind])
const visibilityLabel = computed(() => props.entry.visibility === 'public' ? 'Público' : props.entry.visibility === 'private' ? 'Solo yo' : 'Seguidores')

function moveMedia(direction: -1 | 1) {
  const count = mediaItems.value.length
  if (count < 2) return
  activeMediaIndex.value = (activeMediaIndex.value + direction + count) % count
}

async function deleteStory() {
  if (!window.confirm('¿Quieres eliminar esta historia? Esta acción no se puede deshacer.')) return
  await feed.deleteStory(props.entry.id)
}

async function toggleComments() {
  commentsOpen.value = !commentsOpen.value
  if (commentsOpen.value && !Object.hasOwn(feed.commentsByEntry, props.entry.id)) {
    await feed.loadComments(props.entry.id)
  }
}

async function submitComment() {
  if (!draftComment.value.trim()) return
  try {
    await feed.addComment(props.entry.id, draftComment.value)
    draftComment.value = ''
  } catch {
    // Keep the draft so the user can retry.
  }
}
</script>

<template>
  <article class="feed-card" :class="`feed-card--${entry.kind}`">
    <header class="feed-card-header">
      <img class="avatar avatar--small" :src="entry.author.avatar" :alt="`Foto de ${entry.author.name}`" />
      <div class="author-meta">
        <div class="author-line"><strong>{{ entry.author.name }}</strong><span class="kind-label">{{ kindLabel }}</span></div>
        <p>{{ entry.createdAt }}<span v-if="entry.place" class="meta-place"><MapPin :size="12" /> {{ entry.place }}</span></p>
      </div>
      <button v-if="canEditStory" class="icon-button subtle" type="button" aria-label="Editar historia" title="Editar historia" @click="ui.openStoryEditor(entry)"><Pencil :size="17" /></button>
      <button v-if="canEditStory" class="icon-button subtle delete-story-button" type="button" aria-label="Eliminar historia" title="Eliminar historia" @click="deleteStory"><Trash2 :size="17" /></button>
      <button v-else class="icon-button subtle" type="button" aria-label="Más opciones"><MoreHorizontal :size="19" /></button>
    </header>

    <div v-if="entry.title" class="entry-heading">
      <h2 v-if="entry.kind === 'story'"><RouterLink :to="`/stories/${entry.id}`">{{ entry.title }}</RouterLink></h2>
      <h2 v-else>{{ entry.title }}</h2>
      <span class="visibility-label"><UsersRound :size="13" /> {{ visibilityLabel }}</span>
    </div>
    <p v-if="entry.moderationStatus === 'pending'" class="entry-moderation-status">Tu publicación pública está en revisión; solo tú puedes verla hasta que sea aprobada.</p>
    <p v-else-if="entry.moderationStatus === 'rejected'" class="entry-moderation-status is-rejected">No se publicó: {{ entry.moderationNote || 'el contenido no fue aprobado por moderación.' }}</p>
    <p class="entry-caption">{{ entry.caption }}</p>
    <div v-if="mediaItems.length > 1" class="entry-carousel" role="region" :aria-label="`Galería de ${mediaItems.length} elementos`">
      <video v-if="activeMedia.type === 'video'" class="entry-carousel-media" :src="activeMedia.url" controls preload="metadata" />
      <img v-else class="entry-carousel-media" :src="activeMedia.url" :alt="entry.title ? `Fotografía: ${entry.title}` : 'Fotografía compartida'" loading="lazy" />
      <button class="carousel-arrow carousel-arrow--previous" type="button" aria-label="Medio anterior" @click="moveMedia(-1)"><ChevronLeft :size="20" /></button>
      <button class="carousel-arrow carousel-arrow--next" type="button" aria-label="Medio siguiente" @click="moveMedia(1)"><ChevronRight :size="20" /></button>
      <div class="carousel-footer"><span>{{ activeMediaIndex + 1 }} <span>/</span> {{ mediaItems.length }}</span><div class="carousel-progress" role="progressbar" :aria-valuenow="activeMediaIndex + 1" :aria-valuemin="1" :aria-valuemax="mediaItems.length"><span :style="{ transform: `scaleX(${(activeMediaIndex + 1) / mediaItems.length})` }"></span></div></div>
    </div>
    <template v-else-if="activeMedia" :key="activeMedia.id">
      <video v-if="activeMedia.type === 'video'" class="entry-image" :src="activeMedia.url" controls preload="metadata" />
      <img v-else class="entry-image" :src="activeMedia.url" :alt="entry.title ? `Fotografía: ${entry.title}` : 'Fotografía compartida'" loading="lazy" />
    </template>

    <RouterLink v-if="entry.kind === 'story' && !publicMode && entry.visibility === 'public'" class="story-open-link" :to="`/stories/${entry.id}`">Leer historia <span aria-hidden="true">↗</span></RouterLink>

    <footer v-if="!publicMode" class="feed-card-actions">
      <button class="action-button" :class="{ 'is-liked': entry.liked }" :aria-pressed="entry.liked" @click="emit('toggleLike', entry.id)">
        <Heart :size="18" :fill="entry.liked ? 'currentColor' : 'none'" />
        <span>{{ entry.likes }}</span>
      </button>
      <button class="action-button" :aria-label="`${entry.comments} comentarios`" @click="toggleComments">
        <MessageCircle :size="18" /><span>{{ entry.comments }}</span>
      </button>
      <button v-if="canPublishSocial" class="action-button facebook-share-action" type="button" @click="showSocialPublish = true"><Facebook :size="16" /><span>Facebook</span></button>
      <span class="action-spacer"></span>
      <button class="action-button save-action" aria-label="Guardar"><Bookmark :size="17" /></button>
    </footer>
    <div v-if="commentsOpen && !publicMode" class="comments-panel">
      <p v-if="feed.actionError" class="comments-empty" role="alert">{{ feed.actionError }}</p>
      <div class="comments-header">
        <strong>Comentarios</strong>
        <div class="comments-header-actions">
          <label class="comment-sort-label"><span>Ordenar</span><select v-model="commentSort" aria-label="Ordenar comentarios"><option value="popular">Más gustados</option><option value="recent">Más recientes</option></select></label>
          <button type="button" class="icon-button subtle" aria-label="Cerrar comentarios" @click="commentsOpen = false"><X :size="15" /></button>
        </div>
      </div>

      <div v-if="comments.length" class="comments-list">
        <article v-for="comment in orderedComments" :key="comment.id" class="comment-item">
          <img class="avatar avatar--small" :src="comment.author.avatar" :alt="comment.author.name" />
          <div class="comment-body">
            <div class="comment-meta"><strong>{{ comment.author.name }}</strong><span>{{ comment.createdAt }}</span></div>
            <p>{{ comment.text }}</p>
            <button class="comment-like-button" :class="{ 'is-liked': comment.liked }" type="button" :aria-pressed="comment.liked" :aria-label="comment.liked ? 'Quitar me gusta al comentario' : 'Me gusta el comentario'" @click="feed.toggleCommentLike(entry.id, comment.id)">
              <Heart :size="14" :fill="comment.liked ? 'currentColor' : 'none'" /><span>{{ comment.likes }}</span>
            </button>
          </div>
        </article>
      </div>
      <p v-else class="comments-empty">Aún no hay comentarios en este momento.</p>

      <div class="comment-composer">
        <input v-model="draftComment" type="text" maxlength="220" placeholder="Escribe un comentario" aria-label="Escribe un comentario" />
        <button type="button" :disabled="!draftComment.trim()" @click="submitComment()">
          <Send :size="15" />
        </button>
      </div>
    </div>
    <footer v-else class="public-card-footer">
      <RouterLink :to="`/stories/${entry.id}`">Leer historia <span aria-hidden="true">↗</span></RouterLink>
      <span>Abierta al público</span>
    </footer>
    <SocialPublishDialog :model-value="showSocialPublish" :story="entry" @close="showSocialPublish = false" />
  </article>
</template>

<style scoped>
.comments-panel {
  margin-top: 12px;
  padding: 12px 0 0;
  border-top: 1px solid #edf0eb;
}

.entry-carousel {
  position: relative;
  width: calc(100% + 36px);
  height: clamp(230px, 42vw, 430px);
  overflow: hidden;
  margin: 0 -18px;
  background: #26352c;
}

.entry-carousel-media {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.carousel-arrow {
  position: absolute;
  top: 50%;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, .65);
  border-radius: 50%;
  color: white;
  background: rgba(25, 36, 29, .58);
  cursor: pointer;
  transform: translateY(-50%);
  backdrop-filter: blur(8px);
}

.carousel-arrow:hover { background: rgba(25, 36, 29, .82); }
.carousel-arrow--previous { left: 14px; }
.carousel-arrow--next { right: 14px; }

.carousel-footer {
  position: absolute;
  right: 14px;
  bottom: 13px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 11px;
  color: white;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 5px rgba(0, 0, 0, .7);
}

.carousel-footer > span > span { padding: 0 2px; color: rgba(255,255,255,.68); }
.carousel-progress { height: 3px; flex: 1; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.38); }
.carousel-progress span { display: block; width: 100%; height: 100%; border-radius: inherit; background: white; transform-origin: left center; transition: transform .24s ease; }

@media (max-width: 620px) {
  .entry-carousel { width: calc(100% + 26px); height: clamp(220px, 68vw, 380px); margin-right: -13px; margin-left: -13px; }
}

.comments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  color: var(--ink);
  font-size: 11px;
}

.comments-header-actions { display: flex; align-items: center; gap: 5px; }
.comment-sort-label { display: inline-flex; align-items: center; gap: 5px; color: #89958e; font-size: 9px; }
.comment-sort-label select { max-width: 115px; min-height: 30px; padding: 3px 6px; border: 1px solid #e5eae3; border-radius: 5px; color: #526158; background: #fff; font-size: 9px; }

.comments-list {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.comment-item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 9px 0;
  border-bottom: 1px solid #f1f3f0;
}

.comment-body {
  min-width: 0;
  flex: 1;
}

.comment-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
}

.comment-meta strong {
  color: var(--ink);
  font-size: 10px;
}

.comment-meta span {
  color: #99a29c;
  font-size: 8px;
}

.comment-body p {
  margin: 0;
  color: #5d6d64;
  font-size: 10px;
  line-height: 1.55;
}

.comment-like-button { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; padding: 2px 0; border: 0; color: #89958e; background: transparent; cursor: pointer; font-size: 9px; }
.comment-like-button:hover, .comment-like-button.is-liked { color: var(--coral); }

.comments-empty {
  margin: 0 0 12px;
  color: #8a978d;
  font-size: 10px;
}

.comment-composer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
}

.comment-composer input {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #e2e7e1;
  border-radius: 999px;
  color: var(--ink);
  background: #f9faf7;
  font-size: 11px;
}

.comment-composer button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  color: white;
  background: var(--green);
  cursor: pointer;
}

.comment-composer button:disabled {
  background: #d7dfd8;
  cursor: not-allowed;
}

.entry-moderation-status { margin: 8px 0; padding: 8px 10px; border-left: 2px solid #d3a43c; color: #72591f; background: #fff8e7; font-size: 10px; line-height: 1.5; }
.entry-moderation-status.is-rejected { border-left-color: #bb5a4e; color: #9d483e; background: #fcf1ef; }
</style>

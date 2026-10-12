<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, CalendarDays, Check, Images, LoaderCircle, Pencil, Plus, Sparkles, X } from 'lucide-vue-next'
import FeedEntryCard from '../components/FeedEntryCard.vue'
import SponsoredAdPlacement from '../modules/ads/components/SponsoredAdPlacement.vue'
import { feedApi } from '../modules/feed/services/feedApi'
import { useAuthStore } from '../stores/auth'
import { useFeedStore } from '../stores/feed'
import { useUiStore } from '../stores/ui'
import { DEFAULT_AVATAR_URL } from '../utils/avatar'

const feed = useFeedStore()
const ui = useUiStore()
const auth = useAuthStore()
onMounted(() => { void feed.loadFeed() })
const DEFAULT_COVER_URL = 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1600&q=85'
const defaultProfile = {
  id: 'mariana',
  name: 'Mariana López',
  username: '@mariana',
  bio: 'Coleccionando días bonitos.',
  avatarUrl: DEFAULT_AVATAR_URL,
  coverUrl: DEFAULT_COVER_URL,
}
const profileUser = computed(() => ({ ...defaultProfile, ...auth.user }))
const currentHandle = computed(() => auth.user?.username || '@mariana')
const myEntries = computed(() => feed.entries.filter((entry) => entry.author.handle === currentHandle.value || entry.author.name === profileUser.value.name))
const storyCount = computed(() => myEntries.value.filter((entry) => entry.kind === 'story').length)
const photoCount = computed(() => myEntries.value.filter((entry) => entry.media?.some((media) => media.type === 'image') || (entry.imageUrl && entry.mediaType !== 'video')).length)
const avatarInput = ref<HTMLInputElement | null>(null)
const coverInput = ref<HTMLInputElement | null>(null)
const avatarError = ref('')
const coverError = ref('')
const isEditingName = ref(false)
const nameDraft = ref('')
const nameError = ref('')
const isSavingName = ref(false)

function startNameEdit() {
  nameDraft.value = profileUser.value.name
  nameError.value = ''
  isEditingName.value = true
}

function cancelNameEdit() {
  isEditingName.value = false
  nameDraft.value = profileUser.value.name
  nameError.value = ''
}

async function saveName() {
  const name = nameDraft.value.trim()
  if (name.length < 2 || name.length > 80) {
    nameError.value = 'El nombre debe tener entre 2 y 80 caracteres.'
    return
  }
  if (name === profileUser.value.name) {
    cancelNameEdit()
    return
  }

  isSavingName.value = true
  nameError.value = ''
  try {
    await auth.updateUserProfile({ name })
    isEditingName.value = false
  } catch {
    nameError.value = 'No se pudo actualizar el nombre. Inténtalo de nuevo.'
  } finally {
    isSavingName.value = false
  }
}

function triggerAvatarPicker() {
  avatarInput.value?.click()
}

function triggerCoverPicker() {
  coverInput.value?.click()
}

async function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  avatarError.value = ''

  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    avatarError.value = 'Usa una imagen JPG, PNG o WebP.'
    return
  }

  try {
    const [uploadedAvatar] = await feedApi.uploadMedia([file])
    if (!uploadedAvatar) throw new Error('No se recibió la imagen subida.')
    await auth.updateUserProfile({ avatarUrl: `/api/media/${uploadedAvatar.id}` })
  } catch {
    avatarError.value = 'No se pudo guardar la foto de perfil. Inténtalo de nuevo.'
  }
}

async function handleCoverChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  coverError.value = ''

  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    coverError.value = 'Usa una imagen JPG, PNG o WebP para la portada.'
    return
  }

  try {
    const [uploadedCover] = await feedApi.uploadMedia([file])
    if (!uploadedCover) throw new Error('No se recibió la imagen subida.')
    await auth.updateUserProfile({ coverUrl: `/api/media/${uploadedCover.id}` })
  } catch {
    coverError.value = 'No se pudo guardar la portada. Inténtalo de nuevo.'
  }
}
</script>

<template>
  <div class="profile-page">
    <div class="profile-cover-wrap">
      <img class="profile-cover" :src="profileUser.coverUrl || DEFAULT_COVER_URL" alt="Portada del perfil" />
      <button class="cover-edit-button" type="button" aria-label="Cambiar foto de portada" @click="triggerCoverPicker">
        <Plus :size="14" /> Cambiar portada
      </button>
      <input ref="coverInput" class="visually-hidden" type="file" accept="image/*" @change="handleCoverChange" />
      <span class="profile-cover-label"><Sparkles :size="14" /> MI ESPACIO PERSONAL</span>
    </div>
    <p v-if="coverError" class="profile-cover-error" role="alert">{{ coverError }}</p>

    <section class="profile-summary">
      <div class="profile-avatar-wrap">
        <img class="profile-avatar" :src="profileUser.avatarUrl" :alt="profileUser.name" />
        <button class="avatar-edit-button" type="button" aria-label="Cambiar foto de perfil" @click="triggerAvatarPicker">
          <Plus :size="15" />
        </button>
        <input ref="avatarInput" class="visually-hidden" type="file" accept="image/*" @change="handleAvatarChange" />
      </div>
      <p v-if="avatarError" class="profile-avatar-error" role="alert">{{ avatarError }}</p>
      <div class="profile-identity">
        <span class="eyebrow"><Sparkles :size="13" /> TU PERFIL PERSONAL</span>
        <form v-if="isEditingName" class="profile-name-form" @submit.prevent="saveName">
          <label class="visually-hidden" for="profile-name">Nombre del perfil</label>
          <input id="profile-name" v-model="nameDraft" type="text" maxlength="80" minlength="2" autocomplete="name" :disabled="isSavingName" autofocus />
          <button class="profile-name-action profile-name-save" type="submit" :disabled="isSavingName" aria-label="Guardar nombre" title="Guardar nombre">
            <LoaderCircle v-if="isSavingName" class="profile-save-spinner" :size="17" />
            <Check v-else :size="17" />
          </button>
          <button class="profile-name-action profile-name-cancel" type="button" :disabled="isSavingName" aria-label="Cancelar edición" title="Cancelar edición" @click="cancelNameEdit"><X :size="17" /></button>
        </form>
        <div v-else class="profile-name-line">
          <h1>{{ profileUser.name }}</h1>
          <button class="profile-name-edit" type="button" aria-label="Editar nombre" title="Editar nombre" @click="startNameEdit"><Pencil :size="15" /></button>
        </div>
        <p v-if="nameError" class="profile-name-error" role="alert">{{ nameError }}</p>
        <p class="profile-handle">{{ profileUser.username }} <span>·</span> {{ profileUser.bio }}</p>
      </div>
      <button class="button-primary profile-create" type="button" @click="ui.openStoryDialog()"><Plus :size="17" /> Nueva historia</button>
    </section>

    <section class="profile-stats" aria-label="Estadísticas del perfil">
      <div><strong>{{ myEntries.length }}</strong><span>momentos</span></div>
      <div><strong>{{ storyCount }}</strong><span>historias</span></div>
      <div><strong>{{ photoCount }}</strong><span>recuerdos con foto</span></div>
    </section>

    <nav class="profile-tabs" aria-label="Contenido del perfil">
      <RouterLink to="/profile">Momentos</RouterLink>
      <RouterLink to="/stories">Historias</RouterLink>
      <RouterLink to="/photos">Fotos</RouterLink>
      <RouterLink to="/albums">Álbumes</RouterLink>
    </nav>

    <div class="profile-content-heading">
      <div><span class="eyebrow">TU ARCHIVO</span><h2>Momentos guardados</h2></div>
      <RouterLink class="text-link" to="/stories">Explorar historias <ArrowRight :size="15" /></RouterLink>
    </div>
    <section v-if="myEntries.length" class="profile-feed">
      <FeedEntryCard v-for="entry in myEntries" :key="entry.id" :entry="entry" @toggle-like="feed.toggleLike" />
    </section>
    <section v-else class="empty-state profile-empty">
      <span class="empty-icon"><CalendarDays :size="22" /></span>
      <h2>Tu historia empieza con un momento</h2>
      <p>Publica algo pequeño de hoy. Este será tu espacio para volver a encontrarlo.</p>
      <button class="button-secondary" type="button" @click="ui.openStoryDialog()"><Images :size="16" /> Crear mi primera historia</button>
    </section>
    <SponsoredAdPlacement v-if="myEntries.length" />
  </div>
</template>

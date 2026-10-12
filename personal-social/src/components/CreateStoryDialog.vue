<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { z } from 'zod'
import { ImagePlus, LockKeyhole, Sparkles, Upload, X } from 'lucide-vue-next'
import type { FeedEntry, StoryDraft } from '../types/content'

const props = defineProps<{ modelValue: boolean; publishing: boolean; story?: FeedEntry | null }>()
const emit = defineEmits<{
  close: []
  publish: [story: StoryDraft]
}>()

const title = ref('')
const caption = ref('')
const visibility = ref<StoryDraft['visibility']>('public')
const selectedMedia = ref<Array<{ id?: string; file?: File; url: string; type: 'image' | 'video'; legacy?: boolean }>>([])
const errorMessage = ref('')
const fileInput = ref<HTMLInputElement>()
const dragDepth = ref(0)
const isDragOver = computed(() => dragDepth.value > 0)
const orderedMedia = computed(() => [...selectedMedia.value])

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    dragDepth.value = 0
    const story = props.story
    title.value = story?.title ?? ''
    caption.value = story?.caption ?? ''
    visibility.value = story?.visibility ?? 'public'
    const storyMedia = story?.media?.length
      ? story.media
      : story?.imageUrl
        ? [{ id: `${story.id}-legacy`, url: story.imageUrl, type: story.mediaType ?? 'image' as const }]
        : []
    selectedMedia.value = storyMedia.map((media) => {
      const legacy = media.id === `${story?.id}-legacy`
      return { ...(legacy ? {} : { id: media.id }), url: media.url, type: media.type, legacy }
    })
    errorMessage.value = ''
    return
  }
  title.value = ''
  caption.value = ''
  selectedMedia.value.forEach((media) => { if (media.file) URL.revokeObjectURL(media.url) })
  selectedMedia.value = []
  visibility.value = 'public'
  dragDepth.value = 0
  errorMessage.value = ''
})

function addMedia(files: File[]) {
  if (!files.length) return

  for (const file of files) {
    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null
    if (!type || !['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type)) {
      errorMessage.value = 'Usa JPG, PNG, WebP, MP4 o WebM.'
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      errorMessage.value = 'Cada archivo debe pesar menos de 50 MB.'
      return
    }
  }
  selectedMedia.value = [
    ...selectedMedia.value,
    ...files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
    })),
  ]
  errorMessage.value = ''
}

function selectMedia(event: Event) {
  const input = event.target as HTMLInputElement
  addMedia(Array.from(input.files ?? []))
  input.value = ''
}

function handleDragEnter(event: DragEvent) {
  if (props.publishing) return
  event.preventDefault()
  dragDepth.value += 1
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault()
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  dragDepth.value = 0
  if (props.publishing) return
  addMedia(Array.from(event.dataTransfer?.files ?? []))
}

function removeMedia(url: string) {
  const index = selectedMedia.value.findIndex((media) => media.url === url)
  if (index < 0) return
  if (selectedMedia.value[index].file) URL.revokeObjectURL(selectedMedia.value[index].url)
  selectedMedia.value.splice(index, 1)
}

function publish() {
  const result = z.object({
    title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres.'),
    caption: z.string().trim().min(8, 'Cuéntanos un poco más sobre este momento.'),
  }).safeParse({ title: title.value, caption: caption.value })

  if (!result.success) {
    errorMessage.value = result.error.issues[0]?.message ?? 'Revisa los datos de la historia.'
    return
  }

  const legacyMedia = orderedMedia.value.find((media) => media.legacy)
  emit('publish', {
    storyId: props.story?.id,
    ...result.data,
    media: orderedMedia.value.filter((media) => !media.legacy).map(({ id, file, type }) => ({ id, file, type })),
    imageUrl: legacyMedia?.url,
    mediaType: legacyMedia?.type,
    visibility: visibility.value,
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="props.modelValue" class="dialog-backdrop" @click.self="!props.publishing && emit('close')">
      <section class="story-dialog" role="dialog" aria-modal="true" aria-labelledby="story-dialog-title" @dragenter="handleDragEnter" @dragover.prevent @dragleave="handleDragLeave" @drop="handleDrop">
        <header class="dialog-header">
          <div>
            <span class="eyebrow">UN MOMENTO TUYO</span>
            <h2 id="story-dialog-title">{{ props.story ? 'Editar historia' : 'Crear historia' }}</h2>
          </div>
          <button class="icon-button" type="button" aria-label="Cerrar" :disabled="props.publishing" @click="emit('close')"><X :size="19" /></button>
        </header>

        <form class="story-form" @submit.prevent="publish">
          <label class="field-label" for="story-title">Título</label>
          <input id="story-title" v-model="title" maxlength="80" placeholder="Una tarde en el parque" required />

          <label class="field-label" for="story-caption">¿Qué pasó?</label>
          <textarea id="story-caption" v-model="caption" rows="4" maxlength="500" placeholder="Guarda los detalles que querrás recordar..." required />

          <span class="field-label media-section-label">Fotos y videos debajo de tu texto</span>
          <div v-if="orderedMedia.length" class="media-previews">
            <figure v-for="(media, index) in orderedMedia" :key="media.url" class="media-preview">
              <img v-if="media.type === 'image'" :src="media.url" alt="Vista previa de la imagen elegida" />
              <video v-else :src="media.url" controls />
              <span class="media-order">{{ index + 1 }}</span>
              <button class="preview-remove" type="button" :aria-label="`Quitar ${media.type === 'image' ? 'imagen' : 'video'}`" :disabled="props.publishing" @click="removeMedia(media.url)"><X :size="16" /></button>
            </figure>
          </div>
          <button class="upload-dropzone" type="button" :disabled="props.publishing" @click="fileInput?.click()">
            <span class="upload-icon"><ImagePlus :size="21" /></span>
            <span><strong>{{ orderedMedia.length ? 'Añade más fotos o videos' : 'Añade fotos y videos' }}</strong><small>Selecciona varios o arrástralos aquí · JPG, PNG, WebP, MP4 o WebM · hasta 50 MB cada uno</small></span>
            <Upload class="upload-trailing" :size="18" />
          </button>
          <input ref="fileInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple :disabled="props.publishing" @change="selectMedia" />

          <label class="field-label" for="story-privacy">Quién puede verlo</label>
          <div class="privacy-field">
            <LockKeyhole :size="17" />
            <select id="story-privacy" v-model="visibility">
              <option value="public">Público</option>
              <option value="followers">Personas que sigo</option>
              <option value="private">Solo yo</option>
            </select>
          </div>

          <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
          <div class="dialog-footer">
            <p><Sparkles :size="15" /> {{ props.story ? 'Los cambios se guardarán en tu timeline' : 'Se guardará en tu timeline' }}</p>
            <button class="button-primary" type="submit" :disabled="props.publishing"><span>{{ props.publishing ? 'Guardando…' : props.story ? 'Guardar cambios' : 'Publicar historia' }}</span><span v-if="!props.publishing" aria-hidden="true">↗</span></button>
          </div>
        </form>
        <div v-if="isDragOver" class="story-drag-overlay" role="status" aria-live="polite">
          <span class="story-drag-icon"><ImagePlus :size="30" /></span>
          <strong>Modo de arrastrar y soltar activado</strong>
          <span>Suelta aquí tu imagen o video para añadirlo a la historia</span>
        </div>
      </section>
    </div>
  </Teleport>
</template>

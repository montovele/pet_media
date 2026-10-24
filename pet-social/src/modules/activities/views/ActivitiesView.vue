<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight, CalendarDays, Check, Clock3, ExternalLink, Film, MapPin, Plus, Tag, Upload, X } from 'lucide-vue-next'
import { useActivitiesStore } from '../stores/activities'
import { animalsApi, type AnimalRecord } from '../../animals/services/animalsApi'
import SponsoredAdPlacement from '../../campaigns/components/SponsoredAdPlacement.vue'
import { activityCategoryLabels, activityFormSchema } from '../services/activityValidation'
import type { ActivityCategory, CreateActivityInput } from '../../../types/content'

const activities = useActivitiesStore()
const route = useRoute()
const animals = ref<AnimalRecord[]>([])
const animalsLoading = ref(true)
const animalsError = ref('')
onMounted(() => {
  void activities.load()
  void animalsApi.list().then((records) => {
    animals.value = records
    const requestedAnimal = typeof route.query.animalId === 'string' ? route.query.animalId : ''
    if (records.some((animal) => animal.id === requestedAnimal)) form.animalId = requestedAnimal
    else if (records.length === 1) form.animalId = records[0].id
  }).catch(() => {
    animalsError.value = 'No pudimos cargar tus animales.'
  }).finally(() => { animalsLoading.value = false })
})

function localDate() {
  const today = new Date()
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset())
  return today.toISOString().slice(0, 10)
}

const form = reactive({ animalId: '', title: '', description: '', date: localDate(), locationName: '', category: 'other' as ActivityCategory })
const selectedMedia = ref<Array<{ file: File; previewUrl: string }>>([])
const mediaInput = ref<HTMLInputElement>()
const mediaError = ref('')
const isDraggingMedia = ref(false)
let dragDepth = 0
const activityCountLabel = computed(() => `${activities.items.length} ${activities.items.length === 1 ? 'actividad guardada' : 'actividades guardadas'}`)

onBeforeUnmount(() => {
  selectedMedia.value.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl))
})

function selectMedia(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  selectMediaFiles(files)
}

function handleMediaDragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  dragDepth += 1
  isDraggingMedia.value = true
}

function handleMediaDragLeave(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) isDraggingMedia.value = false
}

function handleMediaDrop(event: DragEvent) {
  dragDepth = 0
  isDraggingMedia.value = false
  selectMediaFiles(Array.from(event.dataTransfer?.files ?? []))
}

function selectMediaFiles(files: File[]) {
  mediaError.value = ''
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp', 'video/mp4', 'video/webm']
  const invalidFile = files.find((file) => !supportedTypes.includes(file.type))
  if (invalidFile) {
    mediaError.value = `El archivo "${invalidFile.name}" no tiene un formato compatible.`
    return
  }
  const oversizedFile = files.find((file) => file.size > (file.type.startsWith('video/') ? 150 : 50) * 1024 * 1024)
  if (oversizedFile) {
    mediaError.value = oversizedFile.type.startsWith('video/')
      ? `El video "${oversizedFile.name}" debe pesar hasta 150 MB.`
      : `La imagen "${oversizedFile.name}" debe pesar hasta 50 MB.`
    return
  }
  const uniqueFiles = files.filter((file) => !selectedMedia.value.some((item) =>
    item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified,
  ))
  if (selectedMedia.value.length + uniqueFiles.length > 20) {
    mediaError.value = 'Puedes adjuntar hasta 20 imágenes o videos por actividad.'
    return
  }
  selectedMedia.value.push(...uniqueFiles.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })))
}

function removeMedia(index: number) {
  const [removed] = selectedMedia.value.splice(index, 1)
  if (removed) URL.revokeObjectURL(removed.previewUrl)
  mediaError.value = ''
}

function clearMedia() {
  selectedMedia.value.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl))
  selectedMedia.value = []
  mediaError.value = ''
}

async function submitActivity() {
  if (mediaError.value) return
  const result = activityFormSchema.safeParse(form)

  if (!result.success) {
    activities.error = result.error.issues[0]?.message ?? 'Revisa los datos de la actividad.'
    return
  }

  const input: CreateActivityInput = {
    ...result.data,
    description: result.data.description || undefined,
    locationName: result.data.locationName || undefined,
  }
  if (await activities.create(input, selectedMedia.value.map(({ file }) => file))) {
    if (animals.value.length !== 1) form.animalId = ''
    form.title = ''
    form.description = ''
    form.locationName = ''
    form.category = 'other'
    clearMedia()
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`))
}
</script>

<template>
  <main class="activities-view">
    <header class="activities-heading">
      <span class="eyebrow"><CalendarDays :size="14" /> BIOGRAFÍA ANIMAL</span>
      <div class="activities-heading-row">
        <div><h1>Caminatas y actividades</h1><p>Registra momentos asociados a un animal; aparecerán en su historia de vida.</p></div>
        <span class="activities-count">{{ activityCountLabel }}</span>
      </div>
    </header>

    <section class="activity-composer" aria-labelledby="activity-form-title">
      <div class="activity-composer-heading"><span class="activity-add-icon"><Plus :size="18" /></span><div><h2 id="activity-form-title">Añadir a su historia</h2><p>Elige el animal y registra una caminata, viaje, cuidado u otro momento.</p></div></div>
      <form class="activity-form" @submit.prevent="submitActivity">
        <label class="activity-field activity-animal-field"><span>Animal</span><select v-model="form.animalId" required :disabled="animalsLoading || !animals.length"><option value="" disabled>{{ animalsLoading ? 'Cargando animales…' : 'Selecciona un animal' }}</option><option v-for="animal in animals" :key="animal.id" :value="animal.id">{{ animal.name || 'Sin nombre' }} · {{ animal.species }}</option></select></label>
        <label class="activity-field activity-title-field"><span>Actividad</span><input v-model="form.title" maxlength="120" required placeholder="Ej. Caminata por el bosque" /></label>
        <label class="activity-field"><span>Fecha</span><input v-model="form.date" type="date" required /></label>
        <label class="activity-field"><span>Lugar</span><input v-model="form.locationName" maxlength="180" placeholder="Opcional" /></label>
        <label class="activity-field"><span>Categoría</span><select v-model="form.category"><option v-for="(label, category) in activityCategoryLabels" :key="category" :value="category">{{ label }}</option></select></label>
        <label class="activity-field activity-description-field"><span>Nota</span><textarea v-model="form.description" rows="2" maxlength="500" placeholder="Añade algún detalle que quieras recordar" /></label>
        <div
          class="activity-video-field"
          :class="{ 'activity-video-field--dragging': isDraggingMedia }"
          @dragenter.prevent="handleMediaDragEnter"
          @dragover.prevent
          @dragleave.prevent="handleMediaDragLeave"
          @drop.prevent="handleMediaDrop"
        >
          <div class="activity-video-label"><Film :size="16" /><span>Fotos y videos del momento</span><small>Opcional</small></div>
          <TransitionGroup name="media-preview" tag="div" class="activity-media-previews">
            <div v-for="(media, index) in selectedMedia" :key="`${media.file.name}-${media.file.lastModified}-${media.file.size}`" class="activity-video-preview">
              <img v-if="media.file.type.startsWith('image/')" :src="media.previewUrl" :alt="`Vista previa de ${media.file.name}`" />
              <video v-else :src="media.previewUrl" controls preload="metadata" />
              <button class="activity-video-remove" type="button" :aria-label="`Quitar ${media.file.name}`" @click="removeMedia(index)"><X :size="15" /></button>
              <span class="activity-media-name">{{ media.file.name }}</span>
            </div>
          </TransitionGroup>
          <div class="activity-video-actions">
            <input ref="mediaInput" class="visually-hidden" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,video/mp4,video/webm" @change="selectMedia" />
            <button class="activity-upload-button" type="button" @click="mediaInput?.click()"><Upload :size="15" />{{ selectedMedia.length ? 'Añadir más archivos' : 'Adjuntar imágenes o videos' }}</button>
            <span>{{ selectedMedia.length ? `${selectedMedia.length} de 20 archivos · imágenes hasta 50 MB y videos hasta 150 MB` : 'Arrastra y suelta imágenes y videos, o selecciónalos · hasta 20 archivos' }}</span>
          </div>
          <p v-if="mediaError" class="activity-error" role="alert">{{ mediaError }}</p>
        </div>
        <p v-if="activities.error" class="activity-error" role="alert">{{ activities.error }}</p>
        <p v-if="animalsError" class="activity-error" role="alert">{{ animalsError }}</p>
        <div v-if="!animalsLoading && !animals.length" class="activity-no-animals"><p>Primero registra un animal para asociar esta actividad a su historia.</p><RouterLink to="/animals">Registrar animal <ArrowRight :size="14" /></RouterLink></div>
        <div class="activity-form-footer"><span>Los eventos son privados y forman parte del historial del animal.</span><button class="button-primary" type="submit" :disabled="activities.saving || !!mediaError || !animals.length"><Plus :size="16" />{{ activities.saving ? 'Guardando…' : 'Guardar actividad' }}</button></div>
      </form>
    </section>

    <section class="video-guide" aria-labelledby="video-guide-title">
      <div class="video-guide-intro">
        <span class="video-guide-icon"><Film :size="19" /></span>
        <span class="eyebrow">DEL RECUERDO AL CLIP</span>
        <h2 id="video-guide-title">Crea un video con Pika</h2>
        <p>Genera un clip corto inspirado en tu actividad y adjúntalo aquí para conservarlo junto a la fecha y el lugar.</p>
        <a class="pika-link" href="https://create.pika.art/home" target="_blank" rel="noopener noreferrer">Abrir Pika <ExternalLink :size="14" /></a>
      </div>
      <ol class="video-guide-steps">
        <li><span>01</span><div><strong>Abre Video Studio</strong><p>En Pika, elige Video Studio para crear un clip a partir de una idea o una imagen de referencia.</p></div></li>
        <li><span>02</span><div><strong>Describe el momento</strong><p>Indica qué aparece, qué movimiento ocurre y el ambiente. Ejemplo: “Una caminata al atardecer junto al mar, olas suaves, cámara avanzando lentamente, luz cálida”.</p></div></li>
        <li><span>03</span><div><strong>Descarga y adjunta</strong><p>Exporta el resultado como MP4 o WebM. Aquí, adjúntalo al registrar la actividad; se admite hasta 150 MB.</p></div></li>
      </ol>
    </section>

    <section class="activity-log" aria-labelledby="activity-log-title">
      <div class="activity-log-heading"><div><span class="eyebrow">HISTORIAS DE VIDA</span><h2 id="activity-log-title">Eventos recientes</h2></div><RouterLink class="activity-history-link" to="/stories">Ver historias <ArrowRight :size="14" /></RouterLink></div>
      <p v-if="activities.loading" class="activity-state">Cargando actividades…</p>
      <p v-else-if="activities.error && !activities.items.length" class="activity-state activity-state--error" role="alert">{{ activities.error }}</p>
      <div v-else-if="activities.items.some((activity) => activity.animalId)" class="activity-list">
        <article v-for="activity in activities.items.filter((item) => item.animalId)" :key="activity.id" class="activity-row">
          <span class="activity-date-mark"><CalendarDays :size="18" /></span>
          <div class="activity-row-main"><time :datetime="activity.date">{{ formatDate(activity.date) }}</time><h3>{{ activity.title }}</h3><p class="activity-animal-name">{{ activity.animalName || 'Animal registrado' }}<template v-if="activity.animalSpecies"> · {{ activity.animalSpecies }}</template></p><p v-if="activity.description">{{ activity.description }}</p><div v-if="activity.media?.length || activity.video" class="activity-saved-media-list"><template v-for="media in activity.media ?? (activity.video ? [activity.video] : [])" :key="media.id"><img v-if="media.type === 'image'" class="activity-saved-media" :src="media.url" :alt="`Imagen de ${activity.title}`" crossorigin="use-credentials" /><video v-else class="activity-saved-media" :src="media.url" controls preload="metadata" crossorigin="use-credentials" :aria-label="`Video de ${activity.title}`" /></template></div><div class="activity-meta"><span><Tag :size="13" /> {{ activityCategoryLabels[activity.category] }}</span><span v-if="activity.locationName"><MapPin :size="13" /> {{ activity.locationName }}</span><span v-if="activity.media?.length || activity.video"><Check :size="13" /> {{ (activity.media?.length || (activity.video ? 1 : 0)) }} archivo(s) adjunto(s)</span><span><Clock3 :size="13" /> En su historia</span></div></div>
        </article>
      </div>
      <div v-else class="activity-empty"><span><CalendarDays :size="21" /></span><h3>Aún no hay eventos</h3><p>Registra una caminata o actividad y aparecerá en la historia del animal correspondiente.</p></div>
    </section>
    <SponsoredAdPlacement v-if="activities.items.length" />
  </main>
</template>

<style scoped>
.activities-view { width: min(100%, 900px); margin: 0 auto; padding: 12px 0 54px; }
.activities-heading { padding: 10px 0 23px; border-bottom: 1px solid var(--line); animation: arrive .42s ease both; }
.activities-heading > .eyebrow { display: inline-flex; align-items: center; gap: 7px; color: #8b7040; }
.activities-heading-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-top: 8px; }
.activities-heading h1 { margin: 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 36px; font-weight: 500; line-height: 1.1; }
.activities-heading p { margin: 7px 0 0; color: var(--muted); font-size: 11px; line-height: 1.55; }
.activities-count { flex: 0 0 auto; padding-bottom: 3px; color: #8b7040; font-size: 10px; font-weight: 700; }
.activity-composer { padding: 21px 0 22px; border-bottom: 1px solid var(--line); animation: arrive .42s .07s ease both; }
.activity-composer-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
.activity-add-icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; color: #876a37; background: #f4ecd9; }
.activity-composer-heading h2, .activity-log-heading h2 { margin: 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 21px; font-weight: 500; }
.activity-composer-heading p { margin: 3px 0 0; color: var(--muted); font-size: 10px; }
.activity-form { display: grid; grid-template-columns: 2fr 1fr 1.4fr 1fr; gap: 11px; }
.activity-field { min-width: 0; display: grid; gap: 5px; color: #68766c; font-size: 10px; font-weight: 700; }
.activity-field input, .activity-field select, .activity-field textarea { width: 100%; min-height: 38px; padding: 8px 10px; border: 1px solid #e1e7de; border-radius: 4px; color: var(--ink); background: #fff; font-size: 11px; font-weight: 400; }
.activity-field textarea { resize: vertical; line-height: 1.5; }
.activity-field input:focus, .activity-field select:focus, .activity-field textarea:focus { border-color: #a9c2ad; outline: 3px solid rgba(55, 120, 97, .12); }
.activity-title-field { grid-column: span 2; }
.activity-animal-field { grid-column: 1 / -1; }
.activity-description-field { grid-column: 1 / -1; }
.activity-video-field { grid-column: 1 / -1; display: grid; gap: 9px; padding: 13px 14px; border: 1px dashed #cbdacb; border-radius: 6px; background: #f8faf6; transition: background .2s ease, border-color .2s ease, box-shadow .2s ease, transform .2s ease; }
.activity-video-field--dragging { border-color: #43845f; background: #eaf5eb; box-shadow: 0 0 0 4px rgba(67, 132, 95, .13); transform: scale(1.01); animation: media-drop-pulse .8s ease-in-out infinite alternate; }
.activity-video-label { display: flex; align-items: center; gap: 7px; color: #435b49; font-size: 10px; font-weight: 700; }
.activity-video-label small { margin-left: auto; color: #8b978d; font-size: 9px; font-weight: 500; }
.activity-media-previews { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); gap: 10px; }
.activity-video-preview { position: relative; min-width: 0; overflow: hidden; border-radius: 5px; background: #26352c; }
.media-preview-enter-active, .media-preview-leave-active { transition: opacity .24s ease, transform .24s ease; }
.media-preview-enter-from, .media-preview-leave-to { opacity: 0; transform: translateY(8px) scale(.98); }
.activity-video-preview video, .activity-video-preview img { display: block; width: 100%; max-height: 280px; object-fit: contain; }
.activity-media-name { display: block; overflow: hidden; padding: 6px 9px; color: white; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.activity-video-remove { position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.5); border-radius: 50%; color: white; background: rgba(25, 36, 29, .75); cursor: pointer; }
.activity-video-actions { display: flex; align-items: center; gap: 10px; }
.activity-upload-button { min-height: 34px; display: inline-flex; align-items: center; gap: 7px; padding: 0 10px; border: 1px solid #dce6dc; border-radius: 4px; color: #38684d; background: white; cursor: pointer; font-size: 10px; font-weight: 700; }
.activity-video-actions > span { min-width: 0; overflow-wrap: anywhere; color: #849087; font-size: 9px; }
.activity-saved-media-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 10px; margin-top: 12px; }
.activity-saved-media { display: block; width: 100%; max-height: 320px; border-radius: 6px; object-fit: contain; background: #26352c; }
.activity-form-footer { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 2px; }
.activity-form-footer > span { color: #89958c; font-size: 9px; }
.activity-form-footer button { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 12px; }
.activity-error { grid-column: 1 / -1; margin: 0; color: #b45244; font-size: 10px; }
.video-guide { display: grid; grid-template-columns: minmax(220px, .75fr) minmax(0, 1.25fr); gap: clamp(22px, 5vw, 60px); margin: 24px 0 0; padding: 22px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); animation: arrive .42s .14s ease both; }
.video-guide-intro { align-content: start; justify-items: start; display: grid; }
.video-guide-icon { width: 37px; height: 37px; display: grid; place-items: center; margin-bottom: 12px; border-radius: 10px; color: #9a5a42; background: #f7e9dd; }
.video-guide-intro .eyebrow { color: #9a7158; }
.video-guide-intro h2 { margin: 6px 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 24px; font-weight: 500; line-height: 1.08; }
.video-guide-intro p { max-width: 300px; margin: 0; color: #738078; font-size: 10px; line-height: 1.65; }
.pika-link { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; margin-top: 14px; padding: 0 10px; border-radius: 4px; color: white; background: #3b6e53; font-size: 10px; font-weight: 700; transition: background .18s, transform .18s; }
.pika-link:hover { background: #285a49; transform: translateY(-1px); }
.video-guide-steps { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.video-guide-steps li { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; padding: 11px 0; border-bottom: 1px solid #e9ede7; }
.video-guide-steps li:first-child { padding-top: 0; }
.video-guide-steps li:last-child { padding-bottom: 0; border-bottom: 0; }
.video-guide-steps li > span { color: #b46e51; font-family: 'Newsreader', Georgia, serif; font-size: 14px; }
.video-guide-steps strong { color: #35463a; font-size: 10px; }
.video-guide-steps p { margin: 4px 0 0; color: #78847b; font-size: 9px; line-height: 1.55; }
.activity-log { padding-top: 24px; animation: arrive .42s .2s ease both; }
.activity-log-heading { display: flex; align-items: end; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.activity-log-heading .eyebrow { display: block; margin-bottom: 5px; color: #8b7040; }
.activity-log-heading > span { color: #8b7040; font-size: 11px; font-weight: 700; }
.activity-history-link { display: inline-flex; align-items: center; gap: 5px; color: #16736e; font-size: 10px; font-weight: 700; }
.activity-animal-name { margin: 0 0 5px; color: var(--brand-primary); font-size: 9px; font-weight: 700; }
.activity-no-animals { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 12px; color: #526c60; background: #e8f2ec; }
.activity-no-animals p { font-size: 10px; line-height: 1.45; }
.activity-no-animals a { display: inline-flex; align-items: center; gap: 5px; color: #16736e; font-size: 9px; font-weight: 700; white-space: nowrap; }
.activity-list { display: grid; }
.activity-row { display: flex; gap: 14px; padding: 17px 2px; border-bottom: 1px solid #e9ede7; animation: arrive .36s ease both; transition: background .18s; }
.activity-row:hover { background: rgba(255,255,255,.48); }
.activity-row:nth-child(2) { animation-delay: 45ms; }
.activity-row:nth-child(3) { animation-delay: 90ms; }
.activity-date-mark { width: 38px; height: 38px; flex: 0 0 auto; display: grid; place-items: center; border: 1px solid #eee5d2; border-radius: 50%; color: #92733b; background: #faf7ef; }
.activity-row-main { min-width: 0; flex: 1; }
.activity-row time { color: #92733b; font-size: 9px; font-weight: 700; }
.activity-row h3 { margin: 4px 0; color: var(--ink); font-size: 13px; font-weight: 700; }
.activity-row-main > p { margin: 0; color: #68766c; font-size: 11px; line-height: 1.55; white-space: pre-wrap; }
.activity-saved-video { display: block; width: min(100%, 520px); max-height: 310px; margin-top: 11px; border-radius: 5px; background: #26352c; }
.activity-meta { display: flex; flex-wrap: wrap; gap: 13px; margin-top: 9px; color: #87938a; font-size: 9px; }
.activity-meta span { display: inline-flex; align-items: center; gap: 4px; }
.activity-empty { display: grid; justify-items: center; padding: 42px 15px; text-align: center; }
.activity-empty > span { width: 42px; height: 42px; display: grid; place-items: center; margin-bottom: 9px; border-radius: 50%; color: #92733b; background: #f4ecd9; }
.activity-empty h3 { margin: 0 0 5px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 20px; font-weight: 500; }
.activity-empty p, .activity-state { margin: 0; color: var(--muted); font-size: 10px; text-align: center; }
.activity-state { padding: 28px 12px; }
.activity-state--error { color: #b45244; }
@keyframes media-drop-pulse { from { box-shadow: 0 0 0 3px rgba(67, 132, 95, .1); } to { box-shadow: 0 0 0 7px rgba(67, 132, 95, .2); } }
@media (prefers-reduced-motion: reduce) { .activity-video-field--dragging { animation: none; } }
@media (max-width: 700px) { .activities-view { padding-top: 2px; } .activities-heading-row { align-items: flex-start; flex-direction: column; gap: 9px; } .activity-form { grid-template-columns: repeat(2, minmax(0, 1fr)); } .activity-title-field { grid-column: 1 / -1; } .video-guide { grid-template-columns: 1fr; gap: 20px; } }
@media (max-width: 420px) { .activity-form { grid-template-columns: 1fr; } .activity-animal-field, .activity-title-field, .activity-description-field, .activity-video-field, .activity-form-footer, .activity-error, .activity-no-animals { grid-column: 1; } .activity-form-footer { align-items: flex-start; flex-direction: column; } .activity-video-actions { align-items: flex-start; flex-direction: column; } .activity-no-animals { align-items: flex-start; flex-direction: column; } }
</style>
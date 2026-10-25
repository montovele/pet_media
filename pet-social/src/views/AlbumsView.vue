<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Images, Layers3, Plus, X } from 'lucide-vue-next'
import { z } from 'zod'
import { useAlbumsStore } from '../modules/albums/stores/albums'
import { usePhotosStore } from '../modules/photos/stores/photos'
import SponsoredAdPlacement from '../modules/campaigns/components/SponsoredAdPlacement.vue'

const albums = useAlbumsStore()
const photos = usePhotosStore()
const creating = ref(false)
const selectedPhotoIds = ref<string[]>([])
const form = reactive({ title: '', description: '' })
const availablePhotoCount = computed(() => photos.items.length)

onMounted(() => {
  void albums.load()
  void photos.load()
})

function togglePhoto(photoId: string) {
  selectedPhotoIds.value = selectedPhotoIds.value.includes(photoId)
    ? selectedPhotoIds.value.filter((id) => id !== photoId)
    : [...selectedPhotoIds.value, photoId]
}

async function submitAlbum() {
  const result = z.object({
    title: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres.').max(120),
    description: z.string().trim().max(500),
  }).safeParse(form)
  if (!result.success) {
    albums.error = result.error.issues[0]?.message ?? 'Revisa el nombre del álbum.'
    return
  }

  if (await albums.create({
    title: result.data.title,
    description: result.data.description || undefined,
    photoIds: selectedPhotoIds.value,
  })) {
    form.title = ''
    form.description = ''
    selectedPhotoIds.value = []
    creating.value = false
  }
}
</script>

<template>
  <main class="albums-page">
    <header class="albums-heading">
      <span class="eyebrow"><Layers3 :size="14" /> COLECCIONES PERSONALES</span>
      <div class="albums-heading-row"><div><h1>Álbumes</h1><p>Organiza las fotos y videos de tus historias, publicaciones y actividades en colecciones.</p></div><button class="button-primary" type="button" @click="creating = !creating"><X v-if="creating" :size="16" /><Plus v-else :size="16" />{{ creating ? 'Cerrar' : 'Nuevo álbum' }}</button></div>
    </header>

    <section v-if="creating" class="album-create-section" aria-labelledby="album-create-title">
      <div class="album-create-heading"><span class="album-create-icon"><Plus :size="17" /></span><div><h2 id="album-create-title">Crear colección</h2><p>Elige un nombre y añade fotos o videos de tu biblioteca.</p></div></div>
      <form class="album-form" @submit.prevent="submitAlbum">
        <label class="album-field"><span>Nombre del álbum</span><input v-model="form.title" maxlength="120" required placeholder="Ej. Verano en la costa" /></label>
        <label class="album-field"><span>Descripción</span><textarea v-model="form.description" rows="2" maxlength="500" placeholder="Opcional" /></label>
        <div class="album-picker-heading"><span>Multimedia de tu biblioteca</span><small>{{ selectedPhotoIds.length }} seleccionados de {{ availablePhotoCount }}</small></div>
        <div v-if="photos.items.length" class="album-photo-picker">
          <button v-for="photo in photos.items" :key="photo.id" class="album-photo-option" :class="{ selected: selectedPhotoIds.includes(photo.id) }" type="button" :aria-pressed="selectedPhotoIds.includes(photo.id)" @click="togglePhoto(photo.id)">
            <video v-if="photo.mediaType === 'video'" :src="photo.url" :aria-label="photo.title" muted playsinline preload="metadata" />
            <img v-else :src="photo.url" :alt="photo.title" loading="lazy" />
            <span class="album-photo-check"><span v-if="selectedPhotoIds.includes(photo.id)">{{ selectedPhotoIds.indexOf(photo.id) + 1 }}</span></span>
          </button>
        </div>
        <p v-else class="album-no-photos">Aún no hay contenido multimedia disponible. Añade fotos o videos en una historia o actividad para incluirlos aquí.</p>
        <p v-if="albums.error" class="album-error" role="alert">{{ albums.error }}</p>
        <div class="album-form-footer"><span>El contenido se mantiene en su historia o actividad original.</span><button class="button-primary" type="submit" :disabled="albums.saving"><Plus :size="15" />{{ albums.saving ? 'Guardando…' : 'Guardar álbum' }}</button></div>
      </form>
    </section>

    <section class="album-list-section" aria-labelledby="album-list-title">
      <div class="album-list-heading"><div><span class="eyebrow">TU ARCHIVO VISUAL</span><h2 id="album-list-title">Colecciones</h2></div><span>{{ albums.items.length }}</span></div>
      <p v-if="albums.loading || photos.loading" class="album-state">Cargando álbumes…</p>
      <p v-else-if="albums.error && !albums.items.length" class="album-state album-state--error" role="alert">{{ albums.error }}</p>
      <div v-else-if="albums.items.length" class="album-grid">
        <RouterLink v-for="album in albums.items" :key="album.id" class="album-card" :to="{ name: 'album-detail', params: { id: album.id } }">
          <div class="album-cover-grid" :class="`album-cover-grid--${Math.min(album.photos.length, 4)}`">
            <template v-for="photo in album.photos.slice(0, 4)" :key="photo.id">
              <video v-if="photo.mediaType === 'video'" :src="photo.url" :aria-label="album.title" muted playsinline preload="metadata" />
              <img v-else :src="photo.url" :alt="album.title" loading="lazy" />
            </template>
            <span v-if="!album.photos.length" class="album-cover-empty"><Images :size="26" /></span>
          </div>
          <div class="album-card-copy"><h3>{{ album.title }}</h3><p v-if="album.description">{{ album.description }}</p><span>{{ album.photos.length }} {{ album.photos.length === 1 ? 'elemento' : 'elementos' }}</span></div>
        </RouterLink>
      </div>
      <div v-else class="albums-empty"><span class="album-empty-icon"><Images :size="22" /></span><h2>Todavía no hay álbumes</h2><p>Crea una colección para agrupar las fotos y videos de tu biblioteca.</p><button class="button-secondary" type="button" @click="creating = true"><Plus :size="15" /> Crear primer álbum</button></div>
    </section>
    <SponsoredAdPlacement v-if="albums.items.length" />
  </main>
</template>

<style scoped>
.albums-page { width: min(100%, 1000px); margin: 0 auto; padding: 12px 0 56px; }
.albums-heading { padding: 10px 0 20px; border-bottom: 1px solid var(--line); }
.albums-heading > .eyebrow { display: inline-flex; align-items: center; gap: 7px; color: #63776a; }
.albums-heading-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-top: 8px; }
.albums-heading h1 { margin: 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 36px; font-weight: 500; }
.albums-heading p { margin: 6px 0 0; color: var(--muted); font-size: 11px; line-height: 1.55; }
.albums-heading-row button { display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto; min-height: 38px; padding: 0 12px; }
.album-create-section { padding: 20px 0; border-bottom: 1px solid var(--line); }
.album-create-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 13px; }
.album-create-icon { width: 35px; height: 35px; display: grid; place-items: center; border-radius: 50%; color: #63776a; background: #e8efe7; }
.album-create-heading h2, .album-list-heading h2 { margin: 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 21px; font-weight: 500; }
.album-create-heading p { margin: 3px 0 0; color: var(--muted); font-size: 10px; }
.album-form { display: grid; gap: 11px; }
.album-field { display: grid; gap: 5px; color: #68766c; font-size: 10px; font-weight: 700; }
.album-field input, .album-field textarea { width: 100%; padding: 9px 10px; border: 1px solid #e1e7de; border-radius: 4px; color: var(--ink); background: white; font-size: 11px; font-weight: 400; }
.album-field textarea { resize: vertical; }
.album-picker-heading, .album-list-heading { display: flex; align-items: end; justify-content: space-between; gap: 12px; }
.album-picker-heading { color: #5e6e62; font-size: 10px; font-weight: 700; }
.album-picker-heading small { color: #89958c; font-size: 9px; font-weight: 400; }
.album-photo-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(95px, 1fr)); gap: 7px; max-height: 270px; overflow: auto; padding: 2px; }
.album-photo-option { position: relative; aspect-ratio: 1; overflow: hidden; padding: 0; border: 2px solid transparent; border-radius: 5px; background: #e9eee8; cursor: pointer; }
.album-photo-option.selected { border-color: #397459; }
.album-photo-option img, .album-photo-option video { display: block; width: 100%; height: 100%; object-fit: cover; }
.album-photo-check { position: absolute; top: 6px; right: 6px; width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.9); border-radius: 50%; color: #fff; background: rgba(31,45,35,.6); font-size: 9px; font-weight: 700; }
.album-photo-option.selected .album-photo-check { border-color: #397459; background: #397459; }
.album-no-photos { margin: 0; padding: 15px; color: #7b897f; background: #f5f7f3; font-size: 10px; line-height: 1.5; }
.album-error { margin: 0; color: #b45244; font-size: 10px; }
.album-form-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.album-form-footer > span { color: #89958c; font-size: 9px; }
.album-form-footer button { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 11px; }
.album-list-section { padding-top: 23px; }
.album-list-heading { padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.album-list-heading .eyebrow { display: block; margin-bottom: 5px; color: #63776a; }
.album-list-heading > span { color: #63776a; font-size: 11px; font-weight: 700; }
.album-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 13px; padding-top: 14px; }
.album-card { display: block; overflow: hidden; border: 1px solid #e5eae2; border-radius: 6px; color: inherit; background: white; text-decoration: none; }
.album-cover-grid { display: grid; aspect-ratio: 1.45; overflow: hidden; background: #e9eee8; }
.album-cover-grid--2, .album-cover-grid--3, .album-cover-grid--4 { grid-template-columns: repeat(2, 1fr); }
.album-cover-grid--3 img:first-child, .album-cover-grid--3 video:first-child { grid-row: span 2; }
.album-cover-grid img, .album-cover-grid video { width: 100%; height: 100%; min-height: 0; object-fit: cover; }
.album-cover-empty { grid-area: 1 / 1 / -1 / -1; display: grid; place-items: center; color: #7b8d7f; }
.album-card-copy { padding: 11px 12px 12px; }
.album-card-copy h3 { margin: 0; color: var(--ink); font-size: 12px; }
.album-card-copy p { margin: 5px 0 7px; color: #718076; font-size: 9px; line-height: 1.5; }
.album-card-copy > span { color: #8d998f; font-size: 9px; }
.albums-empty { display: grid; justify-items: center; padding: 44px 15px; text-align: center; }
.album-empty-icon { width: 43px; height: 43px; display: grid; place-items: center; margin-bottom: 10px; border-radius: 50%; color: #63776a; background: #e8efe7; }
.albums-empty h2 { margin: 0 0 5px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 22px; font-weight: 500; }
.albums-empty p, .album-state { margin: 0; color: var(--muted); font-size: 10px; line-height: 1.55; text-align: center; }
.albums-empty button { display: inline-flex; align-items: center; gap: 6px; margin-top: 13px; }
.album-state { padding: 32px 12px; }
.album-state--error { color: #b45244; }
@media (max-width: 620px) { .albums-page { padding-top: 2px; } .albums-heading-row { align-items: flex-start; flex-direction: column; } .album-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } }
@media (max-width: 400px) { .album-grid { grid-template-columns: 1fr; } .album-form-footer { align-items: flex-start; flex-direction: column; } }
</style>

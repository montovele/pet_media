<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Camera, Images, Search } from 'lucide-vue-next'
import SponsoredAdPlacement from '../../campaigns/components/SponsoredAdPlacement.vue'
import { usePhotosStore } from '../stores/photos'

const photos = usePhotosStore()
const search = ref('')
onMounted(() => { void photos.load() })
const filteredPhotos = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return photos.items
  return photos.items.filter((photo) => `${photo.title} ${photo.source}`.toLocaleLowerCase().includes(query))
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
}
</script>

<template>
  <main class="photos-view">
    <header class="photos-heading">
      <span class="eyebrow"><Camera :size="14" /> BIBLIOTECA PERSONAL</span>
      <div class="photos-heading-row"><div><h1>Fotos y videos</h1><p>Imágenes y videos de tus historias, publicaciones y actividades, reunidos en un solo lugar.</p></div><span>{{ photos.items.length }} {{ photos.items.length === 1 ? 'elemento' : 'elementos' }}</span></div>
    </header>
    <div class="photos-toolbar">
      <span><Images :size="15" /> {{ filteredPhotos.length }} elementos</span>
      <label class="photos-search"><Search :size="15" /><input v-model="search" type="search" placeholder="Buscar en tu multimedia" aria-label="Buscar en tu multimedia" /></label>
    </div>
    <p v-if="photos.loading" class="photos-state">Cargando tu biblioteca…</p>
    <p v-else-if="photos.error" class="photos-state photos-state--error" role="alert">{{ photos.error }}</p>
    <section v-else-if="filteredPhotos.length" class="photo-grid" aria-label="Galería de fotos y videos">
      <RouterLink v-for="photo in filteredPhotos" :key="photo.id" class="photo-tile" :to="{ name: 'photo-detail', params: { id: photo.id } }">
        <video v-if="photo.mediaType === 'video'" :src="photo.url" :aria-label="photo.title" muted playsinline preload="metadata" />
        <img v-else :src="photo.url" :alt="photo.title" loading="lazy" />
        <span class="photo-tile-caption"><strong>{{ photo.title }}</strong><span>{{ photo.source }} · {{ formatDate(photo.createdAt) }}</span></span>
      </RouterLink>
    </section>
    <section v-else class="photos-empty"><span><Images :size="22" /></span><h2>{{ search ? 'No hay coincidencias' : 'Tu galería está lista' }}</h2><p>{{ search ? 'Prueba con otro título o tipo de contenido.' : 'Las fotos y videos de tus historias, publicaciones y actividades aparecerán aquí.' }}</p></section>
    <SponsoredAdPlacement v-if="photos.items.length" />
  </main>
</template>

<style scoped>
.photos-view { width: min(100%, 1000px); margin: 0 auto; padding: 12px 0 56px; }
.photos-heading { padding: 10px 0 20px; border-bottom: 1px solid var(--line); }
.photos-heading > .eyebrow { display: inline-flex; align-items: center; gap: 7px; color: #6d806f; }
.photos-heading-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-top: 8px; }
.photos-heading h1 { margin: 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 36px; font-weight: 500; }
.photos-heading p { margin: 6px 0 0; color: var(--muted); font-size: 11px; line-height: 1.55; }
.photos-heading-row > span { flex: 0 0 auto; color: #63776a; font-size: 10px; font-weight: 700; }
.photos-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 14px 0; }
.photos-toolbar > span { display: inline-flex; align-items: center; gap: 6px; color: #78877d; font-size: 10px; }
.photos-search { width: min(250px, 55%); display: flex; align-items: center; gap: 7px; padding: 0 9px; border: 1px solid #e3e9e1; border-radius: 5px; color: #89968d; background: rgba(255,255,255,.8); }
.photos-search input { width: 100%; height: 34px; border: 0; outline: 0; color: var(--ink); background: transparent; font-size: 10px; }
.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 11px; }
.photo-tile { position: relative; display: block; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 6px; background: #e8ede7; text-decoration: none; }
.photo-tile img, .photo-tile video { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .3s ease; }
.photo-tile:hover img, .photo-tile:hover video { transform: scale(1.035); }
.photo-tile-caption { position: absolute; right: 0; bottom: 0; left: 0; display: grid; gap: 4px; padding: 28px 11px 10px; color: white; background: linear-gradient(transparent, rgba(19,31,23,.78)); }
.photo-tile-caption strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.photo-tile-caption > span { color: rgba(255,255,255,.78); font-size: 8px; }
.photos-empty { display: grid; justify-items: center; padding: 54px 18px; text-align: center; }
.photos-empty > span { width: 44px; height: 44px; display: grid; place-items: center; margin-bottom: 11px; border-radius: 50%; color: #63776a; background: #e8efe7; }
.photos-empty h2 { margin: 0 0 5px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 22px; font-weight: 500; }
.photos-empty p, .photos-state { margin: 0; color: var(--muted); font-size: 10px; line-height: 1.55; text-align: center; }
.photos-state { padding: 36px 12px; }
.photos-state--error { color: #b45244; }
@media (max-width: 620px) { .photos-view { padding-top: 2px; } .photo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; } .photos-heading-row { align-items: flex-start; } .photos-heading h1 { font-size: 32px; } }
</style>
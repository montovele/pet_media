<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ArrowLeft, ImageOff, Images, Layers3 } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { albumsApi } from '../services/albumsApi'
import type { Album } from '../../../types/content'
import SponsoredAdPlacement from '../../campaigns/components/SponsoredAdPlacement.vue'

const route = useRoute()
const album = ref<Album | null>(null)
const loading = ref(true)
const error = ref('')

async function loadAlbum() {
  loading.value = true
  error.value = ''
  try {
    album.value = await albumsApi.get(String(route.params.id))
  } catch {
    album.value = null
    error.value = 'No encontramos este álbum en tus colecciones.'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void loadAlbum() })
watch(() => route.params.id, () => { void loadAlbum() })
</script>

<template>
  <main class="album-detail-view">
    <RouterLink class="album-detail-back" :to="{ name: 'albums' }"><ArrowLeft :size="16" /> Todos mis álbumes</RouterLink>
    <p v-if="loading" class="album-detail-state">Cargando álbum…</p>
    <section v-else-if="error" class="album-detail-empty" role="alert"><span><ImageOff :size="22" /></span><h1>Álbum no disponible</h1><p>{{ error }}</p></section>
    <article v-else-if="album" class="album-detail-content">
      <header class="album-detail-heading"><span class="eyebrow"><Layers3 :size="13" /> COLECCIÓN PERSONAL</span><h1>{{ album.title }}</h1><p v-if="album.description">{{ album.description }}</p><span class="album-detail-count"><Images :size="14" /> {{ album.photos.length }} {{ album.photos.length === 1 ? 'foto' : 'fotos' }}</span></header>
      <section v-if="album.photos.length" class="album-detail-grid" aria-label="Fotos del álbum">
        <figure v-for="(photo, index) in album.photos" :key="photo.id" class="album-detail-photo"><img :src="photo.url" :alt="`${album.title}, foto ${index + 1}`" loading="lazy" /><figcaption>{{ index + 1 }} / {{ album.photos.length }}</figcaption></figure>
      </section>
      <section v-else class="album-detail-empty"><span><Images :size="22" /></span><h2>Este álbum aún no tiene fotos</h2><p>Vuelve a la biblioteca para preparar otra colección.</p></section>
    </article>
    <SponsoredAdPlacement v-if="album && !loading" />
  </main>
</template>

<style scoped>
.album-detail-view { width: min(100%, 1000px); margin: 0 auto; padding: 10px 0 50px; }
.album-detail-back { display: inline-flex; align-items: center; gap: 7px; color: #66776b; font-size: 10px; font-weight: 700; }
.album-detail-back:hover { color: var(--green); }
.album-detail-content { margin-top: 17px; }
.album-detail-heading { padding: 0 0 17px; border-bottom: 1px solid var(--line); }
.album-detail-heading > .eyebrow { display: inline-flex; align-items: center; gap: 5px; color: #718277; }
.album-detail-heading h1 { margin: 6px 0 4px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 34px; font-weight: 500; }
.album-detail-heading p { max-width: 650px; margin: 0 0 9px; color: #748177; font-size: 11px; line-height: 1.55; }
.album-detail-count { display: inline-flex; align-items: center; gap: 5px; color: #89958c; font-size: 9px; }
.album-detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; padding-top: 15px; }
.album-detail-photo { position: relative; aspect-ratio: 1 / 1; overflow: hidden; margin: 0; border-radius: 6px; background: #e7ece6; }
.album-detail-photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
.album-detail-photo figcaption { position: absolute; right: 0; bottom: 0; left: 0; padding: 20px 9px 8px; color: white; background: linear-gradient(transparent, rgba(20,31,24,.65)); font-size: 9px; text-align: right; }
.album-detail-empty, .album-detail-state { padding: 44px 15px; color: #7b897f; font-size: 10px; text-align: center; }
.album-detail-empty { display: grid; justify-items: center; }
.album-detail-empty > span { width: 42px; height: 42px; display: grid; place-items: center; margin-bottom: 9px; border-radius: 50%; color: #66796a; background: #e8efe7; }
.album-detail-empty h2 { margin: 0 0 4px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 21px; font-weight: 500; }
.album-detail-empty p { margin: 0; }
@media (max-width: 620px) { .album-detail-view { padding-top: 2px; } .album-detail-heading h1 { font-size: 30px; } .album-detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; } }
</style>

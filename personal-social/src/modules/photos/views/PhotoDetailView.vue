<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { ArrowLeft, CalendarDays, Camera, ImageOff } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { photosApi } from '../services/photosApi'
import type { Photo } from '../../../types/content'
import SponsoredAdPlacement from '../../ads/components/SponsoredAdPlacement.vue'

const route = useRoute()
const photo = ref<Photo | null>(null)
const loading = ref(true)
const error = ref('')

async function loadPhoto() {
  loading.value = true
  error.value = ''
  try {
    photo.value = await photosApi.get(String(route.params.id))
  } catch {
    photo.value = null
    error.value = 'No encontramos esta foto en tu biblioteca.'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void loadPhoto() })
watch(() => route.params.id, () => { void loadPhoto() })

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(new Date(value))
}
</script>

<template>
  <main class="photo-detail-view">
    <RouterLink class="photo-detail-back" :to="{ name: 'photos' }"><ArrowLeft :size="16" /> Todas mis fotos</RouterLink>
    <p v-if="loading" class="photo-detail-state">Cargando foto…</p>
    <section v-else-if="error" class="photo-detail-empty" role="alert"><span><ImageOff :size="22" /></span><h1>Foto no disponible</h1><p>{{ error }}</p></section>
    <article v-else-if="photo" class="photo-detail-content">
      <figure class="photo-detail-frame"><img :src="photo.url" :alt="photo.title" /></figure>
      <div class="photo-detail-info"><div><span class="eyebrow"><Camera :size="13" /> {{ photo.source.toUpperCase() }}</span><h1>{{ photo.title }}</h1></div><span class="photo-detail-date"><CalendarDays :size="14" /> {{ formatDate(photo.createdAt) }}</span></div>
    </article>
    <SponsoredAdPlacement v-if="photo && !loading" />
  </main>
</template>

<style scoped>
.photo-detail-view { width: min(100%, 1000px); margin: 0 auto; padding: 10px 0 50px; }
.photo-detail-back { display: inline-flex; align-items: center; gap: 7px; color: #66776b; font-size: 10px; font-weight: 700; }
.photo-detail-back:hover { color: var(--green); }
.photo-detail-content { margin-top: 15px; }
.photo-detail-frame { display: grid; place-items: center; min-height: 280px; max-height: 72vh; overflow: hidden; margin: 0; border-radius: 7px; background: #202c24; }
.photo-detail-frame img { display: block; max-width: 100%; max-height: 72vh; object-fit: contain; }
.photo-detail-info { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; padding: 18px 2px; }
.photo-detail-info .eyebrow { display: inline-flex; align-items: center; gap: 5px; color: #748478; }
.photo-detail-info h1 { margin: 5px 0 0; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 27px; font-weight: 500; }
.photo-detail-date { display: inline-flex; align-items: center; gap: 5px; flex: 0 0 auto; color: #89958c; font-size: 10px; }
.photo-detail-state, .photo-detail-empty { padding: 45px 15px; color: #78867d; font-size: 11px; text-align: center; }
.photo-detail-empty { display: grid; justify-items: center; }
.photo-detail-empty > span { width: 44px; height: 44px; display: grid; place-items: center; margin-bottom: 10px; border-radius: 50%; color: #697b6e; background: #e8efe7; }
.photo-detail-empty h1 { margin: 0 0 5px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 23px; font-weight: 500; }
.photo-detail-empty p { margin: 0; }
@media (max-width: 620px) { .photo-detail-view { padding-top: 2px; } .photo-detail-frame { min-height: 220px; max-height: 64vh; } .photo-detail-frame img { max-height: 64vh; } .photo-detail-info { align-items: flex-start; flex-direction: column; gap: 9px; } }
</style>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowLeft, ArrowRight, BookOpen, Search, Sparkles } from 'lucide-vue-next'
import FeedEntryCard from '../components/FeedEntryCard.vue'
import BrandAdCard from '../modules/campaigns/components/BrandAdCard.vue'
import { adsApi, type BrandAd } from '../modules/campaigns/services/adsApi'
import { useFeedStore } from '../stores/feed'

const feed = useFeedStore()
const sponsoredAds = ref<BrandAd[]>([])
onMounted(() => {
  void feed.loadPublicStories()
  void adsApi.listPublic().then((ads) => { sponsoredAds.value = ads }).catch(() => {})
})
const search = ref('')
const publicStories = computed(() => feed.entries.filter((entry) => entry.kind === 'story' && entry.visibility === 'public'))
const filteredStories = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  if (!term) return publicStories.value
  return publicStories.value.filter((story) => `${story.title ?? ''} ${story.caption} ${story.author.name} ${story.place ?? ''}`.toLocaleLowerCase().includes(term))
})
</script>

<template>
  <main class="public-explore">
    <header class="explore-header">
      <RouterLink class="explore-back" to="/"><ArrowLeft :size="15" /> Inicio</RouterLink>
      <span class="public-eyebrow dark"><Sparkles :size="13" /> ABIERTO PARA TODOS</span>
      <h1>Historias públicas</h1>
      <p>Lee momentos que otras personas decidieron compartir abiertamente. No necesitas una cuenta para explorar.</p>
      <label class="explore-search"><Search :size="17" /><input v-model="search" type="search" aria-label="Buscar historias públicas" placeholder="Busca por título, persona o lugar" /></label>
    </header>

    <div class="explore-results-heading"><span>{{ filteredStories.length }} {{ filteredStories.length === 1 ? 'historia' : 'historias' }} públicas</span><span><BookOpen :size="14" /> Solo contenido público</span></div>
    <section v-if="filteredStories.length || sponsoredAds.length" class="explore-story-list">
      <template v-for="(story, index) in filteredStories" :key="story.id">
        <FeedEntryCard :entry="story" @toggle-like="feed.toggleLike" />
        <BrandAdCard v-if="sponsoredAds.length && (index + 1) % 3 === 0" :ad="sponsoredAds[Math.floor(index / 3) % sponsoredAds.length]" />
      </template>
      <BrandAdCard v-if="sponsoredAds.length && filteredStories.length > 0 && filteredStories.length < 3" :ad="sponsoredAds[0]" />
      <BrandAdCard v-if="sponsoredAds.length && !filteredStories.length" :ad="sponsoredAds[0]" />
    </section>
    <section v-else class="explore-empty"><span class="empty-icon"><Search :size="21" /></span><h2>No encontramos historias públicas</h2><p>Prueba con otra búsqueda o vuelve más tarde para descubrir nuevos momentos.</p></section>

    <section class="explore-join"><div><span class="public-eyebrow dark"><span class="tiny-dot"></span> ¿TE GUSTARÍA CONTAR LA TUYA?</span><h2>Haz que tus recuerdos<br /><em>también tengan un lugar.</em></h2><p>Crea una cuenta para publicar historias, ordenar tus fotos y elegir quién puede ver cada momento.</p></div><RouterLink class="explore-join-link" to="/register">Crear cuenta <ArrowRight :size="16" /></RouterLink></section>
  </main>
</template>

<style scoped>
.public-explore { width: min(100%, 920px); margin: 0 auto; padding: 8px 0 65px; }
.explore-header { display: grid; justify-items: center; padding: 20px 20px 31px; text-align: center; }
.explore-back { justify-self: start; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 23px; color: #738178; font-size: 10px; font-weight: 600; }
.public-eyebrow.dark { color: #74867a; }
.explore-header h1 { margin: 10px 0 7px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 43px; font-weight: 500; line-height: 1.04; }
.explore-header > p { max-width: 470px; margin: 0; color: #7f8d83; font-size: 11px; line-height: 1.6; }
.explore-search { width: min(100%, 470px); display: flex; align-items: center; gap: 9px; margin-top: 19px; padding: 0 12px; border: 1px solid #e0e7df; border-radius: 5px; color: #8b998f; background: rgba(255,255,255,.85); }
.explore-search input { width: 100%; height: 41px; border: 0; outline: 0; color: var(--ink); background: transparent; font-size: 11px; }
.explore-results-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 1px; border-bottom: 1px solid #e1e8e0; color: #718076; font-size: 10px; }
.explore-results-heading span:last-child { display: inline-flex; align-items: center; gap: 5px; color: var(--green); }
.explore-story-list { display: grid; gap: 13px; margin-top: 13px; }
.explore-empty { display: grid; justify-items: center; padding: 48px 20px; text-align: center; }
.explore-empty h2 { margin: 8px 0 5px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 23px; font-weight: 500; }
.explore-empty p { max-width: 330px; margin: 0; color: #859188; font-size: 10px; line-height: 1.55; }
.explore-join { display: flex; align-items: center; justify-content: space-between; gap: 25px; margin-top: 31px; padding: 25px 28px; border: 1px solid #dce7dd; border-radius: 7px; background: #edf3eb; }
.explore-join h2 { margin: 8px 0 5px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 26px; font-weight: 500; line-height: 1.08; }
.explore-join h2 em { color: var(--green); font-weight: 500; }
.explore-join p { max-width: 480px; margin: 0; color: #79877d; font-size: 10px; line-height: 1.6; }
.explore-join-link { min-height: 39px; display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto; padding: 0 12px; border-radius: 4px; color: white; background: var(--green); font-size: 10px; font-weight: 700; }
@media (max-width: 620px) { .public-explore { padding-top: 0; } .explore-header { padding: 12px 0 24px; } .explore-header h1 { font-size: 36px; } .explore-results-heading { font-size: 9px; } .explore-join { align-items: flex-start; flex-direction: column; gap: 15px; padding: 19px; } }
</style>

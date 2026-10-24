<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, Sparkles } from 'lucide-vue-next'
import { resolveAdImageUrl, type BrandAd } from '../services/adsApi'

const props = defineProps<{ ad: BrandAd }>()
const imageUrl = computed(() => resolveAdImageUrl(props.ad.imageUrl))
</script>

<template>
  <article class="brand-ad-card">
    <a class="brand-ad-media" :href="ad.destinationUrl" target="_blank" rel="sponsored nofollow noopener noreferrer" :aria-label="`${ad.headline}, anuncio de ${ad.brandName}`">
      <img v-if="imageUrl" :src="imageUrl" :alt="ad.headline" loading="lazy" />
      <div v-else class="brand-ad-placeholder"><Sparkles :size="25" /></div>
    </a>
    <div class="brand-ad-content">
      <div class="brand-ad-meta"><span class="brand-ad-label"><Sparkles :size="12" /> ANUNCIO</span><span>{{ ad.brandName }}</span></div>
      <h2>{{ ad.headline }}</h2>
      <p>{{ ad.body }}</p>
      <a class="brand-ad-cta" :href="ad.destinationUrl" target="_blank" rel="sponsored nofollow noopener noreferrer">{{ ad.ctaLabel }} <ArrowUpRight :size="15" /></a>
    </div>
  </article>
</template>

<style scoped>
.brand-ad-card { display: grid; grid-template-columns: minmax(180px, .78fr) minmax(0, 1fr); overflow: hidden; border: 1px solid #e0e7df; border-radius: 7px; background: #fff; }
.brand-ad-media { min-height: 205px; overflow: hidden; background: #e9eee7; }
.brand-ad-media img { display: block; width: 100%; height: 100%; min-height: 205px; object-fit: cover; }
.brand-ad-placeholder { display: grid; min-height: 205px; place-items: center; color: #54715c; background: #e9eee7; }
.brand-ad-content { display: grid; align-content: center; justify-items: start; gap: 9px; padding: 20px 22px; }
.brand-ad-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; color: #77857b; font-size: 9px; }
.brand-ad-label { display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: 3px; color: #44694d; background: #edf4ec; font-size: 8px; font-weight: 800; letter-spacing: .04em; }
.brand-ad-content h2 { margin: 0; color: #263b30; font-family: 'Newsreader', Georgia, serif; font-size: 23px; font-weight: 500; line-height: 1.12; }
.brand-ad-content p { margin: 0; color: #758178; font-size: 10px; line-height: 1.6; }
.brand-ad-cta { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; margin-top: 2px; padding: 0 10px; border-radius: 4px; color: #fff; background: #386b4d; font-size: 9px; font-weight: 700; }
@media (max-width: 560px) { .brand-ad-card { grid-template-columns: 1fr; } .brand-ad-media, .brand-ad-media img, .brand-ad-placeholder { min-height: 170px; max-height: 220px; } .brand-ad-content { padding: 16px; } }
</style>
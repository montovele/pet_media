<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BrandAdCard from './BrandAdCard.vue'
import { adsApi, type BrandAd } from '../services/adsApi'

const ad = ref<BrandAd | null>(null)

onMounted(async () => {
  try {
    const ads = await adsApi.listPublic()
    ad.value = ads[0] || null
  } catch {
    ad.value = null
  }
})
</script>

<template>
  <aside v-if="ad" class="sponsored-placement" aria-label="Contenido patrocinado">
    <BrandAdCard :ad="ad" />
  </aside>
</template>

<style scoped>
.sponsored-placement { margin: 16px 0 8px; }
</style>

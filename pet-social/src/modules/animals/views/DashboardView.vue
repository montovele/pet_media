<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowRight, CalendarDays, CirclePlus, PawPrint, ShieldCheck } from 'lucide-vue-next'
import { useAuthStore } from '../../../stores/auth'
import { animalsApi, type AnimalRecord } from '../services/animalsApi'

const auth = useAuthStore()
const animals = ref<AnimalRecord[]>([])
const loading = ref(true)
const loadError = ref('')

onMounted(async () => {
  try {
    animals.value = await animalsApi.list()
  } catch {
    loadError.value = 'No pudimos cargar tus animales en este momento.'
  } finally {
    loading.value = false
  }
})

const greetingName = auth.user?.name?.split(' ')[0] || 'cuidador'
</script>

<template>
  <main class="dashboard-page">
    <section class="dashboard-hero">
      <img src="https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1800&q=90" alt="Perro descansando al aire libre" fetchpriority="high" />
      <div class="dashboard-hero-shade" />
      <div class="dashboard-hero-copy">
        <span class="pet-eyebrow"><PawPrint :size="14" /> BIO-ACTA · PANEL DE CUIDADO</span>
        <h1>Su vida merece<br /><em>una historia completa.</em></h1>
        <p>Hola, {{ greetingName }}. La identidad del animal permanece, aunque todo a su alrededor cambie.</p>
        <RouterLink class="dashboard-primary" to="/animals"><PawPrint :size="16" /> Ver mis animales <ArrowRight :size="16" /></RouterLink>
      </div>
      <span class="dashboard-image-caption">IDENTIDAD · HISTORIA · CONTINUIDAD</span>
    </section>

    <section class="dashboard-overview">
      <div class="dashboard-section-heading"><div><span class="pet-eyebrow">RESUMEN</span><h2>Tu espacio de cuidado</h2></div><RouterLink class="dashboard-text-link" to="/animals">Gestionar registros <ArrowRight :size="15" /></RouterLink></div>
      <p v-if="loadError" class="pet-error" role="alert">{{ loadError }}</p>
      <div class="dashboard-metrics">
        <article class="dashboard-metric dashboard-metric--lead"><span class="metric-icon"><PawPrint :size="18" /></span><strong>{{ loading ? '…' : animals.length }}</strong><span>identidades animales</span><RouterLink to="/animals">Abrir registros <ArrowRight :size="14" /></RouterLink></article>
        <article class="dashboard-metric"><span class="metric-icon metric-icon--coral"><CalendarDays :size="18" /></span><strong>—</strong><span>próximos cuidados</span><small>Programación de cuidados: próximamente</small></article>
        <article class="dashboard-metric"><span class="metric-icon metric-icon--gold"><ShieldCheck :size="18" /></span><strong>Privado</strong><span>control de acceso</span><small>Tu expediente no es una ficha pública</small></article>
      </div>
    </section>

    <section class="dashboard-animals">
      <div class="dashboard-section-heading"><div><span class="pet-eyebrow">IDENTIDAD ANIMAL</span><h2>Animales en tu historia</h2></div><RouterLink class="dashboard-text-link" to="/animals">Ver todos <ArrowRight :size="15" /></RouterLink></div>
      <div v-if="loading" class="dashboard-empty"><p>Cargando registros…</p></div>
      <div v-else-if="animals.length" class="dashboard-animal-list">
        <RouterLink v-for="animal in animals.slice(0, 3)" :key="animal.id" class="dashboard-animal-row" :to="{ name: 'animal-detail', params: { animalId: animal.id } }">
          <span class="animal-avatar"><PawPrint :size="22" /></span><span><strong>{{ animal.name || 'Sin nombre' }}</strong><small>{{ animal.species }}</small></span><ArrowRight :size="17" />
        </RouterLink>
      </div>
      <div v-else class="dashboard-empty">
        <div><span class="empty-paw"><PawPrint :size="23" /></span><div><strong>La primera identidad está por comenzar.</strong><p>Registra un animal para dar inicio a su Bio-Acta privada.</p></div></div>
        <RouterLink class="dashboard-add-link" to="/animals"><CirclePlus :size="16" /> Registrar animal</RouterLink>
      </div>
    </section>
  </main>
</template>
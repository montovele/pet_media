<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-vue-next'
import { bioActaApi } from '../services/bioActaApi'

const route = useRoute()
const router = useRouter()
const password = ref('')
const loading = ref(false)
const error = ref('')

async function unlock() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    await bioActaApi.unlockAccessGrant(String(route.params.grantId), password.value)
    const animalId = typeof route.query.animalId === 'string' ? route.query.animalId : ''
    await router.replace(animalId ? { name: 'animal-detail', params: { animalId } } : { name: 'animals' })
  } catch (cause) {
    error.value = axios.isAxiosError(cause) && cause.response?.status === 403
      ? 'La contraseña no es válida para esta cuenta o el acceso ya venció o fue revocado.'
      : cause instanceof Error ? `No se pudo abrir el acceso: ${cause.message}` : 'No se pudo abrir el acceso.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="bioacta-access-page">
    <RouterLink class="bioacta-access-back" to="/bioacta/inicio"><ArrowLeft :size="15" /> Volver a BIO-ACTA</RouterLink>
    <section class="bioacta-access-card">
      <span class="bioacta-access-icon"><LockKeyhole :size="23" /></span>
      <span class="pet-eyebrow"><ShieldCheck :size="14" /> ACCESO COMPARTIDO</span>
      <h1>Abre el expediente compartido</h1>
      <p>Iniciaste sesión con tu cuenta. Escribe la contraseña exclusiva del acceso que te compartió la persona responsable.</p>
      <form @submit.prevent="unlock">
        <label for="shared-access-password">Contraseña del acceso</label>
        <input id="shared-access-password" v-model="password" type="password" autocomplete="current-password" required maxlength="128" autofocus />
        <p v-if="error" class="pet-error" role="alert">{{ error }}</p>
        <button class="button-primary" type="submit" :disabled="loading || !password">
          {{ loading ? 'Verificando…' : 'Abrir expediente' }}<ArrowRight :size="16" />
        </button>
      </form>
      <small>Esta contraseña es distinta de la contraseña de tu cuenta y solo desbloquea este permiso.</small>
    </section>
  </main>
</template>

<style scoped>
.bioacta-access-page { min-height: 70vh; display: grid; align-content: start; justify-items: center; gap: 28px; padding: 22px 16px 48px; }
.bioacta-access-back { width: min(100%, 520px); display: inline-flex; align-items: center; gap: 7px; color: #718078; font-size: 12px; }
.bioacta-access-card { width: min(100%, 520px); display: grid; justify-items: start; gap: 13px; padding: clamp(22px, 5vw, 38px); border: 1px solid #dce8df; border-radius: 18px; background: #fff; box-shadow: 0 12px 35px rgba(32, 54, 51, .08); }
.bioacta-access-icon { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 13px; color: var(--brand-primary); background: var(--green-pale); }
.bioacta-access-card h1 { margin: 0; color: #263c37; font-family: 'Newsreader', Georgia, serif; font-size: 30px; font-weight: 500; line-height: 1.15; }
.bioacta-access-card > p, .bioacta-access-card > small { color: #718078; font-size: 12px; line-height: 1.6; }
.bioacta-access-card form { width: 100%; display: grid; gap: 10px; margin-top: 5px; }
.bioacta-access-card label { color: #50645b; font-size: 12px; font-weight: 700; }
.bioacta-access-card input { min-height: 44px; padding: 9px 12px; border: 1px solid #dce6df; border-radius: 8px; color: #253a35; background: #fffdf8; font-size: 14px; }
.bioacta-access-card .button-primary { min-height: 44px; display: inline-flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 5px; padding: 0 14px; }
@media (max-width: 520px) { .bioacta-access-card h1 { font-size: 25px; } }
</style>

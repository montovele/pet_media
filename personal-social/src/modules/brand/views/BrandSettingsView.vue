<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Aperture, Check, ImagePlus, LoaderCircle, Save, X } from 'lucide-vue-next'
import { feedApi } from '../../feed/services/feedApi'
import { useBrandStore } from '../stores/brand'

const brand = useBrandStore()
const nameDraft = ref('')
const logoFile = ref<File | null>(null)
const logoPreview = ref('')
const removeLogo = ref(false)
const fileInput = ref<HTMLInputElement>()
const errorMessage = ref('')
const saved = ref(false)
const previewLogo = computed(() => logoPreview.value || (removeLogo.value ? '' : brand.logoUrl || ''))

onMounted(async () => {
  await brand.load()
  nameDraft.value = brand.name
})

onBeforeUnmount(() => {
  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
})

function selectLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  errorMessage.value = ''
  saved.value = false
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    errorMessage.value = 'Usa una imagen JPG, PNG o WebP.'
    return
  }
  if (file.size > 8 * 1024 * 1024) {
    errorMessage.value = 'El logo debe pesar 8 MB o menos.'
    return
  }
  if (logoPreview.value && logoFile.value) URL.revokeObjectURL(logoPreview.value)
  logoFile.value = file
  logoPreview.value = URL.createObjectURL(file)
  removeLogo.value = false
}

function clearLogo() {
  if (logoFile.value && logoPreview.value) URL.revokeObjectURL(logoPreview.value)
  logoFile.value = null
  logoPreview.value = ''
  removeLogo.value = true
  if (fileInput.value) fileInput.value.value = ''
}

async function saveBrand() {
  const name = nameDraft.value.trim()
  if (name.length < 2 || name.length > 80) {
    errorMessage.value = 'El nombre debe tener entre 2 y 80 caracteres.'
    return
  }
  errorMessage.value = ''
  saved.value = false

  let logoUrl: string | null | undefined
  if (logoFile.value) {
    try {
      const [uploadedLogo] = await feedApi.uploadMedia([logoFile.value])
      if (!uploadedLogo) throw new Error('No se recibió el logo cargado.')
      logoUrl = `/api/media/${uploadedLogo.id}`
    } catch {
      errorMessage.value = 'No se pudo cargar el logo. Inténtalo de nuevo.'
      return
    }
  } else if (removeLogo.value) {
    logoUrl = null
  }

  const update = logoUrl === undefined ? { name } : { name, logoUrl }
  if (await brand.update(update)) {
    logoFile.value = null
    removeLogo.value = false
    if (logoPreview.value.startsWith('blob:')) URL.revokeObjectURL(logoPreview.value)
    logoPreview.value = ''
    saved.value = true
  } else {
    errorMessage.value = brand.error
  }
}
</script>

<template>
  <main class="brand-settings-page">
    <header class="brand-settings-heading">
      <span class="eyebrow">CONFIGURACIÓN GLOBAL</span>
      <h1>Identidad de marca</h1>
      <p>El nombre y el logo se mostrarán en la barra de navegación para todas las cuentas.</p>
    </header>

    <form class="brand-settings-form" @submit.prevent="saveBrand">
      <section class="brand-preview-section" aria-label="Vista previa del navbar">
        <span class="eyebrow">VISTA PREVIA</span>
        <div class="brand-preview-bar">
          <span class="brand-preview-mark">
            <img v-if="previewLogo" :src="previewLogo" alt="" />
            <Aperture v-else :size="20" :stroke-width="2.1" />
          </span>
          <strong>{{ nameDraft.trim() || 'Nombre de la empresa' }}</strong>
        </div>
      </section>

      <label class="brand-setting-field">
        <span>Nombre de la empresa</span>
        <input v-model="nameDraft" type="text" maxlength="80" minlength="2" required placeholder="Nombre de la empresa" />
        <small>{{ nameDraft.length }} / 80 caracteres</small>
      </label>

      <section class="brand-setting-field brand-logo-setting">
        <span>Logo</span>
        <div class="brand-logo-row">
          <span class="brand-logo-preview">
            <img v-if="previewLogo" :src="previewLogo" alt="Vista previa del logo" />
            <Aperture v-else :size="21" />
          </span>
          <div class="brand-logo-actions">
            <input ref="fileInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="selectLogo" />
            <button class="brand-upload-button" type="button" @click="fileInput?.click()"><ImagePlus :size="15" />{{ logoFile ? 'Cambiar logo' : 'Subir logo' }}</button>
            <button v-if="brand.logoUrl || logoFile" class="brand-clear-button" type="button" @click="clearLogo"><X :size="14" /> Quitar</button>
            <small>{{ logoFile ? `${logoFile.name} · ${(logoFile.size / (1024 * 1024)).toFixed(1)} MB` : 'JPG, PNG o WebP · máximo 8 MB' }}</small>
          </div>
        </div>
      </section>

      <p v-if="errorMessage" class="brand-settings-error" role="alert">{{ errorMessage }}</p>
      <p v-if="saved" class="brand-settings-success" role="status"><Check :size="15" /> Cambios aplicados a la barra de navegación.</p>
      <footer class="brand-settings-footer">
        <span>Solo superadministradores pueden modificar esta identidad.</span>
        <button class="button-primary" type="submit" :disabled="brand.saving"><LoaderCircle v-if="brand.saving" class="brand-save-spinner" :size="16" /><Save v-else :size="16" />{{ brand.saving ? 'Guardando…' : 'Guardar cambios' }}</button>
      </footer>
    </form>
  </main>
</template>

<style scoped>
.brand-settings-page { width: min(100%, 760px); margin: 0 auto; padding: 12px 0 54px; }
.brand-settings-heading { padding: 10px 0 19px; border-bottom: 1px solid var(--line); }
.brand-settings-heading .eyebrow { color: #697d6e; }
.brand-settings-heading h1 { margin: 7px 0 5px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 34px; font-weight: 500; }
.brand-settings-heading p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.55; }
.brand-settings-form { display: grid; gap: 19px; padding-top: 20px; }
.brand-preview-section { display: grid; gap: 9px; }
.brand-preview-bar { min-height: 72px; display: flex; align-items: center; gap: 11px; padding: 15px; border: 1px solid #e2e8df; border-radius: 6px; background: rgba(255,255,255,.88); box-shadow: 0 6px 17px rgba(34,54,44,.035); }
.brand-preview-mark { width: 38px; height: 38px; display: grid; flex: 0 0 auto; place-items: center; overflow: hidden; border-radius: 12px 12px 12px 4px; color: white; background: var(--green); }
.brand-preview-mark img { width: 100%; height: 100%; object-fit: contain; background: white; }
.brand-preview-bar strong { color: var(--ink); overflow-wrap: anywhere; font-size: 16px; }
.brand-setting-field { display: grid; gap: 7px; color: #58695d; font-size: 10px; font-weight: 700; }
.brand-setting-field input:not([type=file]) { width: 100%; height: 40px; padding: 0 10px; border: 1px solid #dfe6dd; border-radius: 4px; color: var(--ink); background: white; font-size: 12px; font-weight: 400; }
.brand-setting-field input:focus { border-color: #a9c2ad; outline: 3px solid rgba(55,120,97,.12); }
.brand-setting-field small { color: #8a968d; font-size: 9px; font-weight: 400; }
.brand-logo-row { display: flex; align-items: center; gap: 12px; }
.brand-logo-preview { width: 58px; height: 58px; display: grid; flex: 0 0 auto; place-items: center; overflow: hidden; border: 1px solid #e2e8df; border-radius: 8px; color: var(--green); background: white; }
.brand-logo-preview img { width: 100%; height: 100%; object-fit: contain; }
.brand-logo-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.brand-upload-button, .brand-clear-button { min-height: 34px; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; border: 1px solid #dce5dc; border-radius: 4px; color: #38684d; background: white; cursor: pointer; font-size: 10px; font-weight: 700; }
.brand-clear-button { color: #9e5147; }
.brand-logo-actions small { flex-basis: 100%; }
.brand-settings-error, .brand-settings-success { display: flex; align-items: center; gap: 7px; margin: 0; font-size: 10px; }
.brand-settings-error { color: #b45244; }
.brand-settings-success { color: #37734d; }
.brand-settings-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 13px; border-top: 1px solid var(--line); }
.brand-settings-footer > span { color: #8a968d; font-size: 9px; }
.brand-settings-footer button { min-height: 38px; display: inline-flex; align-items: center; gap: 7px; }
.brand-save-spinner { animation: brand-spin .9s linear infinite; }
@keyframes brand-spin { to { transform: rotate(360deg); } }
@media (max-width: 560px) { .brand-settings-page { padding-top: 2px; } .brand-settings-heading h1 { font-size: 30px; } .brand-settings-footer { align-items: flex-start; flex-direction: column; } }
</style>
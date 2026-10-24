<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowRight, Check, LoaderCircle, PawPrint, Pencil, ShieldCheck, UserRound, X } from 'lucide-vue-next'
import { animalsApi } from '../modules/animals/services/animalsApi'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const editing = ref(false)
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref('')
const animalCount = ref<number | null>(null)
const animalsError = ref('')
const draft = reactive({ name: '', bio: '' })

const user = computed(() => auth.user)
const accountType = computed(() => {
  const role = user.value?.role
  if (role === 'superadmin') return 'Superadministración'
  if (role === 'admin') return 'Administración'
  if (role === 'editor') return 'Edición profesional'
  if (role === 'moderator') return 'Moderación'
  return 'Cuenta cuidadora'
})

function resetDraft() {
  draft.name = user.value?.name ?? ''
  draft.bio = user.value?.bio ?? ''
}

watch(user, resetDraft, { immediate: true })

onMounted(async () => {
  try {
    animalCount.value = (await animalsApi.list()).length
  } catch {
    animalsError.value = 'No pudimos cargar el resumen de animales.'
  }
})

function beginEdit() {
  resetDraft()
  saveError.value = ''
  saveSuccess.value = ''
  editing.value = true
}

function cancelEdit() {
  resetDraft()
  saveError.value = ''
  editing.value = false
}

async function saveAccount() {
  const name = draft.name.trim()
  const bio = draft.bio.trim()
  if (name.length < 2 || name.length > 80) {
    saveError.value = 'El nombre debe tener entre 2 y 80 caracteres.'
    return
  }
  if (bio.length > 220) {
    saveError.value = 'La descripción puede tener hasta 220 caracteres.'
    return
  }

  saving.value = true
  saveError.value = ''
  saveSuccess.value = ''
  try {
    await auth.updateUserProfile({ name, bio })
    editing.value = false
    saveSuccess.value = 'Los datos de tu cuenta se guardaron.'
  } catch {
    saveError.value = 'No se pudieron guardar los cambios. Inténtalo de nuevo.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="account-page">
    <header class="account-heading">
      <span class="pet-eyebrow"><UserRound :size="14" /> ESPACIO DE CUIDADO</span>
      <h1>Mi cuenta</h1>
      <p>Administra tus datos como persona cuidadora y consulta los animales vinculados a tu espacio.</p>
    </header>

    <section class="account-overview" aria-label="Resumen de la cuenta">
      <div class="account-avatar"><UserRound :size="29" /></div>
      <div class="account-overview-copy">
        <strong>{{ user?.name || 'Cuenta cuidadora' }}</strong>
        <span>{{ accountType }}</span>
      </div>
      <div class="account-overview-stat">
        <strong>{{ animalCount === null ? '—' : animalCount }}</strong>
        <span>{{ animalCount === 1 ? 'animal registrado' : 'animales registrados' }}</span>
      </div>
      <RouterLink class="account-overview-link" to="/animals" aria-label="Abrir mis animales"><ArrowRight :size="18" /></RouterLink>
    </section>

    <p v-if="saveSuccess" class="account-notice account-notice--success" role="status"><Check :size="16" />{{ saveSuccess }}</p>
    <p v-if="saveError" class="account-notice account-notice--error" role="alert">{{ saveError }}</p>
    <p v-if="animalsError" class="account-notice account-notice--error" role="alert">{{ animalsError }}</p>

    <section class="account-section">
      <div class="account-section-heading">
        <div><span class="pet-eyebrow">DATOS PERSONALES</span><h2>Información de la cuenta</h2></div>
        <button v-if="!editing" class="account-edit-button" type="button" @click="beginEdit"><Pencil :size="15" /> Editar</button>
      </div>

      <form v-if="editing" class="account-form" @submit.prevent="saveAccount">
        <label for="account-name">Nombre</label>
        <input id="account-name" v-model="draft.name" type="text" minlength="2" maxlength="80" autocomplete="name" required :disabled="saving" />
        <label for="account-bio">Descripción breve</label>
        <textarea id="account-bio" v-model="draft.bio" maxlength="220" rows="3" placeholder="Cuéntanos algo sobre ti como cuidador o cuidadora" :disabled="saving" />
        <div class="account-form-footer"><span>{{ draft.bio.length }}/220 caracteres</span><div><button class="account-cancel-button" type="button" :disabled="saving" @click="cancelEdit"><X :size="15" /> Cancelar</button><button class="account-save-button" type="submit" :disabled="saving"><LoaderCircle v-if="saving" class="account-spinner" :size="15" /><Check v-else :size="15" />{{ saving ? 'Guardando' : 'Guardar cambios' }}</button></div></div>
      </form>

      <dl v-else class="account-details">
        <div><dt>Nombre</dt><dd>{{ user?.name || 'Sin nombre' }}</dd></div>
        <div><dt>Usuario</dt><dd>{{ user?.username || 'Sin usuario' }}</dd></div>
        <div><dt>Correo electrónico</dt><dd>{{ user?.email || 'No disponible' }}</dd></div>
        <div><dt>Sobre mí</dt><dd>{{ user?.bio || 'Aún no agregas una descripción.' }}</dd></div>
      </dl>
    </section>

    <section class="account-continuity">
      <span class="continuity-icon"><PawPrint :size="19" /></span>
      <div><span class="pet-eyebrow">CONTINUIDAD</span><h2>La identidad del animal va primero.</h2><p>Tu cuenta permite iniciar y administrar registros privados. La cuenta cuidadora y la identidad animal son entidades distintas.</p><RouterLink to="/animals">Ir a mis animales <ArrowRight :size="15" /></RouterLink></div>
    </section>

    <p class="account-privacy"><ShieldCheck :size="16" /> Esta cuenta es privada. Los animales aún no tienen ficha pública ni permisos compartidos habilitados.</p>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Dog, HeartPulse, LoaderCircle, PawPrint, Plus, Search, ShieldCheck } from 'lucide-vue-next'
import { useAuthStore } from '../../../stores/auth'
import { animalsApi, type AnimalDraft, type AnimalRecord } from '../services/animalsApi'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const animals = ref<AnimalRecord[]>([])
const selectedAnimal = ref<AnimalRecord | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const search = ref('')
const formOpen = ref(false)
const successMessage = ref('')
const duplicateMatches = ref<Awaited<ReturnType<typeof animalsApi.findDuplicates>> | null>(null)
const duplicateConfirmed = ref(false)
const selectedPhoto = ref<File | null>(null)
const uploadingPhoto = ref(false)
const draft = reactive<AnimalDraft & { identifierType: 'microchip' | 'tattoo' | 'registry' | 'other'; identifierReference: string }>({
  species: 'Perro',
  name: '',
  sex: null,
  estimatedAge: '',
  physicalDescription: '',
  provisional: false,
  identifiers: [],
  identifierType: 'microchip',
  identifierReference: '',
})

const selectedId = computed(() => String(route.params.animalId ?? ''))
const accessGrant = computed(() => auth.user?.isAccessGuest ? auth.user.accessGrant : undefined)
const guestCanReadHealth = computed(() => accessGrant.value?.permissions.some((permission) => ['health:read', 'health:manage'].includes(permission)) ?? false)
const guestCanReadCare = computed(() => accessGrant.value?.permissions.some((permission) => ['care:read', 'care:manage'].includes(permission)) ?? false)
const guestScopeSummary = computed(() => {
  const grant = accessGrant.value
  if (!grant) return ''
  if (grant.allAnimals) return 'Todos los animales actuales y futuros bajo su cuidado'
  const scopeIds = grant.animalIds.length ? grant.animalIds : [grant.animalId]
  return `${scopeIds.length} ${scopeIds.length === 1 ? 'animal autorizado' : 'animales autorizados'}`
})
watch(() => [draft.species, draft.name, draft.physicalDescription, draft.identifierReference, draft.identifierType], () => {
  duplicateMatches.value = null
  duplicateConfirmed.value = false
})
const filteredAnimals = computed(() => {
  const query = search.value.trim().toLocaleLowerCase()
  if (!query) return animals.value
  return animals.value.filter((animal) => `${animal.name ?? ''} ${animal.species} ${animal.physicalDescription ?? ''}`.toLocaleLowerCase().includes(query))
})

async function loadAnimals() {
  loading.value = true
  error.value = ''
  try {
    animals.value = await animalsApi.list()
    if (selectedId.value) {
      selectedAnimal.value = await animalsApi.get(selectedId.value)
    }
  } catch {
    error.value = 'No pudimos cargar los registros. Comprueba tu conexión e inténtalo de nuevo.'
    selectedAnimal.value = null
  } finally {
    loading.value = false
  }
}

watch(selectedId, async (animalId) => {
  if (!animalId) {
    selectedAnimal.value = null
    return
  }
  loading.value = true
  error.value = ''
  try {
    selectedAnimal.value = await animalsApi.get(animalId)
  } catch {
    selectedAnimal.value = null
    error.value = 'No encontramos ese registro en tu espacio privado.'
  } finally {
    loading.value = false
  }
})

onMounted(loadAnimals)

async function createAnimal() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  successMessage.value = ''
  let createdAnimal: AnimalRecord | null = null
  let photoUploaded = false
  try {
    const values: AnimalDraft = {
      species: draft.species,
      name: draft.name?.trim() || null,
      sex: draft.sex,
      estimatedAge: draft.estimatedAge?.trim() || null,
      physicalDescription: draft.physicalDescription?.trim() || null,
      provisional: draft.provisional,
      identifiers: draft.identifierReference.trim()
        ? [{ type: draft.identifierType, reference: draft.identifierReference.trim() }]
        : [],
    }
    if (!duplicateConfirmed.value) {
      duplicateMatches.value = await animalsApi.findDuplicates(values)
      if (duplicateMatches.value.matches.length || duplicateMatches.value.possiblePrivateMatch) {
        error.value = duplicateMatches.value.matches.length
          ? 'Encontramos registros públicos parecidos. Revísalos antes de crear otra identidad.'
          : 'Existe una posible coincidencia privada. Para continuar, crea una identidad provisional y confirma que necesita verificación.'
        return
      }
    } else if ((duplicateMatches.value?.matches.length || duplicateMatches.value?.possiblePrivateMatch) && !draft.provisional) {
      error.value = 'Si existe una posible coincidencia, el nuevo registro debe ser provisional hasta verificar que se trata de otro animal.'
      return
    }
    createdAnimal = await animalsApi.create(values)
    if (selectedPhoto.value) {
      await animalsApi.uploadPhoto(createdAnimal.id, selectedPhoto.value, `Fotografía de ${createdAnimal.name || createdAnimal.species}`)
      photoUploaded = true
      createdAnimal = await animalsApi.get(createdAnimal.id)
    }
    animals.value = [createdAnimal, ...animals.value]
    Object.assign(draft, { species: 'Perro', name: '', sex: null, estimatedAge: '', physicalDescription: '', provisional: false, identifiers: [], identifierType: 'microchip', identifierReference: '' })
    selectedPhoto.value = null
    duplicateMatches.value = null
    duplicateConfirmed.value = false
    formOpen.value = false
    successMessage.value = `${createdAnimal.name || createdAnimal.species} ya tiene un registro ${createdAnimal.identityStatus === 'provisional' ? 'provisional' : 'de identidad'}.`
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Error desconocido'
    error.value = createdAnimal
      ? photoUploaded
        ? `La identidad y la fotografía se guardaron, pero no se pudo actualizar la vista: ${message}`
        : `La identidad se creó, pero no se pudo subir su fotografía: ${message}`
      : `No se pudo guardar el registro: ${message}`
    if (createdAnimal && !animals.value.some((animal) => animal.id === createdAnimal?.id)) {
      animals.value = [createdAnimal, ...animals.value]
    }
    if (createdAnimal) {
      Object.assign(draft, { species: 'Perro', name: '', sex: null, estimatedAge: '', physicalDescription: '', provisional: false, identifiers: [], identifierType: 'microchip', identifierReference: '' })
      selectedPhoto.value = null
      duplicateMatches.value = null
      duplicateConfirmed.value = false
      formOpen.value = false
    }
  } finally {
    saving.value = false
  }
}

function selectPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  selectedPhoto.value = input.files?.[0] ?? null
}

async function uploadAnimalPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !selectedAnimal.value || uploadingPhoto.value) return
  uploadingPhoto.value = true
  error.value = ''
  try {
    await animalsApi.uploadPhoto(selectedAnimal.value.id, file, `Fotografía de ${selectedAnimal.value.name || selectedAnimal.value.species}`)
    selectedAnimal.value = await animalsApi.get(selectedAnimal.value.id)
    successMessage.value = 'La fotografía se agregó al expediente privado.'
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo subir la fotografía: ${cause.message}` : 'No se pudo subir la fotografía.'
  } finally {
    uploadingPhoto.value = false
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
}
</script>

<template>
  <main class="animals-page">
    <section class="animals-banner">
      <div class="animals-banner-image" role="img" aria-label="Perro acompañado por su cuidadora" />
      <div class="animals-banner-copy">
        <span class="pet-eyebrow"><PawPrint :size="14" /> IDENTIDAD ANIMAL</span>
        <h1>Una vida, una identidad.</h1>
        <p>El primer capítulo de una historia que merece acompañarlo siempre.</p>
      </div>
      <span class="banner-index">BIO-ACTA <span>·</span> REGISTRO PRIVADO</span>
    </section>

    <section v-if="selectedAnimal" class="animal-detail-page">
      <button class="back-link" type="button" @click="router.push({ name: 'animals' })"><ArrowLeft :size="16" /> Todos los animales</button>
      <div class="animal-detail-heading">
        <div class="animal-avatar animal-avatar--large"><Dog :size="34" /></div>
        <div><span class="pet-eyebrow">REGISTRO {{ selectedAnimal.identityStatus === 'provisional' ? 'PROVISIONAL' : 'DE IDENTIDAD' }}</span><h2>{{ selectedAnimal.name || 'Sin nombre' }}</h2><p>{{ selectedAnimal.species }} <span v-if="selectedAnimal.sex">· {{ selectedAnimal.sex }}</span></p></div>
      </div>
      <nav class="animal-detail-actions" aria-label="Herramientas de la Bio-Acta">
        <RouterLink v-if="!auth.user?.isAccessGuest || guestCanReadHealth" :to="{ path: '/bioacta/salud', query: { animalId: selectedAnimal.id } }">Salud</RouterLink>
        <RouterLink v-if="!auth.user?.isAccessGuest || guestCanReadCare" :to="{ path: '/bioacta/cuidados', query: { animalId: selectedAnimal.id } }">Cuidados</RouterLink>
        <template v-if="!auth.user?.isAccessGuest">
          <RouterLink v-if="auth.user?.role !== 'superadmin'" :to="{ path: '/bioacta/compartir', query: { animalId: selectedAnimal.id } }">Configurar accesos</RouterLink>
          <RouterLink v-if="auth.user?.role !== 'superadmin'" :to="{ path: '/bioacta/custodia', query: { animalId: selectedAnimal.id } }">Transferir custodia</RouterLink>
          <RouterLink :to="{ path: '/bioacta/qr', query: { animalId: selectedAnimal.id } }">Consulta pública y QR</RouterLink>
        </template>
      </nav>
      <section v-if="accessGrant" class="animal-guest-access" aria-label="Configuración del acceso temporal">
        <header class="animal-guest-access-heading">
          <span class="animal-guest-access-icon"><ShieldCheck :size="19" /></span>
          <span><strong>Acceso compartido</strong><small>Configuración vigente para esta ficha</small></span>
          <span class="animal-guest-access-badge">Solo consulta</span>
        </header>
        <div class="animal-guest-access-grid">
          <div class="animal-guest-access-item">
            <span class="animal-guest-access-item-icon"><PawPrint :size="15" /></span>
            <span><small>Alcance</small><strong>{{ guestScopeSummary }}</strong></span>
          </div>
          <div class="animal-guest-access-item">
            <span class="animal-guest-access-item-icon"><ShieldCheck :size="15" /></span>
            <span><small>Perfil asignado</small><strong>{{ accessGrant.role || 'Invitado' }}</strong></span>
          </div>
          <div class="animal-guest-access-item">
            <span class="animal-guest-access-item-icon"><HeartPulse :size="15" /></span>
            <span><small>Información de salud</small><strong>{{ guestCanReadHealth ? 'Permitida' : 'No incluida' }}</strong></span>
          </div>
          <div class="animal-guest-access-item">
            <span class="animal-guest-access-item-icon"><CalendarDays :size="15" /></span>
            <span><small>Información de cuidados</small><strong>{{ guestCanReadCare ? 'Permitida' : 'No incluida' }}</strong></span>
          </div>
          <div class="animal-guest-access-item">
            <span class="animal-guest-access-item-icon"><ShieldCheck :size="15" /></span>
            <span><small>Vigencia</small><strong>{{ accessGrant.expiresAt ? `Hasta ${formatDate(accessGrant.expiresAt)}` : 'Hasta que la persona responsable revoque el acceso' }}</strong></span>
          </div>
        </div>
        <p class="animal-guest-access-footnote">La identidad básica de esta ficha está incluida. La persona responsable puede actualizar estos permisos en cualquier momento.</p>
      </section>
      <div class="animal-detail-grid">
        <section class="detail-section">
          <span class="pet-eyebrow">IDENTIDAD</span>
          <dl>
            <div><dt>Especie</dt><dd>{{ selectedAnimal.species }}</dd></div>
            <div><dt>Identificador público</dt><dd><code>{{ selectedAnimal.publicId }}</code></dd></div>
            <div><dt>Edad estimada</dt><dd>{{ selectedAnimal.estimatedAge || 'Sin registrar' }}</dd></div>
            <div><dt>Señas físicas</dt><dd>{{ selectedAnimal.physicalDescription || 'Sin descripción registrada' }}</dd></div>
            <div><dt>Registro creado</dt><dd>{{ formatDate(selectedAnimal.createdAt) }}</dd></div>
            <div v-if="auth.user?.role === 'superadmin' && selectedAnimal.createdBy"><dt>Cuenta responsable</dt><dd>{{ selectedAnimal.createdBy.name }} · {{ selectedAnimal.createdBy.email }}</dd></div>
          </dl>
        </section>
        <aside class="privacy-note"><ShieldCheck :size="19" /><div><strong>Expediente privado</strong><p>La vista pública y los accesos compartidos solo estarán activos cuando el servidor confirme permisos y visibilidad segura.</p></div></aside>
      </div>
      <section v-if="selectedAnimal.photos.length" class="animal-photo-gallery" aria-label="Fotografías del animal">
        <img v-for="photo in selectedAnimal.photos" :key="photo.id" :src="photo.url" :alt="photo.alt || `Fotografía de ${selectedAnimal.name || selectedAnimal.species}`" />
      </section>
      <label v-if="!auth.user?.isAccessGuest && auth.user?.role !== 'superadmin'" class="animal-photo-upload">Añadir fotografía <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="uploadingPhoto" @change="uploadAnimalPhoto" /><small>{{ uploadingPhoto ? 'Subiendo…' : 'JPG, PNG o WebP · máximo 8 MB' }}</small></label>
    </section>

    <template v-else>
      <section class="animals-toolbar">
        <div><span class="pet-eyebrow">{{ auth.user?.role === 'superadmin' ? 'VISIÓN GLOBAL DE SUPERADMIN' : 'TU ESPACIO DE CUIDADO' }}</span><h2>Animales registrados</h2><p>{{ auth.user?.role === 'superadmin' ? 'Consulta los expedientes y sus datos de origen en toda la plataforma.' : 'La identidad permanece; la historia se construye con el tiempo.' }}</p></div>
        <button v-if="auth.user?.role !== 'superadmin'" class="button-primary" type="button" @click="formOpen = !formOpen"><Plus :size="17" /> Registrar animal</button>
      </section>

      <p v-if="successMessage" class="pet-success" role="status"><Check :size="16" />{{ successMessage }}</p>
      <p v-if="error" class="pet-error" role="alert">{{ error }}</p>

      <form v-if="formOpen" class="animal-form" @submit.prevent="createAnimal">
        <div class="animal-form-heading"><div><span class="pet-eyebrow">NUEVO REGISTRO</span><h3>Empecemos por conocerle</h3></div><button class="icon-button" type="button" aria-label="Cerrar formulario" @click="formOpen = false">×</button></div>
        <div class="animal-form-grid">
          <label>Especie <select v-model="draft.species" required><option>Perro</option><option>Gato</option><option>Ave</option><option>Conejo</option><option>Otro</option></select></label>
          <label>Nombre, si se conoce <input v-model="draft.name" maxlength="120" placeholder="Ej. Nube" /></label>
          <label>Sexo <select v-model="draft.sex"><option :value="null">No especificado</option><option>Hembra</option><option>Macho</option></select></label>
          <label>Edad estimada <input v-model="draft.estimatedAge" maxlength="120" placeholder="Ej. Aproximadamente 3 años" /></label>
          <label class="animal-form-wide">Señas físicas <textarea v-model="draft.physicalDescription" maxlength="2000" rows="3" placeholder="Marcas, colores u otras características reconocibles" /></label>
          <label>Tipo de identificador <select v-model="draft.identifierType"><option value="microchip">Microchip</option><option value="tattoo">Tatuaje</option><option value="registry">Registro</option><option value="other">Otro</option></select></label>
          <label>Identificador, si se conoce <input v-model="draft.identifierReference" maxlength="120" placeholder="Referencia privada" autocomplete="off" /></label>
          <label class="animal-form-wide">Fotografía principal <input type="file" accept="image/jpeg,image/png,image/webp" @change="selectPhoto" /><small>JPG, PNG o WebP · máximo 8 MB</small></label>
          <label class="animal-form-wide animal-provisional"><input v-model="draft.provisional" type="checkbox" /> Registro provisional: responsable desconocido o identidad pendiente de verificación.</label>
        </div>
        <ul v-if="duplicateMatches?.matches.length || duplicateMatches?.possiblePrivateMatch" class="animal-duplicate-list" aria-label="Posibles identidades existentes">
          <li v-for="match in duplicateMatches?.matches || []" :key="match.publicId"><strong>{{ match.name || 'Animal sin nombre' }} · {{ match.species }}</strong><span>{{ match.physicalDescription || 'Sin descripción pública' }}</span><RouterLink :to="`/bioacta/public/${encodeURIComponent(match.publicId)}`" target="_blank">Revisar identidad pública</RouterLink></li>
          <li v-if="duplicateMatches?.possiblePrivateMatch"><strong>Posible coincidencia privada por identificador.</strong><span>Por privacidad no mostramos sus datos. Se recomienda un registro provisional y una verificación antes de consolidar identidades.</span></li>
          <li class="animal-duplicate-confirm"><label><input v-model="duplicateConfirmed" type="checkbox" required /> Revisé las coincidencias. Si hay una coincidencia posible, crearé el registro como provisional hasta verificar que no sea el mismo animal.</label></li>
        </ul>
        <div class="animal-form-footer"><p><ShieldCheck :size="15" /> Este registro será privado.</p><button class="button-primary" type="submit" :disabled="saving"><LoaderCircle v-if="saving" class="is-spinning" :size="16" /><Check v-else :size="16" />{{ saving ? 'Guardando…' : 'Crear identidad' }}</button></div>
      </form>

      <div v-if="animals.length" class="animal-list-toolbar">
        <p>{{ animals.length }} {{ animals.length === 1 ? 'identidad registrada' : 'identidades registradas' }}</p>
        <label class="animal-search"><Search :size="16" /><input v-model="search" type="search" placeholder="Buscar animal" aria-label="Buscar animal" /></label>
      </div>

      <section v-if="loading" class="animal-state"><LoaderCircle class="is-spinning" :size="22" /><p>Cargando tus registros…</p></section>
      <section v-else-if="filteredAnimals.length" class="animal-list" aria-live="polite">
        <RouterLink v-for="animal in filteredAnimals" :key="animal.id" class="animal-row" :to="{ name: 'animal-detail', params: { animalId: animal.id } }">
          <span class="animal-avatar"><PawPrint :size="23" /></span>
          <span class="animal-row-copy"><strong>{{ animal.name || 'Sin nombre' }}</strong><span>{{ animal.species }}<template v-if="animal.sex"> · {{ animal.sex }}</template><template v-if="auth.user?.role === 'superadmin' && animal.createdBy"> · Responsable: {{ animal.createdBy.name }}</template></span></span>
          <span class="animal-row-meta">Registrado {{ formatDate(animal.createdAt) }}</span>
          <ArrowRight :size="17" class="animal-row-arrow" />
        </RouterLink>
      </section>
      <section v-else-if="animals.length" class="animal-state"><p>No hay coincidencias para “{{ search }}”.</p></section>
      <section v-else-if="!loading && !error && auth.user?.role === 'superadmin'" class="animal-state"><p>No hay registros de animales en la plataforma.</p></section>
      <section v-else-if="!loading && !error" class="animals-empty">
        <img src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1000&q=85" alt="Perro acompañado por su familia" loading="lazy" />
        <div><span class="pet-eyebrow">CADA HISTORIA EMPIEZA EN ALGÚN LUGAR</span><h3>La identidad empieza aquí.</h3><p>Registra un animal para comenzar a conservar sus datos y construir una historia que pueda acompañarlo a lo largo de su vida.</p><button class="button-primary" type="button" @click="formOpen = true"><Plus :size="16" /> Crear el primer registro</button></div>
      </section>
    </template>
  </main>
</template>
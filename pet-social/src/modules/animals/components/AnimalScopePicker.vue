<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, PawPrint, Search, ShieldCheck, X } from 'lucide-vue-next'
import type { AnimalRecord } from '../services/animalsApi'

const props = defineProps<{
  animals: AnimalRecord[]
  selectedIds: string[]
  allAnimals: boolean
}>()

const emit = defineEmits<{
  'update:selectedIds': [value: string[]]
  'update:allAnimals': [value: boolean]
}>()

const search = ref('')
const speciesFilter = ref('')
const showSelectedOnly = ref(false)
const visibleLimit = ref(40)

const speciesOptions = computed(() => [...new Set(props.animals.map((animal) => animal.species))]
  .sort((left, right) => left.localeCompare(right, 'es')))

const normalizedAnimals = computed(() => props.animals
  .map((animal) => ({
    animal,
    searchText: [
      animal.name,
      animal.species,
      animal.sex,
      animal.id,
      animal.publicId,
    ].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es'),
  }))
  .sort((left, right) => (left.animal.name || left.animal.species).localeCompare(
    right.animal.name || right.animal.species,
    'es',
    { sensitivity: 'base' },
  )))
const selectedIdSet = computed(() => new Set(props.selectedIds))

const filteredAnimals = computed(() => {
  const query = search.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
  const terms = query.split(/\s+/).filter(Boolean)
  return normalizedAnimals.value
    .filter(({ animal, searchText }) => (!speciesFilter.value || animal.species === speciesFilter.value)
      && (!showSelectedOnly.value || selectedIdSet.value.has(animal.id))
      && terms.every((term) => searchText.includes(term)))
})

const visibleAnimals = computed(() => filteredAnimals.value
  .slice(0, visibleLimit.value)
  .map(({ animal }) => animal))
const selectedAnimals = computed(() => {
  const animalsById = new Map(props.animals.map((animal) => [animal.id, animal]))
  return props.selectedIds
    .map((id) => animalsById.get(id))
    .filter((animal): animal is AnimalRecord => Boolean(animal))
})
const visibleSelectedAnimals = computed(() => selectedAnimals.value.slice(0, 6))
const remainingSelectedCount = computed(() => Math.max(0, selectedAnimals.value.length - visibleSelectedAnimals.value.length))
const visibleSelectedCount = computed(() => visibleAnimals.value
  .filter((animal) => selectedIdSet.value.has(animal.id)).length)
const visibleUnselectedCount = computed(() => visibleAnimals.value.length - visibleSelectedCount.value)
const allVisibleSelected = computed(() => visibleAnimals.value.length > 0
  && visibleSelectedCount.value === visibleAnimals.value.length)
const exceedsSelectionLimit = computed(() => props.selectedIds.length + visibleUnselectedCount.value > 100)

watch([search, speciesFilter, showSelectedOnly], () => {
  visibleLimit.value = 40
})

function toggleAnimal(animalId: string) {
  if (props.selectedIds.includes(animalId)) {
    emit('update:selectedIds', props.selectedIds.filter((id) => id !== animalId))
  } else if (props.selectedIds.length < 100) {
    emit('update:selectedIds', [...props.selectedIds, animalId])
  }
}

function toggleVisibleAnimals() {
  const visibleIds = new Set(visibleAnimals.value.map((animal) => animal.id))
  const nextIds = allVisibleSelected.value
    ? props.selectedIds.filter((id) => !visibleIds.has(id))
    : [...new Set([...props.selectedIds, ...visibleIds])].slice(0, 100)
  emit('update:selectedIds', nextIds)
}

function setAllAnimals(enabled: boolean) {
  emit('update:allAnimals', enabled)
  if (enabled) emit('update:selectedIds', [])
}
</script>

<template>
  <fieldset class="animal-scope-picker">
    <legend><span class="animal-scope-step">2</span> Elige qué animales podrá consultar</legend>
    <p class="animal-scope-intro">Limita el acceso a fichas específicas o compártelas todas bajo tu cuidado.</p>
    <button
      type="button"
      class="animal-scope-all"
      :class="{ 'is-selected': allAnimals }"
      :aria-pressed="allAnimals"
      @click="setAllAnimals(!allAnimals)"
    >
      <span class="animal-scope-all-icon"><ShieldCheck :size="18" /></span>
      <span class="animal-scope-all-copy">
        <strong>Todos mis animales</strong>
        <small>Incluye los actuales y los que agregues después</small>
      </span>
      <span class="animal-scope-all-indicator" aria-hidden="true"><Check :size="14" /></span>
    </button>

    <template v-if="!allAnimals">
      <div class="animal-scope-summary" aria-live="polite">
        <span class="animal-scope-selected-count"><strong>{{ selectedIds.length }}</strong> de {{ animals.length }} seleccionados</span>
        <button v-if="selectedIds.length" type="button" class="animal-scope-clear" @click="emit('update:selectedIds', [])">
          <X :size="13" /> Limpiar selección
        </button>
      </div>

      <div v-if="visibleSelectedAnimals.length" class="animal-scope-chips" aria-label="Animales seleccionados">
        <span v-for="animal in visibleSelectedAnimals" :key="animal.id" class="animal-scope-chip">
          {{ animal.name || animal.species }}
          <button type="button" :aria-label="`Quitar ${animal.name || animal.species}`" @click="toggleAnimal(animal.id)">
            <X :size="12" />
          </button>
        </span>
        <span v-if="remainingSelectedCount" class="animal-scope-more-selected">+{{ remainingSelectedCount }} más; búscalos para quitarlos</span>
      </div>

      <div class="animal-scope-tools" :class="{ 'has-filters': search || speciesFilter }">
        <label class="animal-scope-search">
          <Search :size="16" aria-hidden="true" />
          <span class="visually-hidden">Buscar por nombre, especie o identificador</span>
          <input v-model="search" type="search" placeholder="Busca por nombre o código de ficha" autocomplete="off" />
          <button v-if="search" type="button" class="animal-scope-search-clear" aria-label="Limpiar búsqueda" @click="search = ''"><X :size="14" /></button>
        </label>
        <label class="animal-scope-species">
          <span class="visually-hidden">Filtrar por especie</span>
          <select v-model="speciesFilter" aria-label="Filtrar por especie">
            <option value="">Todas las especies</option>
            <option v-for="species in speciesOptions" :key="species" :value="species">{{ species }}</option>
          </select>
        </label>
      </div>

      <div class="animal-scope-results-heading">
        <div class="animal-scope-tabs" role="tablist" aria-label="Filtrar animales">
        <button type="button" :aria-pressed="!showSelectedOnly" class="animal-scope-mode" :class="{ 'is-active': !showSelectedOnly }" @click="showSelectedOnly = false">
          Todos <span>{{ animals.length }}</span>
        </button>
        <button type="button" :aria-pressed="showSelectedOnly" class="animal-scope-mode" :class="{ 'is-active': showSelectedOnly }" @click="showSelectedOnly = true">
          Seleccionados <span>{{ selectedIds.length }}</span>
        </button>
        </div>
        <button
          v-if="visibleAnimals.length"
          type="button"
          class="animal-scope-select-visible"
          :disabled="!allVisibleSelected && exceedsSelectionLimit"
          :title="!allVisibleSelected && exceedsSelectionLimit ? 'La selección específica está limitada a 100 animales.' : undefined"
          @click="toggleVisibleAnimals"
        >
          {{ allVisibleSelected ? 'Quitar visibles' : 'Seleccionar visibles' }}
        </button>
      </div>

      <div class="animal-scope-results" role="group" aria-label="Resultados de animales">
        <label v-for="animal in visibleAnimals" :key="animal.id" class="animal-scope-option">
          <input
            :checked="selectedIdSet.has(animal.id)"
            :disabled="!selectedIdSet.has(animal.id) && selectedIds.length >= 100"
            type="checkbox"
            :aria-label="`Seleccionar ${animal.name || animal.species}, ${animal.species}`"
            @change="toggleAnimal(animal.id)"
          />
          <span class="animal-scope-avatar">
            <img v-if="animal.photos[0]" :src="animal.photos[0].url" :alt="animal.photos[0].alt || ''" loading="lazy" />
            <PawPrint v-else :size="16" />
          </span>
          <span class="animal-scope-option-copy">
            <strong>{{ animal.name || 'Sin nombre' }}</strong>
            <small>{{ animal.species }} <span aria-hidden="true">·</span> Ficha {{ animal.publicId.slice(0, 8) }}</small>
          </span>
          <span class="animal-scope-check" :class="{ 'is-selected': selectedIdSet.has(animal.id) }" aria-hidden="true"><Check :size="13" /></span>
        </label>
        <p v-if="!filteredAnimals.length" class="animal-scope-empty">
          {{ !animals.length
            ? 'Aún no tienes animales registrados. Cuando agregues fichas, podrás elegirlas aquí.'
            : showSelectedOnly && !selectedIds.length
              ? 'Todavía no hay fichas seleccionadas.'
              : 'No encontramos resultados. Prueba otro nombre o especie.' }}
        </p>
      </div>

      <div v-if="visibleLimit < filteredAnimals.length" class="animal-scope-pagination">
        <span>Viendo {{ visibleAnimals.length }} de {{ filteredAnimals.length }}</span>
        <button type="button" class="animal-scope-load-more" @click="visibleLimit += 40">Mostrar 40 más</button>
      </div>
      <small class="animal-scope-limit">Puedes seleccionar hasta 100 fichas específicas por acceso.</small>
    </template>
  </fieldset>
</template>

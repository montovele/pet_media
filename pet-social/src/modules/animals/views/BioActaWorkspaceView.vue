<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, CalendarDays, Check, Clock3, HeartPulse, PawPrint, Plus, QrCode, ShieldCheck, UserPlus } from 'lucide-vue-next'
import { useAuthStore } from '../../../stores/auth'
import { animalsApi, type AnimalRecord } from '../services/animalsApi'
import AnimalScopePicker from '../components/AnimalScopePicker.vue'
import {
  bioActaApi,
  type AccessGrant,
  type AuditLog,
  type CareSchedule,
  type HealthRecord,
  type ProfessionalSummary,
  type PublicBioActa,
} from '../services/bioActaApi'

type Section = 'inicio' | 'salud' | 'cuidados' | 'perdidos' | 'compartir' | 'custodia' | 'qr' | 'profesional' | 'administracion' | 'public'
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const sections: Section[] = ['inicio', 'salud', 'cuidados', 'perdidos', 'compartir', 'custodia', 'qr', 'profesional', 'administracion', 'public']
const advancedSections: Section[] = ['compartir', 'custodia', 'qr', 'profesional', 'administracion']
const section = computed<Section>(() => {
  if (route.name === 'public-bio-acta') return 'public'
  if (route.name === 'public-lost-found') return 'perdidos'
  const candidate = String(route.params.section ?? 'inicio')
  return sections.find((item) => item === candidate) ?? 'inicio'
})
const isPublic = computed(() => route.name === 'public-bio-acta')
const isPublicReport = computed(() => route.name === 'public-lost-found')
const isPublicPage = computed(() => isPublic.value || isPublicReport.value)
const isAdmin = computed(() => auth.user?.role === 'superadmin')
const animals = ref<AnimalRecord[]>([])
const selectedAnimalId = ref('')
const healthRecords = ref<HealthRecord[]>([])
const careSchedules = ref<CareSchedule[]>([])
const accessGrants = ref<AccessGrant[]>([])
const incomingTransfers = ref<Awaited<ReturnType<typeof animalsApi.listIncomingTransfers>>>([])
const outgoingTransfers = ref<Awaited<ReturnType<typeof animalsApi.listOutgoingTransfers>>>([])
const auditLogs = ref<AuditLog[]>([])
const professionalSummary = ref<ProfessionalSummary | null>(null)
const publicRecord = ref<PublicBioActa | null>(null)
const publicReports = ref<Awaited<ReturnType<typeof bioActaApi.listPublicLostFoundReports>>>([])
const myLostFoundReports = ref<Awaited<ReturnType<typeof bioActaApi.listMyLostFoundReports>>>([])
const lostFoundMessages = ref<Awaited<ReturnType<typeof bioActaApi.listMyLostFoundMessages>>>([])
const overviewSummary = ref({
  healthRecords: 0,
  activeCareSchedules: 0,
  dueCareSchedules: 0,
  activeAccessGrants: 0,
  openReports: 0,
  messages: 0,
  incomingTransfers: 0,
  outgoingTransfers: 0,
})
const contactingReportId = ref('')
const contactMessage = ref('')
const replyDrafts = reactive<Record<string, string>>({})
const qrUrl = ref('')
const qrImage = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')

const healthDraft = reactive({
  type: 'Vacuna',
  description: '',
  date: new Date().toISOString().slice(0, 10),
  productName: '',
  dose: '',
  lotNumber: '',
  nextDueDate: '',
})
const careDraft = reactive({
  name: '',
  dose: '',
  frequency: 'Diaria',
  intervalValue: 1,
  intervalUnit: 'days' as 'hours' | 'days' | 'weeks',
  nextAt: '',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
})
const reportDraft = reactive({
  type: 'found' as 'lost' | 'found',
  animalId: '',
  species: '',
  date: new Date().toISOString().slice(0, 10),
  location: '',
  description: '',
  contactMethod: '',
})
const grantDraft = reactive({
  recipient: '',
  password: '',
  role: 'Cuidador',
  permissions: ['health:read'],
  expiresAt: '',
  allAnimals: false,
  animalIds: [] as string[],
})
const editingGrantId = ref('')
const grantEditDraft = reactive({
  role: 'Cuidador',
  permissions: [] as string[],
  expiresAt: '',
  allAnimals: false,
  animalIds: [] as string[],
  password: '',
})
const transferRecipient = ref('')

const selectedAnimal = computed(() => animals.value.find((animal) => animal.id === selectedAnimalId.value) ?? null)
const certifiedHealthCount = computed(() => healthRecords.value.filter((record) => record.certified).length)
const publicQrAnimal = computed(() => animals.value.find((animal) => animal.publicEnabled) ?? null)
const guideSteps = computed(() => [
  {
    number: '01',
    title: 'Crea su identidad',
    description: 'Registra los datos esenciales para reconocer a tu animal y conservar su historia.',
    to: '/animals',
    action: animals.value.length ? 'Ver mis animales' : 'Registrar animal',
    complete: animals.value.length > 0,
    icon: PawPrint,
  },
  {
    number: '02',
    title: 'Organiza su cuidado',
    description: 'Añade eventos de salud y programa recordatorios para sus cuidados cotidianos.',
    to: animals.value.length && selectedAnimalId.value
      ? { path: '/bioacta/salud', query: { animalId: selectedAnimalId.value } }
      : '/animals',
    action: overviewSummary.value.healthRecords || overviewSummary.value.activeCareSchedules
      ? 'Ver su cuidado'
      : animals.value.length ? 'Añadir información' : 'Primero crea una ficha',
    complete: overviewSummary.value.healthRecords > 0 || overviewSummary.value.activeCareSchedules > 0,
    icon: HeartPulse,
  },
  {
    number: '03',
    title: 'Comparte con seguridad',
    description: 'Da acceso limitado a otras personas o activa una consulta pública con información autorizada.',
    to: animals.value.length && selectedAnimalId.value
      ? { path: '/bioacta/compartir', query: { animalId: selectedAnimalId.value } }
      : '/animals',
    action: overviewSummary.value.activeAccessGrants || publicQrAnimal.value
      ? 'Revisar permisos'
      : animals.value.length ? 'Configurar acceso' : 'Primero crea una ficha',
    complete: overviewSummary.value.activeAccessGrants > 0 || Boolean(publicQrAnimal.value),
    icon: ShieldCheck,
  },
])
const heading = computed(() => ({
  inicio: ['BIO-ACTA', 'El cuidado de tu animal, más fácil de seguir', 'Empieza con su identidad y añade su historia de cuidado a tu ritmo.'],
  salud: ['BIOGRAFÍA SANITARIA', 'Salud y procedencia', 'Conserva eventos de salud y distingue los datos declarados de los certificados.'],
  cuidados: ['CUIDADOS', 'Rutinas que acompañan', 'Programa cuidados y registra cada dosis para reducir omisiones y duplicaciones.'],
  perdidos: ['RED DE REENCUENTRO', 'Perdidos y encontrados', 'Reporta un animal sin convertir el reporte en una declaración de propiedad o custodia.'],
  compartir: ['CONTINUIDAD', 'Compartir con permisos', 'Concede accesos limitados y temporales a las personas que participan en su cuidado.'],
  custodia: ['CONTINUIDAD', 'Transferir custodia', 'Transfiere la responsabilidad con aceptación explícita y conserva la identidad y su historia.'],
  qr: ['IDENTIDAD PÚBLICA', 'Consulta y código QR', 'Comparte únicamente la información autorizada, sin exponer datos personales.'],
  profesional: ['ESPACIO PROFESIONAL', 'Veterinarias y refugios', 'Herramientas profesionales para expedientes y registros certificados.'],
  administracion: ['CONTROL Y AUDITORÍA', 'Administración BIO-ACTA', 'Acceso a reportes, auditoría y catálogos sujetos a permisos administrativos.'],
  public: ['BIO-ACTA · REGISTRO PRIVADO', 'Identidad animal', 'Información pública autorizada por las personas responsables del registro.'],
}[section.value]))

async function loadAnimals() {
  loading.value = true
  error.value = ''
  try {
    animals.value = await animalsApi.list()
    const requestedId = typeof route.query.animalId === 'string' ? route.query.animalId : ''
    if (animals.value.some((animal) => animal.id === requestedId)) selectedAnimalId.value = requestedId
    else if (!selectedAnimalId.value && animals.value.length) selectedAnimalId.value = animals.value[0].id
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudieron cargar los animales: ${cause.message}` : 'No se pudieron cargar los animales.'
  } finally {
    loading.value = false
  }
}

async function loadSectionData() {
  error.value = ''
  notice.value = ''
  if (isPublic.value) {
    loading.value = true
    try {
      publicRecord.value = await bioActaApi.getPublicBioActa(String(route.params.publicId ?? ''))
    } catch (cause) {
      error.value = cause instanceof Error ? `No se pudo consultar la Bio-Acta pública: ${cause.message}` : 'No se pudo consultar la Bio-Acta pública.'
    } finally {
      loading.value = false
    }
    return
  }
  if (!selectedAnimalId.value && !['inicio', 'profesional', 'administracion', 'custodia', 'perdidos'].includes(section.value)) return

  loading.value = true
  try {
    if (section.value === 'inicio') {
      const [
        healthByAnimal,
        careByAnimal,
        grantsByAnimal,
        reports,
        messages,
        incoming,
        outgoing,
      ] = await Promise.all([
        Promise.all(animals.value.map((animal) => bioActaApi.listHealthRecords(animal.id))),
        Promise.all(animals.value.map((animal) => bioActaApi.listCareSchedules(animal.id))),
        Promise.all(animals.value.map((animal) => bioActaApi.listAccessGrants(animal.id))),
        bioActaApi.listMyLostFoundReports(),
        bioActaApi.listMyLostFoundMessages(),
        animalsApi.listIncomingTransfers(),
        animalsApi.listOutgoingTransfers(),
      ])
      const schedules = careByAnimal.flat()
      overviewSummary.value = {
        healthRecords: healthByAnimal.flat().length,
        activeCareSchedules: schedules.filter((schedule) => schedule.active).length,
        dueCareSchedules: schedules.filter((schedule) => schedule.active && Date.parse(schedule.nextAt) <= Date.now()).length,
        activeAccessGrants: [...new Map(grantsByAnimal.flat().map((grant) => [grant.id, grant])).values()].filter((grant) => !grant.revokedAt).length,
        openReports: reports.filter((report) => report.status === 'open').length,
        messages: messages.length,
        incomingTransfers: incoming.length,
        outgoingTransfers: outgoing.length,
      }
    }
    if (section.value === 'salud') healthRecords.value = await bioActaApi.listHealthRecords(selectedAnimalId.value)
    if (section.value === 'cuidados') careSchedules.value = await bioActaApi.listCareSchedules(selectedAnimalId.value)
    if (section.value === 'perdidos') {
      const [reports, messages] = await Promise.all([
        bioActaApi.listMyLostFoundReports(),
        bioActaApi.listMyLostFoundMessages(),
      ])
      myLostFoundReports.value = reports
      lostFoundMessages.value = messages
    }
    if (section.value === 'compartir') accessGrants.value = await bioActaApi.listAccessGrants(selectedAnimalId.value)
    if (section.value === 'custodia') {
      const [incoming, outgoing] = await Promise.all([
        animalsApi.listIncomingTransfers(),
        animalsApi.listOutgoingTransfers(),
      ])
      incomingTransfers.value = incoming
      outgoingTransfers.value = outgoing
    }
    if (section.value === 'qr') {
      qrUrl.value = ''
      qrImage.value = ''
      const qr = await bioActaApi.getQr(selectedAnimalId.value)
      qrImage.value = qr.imageDataUrl
      qrUrl.value = qr.publicUrl
    }
    if (section.value === 'profesional') professionalSummary.value = await bioActaApi.getProfessionalSummary()
    if (section.value === 'administracion' && isAdmin.value) auditLogs.value = await bioActaApi.listAuditLogs()
  } catch (cause) {
    error.value = cause instanceof Error
      ? `No se pudo cargar esta función. El servidor puede no tener habilitado el servicio correspondiente: ${cause.message}`
      : 'No se pudo cargar esta función.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (isPublicPage.value && !isPublicReport.value) {
    await loadSectionData()
    return
  }
  if (isPublicReport.value) {
    loading.value = true
    try {
      publicReports.value = await bioActaApi.listPublicLostFoundReports()
    } catch (cause) {
      error.value = cause instanceof Error ? `No se pudieron cargar los reportes: ${cause.message}` : 'No se pudieron cargar los reportes.'
    } finally {
      loading.value = false
    }
    return
  }
  await loadAnimals()
  await loadSectionData()
})

watch([section, selectedAnimalId], () => {
  clearMessages()
  if (section.value !== 'inicio' && section.value !== 'profesional' && section.value !== 'administracion' && section.value !== 'custodia'
    && (section.value !== 'perdidos' || !isPublicReport.value)) {
    void loadSectionData()
  }
})

watch(selectedAnimalId, (animalId) => {
  if (animalId && !grantDraft.allAnimals && !grantDraft.animalIds.length) {
    grantDraft.animalIds = [animalId]
  }
})

watch(() => route.query.animalId, (requestedId) => {
  if (typeof requestedId === 'string' && animals.value.some((animal) => animal.id === requestedId)) {
    selectedAnimalId.value = requestedId
  }
})

function clearMessages() {
  error.value = ''
  notice.value = ''
}

async function submitHealthRecord() {
  if (!selectedAnimalId.value || saving.value) return
  saving.value = true
  clearMessages()
  try {
    const record = await bioActaApi.createHealthRecord(selectedAnimalId.value, {
      type: healthDraft.type,
      description: healthDraft.description,
      date: healthDraft.date,
      details: {
        productName: healthDraft.productName.trim() || null,
        dose: healthDraft.dose.trim() || null,
        lotNumber: healthDraft.lotNumber.trim() || null,
        nextDueDate: healthDraft.nextDueDate || null,
      },
    })
    healthRecords.value = [record, ...healthRecords.value]
    Object.assign(healthDraft, {
      description: '',
      productName: '',
      dose: '',
      lotNumber: '',
      nextDueDate: '',
    })
    notice.value = 'El evento de salud fue guardado. Su autoría y certificación dependen de la respuesta del servidor.'
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo guardar el evento de salud: ${cause.message}` : 'No se pudo guardar el evento de salud.'
  } finally {
    saving.value = false
  }
}

async function submitCareSchedule() {
  if (!selectedAnimalId.value || saving.value) return
  saving.value = true
  clearMessages()
  try {
    const schedule = await bioActaApi.createCareSchedule(selectedAnimalId.value, {
      ...careDraft,
      dose: careDraft.dose.trim() || null,
      nextAt: new Date(careDraft.nextAt).toISOString(),
    })
    careSchedules.value = [schedule, ...careSchedules.value]
    Object.assign(careDraft, { name: '', dose: '', frequency: 'Diaria', intervalValue: 1, intervalUnit: 'days', nextAt: '' })
    notice.value = 'El cuidado fue programado.'
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo programar el cuidado: ${cause.message}` : 'No se pudo programar el cuidado.'
  } finally {
    saving.value = false
  }
}

async function logDose(schedule: CareSchedule) {
  clearMessages()
  try {
    await bioActaApi.logCareDose(schedule.id, 'administered')
    notice.value = 'La dosis quedó registrada.'
    try {
      careSchedules.value = await bioActaApi.listCareSchedules(selectedAnimalId.value)
    } catch (cause) {
      error.value = cause instanceof Error ? `La dosis se guardó, pero no se pudo actualizar el historial: ${cause.message}` : 'La dosis se guardó, pero no se pudo actualizar el historial.'
    }
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo registrar la dosis: ${cause.message}` : 'No se pudo registrar la dosis.'
  }
}

async function skipDose(schedule: CareSchedule) {
  clearMessages()
  try {
    await bioActaApi.logCareDose(schedule.id, 'skipped')
    notice.value = 'La dosis omitida quedó registrada; revisa la próxima fecha programada.'
    try {
      careSchedules.value = await bioActaApi.listCareSchedules(selectedAnimalId.value)
    } catch (cause) {
      error.value = cause instanceof Error ? `La omisión se guardó, pero no se pudo actualizar el historial: ${cause.message}` : 'La omisión se guardó, pero no se pudo actualizar el historial.'
    }
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo registrar la dosis omitida: ${cause.message}` : 'No se pudo registrar la dosis omitida.'
  }
}

async function submitReport() {
  if (saving.value) return
  saving.value = true
  clearMessages()
  try {
    await bioActaApi.createLostFoundReport({
      ...reportDraft,
      animalId: reportDraft.animalId || null,
    })
    Object.assign(reportDraft, { species: '', location: '', description: '', contactMethod: '', animalId: '' })
    notice.value = 'El reporte fue recibido.'
    if (isPublicReport.value) {
      try {
        publicReports.value = await bioActaApi.listPublicLostFoundReports()
      } catch (cause) {
        error.value = cause instanceof Error ? `El reporte se guardó, pero no se pudo actualizar la lista: ${cause.message}` : 'El reporte se guardó, pero no se pudo actualizar la lista.'
      }
    } else {
      try {
        myLostFoundReports.value = await bioActaApi.listMyLostFoundReports()
      } catch (cause) {
        error.value = cause instanceof Error ? `El reporte se guardó, pero no se pudo actualizar tu lista: ${cause.message}` : 'El reporte se guardó, pero no se pudo actualizar tu lista.'
      }
    }
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo enviar el reporte: ${cause.message}` : 'No se pudo enviar el reporte.'
  } finally {
    saving.value = false
  }
}

async function updateReportStatus(reportId: string, status: 'open' | 'resolved' | 'closed') {
  clearMessages()
  try {
    await bioActaApi.updateLostFoundReportStatus(reportId, status)
    myLostFoundReports.value = myLostFoundReports.value.map((report) => report.id === reportId ? { ...report, status } : report)
    notice.value = 'El estado del reporte fue actualizado.'
    if (isPublicReport.value) publicReports.value = await bioActaApi.listPublicLostFoundReports()
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo actualizar el estado: ${cause.message}` : 'No se pudo actualizar el estado.'
  }
}

async function sendContactRequest(reportId: string, threadId?: string) {
  const message = threadId ? replyDrafts[threadId]?.trim() : contactMessage.value.trim()
  if (!message || contactingReportId.value) return
  contactingReportId.value = reportId
  clearMessages()
  try {
    await bioActaApi.contactLostFoundReport(reportId, message, threadId)
    if (threadId) {
      replyDrafts[threadId] = ''
      notice.value = 'Tu respuesta privada fue enviada.'
      try {
        lostFoundMessages.value = await bioActaApi.listMyLostFoundMessages()
      } catch (cause) {
        error.value = cause instanceof Error ? `Tu respuesta se envió, pero no se pudo actualizar la conversación: ${cause.message}` : 'Tu respuesta se envió, pero no se pudo actualizar la conversación.'
      }
    } else {
      contactMessage.value = ''
      notice.value = 'Tu mensaje fue enviado de forma privada a la persona que publicó el reporte.'
    }
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo enviar el mensaje privado: ${cause.message}` : 'No se pudo enviar el mensaje privado.'
  } finally {
    contactingReportId.value = ''
  }
}

async function submitGrant() {
  if (!selectedAnimalId.value || saving.value) return
  if (!grantDraft.allAnimals && !grantDraft.animalIds.length) {
    error.value = 'Selecciona al menos un animal para compartir.'
    return
  }
  const anchorAnimalId = grantDraft.allAnimals ? selectedAnimalId.value : grantDraft.animalIds[0]
  saving.value = true
  clearMessages()
  try {
    const grant = await bioActaApi.createAccessGrant(anchorAnimalId, {
      ...grantDraft,
      expiresAt: grantDraft.expiresAt || null,
    })
    accessGrants.value = [grant, ...accessGrants.value]
    Object.assign(grantDraft, {
      recipient: '',
      password: '',
      role: 'Cuidador',
      permissions: ['health:read'],
      expiresAt: '',
      allAnimals: false,
      animalIds: selectedAnimalId.value ? [selectedAnimalId.value] : [],
    })
    notice.value = 'El acceso fue creado con los permisos indicados.'
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo compartir el expediente: ${cause.message}` : 'No se pudo compartir el expediente.'
  } finally {
    saving.value = false
  }
}

function editGrant(grant: AccessGrant) {
  editingGrantId.value = grant.id
  Object.assign(grantEditDraft, {
    role: grant.role,
    permissions: [...grant.permissions],
    expiresAt: grant.expiresAt?.slice(0, 10) ?? '',
    allAnimals: grant.allAnimals,
    animalIds: grant.allAnimals ? [] : [...(grant.animalIds.length ? grant.animalIds : [grant.animalId])],
    password: '',
  })
  clearMessages()
}

async function saveGrantEdits(grant: AccessGrant) {
  if (saving.value) return
  if (!grantEditDraft.allAnimals && !grantEditDraft.animalIds.length) {
    error.value = 'Selecciona al menos un animal o elige todos tus animales.'
    return
  }
  saving.value = true
  clearMessages()
  try {
    const updated = await bioActaApi.updateAccessGrant(grant.id, {
      ...grantEditDraft,
      expiresAt: grantEditDraft.expiresAt || null,
      password: grantEditDraft.password || undefined,
    })
    accessGrants.value = accessGrants.value.map((item) => item.id === updated.id ? updated : item)
    editingGrantId.value = ''
    notice.value = 'Los permisos y el alcance del acceso fueron actualizados.'
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo actualizar el acceso: ${cause.message}` : 'No se pudo actualizar el acceso.'
  } finally {
    saving.value = false
  }
}

async function revokeGrant(grant: AccessGrant) {
  clearMessages()
  try {
    await bioActaApi.revokeAccessGrant(grant.id)
    accessGrants.value = accessGrants.value.map((item) => item.id === grant.id
      ? { ...item, revokedAt: new Date().toISOString() }
      : item)
    notice.value = 'El acceso fue revocado.'
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo revocar el acceso: ${cause.message}` : 'No se pudo revocar el acceso.'
  }
}

function grantScopeLabel(grant: AccessGrant) {
  if (grant.allAnimals) return 'Todos los animales bajo tu cuidado actual y futuro'
  const ids = grant.animalIds.length ? grant.animalIds : [grant.animalId]
  return ids.map((id) => {
    const animal = animals.value.find((item) => item.id === id)
    return animal ? animal.name || animal.species : 'Animal no disponible'
  }).join(', ')
}

function grantPermissionLabels(permissions: string[]) {
  const labels: Record<string, string> = {
    'animal:read': 'Identidad',
    'animal:manage': 'Gestionar expediente',
    'health:read': 'Consultar salud',
    'health:manage': 'Gestionar salud',
    'care:read': 'Consultar cuidados',
    'care:manage': 'Gestionar cuidados',
  }
  return [...new Set(permissions.map((permission) => labels[permission] ?? permission))]
}

async function submitTransfer() {
  if (!selectedAnimalId.value || saving.value) return
  saving.value = true
  clearMessages()
  try {
    await animalsApi.createTransfer(selectedAnimalId.value, transferRecipient.value.trim())
    transferRecipient.value = ''
    notice.value = 'La solicitud de transferencia fue enviada; la otra persona debe aceptarla para cambiar la custodia.'
    try {
      outgoingTransfers.value = await animalsApi.listOutgoingTransfers()
    } catch (cause) {
      error.value = cause instanceof Error ? `La solicitud se envió, pero no se pudo actualizar la lista: ${cause.message}` : 'La solicitud se envió, pero no se pudo actualizar la lista.'
    }
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo solicitar la transferencia: ${cause.message}` : 'No se pudo solicitar la transferencia.'
  } finally {
    saving.value = false
  }
}

async function acceptTransfer(transferId: string) {
  clearMessages()
  try {
    const animal = await animalsApi.acceptTransfer(transferId)
    animals.value = [animal, ...animals.value.filter((item) => item.id !== animal.id)]
    incomingTransfers.value = incomingTransfers.value.filter((item) => item.id !== transferId)
    notice.value = 'La transferencia fue aceptada. La identidad y el historial permanecen asociados al animal.'
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo aceptar la transferencia: ${cause.message}` : 'No se pudo aceptar la transferencia.'
  }
}

async function cancelTransfer(transferId: string) {
  clearMessages()
  try {
    await animalsApi.cancelTransfer(transferId)
    outgoingTransfers.value = outgoingTransfers.value.filter((transfer) => transfer.id !== transferId)
    notice.value = 'La solicitud de transferencia fue cancelada.'
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo cancelar la transferencia: ${cause.message}` : 'No se pudo cancelar la transferencia.'
  }
}

async function copyPublicUrl() {
  if (!qrUrl.value) return
  try {
    await navigator.clipboard.writeText(qrUrl.value)
    notice.value = 'Enlace público copiado.'
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo copiar el enlace: ${cause.message}` : 'No se pudo copiar el enlace.'
  }
}

async function copyAccessInvite(grant: AccessGrant) {
  const inviteUrl = new URL(router.resolve({
    name: 'bioacta-access',
    params: { grantId: grant.id },
    query: { animalId: grant.animalId, email: grant.recipient },
  }).href, window.location.origin).toString()
  try {
    await navigator.clipboard.writeText(inviteUrl)
    notice.value = `Invitación para ${grant.recipient} copiada. Comparte también la contraseña del acceso por un canal privado distinto.`
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? `No se pudo copiar la invitación: ${cause.message}` : 'No se pudo copiar la invitación.'
  }
}

async function updatePublicVisibility(event: Event) {
  if (!selectedAnimalId.value) return
  const enabled = (event.target as HTMLInputElement).checked
  clearMessages()
  try {
    const updated = await animalsApi.setPublicVisibility(selectedAnimalId.value, enabled)
    animals.value = [updated, ...animals.value.filter((animal) => animal.id !== updated.id)]
    notice.value = enabled
      ? 'La consulta pública quedó habilitada. Las fotografías adjuntas también serán visibles.'
      : 'La consulta pública quedó deshabilitada.'
    if (enabled) {
      try {
        const qr = await bioActaApi.getQr(selectedAnimalId.value)
        qrUrl.value = qr.publicUrl
        qrImage.value = qr.imageDataUrl
      } catch (cause) {
        error.value = cause instanceof Error ? `Se habilitó la vista pública, pero no se pudo generar el QR: ${cause.message}` : 'Se habilitó la vista pública, pero no se pudo generar el QR.'
      }
    } else {
      qrUrl.value = ''
      qrImage.value = ''
    }
  } catch (cause) {
    const target = event.target as HTMLInputElement
    target.checked = !enabled
    error.value = cause instanceof Error ? `No se pudo actualizar la visibilidad: ${cause.message}` : 'No se pudo actualizar la visibilidad.'
  }
}
</script>

<template>
  <main class="bioacta-page">
    <header class="bioacta-heading">
      <span class="pet-eyebrow"><PawPrint :size="14" />{{ heading[0] }}</span>
      <h1>{{ heading[1] }}</h1>
      <p>{{ heading[2] }}</p>
    </header>

    <nav v-if="!isPublicPage" class="bioacta-tabs" aria-label="Secciones principales de BIO-ACTA">
      <RouterLink v-if="!auth.user?.isAccessGuest" to="/bioacta/inicio">Inicio</RouterLink>
      <RouterLink v-if="!auth.user?.isAccessGuest || auth.user.accessGrant?.permissions.some((permission) => ['health:read', 'health:manage'].includes(permission))" :to="{ path: '/bioacta/salud', query: { animalId: selectedAnimalId } }">Salud</RouterLink>
      <RouterLink v-if="!auth.user?.isAccessGuest || auth.user.accessGrant?.permissions.includes('care:manage')" :to="{ path: '/bioacta/cuidados', query: { animalId: selectedAnimalId } }">Cuidados</RouterLink>
      <RouterLink v-if="!auth.user?.isAccessGuest" to="/bioacta/perdidos">Reencuentro</RouterLink>
      <details v-if="!auth.user?.isAccessGuest" class="bioacta-nav-more" :open="advancedSections.includes(section)">
        <summary>Otras secciones</summary>
        <div class="bioacta-nav-menu">
          <RouterLink to="/bioacta/compartir">Compartir acceso</RouterLink>
          <RouterLink to="/bioacta/custodia">Transferir custodia</RouterLink>
          <RouterLink to="/bioacta/qr">Consulta pública y QR</RouterLink>
          <RouterLink to="/bioacta/profesional">Espacio profesional</RouterLink>
          <RouterLink v-if="isAdmin" to="/bioacta/administracion">Administración</RouterLink>
        </div>
      </details>
    </nav>

    <label v-if="!isPublicPage && ['salud', 'cuidados', 'compartir', 'custodia', 'qr'].includes(section)" class="bioacta-animal-picker">
      <span>Expediente</span>
      <select v-model="selectedAnimalId" :disabled="loading || !animals.length">
        <option v-for="animal in animals" :key="animal.id" :value="animal.id">{{ animal.name || 'Sin nombre' }} · {{ animal.species }}</option>
        <option v-if="!animals.length" value="">Registra un animal primero</option>
      </select>
    </label>

    <p v-if="error" class="pet-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="pet-success" role="status"><Check :size="15" />{{ notice }}</p>
    <section v-if="loading" class="bioacta-loading" role="status"><Clock3 class="is-spinning" :size="18" />Cargando información…</section>

    <section v-else-if="section === 'inicio'" class="bioacta-overview">
      <section class="bioacta-guide" aria-labelledby="bioacta-guide-title">
        <div class="bioacta-guide-heading">
          <div>
            <span class="bioacta-section-label">TU ESPACIO DE CUIDADO</span>
            <h2 id="bioacta-guide-title">Empieza en tres pasos</h2>
            <p>No necesitas completarlo todo ahora. Puedes volver a cada parte cuando la necesites.</p>
          </div>
          <RouterLink class="button-primary bioacta-guide-cta" to="/animals">
            {{ animals.length ? 'Abrir mis animales' : 'Crear primera ficha' }}<ArrowRight :size="16" />
          </RouterLink>
        </div>
        <div class="bioacta-guide-steps">
          <RouterLink v-for="step in guideSteps" :key="step.number" class="bioacta-guide-step" :class="{ 'is-complete': step.complete }" :to="step.to">
            <span class="bioacta-step-number">{{ step.complete ? '✓' : step.number }}</span>
            <span class="bioacta-step-icon"><component :is="step.icon" :size="19" /></span>
            <span class="bioacta-step-copy">
              <span class="bioacta-step-status">{{ step.complete ? 'LISTO' : `PASO ${step.number}` }}</span>
              <strong>{{ step.title }}</strong>
              <span>{{ step.description }}</span>
              <b>{{ step.action }} <ArrowRight :size="14" /></b>
            </span>
          </RouterLink>
        </div>
      </section>

      <section class="bioacta-glance" aria-labelledby="bioacta-glance-title">
        <div class="bioacta-subsection-heading">
          <div><span class="bioacta-section-label">ACTIVIDAD</span><h2 id="bioacta-glance-title">Tu espacio en resumen</h2></div>
          <RouterLink to="/animals">Ver expedientes <ArrowRight :size="14" /></RouterLink>
        </div>
        <div class="bioacta-summary-grid" aria-label="Resumen de registros BIO-ACTA">
          <RouterLink class="bioacta-summary-card" to="/animals"><strong>{{ animals.length }}</strong><span>Animales</span></RouterLink>
          <RouterLink class="bioacta-summary-card" to="/bioacta/salud"><strong>{{ overviewSummary.healthRecords }}</strong><span>Eventos de salud</span></RouterLink>
          <RouterLink class="bioacta-summary-card" to="/bioacta/cuidados"><strong>{{ overviewSummary.activeCareSchedules }}</strong><span>Cuidados activos · {{ overviewSummary.dueCareSchedules }} por atender</span></RouterLink>
          <RouterLink class="bioacta-summary-card" to="/bioacta/perdidos"><strong>{{ overviewSummary.openReports }}</strong><span>Reportes abiertos · {{ overviewSummary.messages }} mensajes</span></RouterLink>
          <RouterLink class="bioacta-summary-card" to="/bioacta/compartir"><strong>{{ overviewSummary.activeAccessGrants }}</strong><span>Accesos vigentes</span></RouterLink>
          <RouterLink class="bioacta-summary-card" to="/bioacta/custodia"><strong>{{ overviewSummary.incomingTransfers + overviewSummary.outgoingTransfers }}</strong><span>Transferencias · {{ overviewSummary.incomingTransfers }} recibidas, {{ overviewSummary.outgoingTransfers }} enviadas</span></RouterLink>
        </div>
      </section>

      <details class="bioacta-tools">
        <summary><span><strong>Más herramientas</strong><small>Explora funciones adicionales cuando las necesites</small></span><ArrowRight :size="16" /></summary>
        <div class="bioacta-tools-links">
          <RouterLink to="/stories"><CalendarDays :size="18" /><span><strong>Línea de vida</strong><small>Historias y actividades de tus animales</small></span><ArrowRight :size="15" /></RouterLink>
          <RouterLink :to="publicQrAnimal ? { path: '/bioacta/qr', query: { animalId: publicQrAnimal.id } } : '/bioacta/qr'"><QrCode :size="18" /><span><strong>Consulta pública y QR</strong><small>{{ publicQrAnimal ? 'Consulta pública habilitada' : 'Controla qué información compartir' }}</small></span><ArrowRight :size="15" /></RouterLink>
          <RouterLink to="/bioacta/custodia"><UserPlus :size="18" /><span><strong>Transferir custodia</strong><small>Solicitudes recibidas: {{ overviewSummary.incomingTransfers }}</small></span><ArrowRight :size="15" /></RouterLink>
          <RouterLink to="/bioacta/profesional"><HeartPulse :size="18" /><span><strong>Espacio profesional</strong><small>Para veterinarias y refugios</small></span><ArrowRight :size="15" /></RouterLink>
          <RouterLink v-if="isAdmin" to="/bioacta/administracion"><ShieldCheck :size="18" /><span><strong>Administración</strong><small>Auditoría y catálogos</small></span><ArrowRight :size="15" /></RouterLink>
        </div>
      </details>

      <aside class="bioacta-principle"><ShieldCheck :size="19" /><p><strong>Tu información, bajo tu control.</strong> Los datos de salud se distinguen de las certificaciones y tú eliges qué información hacer pública.</p></aside>
    </section>

    <section v-else-if="section === 'salud'" class="bioacta-health-page">
      <header class="bioacta-health-welcome">
        <span class="bioacta-health-welcome-icon"><HeartPulse :size="22" /></span>
        <div>
          <span class="bioacta-section-label">HISTORIA Y PROCEDENCIA</span>
          <h2>Un registro claro, paso a paso</h2>
          <p>Conserva los eventos importantes y distingue la información declarada de la que cuenta con certificación profesional.</p>
        </div>
      </header>

      <div class="bioacta-health-summary" aria-label="Resumen del historial sanitario">
        <div class="bioacta-health-summary-item"><strong>{{ healthRecords.length }}</strong><span>{{ healthRecords.length === 1 ? 'evento en el historial' : 'eventos en el historial' }}</span></div>
        <span class="bioacta-health-summary-divider" aria-hidden="true"></span>
        <div class="bioacta-health-summary-item"><strong>{{ certifiedHealthCount }}</strong><span>{{ certifiedHealthCount === 1 ? 'registro certificado' : 'registros certificados' }}</span></div>
        <div v-if="selectedAnimal" class="bioacta-health-animal">
          <span class="bioacta-health-animal-avatar"><img v-if="selectedAnimal.photos[0]" :src="selectedAnimal.photos[0].url" :alt="selectedAnimal.photos[0].alt || ''" /><PawPrint v-else :size="17" /></span>
          <span><small>Expediente actual</small><strong>{{ selectedAnimal.name || 'Sin nombre' }} · {{ selectedAnimal.species }}</strong></span>
        </div>
      </div>

      <p v-if="auth.user?.isAccessGuest" class="bioacta-health-readonly"><ShieldCheck :size="17" /> Tienes acceso de solo consulta. Puedes revisar los registros autorizados, pero no modificarlos.</p>

      <div class="bioacta-health-layout">
        <form v-if="!auth.user?.isAccessGuest" class="bioacta-form bioacta-health-form" @submit.prevent="submitHealthRecord">
          <header class="bioacta-health-form-heading">
            <span class="bioacta-health-form-icon"><Plus :size="18" /></span>
            <span><h3>Registrar un evento</h3><p>Completa los datos disponibles; puedes volver a editarlos al crear otro registro.</p></span>
          </header>

          <section class="bioacta-health-form-step">
            <div class="bioacta-health-step-heading"><span>1</span><div><strong>¿Qué ocurrió?</strong><small>Elige una categoría y registra cuándo sucedió.</small></div></div>
            <div class="bioacta-health-fields">
              <label>Tipo de evento
                <select v-model="healthDraft.type"><option>Vacuna</option><option>Enfermedad</option><option>Alergia</option><option>Cirugía</option><option>Tratamiento</option><option>Medicamento</option><option>Otro</option></select>
              </label>
              <label>Fecha del evento<input v-model="healthDraft.date" type="date" required /></label>
            </div>
            <label>Descripción
              <textarea v-model="healthDraft.description" rows="3" maxlength="2000" required placeholder="Describe el evento con la información que tengas. Evita incluir datos personales innecesarios." />
              <small class="bioacta-health-helper">Este texto quedará asociado al expediente seleccionado.</small>
            </label>
          </section>

          <details class="bioacta-health-details">
            <summary><span><strong>Datos adicionales</strong><small>Producto, dosis, lote y próxima fecha indicada (opcionales)</small></span><ArrowRight :size="16" /></summary>
            <div class="bioacta-health-fields">
              <label>Producto o medicamento<input v-model="healthDraft.productName" maxlength="160" placeholder="Nombre comercial o genérico" /></label>
              <label>Dosis y unidad<input v-model="healthDraft.dose" maxlength="100" placeholder="Ej. 1 tableta" /></label>
              <label>Número de lote<input v-model="healthDraft.lotNumber" maxlength="100" placeholder="Si está disponible" /></label>
              <label>Próxima fecha indicada<input v-model="healthDraft.nextDueDate" type="date" /></label>
            </div>
          </details>

          <aside class="bioacta-health-disclaimer"><ShieldCheck :size="17" /><p><strong>Registro declarado, no certificado.</strong> La información que agregues no constituye una validación profesional. Solo el servidor puede asignar una certificación.</p></aside>
          <button class="button-primary bioacta-health-submit" type="submit" :disabled="saving || !selectedAnimalId">
            <Check v-if="!saving" :size="16" /><Clock3 v-else class="is-spinning" :size="16" />{{ saving ? 'Guardando registro…' : 'Guardar en el historial' }}
          </button>
        </form>

        <section class="bioacta-record-list bioacta-health-history" aria-labelledby="bioacta-health-history-title">
          <header class="bioacta-health-history-heading">
            <span class="bioacta-health-history-icon"><CalendarDays :size="18" /></span>
            <span><h3 id="bioacta-health-history-title">Historial sanitario</h3><small>Eventos ordenados del más reciente al más antiguo</small></span>
          </header>
          <div v-if="healthRecords.length" class="bioacta-health-timeline">
            <article v-for="record in healthRecords" :key="record.id" class="bioacta-health-event">
              <span class="bioacta-health-timeline-marker" aria-hidden="true"></span>
              <div class="bioacta-health-event-card">
                <div class="bioacta-health-event-meta">
                  <time>{{ new Date(`${record.date}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) }}</time>
                  <span :class="record.certified ? 'bioacta-badge bioacta-badge--verified' : 'bioacta-badge'">{{ record.certified ? 'Certificado' : 'Declarado' }}</span>
                </div>
                <h4>{{ record.type }}</h4>
                <p>{{ record.description }}</p>
                <div v-if="record.details.productName || record.details.dose || record.details.lotNumber || record.details.nextDueDate" class="bioacta-health-event-details">
                  <span v-if="record.details.productName"><strong>Producto</strong>{{ record.details.productName }}</span>
                  <span v-if="record.details.dose"><strong>Dosis</strong>{{ record.details.dose }}</span>
                  <span v-if="record.details.lotNumber"><strong>Lote</strong>{{ record.details.lotNumber }}</span>
                  <span v-if="record.details.nextDueDate"><strong>Próxima fecha indicada</strong>{{ new Date(`${record.details.nextDueDate}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) }}</span>
                </div>
                <small v-if="record.certified && record.professionalName" class="bioacta-health-professional">Validado por {{ record.professionalName }}</small>
              </div>
            </article>
          </div>
          <div v-else-if="!loading && !error" class="bioacta-health-empty">
            <span><HeartPulse :size="22" /></span>
            <strong>Este historial aún está por comenzar</strong>
            <p>{{ auth.user?.isAccessGuest ? 'No hay eventos sanitarios disponibles para esta ficha.' : 'Cuando registres una vacuna, tratamiento u otro evento, aparecerá aquí ordenado por fecha.' }}</p>
          </div>
        </section>
      </div>
    </section>

    <section v-else-if="section === 'cuidados'" class="bioacta-module">
      <form v-if="!auth.user?.isAccessGuest" class="bioacta-form" @submit.prevent="submitCareSchedule">
        <h2><Clock3 :size="18" /> Programar cuidado o medicamento</h2>
        <label>Nombre<input v-model="careDraft.name" maxlength="120" required placeholder="Ej. Medicamento" /></label>
        <label>Dosis y unidad<input v-model="careDraft.dose" maxlength="100" placeholder="Opcional" /></label>
        <label>Frecuencia<select v-model="careDraft.frequency"><option>Cada 12 horas</option><option>Diaria</option><option>Semanal</option><option>Mensual</option><option>Personalizada</option><option>Una vez</option></select></label>
        <template v-if="careDraft.frequency === 'Personalizada'">
          <label>Cada<input v-model.number="careDraft.intervalValue" type="number" min="1" max="365" required /></label>
          <label>Unidad<select v-model="careDraft.intervalUnit"><option value="hours">Horas</option><option value="days">Días</option><option value="weeks">Semanas</option></select></label>
        </template>
        <label>Próxima fecha y hora<input v-model="careDraft.nextAt" type="datetime-local" required /></label>
        <label>Zona horaria<input v-model="careDraft.timeZone" required /></label>
        <button class="button-primary" type="submit" :disabled="saving || !selectedAnimalId">{{ saving ? 'Guardando…' : 'Programar cuidado' }}</button>
      </form>
      <p v-else class="bioacta-form-note">Acceso temporal de solo consulta. Puedes revisar la información autorizada, pero no modificar el expediente.</p>
      <div class="bioacta-record-list">
        <h2>Programaciones y registro de dosis</h2>
        <article v-for="schedule in careSchedules" :key="schedule.id" class="bioacta-record">
          <time v-if="schedule.active">Próxima: {{ new Date(schedule.nextAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) }} · {{ schedule.timeZone }}</time>
          <time v-else>Programación finalizada</time>
          <strong>{{ schedule.name }}</strong><p>{{ schedule.dose || 'Sin dosis especificada' }} · {{ schedule.frequency === 'Personalizada' ? `Cada ${schedule.intervalValue} ${schedule.intervalUnit === 'hours' ? 'horas' : schedule.intervalUnit === 'days' ? 'días' : 'semanas'}` : schedule.frequency }}</p>
          <div v-if="schedule.active && !auth.user?.isAccessGuest" class="bioacta-action-row">
            <button class="button-secondary" type="button" @click="logDose(schedule)">Registrar administrada</button>
            <button class="button-secondary" type="button" @click="skipDose(schedule)">Registrar omitida</button>
          </div>
          <ul v-if="schedule.logs.length" class="care-dose-log">
            <li v-for="log in schedule.logs" :key="log.id"><strong>{{ log.result === 'administered' ? 'Administrada' : 'Omitida' }}</strong><span>{{ new Date(log.administeredAt).toLocaleString('es-MX') }} · {{ log.userName }}</span></li>
          </ul>
        </article>
        <p v-if="!loading && !careSchedules.length && !error" class="bioacta-empty">No hay cuidados programados.</p>
        <p class="bioacta-form-note">Las notificaciones dependen del dispositivo y no se garantizan cuando el navegador está cerrado.</p>
      </div>
    </section>

    <section v-else-if="section === 'perdidos'" :class="['bioacta-module', { 'bioacta-module--single': !isPublicReport }]">
      <form class="bioacta-form" @submit.prevent="submitReport">
        <h2>Crear reporte seguro</h2>
        <label>Tipo<select v-model="reportDraft.type"><option value="found">Encontré un animal</option><option value="lost">Mi animal está perdido</option></select></label>
        <label>Especie<input v-model="reportDraft.species" maxlength="80" required /></label>
        <label>Fecha<input v-model="reportDraft.date" type="date" required /></label>
        <label>Zona aproximada<input v-model="reportDraft.location" maxlength="180" required placeholder="Barrio o punto de referencia, no domicilio" /></label>
        <label>Descripción<textarea v-model="reportDraft.description" maxlength="1200" rows="3" required /></label>
        <label>Contacto privado<input v-model="reportDraft.contactMethod" maxlength="180" required placeholder="Dato de contacto, no se mostrará públicamente" /></label>
        <button class="button-primary" type="submit" :disabled="saving">{{ saving ? 'Enviando…' : 'Enviar reporte' }}</button>
        <p class="bioacta-form-note">El reporte no convierte a quien lo envía en propietario ni permite transferir custodia. El contacto se guarda en privado y no se muestra en la lista pública; los mensajes internos requieren una cuenta.</p>
        <p v-if="!auth.authenticated" class="bioacta-form-note">Los reportes anónimos no quedan vinculados a una bandeja: no podrás cambiar su estado ni recibir mensajes dentro de la plataforma. <RouterLink to="/login">Inicia sesión</RouterLink> antes de publicarlo si necesitas esas funciones.</p>
      </form>
      <div v-if="isPublicReport" class="bioacta-record-list">
        <h2>Reportes abiertos</h2>
        <article v-for="report in publicReports" :key="report.id" class="bioacta-record">
          <time>{{ report.type === 'lost' ? 'Perdido' : 'Encontrado' }} · {{ new Date(report.date).toLocaleDateString('es-MX') }}</time>
          <strong>{{ report.species }} · {{ report.location }}</strong><p>{{ report.description }}</p>
          <small>El sistema protege la información de contacto. No se publica el domicilio de quien reporta.</small>
          <template v-if="auth.authenticated && report.contactAvailable">
            <label class="bioacta-wide">Mensaje privado para la persona que publicó el reporte<textarea v-model="contactMessage" maxlength="1000" rows="2" placeholder="Describe cómo puedes ayudar; no incluyas datos sensibles." /></label>
            <button class="button-secondary" type="button" :disabled="contactingReportId === report.id || contactMessage.trim().length < 10" @click="sendContactRequest(report.id)">{{ contactingReportId === report.id ? 'Enviando…' : 'Enviar mensaje privado' }}</button>
          </template>
          <template v-else-if="auth.authenticated">
            <small>Este reporte no está vinculado a una cuenta y no puede recibir mensajes internos.</small>
          </template>
          <p v-else class="bioacta-form-note">Inicia sesión para enviar un mensaje privado a quien reportó.</p>
        </article>
        <p v-if="!publicReports.length" class="bioacta-empty">Aún no hay reportes abiertos.</p>
      </div>
      <div v-else-if="auth.authenticated" class="bioacta-record-list">
        <h2>Mis reportes</h2>
        <article v-for="report in myLostFoundReports" :key="report.id" class="bioacta-record">
          <time>{{ report.type === 'lost' ? 'Perdido' : 'Encontrado' }} · {{ new Date(report.date).toLocaleDateString('es-MX') }} · {{ report.status === 'open' ? 'Abierto' : report.status === 'resolved' ? 'Resuelto' : 'Cerrado' }}</time>
          <strong>{{ report.species }} · {{ report.location }}</strong><p>{{ report.description }}</p>
          <p>Contacto privado: {{ report.contactMethod }}</p>
          <div class="bioacta-action-row">
            <button v-if="report.status !== 'open'" class="button-secondary" type="button" @click="updateReportStatus(report.id, 'open')">Reabrir</button>
            <button v-if="report.status === 'open'" class="button-secondary" type="button" @click="updateReportStatus(report.id, 'resolved')">Marcar resuelto</button>
            <button v-if="report.status !== 'closed'" class="button-secondary" type="button" @click="updateReportStatus(report.id, 'closed')">Cerrar reporte</button>
          </div>
        </article>
        <p v-if="!myLostFoundReports.length" class="bioacta-empty">Aún no tienes reportes asociados a tu cuenta.</p>
        <h2>Mensajes privados recibidos</h2>
        <article v-for="message in lostFoundMessages" :key="message.id" class="bioacta-record">
          <time>{{ new Date(message.createdAt).toLocaleString('es-MX') }} · {{ message.isOutgoing ? `Tú → ${message.recipientName}` : `${message.senderName} → tú` }}</time>
          <strong>{{ message.reportType === 'lost' ? 'Reporte de animal perdido' : 'Reporte de animal encontrado' }} · {{ message.species }}</strong>
          <p>{{ message.message }}</p>
          <label class="bioacta-wide">Responder<textarea v-model="replyDrafts[message.threadId]" maxlength="1000" rows="2" /></label>
          <button class="button-secondary" type="button" :disabled="contactingReportId === message.reportId || (replyDrafts[message.threadId]?.trim().length || 0) < 10" @click="sendContactRequest(message.reportId, message.threadId)">{{ contactingReportId === message.reportId ? 'Enviando…' : 'Enviar respuesta privada' }}</button>
        </article>
        <p v-if="!lostFoundMessages.length" class="bioacta-empty">No tienes mensajes de contacto pendientes.</p>
      </div>
    </section>

    <section v-else-if="section === 'compartir'" class="bioacta-module bioacta-share-module">
      <form class="bioacta-form bioacta-share-form" @submit.prevent="submitGrant">
        <header class="bioacta-share-intro">
          <span class="bioacta-share-icon"><ShieldCheck :size="20" /></span>
          <span class="bioacta-share-title">
            <span class="bioacta-share-kicker">ACCESO SEGURO</span>
            <h2>Invita a alguien de confianza</h2>
            <p>Elige quién puede entrar y qué información verá. Tú mantienes el control y puedes cambiar estos permisos en cualquier momento.</p>
          </span>
        </header>

        <section class="bioacta-share-step">
          <div class="bioacta-share-step-heading">
            <span class="bioacta-share-step-number">1</span>
            <span><strong>Datos de la invitación</strong><small>Solo esa persona podrá usar este acceso.</small></span>
          </div>
          <label>Correo de la persona autorizada<input v-model="grantDraft.recipient" type="email" maxlength="180" autocomplete="email" required placeholder="nombre@correo.com" /></label>
          <label>Contraseña temporal
            <input v-model="grantDraft.password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required placeholder="Crea una contraseña de al menos 10 caracteres" />
            <small class="bioacta-field-help">Compártela por un canal privado distinto a la invitación.</small>
          </label>
          <label>Tipo de acceso
            <select v-model="grantDraft.role"><option>Cuidador</option><option>Veterinario</option><option>Refugio</option><option>Hogar temporal</option><option>Rescatista</option></select>
          </label>
        </section>

        <AnimalScopePicker
          v-model:selected-ids="grantDraft.animalIds"
          v-model:all-animals="grantDraft.allAnimals"
          :animals="animals"
        />

        <fieldset class="bioacta-share-info">
          <legend><span class="animal-scope-step">3</span> Decide qué información verá</legend>
          <p class="bioacta-share-info-note">La identidad básica siempre está disponible. Los demás datos se habilitan por separado.</p>
          <div class="bioacta-share-info-options">
            <div class="bioacta-share-info-option is-included">
              <span class="bioacta-share-info-icon"><PawPrint :size="17" /></span>
              <span><strong>Identidad básica</strong><small>Nombre, especie y datos de identificación</small></span>
              <span class="bioacta-share-included">Incluida</span>
            </div>
            <label class="bioacta-share-info-option" :class="{ 'is-enabled': grantDraft.permissions.includes('health:read') }">
              <input v-model="grantDraft.permissions" type="checkbox" value="health:read" />
              <span class="bioacta-share-info-icon"><HeartPulse :size="17" /></span>
              <span><strong>Salud</strong><small>Historial y registros sanitarios</small></span>
              <Check v-if="grantDraft.permissions.includes('health:read')" :size="15" class="bioacta-share-info-check" aria-hidden="true" />
            </label>
            <label class="bioacta-share-info-option" :class="{ 'is-enabled': grantDraft.permissions.includes('care:read') }">
              <input v-model="grantDraft.permissions" type="checkbox" value="care:read" />
              <span class="bioacta-share-info-icon"><CalendarDays :size="17" /></span>
              <span><strong>Cuidados</strong><small>Rutinas y registros de administración</small></span>
              <Check v-if="grantDraft.permissions.includes('care:read')" :size="15" class="bioacta-share-info-check" aria-hidden="true" />
            </label>
          </div>
        </fieldset>

        <section class="bioacta-share-expiry">
          <div class="bioacta-share-step-heading">
            <span class="bioacta-share-step-number">4</span>
            <span><strong>Vigencia del acceso</strong><small>Sin fecha, seguirá vigente hasta que lo revoques.</small></span>
          </div>
          <label>Fecha de expiración (opcional)<input v-model="grantDraft.expiresAt" type="date" /></label>
        </section>
        <div class="bioacta-share-submit">
          <p><ShieldCheck :size="14" /> Acceso de solo consulta. Puedes revocarlo cuando quieras.</p>
          <button class="button-primary" type="submit" :disabled="saving || !selectedAnimalId || (!grantDraft.allAnimals && !grantDraft.animalIds.length)">
            <ShieldCheck :size="16" /> {{ saving ? 'Creando acceso…' : 'Crear acceso seguro' }}
          </button>
        </div>
      </form>
      <div class="bioacta-record-list bioacta-share-grants">
        <header class="bioacta-share-grants-heading">
          <span class="bioacta-share-grants-icon"><UserPlus :size="18" /></span>
          <span><h2>Accesos compartidos</h2><small>Administra invitaciones y permisos activos.</small></span>
          <span v-if="accessGrants.filter((grant) => !grant.revokedAt).length" class="bioacta-share-count">{{ accessGrants.filter((grant) => !grant.revokedAt).length }}</span>
        </header>
        <article v-for="grant in accessGrants" :key="grant.id" class="bioacta-record bioacta-share-grant" :class="{ 'is-revoked': grant.revokedAt }">
          <div class="bioacta-share-grant-heading">
            <span class="bioacta-share-recipient-avatar"><UserPlus :size="17" /></span>
            <span><strong>{{ grant.recipient }}</strong><small>{{ grant.role }}</small></span>
            <span class="bioacta-share-status" :class="{ 'is-revoked': grant.revokedAt }">{{ grant.revokedAt ? 'Revocado' : 'Activo' }}</span>
          </div>
          <p>Animales: {{ grantScopeLabel(grant) }}</p>
          <p>Información: {{ grantPermissionLabels(grant.permissions).join(', ') }}</p>
          <small>{{ grant.expiresAt ? `Expira ${new Date(grant.expiresAt).toLocaleDateString('es-MX')}` : 'Sin fecha de expiración' }}</small>
          <small v-if="!grant.revokedAt && !grant.passwordProtected" class="bioacta-form-note">Acceso anterior sin contraseña. Revócalo y crea uno nuevo para requerir una contraseña.</small>
          <form v-if="editingGrantId === grant.id" class="bioacta-access-editor" @submit.prevent="saveGrantEdits(grant)">
            <AnimalScopePicker
              v-model:selected-ids="grantEditDraft.animalIds"
              v-model:all-animals="grantEditDraft.allAnimals"
              :animals="animals"
            />
            <fieldset class="bioacta-share-info bioacta-share-info--editor">
              <legend>Información visible</legend>
              <div class="bioacta-share-info-options">
                <div class="bioacta-share-info-option is-included"><span class="bioacta-share-info-icon"><PawPrint :size="17" /></span><span><strong>Identidad básica</strong><small>Siempre disponible</small></span><span class="bioacta-share-included">Incluida</span></div>
                <label class="bioacta-share-info-option" :class="{ 'is-enabled': grantEditDraft.permissions.includes('health:read') }">
                  <input v-model="grantEditDraft.permissions" type="checkbox" value="health:read" />
                  <span class="bioacta-share-info-icon"><HeartPulse :size="17" /></span><span><strong>Salud</strong><small>Historial y registros sanitarios</small></span>
                  <Check v-if="grantEditDraft.permissions.includes('health:read')" :size="15" class="bioacta-share-info-check" aria-hidden="true" />
                </label>
                <label class="bioacta-share-info-option" :class="{ 'is-enabled': grantEditDraft.permissions.includes('care:read') }">
                  <input v-model="grantEditDraft.permissions" type="checkbox" value="care:read" />
                  <span class="bioacta-share-info-icon"><CalendarDays :size="17" /></span><span><strong>Cuidados</strong><small>Rutinas y registros de administración</small></span>
                  <Check v-if="grantEditDraft.permissions.includes('care:read')" :size="15" class="bioacta-share-info-check" aria-hidden="true" />
                </label>
              </div>
            </fieldset>
            <label>Rol<select v-model="grantEditDraft.role"><option>Cuidador</option><option>Veterinario</option><option>Refugio</option><option>Hogar temporal</option><option>Rescatista</option></select></label>
            <label>Expira el<input v-model="grantEditDraft.expiresAt" type="date" /></label>
            <label>Contraseña nueva (opcional)<input v-model="grantEditDraft.password" type="password" minlength="10" maxlength="128" autocomplete="new-password" placeholder="Déjala vacía para conservarla" /></label>
            <div class="bioacta-action-row">
              <button class="button-primary" type="submit" :disabled="saving || (!grantEditDraft.allAnimals && !grantEditDraft.animalIds.length)">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
              <button class="button-secondary" type="button" @click="editingGrantId = ''">Cancelar</button>
            </div>
          </form>
          <div v-if="!grant.revokedAt" class="bioacta-action-row">
            <button v-if="grant.passwordProtected" class="button-secondary" type="button" @click="copyAccessInvite(grant)">Copiar invitación</button>
            <button class="button-secondary" type="button" @click="editGrant(grant)">Editar permisos</button>
            <button class="button-secondary" type="button" @click="revokeGrant(grant)">Revocar acceso</button>
          </div>
        </article>
        <p v-if="!loading && !accessGrants.length && !error" class="bioacta-empty">No hay accesos compartidos.</p>
      </div>
    </section>

    <section v-else-if="section === 'qr'" class="bioacta-module bioacta-module--single">
      <div class="bioacta-qr-card">
        <img v-if="qrImage" :src="qrImage" alt="Código QR de consulta pública de la Bio-Acta" />
        <span v-else class="bioacta-qr-placeholder"><QrCode :size="52" /></span>
        <div><h2>{{ selectedAnimal?.name || 'Selecciona un animal' }}</h2><p>El código contiene únicamente un enlace con el identificador público, nunca datos personales.</p>
          <a v-if="qrUrl" :href="qrUrl" target="_blank" rel="noopener noreferrer">{{ qrUrl }}</a>
          <button v-if="qrUrl" class="button-secondary" type="button" @click="copyPublicUrl">Copiar enlace público</button>
          <label class="bioacta-public-toggle"><input :checked="selectedAnimal?.publicEnabled" type="checkbox" @change="updatePublicVisibility" /> Habilitar consulta pública de datos básicos y fotografías adjuntas</label>
          <p v-if="!qrUrl" class="bioacta-form-note">Habilita la vista pública para generar un enlace seguro y su QR. La información pública se filtra en el servidor.</p>
        </div>
      </div>
    </section>

    <section v-else-if="section === 'custodia'" class="bioacta-module">
      <form class="bioacta-form" @submit.prevent="submitTransfer">
        <h2><UserPlus :size="18" /> Solicitar transferencia</h2>
        <p class="bioacta-form-note">La otra persona debe tener una cuenta y aceptar la solicitud. Al aceptar, se revocan los accesos compartidos existentes para que el nuevo responsable vuelva a concederlos de forma consciente.</p>
        <label>Correo de la persona receptora<input v-model="transferRecipient" type="email" maxlength="180" required /></label>
        <button class="button-primary" type="submit" :disabled="saving || !selectedAnimalId">{{ saving ? 'Enviando…' : 'Enviar solicitud' }}</button>
      </form>
      <div class="bioacta-record-list">
        <h2>Solicitudes recibidas</h2>
        <article v-for="transfer in incomingTransfers" :key="transfer.id" class="bioacta-record"><strong>{{ transfer.animalName || 'Sin nombre' }} · {{ transfer.species }}</strong><p>Enviada por {{ transfer.fromEmail }} · {{ new Date(transfer.createdAt).toLocaleDateString('es-MX') }}</p><button class="button-secondary" type="button" @click="acceptTransfer(transfer.id)">Aceptar custodia</button></article>
        <p v-if="!incomingTransfers.length" class="bioacta-empty">No tienes solicitudes de custodia pendientes.</p>
        <h2>Solicitudes enviadas</h2>
        <article v-for="transfer in outgoingTransfers" :key="transfer.id" class="bioacta-record"><strong>{{ transfer.animalName || 'Sin nombre' }} · {{ transfer.species }}</strong><p>Pendiente de aceptación por {{ transfer.recipientEmail }} · {{ new Date(transfer.createdAt).toLocaleDateString('es-MX') }}</p><button class="button-secondary" type="button" @click="cancelTransfer(transfer.id)">Cancelar solicitud</button></article>
        <p v-if="!outgoingTransfers.length" class="bioacta-empty">No tienes solicitudes enviadas pendientes.</p>
      </div>
    </section>

    <section v-else-if="section === 'profesional'" class="bioacta-module bioacta-module--single">
      <div class="bioacta-status-card"><UserPlus :size="22" /><h2>Herramientas profesionales</h2><p>El registro certificado requiere autenticación profesional, verificación de credenciales y permisos del servidor. No se permite marcar como certificado un dato desde esta vista de cuidador.</p><template v-if="professionalSummary"><p>Organización: {{ professionalSummary.organizationName || 'Sin organización' }}</p><p>Animales vinculados: {{ professionalSummary.animalCount }} · Certificaciones pendientes: {{ professionalSummary.pendingCertifications }}</p><p>{{ professionalSummary.verifiedProfessional ? 'Perfil profesional verificado' : 'Perfil profesional pendiente de verificación' }}</p></template><RouterLink class="button-secondary" to="/bioacta/salud">Consultar registros sanitarios</RouterLink></div>
      <p class="bioacta-form-note">La suscripción profesional es una hipótesis comercial pendiente de validación; no se activa ninguna compra desde esta pantalla.</p>
    </section>

    <section v-else-if="section === 'administracion'" class="bioacta-module bioacta-module--single">
      <div v-if="isAdmin" class="bioacta-status-card"><ShieldCheck :size="22" /><h2>Auditoría y catálogos</h2><p>Esta vista solo se ofrece a cuentas administradoras. Las acciones y permisos también deben validarse en el servidor.</p><div v-for="entry in auditLogs" :key="entry.id" class="bioacta-audit-entry"><strong>{{ entry.action }} · {{ entry.entityType }}</strong><small>{{ entry.actor }} · {{ new Date(entry.createdAt).toLocaleString('es-MX') }}</small></div><p v-if="!auditLogs.length && !error" class="bioacta-form-note">No hay eventos de auditoría disponibles.</p><p class="bioacta-form-note">El registro BIO-ACTA es privado digital y no representa un documento gubernamental oficial.</p></div>
      <p v-else class="pet-error" role="alert">No tienes permiso para consultar la administración.</p>
    </section>

    <section v-else-if="section === 'public'" class="bioacta-public-record">
      <template v-if="publicRecord">
        <img v-for="photo in publicRecord.photos" :key="photo.url" class="bioacta-public-photo" :src="photo.url" :alt="photo.alt || `Fotografía de ${publicRecord.name || publicRecord.species}`" />
        <h2>{{ publicRecord.name || 'Animal sin nombre' }}</h2>
        <p>{{ publicRecord.species }}<span v-if="publicRecord.sex"> · {{ publicRecord.sex }}</span></p>
        <dl><div v-if="publicRecord.estimatedAge"><dt>Edad estimada</dt><dd>{{ publicRecord.estimatedAge }}</dd></div><div v-if="publicRecord.physicalDescription"><dt>Señas físicas</dt><dd>{{ publicRecord.physicalDescription }}</dd></div></dl>
        <section v-if="publicRecord.publicHealthSummary" class="bioacta-public-summary"><h3>Información sanitaria autorizada</h3><p>{{ publicRecord.publicHealthSummary }}</p></section>
        <p class="bioacta-form-note"><ShieldCheck :size="14" /> Se muestra solo la información autorizada. No se publican domicilios ni datos de contacto.</p>
      </template>
    </section>
  </main>
</template>

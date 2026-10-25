<script setup lang="ts">
import { onUnmounted, reactive, ref, watch } from 'vue'
import axios from 'axios'
import { ArrowLeft, ArrowRight, Eye, EyeOff, PawPrint } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { loginSchema } from '../modules/auth/services/authApi'
import { useBrandStore } from '../modules/brand/stores/brand'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const brand = useBrandStore()
const auth = useAuthStore()
const accessInvite = typeof route.query.next === 'string'
  ? route.query.next.match(/^\/bioacta\/acceso\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\?|$)/i)
  : null
const isAccessInvite = Boolean(accessInvite)
const loginMode = ref<'account' | 'temporary'>(isAccessInvite ? 'temporary' : 'account')
const grantReference = ref(accessInvite?.[1] ?? '')
const form = reactive({ email: typeof route.query.email === 'string' ? route.query.email : '', password: '' })
const fieldErrors = reactive<Record<string, string>>({})
const serverError = ref('')
const loading = ref(false)
const passwordVisible = ref(false)

watch([loginMode, () => brand.name], ([mode, brandName]) => {
  document.title = `${brandName} · ${mode === 'temporary' ? 'Acceso temporal' : 'Cuenta personal'}`
}, { immediate: true })

onUnmounted(() => {
  document.title = `${brand.name} · Su identidad lo acompaña`
})

function getGrantId(value: string) {
  const match = value.trim().match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  return match?.[0]
}

async function submit() {
  Object.keys(fieldErrors).forEach((key) => delete fieldErrors[key])
  serverError.value = ''
  const result = loginSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      if (!fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return
  }

  loading.value = true
  try {
    if (loginMode.value === 'temporary') {
      const grantId = getGrantId(grantReference.value)
      if (!grantId) {
        serverError.value = 'Pega el enlace de invitación o el identificador del acceso temporal.'
        return
      }
      await auth.loginAccessGrant(grantId, result.data.email, result.data.password)
    } else {
      await auth.login(result.data.email, result.data.password)
    }
    const authenticated = auth.authenticated
    if (!authenticated) {
      serverError.value = 'No pudimos confirmar tu sesión. Comprueba que el backend tenga implementado GET /auth/me.'
      return
    }
    if (auth.user?.isAccessGuest && auth.user.accessGrant) {
      const { permissions } = auth.user.accessGrant
      const animalId = auth.user.accessGrant.animalIds[0] ?? auth.user.accessGrant.animalId
      const query = { animalId }
      if (permissions.includes('health:read') || permissions.includes('health:manage')) {
        await router.replace({ path: '/bioacta/salud', query })
      } else if (permissions.includes('care:read') || permissions.includes('care:manage')) {
        await router.replace({ path: '/bioacta/cuidados', query })
      } else {
        await router.replace({ name: 'animal-detail', params: { animalId } })
      }
      return
    }
    const destination = typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//')
      ? route.query.next
      : '/home'
    await router.replace(destination)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      serverError.value = loginMode.value === 'temporary'
        ? 'El correo o la contraseña temporal no corresponden a esta invitación, o el acceso venció o fue revocado.'
        : 'El correo o la contraseña no son correctos.'
    } else if (axios.isAxiosError(error) && error.response?.status === 409 && loginMode.value === 'temporary') {
      serverError.value = 'Este acceso coincide con varias invitaciones. Usa el enlace de invitación completo que recibiste.'
    } else if (axios.isAxiosError(error) && error.response?.status === 404) {
      serverError.value = 'El inicio de sesión todavía no está disponible en el backend.'
    } else if (axios.isAxiosError(error) && !error.response) {
      serverError.value = 'No pudimos conectar con el servidor. Inténtalo de nuevo más tarde.'
    } else {
      serverError.value = 'No pudimos iniciar sesión. Inténtalo de nuevo.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <aside class="login-art"><div class="login-art-image"></div><div class="login-art-overlay"></div><RouterLink class="login-brand" to="/" aria-label="BIO-ACTA"><span class="brand-mark"><PawPrint :size="18" /></span><span class="brand-name">BIO-ACTA</span></RouterLink><div class="login-art-copy"><span class="public-eyebrow">SU HISTORIA CONTINÚA</span><h1>Su identidad<br />permanece.</h1><p>Vuelve al espacio de cuidado y a los registros de tus animales.</p></div></aside>
    <section class="login-main">
      <RouterLink class="login-back" to="/"><ArrowLeft :size="15" /> Volver al inicio</RouterLink>
      <div class="login-form-wrap"><span class="public-eyebrow dark"><span class="tiny-dot"></span> {{ loginMode === 'temporary' ? 'ACCESO COMPARTIDO' : 'CUENTA CUIDADORA' }}</span><h2>{{ loginMode === 'temporary' ? 'Abrir expediente compartido' : 'Iniciar sesión' }}</h2><p>{{ loginMode === 'temporary' ? 'Ingresa con el correo autorizado y la contraseña temporal que recibiste.' : 'Continúa con la identidad y la historia de tus animales.' }}</p>
        <div class="login-mode-switch" role="group" aria-label="Tipo de acceso">
          <button type="button" :aria-pressed="loginMode === 'account'" :class="{ 'is-active': loginMode === 'account' }" @click="loginMode = 'account'; serverError = ''">Cuenta personal</button>
          <button type="button" :aria-pressed="loginMode === 'temporary'" :class="{ 'is-active': loginMode === 'temporary' }" @click="loginMode = 'temporary'; serverError = ''">Acceso temporal</button>
        </div>
        <p v-if="loginMode === 'temporary'" class="login-invite-note" role="note">No necesitas crear una cuenta. Este acceso dura hasta 8 horas y solo permite consultar el expediente y la información autorizada.</p>
        <p v-if="route.query.registered === '1'" class="login-registration-success" role="status">Tu cuenta se creó correctamente. Inicia sesión para continuar.</p>
        <form class="login-form" @submit.prevent="submit" novalidate>
          <template v-if="loginMode === 'temporary'">
            <label for="login-grant-reference">Enlace o identificador de invitación</label><input id="login-grant-reference" v-model="grantReference" autocomplete="off" placeholder="Pega aquí la invitación que recibiste" required />
          </template>
          <label for="login-email">Correo electrónico</label><input id="login-email" v-model="form.email" type="email" autocomplete="email" placeholder="tu@correo.com" :aria-invalid="!!fieldErrors.email" />
          <small v-if="fieldErrors.email" class="login-error">{{ fieldErrors.email }}</small>
          <label for="login-password">{{ loginMode === 'temporary' ? 'Contraseña temporal del acceso' : 'Contraseña' }}</label><div class="login-password"><input id="login-password" v-model="form.password" :type="passwordVisible ? 'text' : 'password'" autocomplete="current-password" :placeholder="loginMode === 'temporary' ? 'Contraseña que te compartieron' : 'Tu contraseña'" :aria-invalid="!!fieldErrors.password" /><button type="button" :aria-label="passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="passwordVisible = !passwordVisible"><EyeOff v-if="passwordVisible" :size="16" /><Eye v-else :size="16" /></button></div>
          <small v-if="fieldErrors.password" class="login-error">{{ fieldErrors.password }}</small>
          <p v-if="serverError" class="login-server-error" role="alert">{{ serverError }}</p>
          <button class="login-submit" type="submit" :disabled="loading"><span>{{ loading ? 'Verificando…' : loginMode === 'temporary' ? 'Abrir expediente' : 'Entrar a mi espacio' }}</span><ArrowRight :size="16" /></button>
        </form>
        <p v-if="loginMode === 'account'" class="login-register">¿Todavía no tienes cuenta? <RouterLink :to="{ name: 'register', query: { email: form.email || undefined, next: route.query.next } }">Crear cuenta cuidadora</RouterLink></p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page { min-height: 100vh; display: grid; grid-template-columns: minmax(360px, .9fr) minmax(440px, 1.1fr); background: var(--canvas); }
.login-art { position: relative; min-height: 100vh; overflow: hidden; color: white; background: #173e36; }
.login-art-image, .login-art-overlay { position: absolute; inset: 0; }
.login-art-image { background: url('https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1400&q=88') center/cover; }
.login-art-overlay { background: linear-gradient(180deg, rgba(20,48,39,.22), rgba(16,43,36,.8)); }
.login-brand { position: absolute; z-index: 1; top: 25px; left: 30px; display: inline-flex; align-items: center; gap: 10px; }
.login-art-copy { position: absolute; z-index: 1; right: 30px; bottom: 14%; left: 9%; }
.login-art-copy h1 { margin: 12px 0 8px; color: white; font-family: 'Newsreader', Georgia, serif; font-size: clamp(44px, 5vw, 66px); font-weight: 500; line-height: .98; }
.login-art-copy p { color: rgba(255,255,255,.82); font-family: 'Newsreader', Georgia, serif; font-size: 17px; }
.login-main { min-height: 100vh; display: flex; flex-direction: column; padding: 25px clamp(25px, 7vw, 100px) 30px; background: radial-gradient(ellipse at 80% 10%, rgba(225,232,218,.7), transparent 28rem), var(--canvas); }
.login-back { display: inline-flex; align-items: center; gap: 6px; color: #7e8b81; font-size: 10px; font-weight: 600; }
.login-form-wrap { width: min(100%, 440px); align-self: center; margin: auto 0; padding: 36px; border: 1px solid rgba(228,222,210,.9); border-radius: 22px; background: var(--paper); box-shadow: var(--shadow); }
.login-form-wrap > .public-eyebrow { color: #718477; }
.login-form-wrap h2 { margin: 9px 0 4px; color: var(--ink); font-family: 'Newsreader', Georgia, serif; font-size: 35px; font-weight: 500; }
.login-form-wrap > p { margin: 0 0 21px; color: #7d897f; font-size: 11px; }
.login-mode-switch { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 17px 0; padding: 4px; border: 1px solid #dce6df; border-radius: 10px; background: #f4f6f1; }
.login-mode-switch button { min-height: 38px; border: 0; border-radius: 7px; color: #66756c; background: transparent; cursor: pointer; font: inherit; font-size: 10px; font-weight: 700; }
.login-mode-switch button.is-active { color: #245b49; background: white; box-shadow: 0 1px 4px rgba(32, 54, 51, .12); }
.login-form-wrap > .login-invite-note { margin: 0 0 16px; padding: 10px 12px; border: 1px solid #d6e5dc; border-radius: 6px; color: #456353; background: #f1f7f2; font-size: 10px; line-height: 1.6; }
.login-invite-note a { color: #216d55; font-weight: 700; text-decoration: underline; }
.login-form-wrap > .login-registration-success { margin: 0 0 16px; padding: 10px 12px; border: 1px solid #cfe1d0; border-radius: 4px; color: #37634a; background: #eef6ed; font-size: 10px; line-height: 1.5; }
.login-form { display: grid; gap: 8px; }
.login-form > label { margin-top: 8px; color: #536158; font-size: 10px; font-weight: 700; }
.login-form > input, .login-password { width: 100%; height: 46px; border: 1px solid var(--line); border-radius: 9px; background: #fff; }
.login-form > input { padding: 0 10px; color: #29372f; font-size: 11px; }
.login-password { display: flex; align-items: center; }
.login-password input { width: 100%; height: 100%; padding: 0 10px; border: 0; outline: 0; background: transparent; font-size: 11px; }
.login-password button { width: 40px; height: 40px; display: grid; flex: 0 0 auto; place-items: center; border: 0; color: #88958b; background: transparent; cursor: pointer; }
.login-error { color: #b45244; font-size: 9px; }
.login-server-error { margin: 3px 0; padding: 9px; border: 1px solid #f0d5cf; border-radius: 4px; color: #a94d41; background: #fcf3f1; font-size: 10px; line-height: 1.5; }
.login-submit { min-height: 47px; display: flex; align-items: center; justify-content: space-between; margin-top: 9px; padding: 0 15px; border: 0; border-radius: 10px; color: white; background: var(--green); box-shadow: 0 6px 16px rgba(40,107,85,.18); cursor: pointer; font-size: 11px; font-weight: 700; transition: background .18s, transform .18s; }
.login-submit:hover { background: var(--green-deep); transform: translateY(-1px); }
.login-submit:disabled { opacity: .65; cursor: wait; }
.login-register { margin: 17px 0 8px !important; color: #828e85; font-size: 10px !important; text-align: center; }
.login-register a, .login-explore { color: #397459; font-weight: 700; }
.login-explore { display: block; font-size: 10px; text-align: center; }
@media (max-width: 780px) { .login-page { grid-template-columns: 1fr; } .login-art { display: none; } .login-main { min-height: 100vh; padding: 18px 23px 28px; } .login-form-wrap { margin: auto 0; padding: 28px 24px; border-radius: 18px; } }
</style>
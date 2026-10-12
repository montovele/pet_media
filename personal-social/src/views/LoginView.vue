<script setup lang="ts">
import { reactive, ref } from 'vue'
import axios from 'axios'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-vue-next'
import { useRoute, useRouter } from 'vue-router'
import { loginSchema } from '../modules/auth/services/authApi'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const form = reactive({ email: typeof route.query.email === 'string' ? route.query.email : '', password: '' })
const fieldErrors = reactive<Record<string, string>>({})
const serverError = ref('')
const loading = ref(false)
const passwordVisible = ref(false)

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
    const authenticated = await auth.login(result.data.email, result.data.password)
    if (!authenticated) {
      serverError.value = 'No pudimos confirmar tu sesión. Comprueba que el backend tenga implementado GET /auth/me.'
      return
    }
    const destination = typeof route.query.next === 'string' && route.query.next.startsWith('/') && !route.query.next.startsWith('//')
      ? route.query.next
      : '/home'
    await router.replace(destination)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      serverError.value = 'El correo o la contraseña no son correctos.'
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
    <aside class="login-art"><div class="login-art-image"></div><div class="login-art-overlay"></div><RouterLink class="login-brand" to="/"><span class="brand-mark"><Sparkles :size="18" /></span><span class="brand-name">entre<span>momentos</span></span></RouterLink><div class="login-art-copy"><span class="public-eyebrow">QUÉ BUENO TENERTE DE VUELTA</span><h1>Tus días siguen<br />aquí.</h1><p>Vuelve a tus historias, tus fotos y tu gente.</p></div></aside>
    <section class="login-main">
      <RouterLink class="login-back" to="/"><ArrowLeft :size="15" /> Volver al inicio</RouterLink>
      <div class="login-form-wrap"><span class="public-eyebrow dark"><span class="tiny-dot"></span> TU ESPACIO PERSONAL</span><h2>Iniciar sesión</h2><p>Continúa donde dejaste tus recuerdos.</p>
        <p v-if="route.query.registered === '1'" class="login-registration-success" role="status">Tu cuenta se creó correctamente. Inicia sesión para continuar.</p>
        <form class="login-form" @submit.prevent="submit" novalidate>
          <label for="login-email">Correo electrónico</label><input id="login-email" v-model="form.email" type="email" autocomplete="email" placeholder="tu@correo.com" :aria-invalid="!!fieldErrors.email" />
          <small v-if="fieldErrors.email" class="login-error">{{ fieldErrors.email }}</small>
          <label for="login-password">Contraseña</label><div class="login-password"><input id="login-password" v-model="form.password" :type="passwordVisible ? 'text' : 'password'" autocomplete="current-password" placeholder="Tu contraseña" :aria-invalid="!!fieldErrors.password" /><button type="button" :aria-label="passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="passwordVisible = !passwordVisible"><EyeOff v-if="passwordVisible" :size="16" /><Eye v-else :size="16" /></button></div>
          <small v-if="fieldErrors.password" class="login-error">{{ fieldErrors.password }}</small>
          <p v-if="serverError" class="login-server-error" role="alert">{{ serverError }}</p>
          <button class="login-submit" type="submit" :disabled="loading"><span>{{ loading ? 'Entrando…' : 'Entrar a mi espacio' }}</span><ArrowRight :size="16" /></button>
        </form>
        <p class="login-register">¿Todavía no tienes cuenta? <RouterLink to="/register">Crear una cuenta</RouterLink></p>
        <RouterLink class="login-explore" to="/explore">O sigue explorando sin cuenta</RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page { min-height: 100vh; display: grid; grid-template-columns: minmax(360px, .9fr) minmax(440px, 1.1fr); background: #f8f9f5; }
.login-art { position: relative; min-height: 100vh; overflow: hidden; color: white; background: #36523f; }
.login-art-image, .login-art-overlay { position: absolute; inset: 0; }
.login-art-image { background: url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=88') center/cover; }
.login-art-overlay { background: linear-gradient(180deg, rgba(28,47,34,.3), rgba(24,42,31,.68)); }
.login-brand { position: absolute; z-index: 1; top: 25px; left: 30px; display: inline-flex; align-items: center; gap: 10px; }
.login-art-copy { position: absolute; z-index: 1; right: 30px; bottom: 14%; left: 9%; }
.login-art-copy h1 { margin: 12px 0 8px; color: white; font-family: 'Newsreader', Georgia, serif; font-size: clamp(44px, 5vw, 66px); font-weight: 500; line-height: .98; }
.login-art-copy p { color: rgba(255,255,255,.82); font-family: 'Newsreader', Georgia, serif; font-size: 17px; }
.login-main { min-height: 100vh; display: flex; flex-direction: column; padding: 25px clamp(25px, 7vw, 100px) 30px; }
.login-back { display: inline-flex; align-items: center; gap: 6px; color: #7e8b81; font-size: 10px; font-weight: 600; }
.login-form-wrap { width: min(100%, 400px); align-self: center; margin: auto 0; padding: 30px 0; }
.login-form-wrap > .public-eyebrow { color: #718477; }
.login-form-wrap h2 { margin: 9px 0 4px; color: #26342d; font-family: 'Newsreader', Georgia, serif; font-size: 35px; font-weight: 500; }
.login-form-wrap > p { margin: 0 0 21px; color: #7d897f; font-size: 11px; }
.login-form-wrap > .login-registration-success { margin: 0 0 16px; padding: 10px 12px; border: 1px solid #cfe1d0; border-radius: 4px; color: #37634a; background: #eef6ed; font-size: 10px; line-height: 1.5; }
.login-form { display: grid; gap: 8px; }
.login-form > label { margin-top: 8px; color: #536158; font-size: 10px; font-weight: 700; }
.login-form > input, .login-password { width: 100%; height: 42px; border: 1px solid #dfe7df; border-radius: 4px; background: white; }
.login-form > input { padding: 0 10px; color: #29372f; font-size: 11px; }
.login-password { display: flex; align-items: center; }
.login-password input { width: 100%; height: 100%; padding: 0 10px; border: 0; outline: 0; background: transparent; font-size: 11px; }
.login-password button { width: 40px; height: 40px; display: grid; flex: 0 0 auto; place-items: center; border: 0; color: #88958b; background: transparent; cursor: pointer; }
.login-error { color: #b45244; font-size: 9px; }
.login-server-error { margin: 3px 0; padding: 9px; border: 1px solid #f0d5cf; border-radius: 4px; color: #a94d41; background: #fcf3f1; font-size: 10px; line-height: 1.5; }
.login-submit { min-height: 43px; display: flex; align-items: center; justify-content: space-between; margin-top: 9px; padding: 0 12px; border: 0; border-radius: 4px; color: white; background: #397459; cursor: pointer; font-size: 11px; font-weight: 700; }
.login-submit:hover { background: #2b6048; }
.login-submit:disabled { opacity: .65; cursor: wait; }
.login-register { margin: 17px 0 8px !important; color: #828e85; font-size: 10px !important; text-align: center; }
.login-register a, .login-explore { color: #397459; font-weight: 700; }
.login-explore { display: block; font-size: 10px; text-align: center; }
@media (max-width: 780px) { .login-page { grid-template-columns: 1fr; } .login-art { display: none; } .login-main { min-height: 100vh; padding: 18px 23px 28px; } .login-form-wrap { margin: auto 0; } }
</style>
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { z } from 'zod'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-vue-next'
import { authApi, registerSchema } from '../modules/auth/services/authApi'

const router = useRouter()
const form = reactive({ name: '', email: '', password: '', confirmPassword: '', acceptedTerms: false })
const errors = reactive<Record<string, string>>({})
const passwordVisible = ref(false)
const loading = ref(false)
const serverError = ref('')

async function submit() {
  Object.keys(errors).forEach((key) => delete errors[key])
  serverError.value = ''
  const result = registerSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? 'form')
      if (!errors[field]) errors[field] = issue.message
    }
    return
  }

  loading.value = true
  try {
    await authApi.register({ name: result.data.name, email: result.data.email, password: result.data.password })
    await router.replace({ name: 'login', query: { registered: '1', email: result.data.email } })
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      serverError.value = 'Ya existe una cuenta con ese correo electrónico.'
    } else if (axios.isAxiosError(error) && error.response?.status === 404) {
      serverError.value = 'El registro todavía no está disponible. El backend debe implementar POST /auth/register.'
    } else if (axios.isAxiosError(error) && !error.response) {
      serverError.value = 'No pudimos conectar con el servidor. Inténtalo de nuevo más tarde.'
    } else if (error instanceof z.ZodError) {
      serverError.value = 'El servicio de registro no respondió como API. Comprueba que VITE_API_URL apunte al backend.'
    } else {
      serverError.value = 'No pudimos crear la cuenta. Revisa los datos e inténtalo de nuevo.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="register-page">
    <aside class="register-art">
      <div class="register-art-image"></div>
      <div class="register-art-overlay"></div>
      <RouterLink class="register-brand" to="/" aria-label="Volver a Entremomentos"><span class="brand-mark"><Sparkles :size="18" /></span><span class="brand-name">entre<span>momentos</span></span></RouterLink>
      <div class="register-art-copy"><span class="public-eyebrow">TU HISTORIA, A TU RITMO</span><h1>Hazle un lugar<br />a lo que importa.</h1><p>Un diario para contar los días como realmente fueron.</p></div>
      <span class="register-art-caption">FOTOS · PALABRAS · VIDA COTIDIANA</span>
    </aside>

    <section class="register-main">
      <RouterLink class="register-back" to="/"><ArrowLeft :size="15" /> Volver al inicio</RouterLink>
      <div class="register-form-wrap">
        <span class="public-eyebrow dark"><span class="tiny-dot"></span> EMPIEZA A GUARDAR</span>
        <h2>Crea tu espacio</h2>
        <p class="register-intro">Una cuenta para tus historias, fotos y recuerdos.</p>

        <form class="register-form" @submit.prevent="submit" novalidate>
          <label for="register-name">Nombre</label>
          <input id="register-name" v-model="form.name" autocomplete="name" placeholder="Cómo te llamas" :aria-invalid="!!errors.name" :aria-describedby="errors.name ? 'name-error' : undefined" />
          <small v-if="errors.name" id="name-error" class="field-error">{{ errors.name }}</small>

          <label for="register-email">Correo electrónico</label>
          <input id="register-email" v-model="form.email" type="email" autocomplete="email" placeholder="tu@correo.com" :aria-invalid="!!errors.email" :aria-describedby="errors.email ? 'email-error' : undefined" />
          <small v-if="errors.email" id="email-error" class="field-error">{{ errors.email }}</small>

          <label for="register-password">Contraseña</label>
          <div class="password-input"><input id="register-password" v-model="form.password" :type="passwordVisible ? 'text' : 'password'" autocomplete="new-password" placeholder="Al menos 10 caracteres" :aria-invalid="!!errors.password" :aria-describedby="errors.password ? 'password-error' : undefined" /><button type="button" :aria-label="passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'" @click="passwordVisible = !passwordVisible"><EyeOff v-if="passwordVisible" :size="16" /><Eye v-else :size="16" /></button></div>
          <small v-if="errors.password" id="password-error" class="field-error">{{ errors.password }}</small>

          <label for="register-confirm">Confirmar contraseña</label>
          <input id="register-confirm" v-model="form.confirmPassword" type="password" autocomplete="new-password" placeholder="Repite tu contraseña" :aria-invalid="!!errors.confirmPassword" :aria-describedby="errors.confirmPassword ? 'confirm-error' : undefined" />
          <small v-if="errors.confirmPassword" id="confirm-error" class="field-error">{{ errors.confirmPassword }}</small>

          <label class="terms-check"><input v-model="form.acceptedTerms" type="checkbox" /><span>Acepto los términos de uso y la política de privacidad.</span></label>
          <small v-if="errors.acceptedTerms" class="field-error">{{ errors.acceptedTerms }}</small>
          <p v-if="serverError" class="server-error" role="alert">{{ serverError }}</p>
          <button class="register-submit" type="submit" :disabled="loading"><span>{{ loading ? 'Creando cuenta…' : 'Crear cuenta' }}</span><ArrowRight :size="16" /></button>
        </form>
        <p class="register-login">¿Ya tienes cuenta? <RouterLink to="/login">Iniciar sesión</RouterLink></p>
        <p class="register-login register-login--explore">¿Solo quieres mirar? <RouterLink to="/explore">Explora sin cuenta</RouterLink></p>
        <p class="register-security"><span class="tiny-dot"></span> Tus recuerdos son tuyos. Tú eliges con quién compartirlos.</p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.register-page { min-height: 100vh; display: grid; grid-template-columns: minmax(360px, .88fr) minmax(440px, 1.12fr); background: #f8f9f5; }
.register-art { position: relative; min-height: 100vh; overflow: hidden; color: #fff; background: #35523f; }
.register-art-image, .register-art-overlay { position: absolute; inset: 0; }
.register-art-image { background: url('https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1400&q=88') center/cover; }
.register-art-overlay { background: linear-gradient(180deg, rgba(28,47,34,.35), rgba(25,43,32,.15) 40%, rgba(24,41,30,.77)); }
.register-brand { position: absolute; z-index: 1; top: 25px; left: 30px; display: inline-flex; align-items: center; gap: 10px; }
.register-art-copy { position: absolute; z-index: 1; right: 35px; bottom: 13%; left: 9%; }
.register-art-copy h1 { margin: 12px 0 8px; color: white; font-family: 'Newsreader', Georgia, serif; font-size: clamp(43px, 5vw, 65px); font-weight: 500; line-height: .99; }
.register-art-copy p { color: rgba(255,255,255,.8); font-family: 'Newsreader', Georgia, serif; font-size: 18px; }
.register-art-caption { position: absolute; right: 28px; bottom: 24px; color: rgba(255,255,255,.7); font-size: 8px; font-weight: 700; letter-spacing: 1.2px; }
.register-main { min-height: 100vh; display: flex; flex-direction: column; padding: 25px clamp(25px, 7vw, 100px) 30px; }
.register-back { display: inline-flex; align-items: center; gap: 6px; color: #7e8b81; font-size: 10px; font-weight: 600; }
.register-form-wrap { width: min(100%, 420px); align-self: center; margin: auto 0; padding: 30px 0; }
.register-form-wrap > .public-eyebrow { color: #718477; }
.register-form-wrap h2 { margin: 9px 0 4px; color: #26342d; font-family: 'Newsreader', Georgia, serif; font-size: 34px; font-weight: 500; }
.register-intro { margin: 0 0 21px; color: #7d897f; font-size: 11px; }
.register-form { display: grid; gap: 7px; }
.register-form > label:not(.terms-check) { margin-top: 7px; color: #536158; font-size: 10px; font-weight: 700; }
.register-form > input, .password-input { width: 100%; height: 41px; border: 1px solid #dfe7df; border-radius: 4px; background: white; }
.register-form > input { padding: 0 10px; color: #29372f; font-size: 11px; }
.register-form input::placeholder { color: #a2ada4; }
.register-form input[aria-invalid="true"] { border-color: #cf806f; }
.password-input { display: flex; align-items: center; }
.password-input input { width: 100%; height: 100%; padding: 0 10px; border: 0; outline: 0; background: transparent; font-size: 11px; }
.password-input button { width: 39px; height: 39px; display: grid; flex: 0 0 auto; place-items: center; border: 0; color: #88958b; background: transparent; cursor: pointer; }
.terms-check { display: flex; align-items: flex-start; gap: 8px; margin-top: 7px; color: #78867c; font-size: 9px; line-height: 1.5; }
.terms-check input { margin: 1px 0 0; accent-color: #397258; }
.field-error, .server-error { color: #b45244; font-size: 9px; }
.server-error { margin: 3px 0; padding: 9px; border: 1px solid #f0d5cf; border-radius: 4px; background: #fcf3f1; line-height: 1.5; }
.register-submit { min-height: 43px; display: flex; align-items: center; justify-content: space-between; margin-top: 9px; padding: 0 12px; border: 0; border-radius: 4px; color: white; background: #397459; cursor: pointer; font-size: 11px; font-weight: 700; }
.register-submit:hover { background: #2b6048; }
.register-submit:disabled { opacity: .65; cursor: wait; }
.register-login { margin: 16px 0; color: #828e85; font-size: 10px; text-align: center; }
.register-login--explore { margin-top: -9px; }
.register-login a, .register-explore { color: #397459; font-weight: 700; }
.register-security { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 0; color: #9ba59c; font-size: 9px; }
.register-security .tiny-dot { width: 5px; height: 5px; }
@media (max-width: 780px) { .register-page { grid-template-columns: 1fr; } .register-art { display: none; } .register-main { min-height: 100vh; padding: 18px 23px 28px; } .register-form-wrap { margin: auto 0; } }
</style>

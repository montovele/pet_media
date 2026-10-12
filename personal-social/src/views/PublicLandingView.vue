<script setup lang="ts">
import { Aperture, ArrowDown, ArrowRight, BookOpen, Camera, Heart, Sparkles, UsersRound } from 'lucide-vue-next'
import { useBrandStore } from '../modules/brand/stores/brand'

const brand = useBrandStore()
</script>

<template>
  <main class="public-site">
    <header class="public-header">
      <RouterLink class="brand" to="/" :aria-label="`${brand.name}, inicio`">
        <span class="brand-mark" :class="{ 'brand-mark--custom': brand.logoUrl }">
          <img v-if="brand.logoUrl" class="brand-logo" :src="brand.logoUrl" alt="" />
          <Aperture v-else :size="19" />
        </span>
        <span class="brand-name">{{ brand.name }}</span>
      </RouterLink>
      <nav aria-label="Navegación pública">
        <RouterLink to="/explore">Explorar historias</RouterLink>
        <a href="#como-funciona">Nuestra idea</a>
      </nav>
      <div class="public-header-actions">
        <RouterLink class="public-login-link" to="/login">Iniciar sesión</RouterLink>
        <RouterLink class="public-header-cta" to="/register">Crear cuenta <ArrowRight :size="14" /></RouterLink>
      </div>
    </header>

    <section class="public-hero">
      <div class="hero-image" role="img" aria-label="Un camino tranquilo entre árboles al amanecer"></div>
      <div class="hero-overlay"></div>
      <div class="hero-copy">
        <span class="public-eyebrow"><Sparkles :size="14" /> UNA RED PARA LOS DÍAS REALES</span>
        <h1>{{ brand.name }}</h1>
        <p>Las cosas pequeñas también merecen quedarse.</p>
        <div class="hero-actions">
          <RouterLink class="hero-primary" to="/register">Empieza tu diario <ArrowRight :size="16" /></RouterLink>
          <RouterLink class="hero-secondary" to="/explore">Explorar sin cuenta <ArrowDown :size="15" /></RouterLink>
        </div>
      </div>
      <div class="hero-caption"><span>01 / 03</span><span>Un espacio para guardar la vida como sucede</span></div>
    </section>

    <section id="como-funciona" class="public-intro">
      <div class="intro-marker"><span>01</span><span class="marker-line"></span><span>02</span></div>
      <div class="intro-copy">
        <span class="public-eyebrow dark"><span class="tiny-dot"></span> MÁS QUE UNA FOTO EN EL FEED</span>
        <h2>Guarda el momento.<br /><em>Cuenta lo que significó.</em></h2>
        <p>Una caminata, una comida que salió bien, una tarde sin planes. Reúne fotos, videos y palabras en historias que puedas volver a vivir, a tu ritmo y con tu gente.</p>
        <RouterLink class="intro-link" to="/explore">Conoce historias públicas <ArrowRight :size="16" /></RouterLink>
      </div>
      <div class="intro-image-wrap">
        <img src="https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1000&q=85" alt="Luz suave del amanecer en el campo" loading="lazy" />
        <span class="image-index">DÍAS QUE SE QUEDAN · 01</span>
      </div>
    </section>

    <section class="public-benefits">
      <div class="benefits-heading"><span class="public-eyebrow dark"><span class="tiny-dot coral"></span> TU ESPACIO, TUS REGLAS</span><h2>Una red para compartir<br /><em>sin dejar de ser tuya.</em></h2></div>
      <div class="benefit-list">
        <article><span class="benefit-icon"><BookOpen :size="19" /></span><div><h3>Historias con contexto</h3><p>Junta palabras, fotos y videos para recordar lo que pasó, no solo cómo se veía.</p></div><span class="benefit-number">01</span></article>
        <article><span class="benefit-icon coral-icon"><Heart :size="19" /></span><div><h3>Privacidad a tu medida</h3><p>Decide qué recuerdos compartes y con quién. Lo personal no tiene que ser público.</p></div><span class="benefit-number">02</span></article>
        <article><span class="benefit-icon gold-icon"><Camera :size="19" /></span><div><h3>Tu historia, en orden</h3><p>Organiza actividades y álbumes para volver fácilmente a cada etapa de tu vida.</p></div><span class="benefit-number">03</span></article>
      </div>
    </section>

    <section class="public-recommendations">
      <div class="recommendations-copy"><span class="public-eyebrow dark"><span class="tiny-dot"></span> UNA VENTANA ABIERTA</span><h2>Historias que puedes<br /><em>leer desde aquí.</em></h2><p>Explora momentos que sus autores eligieron compartir públicamente. Para guardar los tuyos, crea un espacio personal.</p><RouterLink class="intro-link" to="/explore">Ir a explorar <ArrowRight :size="16" /></RouterLink></div>
      <div class="recommendation-art">
        <img class="recommendation-main" src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=85" alt="Sendero soleado en el bosque" loading="lazy" />
        <div class="recommendation-note"><span>UNA MAÑANA SIN PRISA</span><p>Los momentos sencillos también cuentan una historia.</p><span class="note-byline"><UsersRound :size="12" /> DE LA COMUNIDAD</span></div>
        <img class="recommendation-detail" src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=500&q=85" alt="Paisaje de montaña al atardecer" loading="lazy" />
      </div>
    </section>

    <section class="public-join">
      <div><span class="public-eyebrow"><Sparkles :size="13" /> TU PRÓXIMO RECUERDO EMPIEZA AQUÍ</span><h2>Hazle un lugar a lo que importa.</h2><p>Crea tu cuenta y empieza con una historia de hoy.</p></div>
      <RouterLink class="join-button" to="/register">Crear mi cuenta <ArrowRight :size="16" /></RouterLink>
    </section>

    <footer class="public-footer"><RouterLink class="brand" to="/" :aria-label="brand.name"><span class="brand-mark" :class="{ 'brand-mark--custom': brand.logoUrl }"><img v-if="brand.logoUrl" class="brand-logo" :src="brand.logoUrl" alt="" /><Aperture v-else :size="17" /></span><span class="brand-name">{{ brand.name }}</span></RouterLink><span>Un lugar para recordar lo que sí pasó.</span><RouterLink to="/explore">Explorar historias</RouterLink></footer>
  </main>
</template>

<style scoped>
.public-site { --public-ink: #26342d; --public-muted: #77847b; --public-green: #386f58; min-height: 100vh; color: var(--public-ink); background: #f6f7f2; }
.public-header { height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 0 clamp(19px, 5vw, 76px); background: #f9faf6; }
.public-header .brand { min-width: auto; }
.public-header nav, .public-header-actions { display: flex; align-items: center; gap: 25px; }
.public-header nav a, .public-login-link { color: #68776d; font-size: 11px; font-weight: 600; }
.public-header nav a:hover, .public-login-link:hover { color: var(--public-green); }
.public-header-actions { gap: 17px; }
.public-header-cta { min-height: 35px; display: inline-flex; align-items: center; gap: 7px; padding: 0 11px; border: 1px solid #cdddcf; border-radius: 4px; color: var(--public-green); font-size: 10px; font-weight: 700; }
.public-hero { position: relative; min-height: min(650px, 76vh); display: flex; align-items: center; overflow: hidden; color: white; background: #344a3d; }
.hero-image, .hero-overlay { position: absolute; inset: 0; }
.hero-image { background-image: url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2200&q=90'); background-size: cover; background-position: center 54%; transform: scale(1.015); animation: hero-arrive 1s ease both; }
.hero-overlay { background: linear-gradient(90deg, rgba(21,39,29,.76), rgba(27,42,32,.38) 55%, rgba(26,40,31,.06)), linear-gradient(0deg, rgba(19,33,25,.45), transparent 35%); }
.hero-copy { position: relative; z-index: 1; width: min(880px, 100%); padding: 40px clamp(26px, 10vw, 150px); animation: copy-arrive .6s .12s ease both; }
.public-eyebrow { display: inline-flex; align-items: center; gap: 7px; color: #d4e2d1; font-size: 9px; font-weight: 700; letter-spacing: 1.4px; }
.hero-copy h1 { margin: 19px 0 9px; color: white; font-family: 'Newsreader', Georgia, serif; font-size: clamp(52px, 7vw, 82px); font-weight: 500; line-height: .98; letter-spacing: 0; }
.hero-copy > p { color: rgba(255,255,255,.83); font-family: 'Newsreader', Georgia, serif; font-size: 21px; }
.hero-actions { display: flex; align-items: center; gap: 21px; margin-top: 26px; }
.hero-primary, .hero-secondary { display: inline-flex; align-items: center; gap: 9px; font-size: 11px; font-weight: 700; }
.hero-primary { min-height: 43px; padding: 0 15px; border-radius: 4px; color: #fff; background: #38765a; }
.hero-primary:hover, .join-button:hover { background: #285d46; }
.hero-secondary { color: rgba(255,255,255,.9); }
.hero-secondary:hover { color: white; }
.hero-caption { position: absolute; z-index: 1; right: clamp(20px, 5vw, 70px); bottom: 20px; left: clamp(20px, 5vw, 70px); display: flex; justify-content: space-between; color: rgba(255,255,255,.73); font-size: 9px; letter-spacing: .4px; }
.hero-caption span:first-child { color: #f1d58c; font-weight: 700; }
.public-intro { width: min(1120px, 100%); display: grid; grid-template-columns: 70px minmax(280px, .9fr) minmax(290px, 1fr); align-items: center; gap: clamp(26px, 6vw, 76px); margin: 0 auto; padding: 100px 30px 105px; }
.intro-marker { align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; color: #a7b0a6; font-size: 9px; }
.intro-marker span:first-child { color: var(--public-green); font-weight: 700; }
.marker-line { width: 1px; height: 84px; background: #cbd6c9; }
.public-eyebrow.dark { color: #77867a; }
.tiny-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--public-green); }
.tiny-dot.coral { background: #de806a; }
.intro-copy h2, .benefits-heading h2, .recommendations-copy h2 { margin: 13px 0; color: var(--public-ink); font-family: 'Newsreader', Georgia, serif; font-size: 39px; font-weight: 500; line-height: 1.04; letter-spacing: 0; }
.intro-copy h2 em, .benefits-heading h2 em, .recommendations-copy h2 em { color: var(--public-green); font-weight: 500; }
.intro-copy > p, .recommendations-copy > p { max-width: 395px; color: #77847b; font-size: 12px; line-height: 1.8; }
.intro-link { display: inline-flex; align-items: center; gap: 8px; margin-top: 15px; color: var(--public-green); font-size: 11px; font-weight: 700; }
.intro-image-wrap { position: relative; min-height: 315px; }
.intro-image-wrap img { width: 100%; height: 315px; display: block; object-fit: cover; }
.image-index { position: absolute; right: -10px; bottom: -11px; padding: 10px 12px; color: #fff; background: #3c765b; font-size: 8px; font-weight: 700; letter-spacing: 1px; }
.public-benefits { display: grid; grid-template-columns: minmax(230px, .7fr) minmax(390px, 1fr); gap: 10vw; padding: 74px clamp(25px, 10vw, 145px) 82px; background: #eaf0e8; }
.benefits-heading h2 { font-size: 35px; }
.benefit-list { display: grid; }
.benefit-list article { display: grid; grid-template-columns: 38px minmax(0, 1fr) 24px; align-items: start; gap: 13px; padding: 15px 0; border-bottom: 1px solid #d7e1d6; }
.benefit-list article:first-child { padding-top: 2px; }
.benefit-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; color: #397456; background: #d7e7d8; }
.coral-icon { color: #a45d50; background: #f1ddd5; }
.gold-icon { color: #856c35; background: #f0e7c9; }
.benefit-list h3 { margin: 1px 0 4px; color: #35443a; font-size: 12px; }
.benefit-list p { max-width: 430px; margin: 0; color: #79877d; font-size: 10px; line-height: 1.6; }
.benefit-number { color: #a0aea1; font-family: 'Newsreader', Georgia, serif; font-size: 12px; }
.public-recommendations { width: min(1120px, 100%); display: grid; grid-template-columns: minmax(250px, .7fr) minmax(360px, 1fr); align-items: center; gap: 8vw; margin: 0 auto; padding: 105px 30px 112px; }
.recommendations-copy h2 { font-size: 38px; }
.recommendation-art { position: relative; min-height: 340px; }
.recommendation-main { width: 74%; height: 310px; display: block; object-fit: cover; }
.recommendation-note { position: absolute; z-index: 1; top: 37px; right: 0; width: 43%; padding: 20px 18px; background: #f9f7ee; box-shadow: 0 11px 28px rgba(36,50,40,.1); }
.recommendation-note > span:first-child { color: #818e80; font-size: 8px; font-weight: 700; letter-spacing: .8px; }
.recommendation-note p { margin: 13px 0 17px; color: #405046; font-family: 'Newsreader', Georgia, serif; font-size: 21px; line-height: 1.15; }
.recommendation-note .note-byline { display: flex; align-items: center; gap: 5px; color: var(--public-green); font-size: 8px; font-weight: 700; letter-spacing: .6px; }
.recommendation-detail { position: absolute; right: 4%; bottom: 0; width: 34%; height: 106px; border: 6px solid #f6f7f2; object-fit: cover; }
.public-join { display: flex; align-items: center; justify-content: space-between; gap: 25px; padding: 43px clamp(25px, 10vw, 145px); color: #fff; background: #31674f; }
.public-join .public-eyebrow { color: #d5e4d5; }
.public-join h2 { margin: 8px 0 3px; color: white; font-family: 'Newsreader', Georgia, serif; font-size: 30px; font-weight: 500; }
.public-join p { margin: 0; color: #ccdbcf; font-size: 10px; }
.join-button { min-height: 42px; display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto; padding: 0 14px; border-radius: 4px; color: white; background: #41815f; font-size: 10px; font-weight: 700; }
.public-footer { min-height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 15px clamp(20px, 5vw, 76px); background: #f9faf6; }
.public-footer .brand { min-width: auto; }
.public-footer > span, .public-footer > a:last-child { color: #8a968d; font-size: 9px; }
.public-footer > a:last-child { color: var(--public-green); font-weight: 700; }
@keyframes hero-arrive { from { transform: scale(1.07); filter: saturate(.8); } to { transform: scale(1.015); filter: saturate(1); } }
@keyframes copy-arrive { from { opacity: 0; transform: translateY(13px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 760px) {
  .public-header { height: 62px; }
  .public-header nav { display: none; }
  .public-login-link { display: none; }
  .public-hero { min-height: 590px; min-height: min(690px, 82svh); }
  .hero-copy { padding: 35px 23px; }
  .hero-copy h1 { font-size: 54px; }
  .hero-copy > p { max-width: 285px; font-size: 18px; line-height: 1.3; }
  .hero-actions { align-items: flex-start; flex-direction: column; gap: 15px; }
  .hero-caption { right: 20px; left: 20px; font-size: 8px; }
  .hero-caption span:last-child { max-width: 210px; text-align: right; }
  .public-intro { grid-template-columns: 22px minmax(0,1fr); gap: 12px 18px; padding: 64px 22px 70px; }
  .intro-marker { grid-row: span 2; }
  .intro-copy h2, .benefits-heading h2, .recommendations-copy h2 { font-size: 32px; }
  .intro-image-wrap { grid-column: 2; min-height: 230px; margin-top: 9px; }
  .intro-image-wrap img { height: 230px; }
  .public-benefits { grid-template-columns: 1fr; gap: 25px; padding: 56px 23px 63px; }
  .benefits-heading h2 { margin-bottom: 0; }
  .public-recommendations { grid-template-columns: 1fr; gap: 25px; padding: 68px 22px 78px; }
  .recommendation-art { min-height: 295px; }
  .recommendation-main { height: 260px; }
  .recommendation-note { top: 29px; width: 48%; padding: 15px 12px; }
  .recommendation-note p { font-size: 18px; }
  .recommendation-detail { height: 86px; }
  .public-join { align-items: flex-start; flex-direction: column; gap: 18px; padding: 34px 23px; }
  .public-join h2 { max-width: 320px; font-size: 27px; }
  .public-footer { flex-wrap: wrap; }
  .public-footer > span { order: 3; width: 100%; }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
</style>

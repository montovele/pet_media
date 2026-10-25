<script setup lang="ts">
import { ArrowDown, ArrowRight, PawPrint, ShieldCheck, Stethoscope } from 'lucide-vue-next'
import { useBrandStore } from '../modules/brand/stores/brand'

const brand = useBrandStore()
</script>

<template>
  <main class="public-site">
    <header class="public-header">
      <RouterLink class="brand" to="/" :aria-label="`${brand.name}, inicio`">
          <span class="brand-mark" :class="{ 'brand-mark--custom': brand.logoUrl }">
          <img v-if="brand.logoUrl" class="brand-logo" :src="brand.logoUrl" alt="" />
          <PawPrint v-else :size="19" />
        </span>
        <span class="brand-name">{{ brand.name }}</span>
      </RouterLink>
      <nav aria-label="Navegación pública">
        <a href="#proposito">El propósito</a>
        <a href="#privacidad">Privacidad</a>
        <RouterLink to="/lost-found">Reportar perdido o encontrado</RouterLink>
      </nav>
      <div class="public-header-actions">
        <RouterLink class="public-login-link" to="/login">Iniciar sesión</RouterLink>
        <RouterLink class="public-header-cta" to="/register">Crear cuenta <ArrowRight :size="14" /></RouterLink>
      </div>
    </header>

    <section class="public-hero">
      <div class="hero-image" role="img" aria-label="Perro acompañado en un paseo al aire libre"></div>
      <div class="hero-overlay"></div>
      <div class="hero-copy">
        <span class="public-eyebrow"><PawPrint :size="14" /> IDENTIDAD Y BIOGRAFÍA ANIMAL</span>
        <h1>{{ brand.name }}</h1>
        <p>Su identidad lo acompaña. Su historia lo protege.</p>
        <div class="hero-actions">
          <RouterLink class="hero-primary" to="/register">Comenzar una Bio-Acta <ArrowRight :size="16" /></RouterLink>
          <a class="hero-secondary" href="#proposito">Conocer el propósito <ArrowDown :size="15" /></a>
        </div>
      </div>
      <div class="hero-caption"><span>IDENTIDAD · CONTINUIDAD</span><span>Una vida merece más que un registro aislado</span></div>
    </section>

    <section id="proposito" class="public-intro">
      <div class="intro-marker"><span>01</span><span class="marker-line"></span><span>02</span></div>
      <div class="intro-copy">
        <span class="public-eyebrow dark"><span class="tiny-dot"></span> PRIMERO, EL ANIMAL</span>
        <h2>Una vida, una identidad.<br /><em>Una historia que permanece.</em></h2>
        <p>BIO-ACTA propone conservar la identidad y biografía de cada animal, incluso cuando cambian sus cuidadores, su hogar o quienes participan en su cuidado.</p>
        <RouterLink class="intro-link" to="/register">Iniciar un registro <ArrowRight :size="16" /></RouterLink>
      </div>
      <div class="intro-image-wrap">
        <img src="https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1000&q=85" alt="Perro golden retriever en un entorno natural" loading="lazy" />
        <span class="image-index">UNA VIDA · UNA IDENTIDAD</span>
      </div>
    </section>

    <section id="privacidad" class="public-benefits">
      <div class="benefits-heading"><span class="public-eyebrow dark"><span class="tiny-dot coral"></span> IDENTIDAD CON CUIDADO</span><h2>Una historia útil.<br /><em>Información protegida.</em></h2></div>
      <div class="benefit-list">
        <article><span class="benefit-icon"><PawPrint :size="19" /></span><div><h3>Identidad que no depende de una persona</h3><p>El registro del animal busca permanecer a través de los cambios en su entorno.</p></div><span class="benefit-number">01</span></article>
        <article><span class="benefit-icon coral-icon"><ShieldCheck :size="19" /></span><div><h3>Privacidad desde el inicio</h3><p>Los registros actuales son privados. Los datos públicos y los permisos compartidos requieren autorización explícita.</p></div><span class="benefit-number">02</span></article>
        <article><span class="benefit-icon gold-icon"><Stethoscope :size="19" /></span><div><h3>Procedencia de cada dato</h3><p>La propuesta distingue información declarada por cuidadores de registros que un profesional pueda certificar.</p></div><span class="benefit-number">03</span></article>
      </div>
    </section>

    <section class="public-recommendations">
      <div class="recommendations-copy"><span class="public-eyebrow dark"><span class="tiny-dot"></span> UNA BIO-ACTA EN EVOLUCIÓN</span><h2>Comienza con su identidad.<br /><em>Continúa con su historia.</em></h2><p>La primera versión permite iniciar un registro privado del animal. El expediente público, el QR y las transferencias se habilitarán cuando sus reglas de protección estén definidas.</p><RouterLink class="intro-link" to="/register">Crear una cuenta cuidadora <ArrowRight :size="16" /></RouterLink></div>
      <div class="recommendation-art">
        <img class="recommendation-main" src="https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=85" alt="Persona acariciando a su perro" loading="lazy" />
        <div class="recommendation-note"><span>SU HISTORIA CONTINÚA</span><p>Primero identificamos al animal; después vinculamos a quienes forman parte de su vida.</p><span class="note-byline"><PawPrint :size="12" /> BIO-ACTA</span></div>
        <img class="recommendation-detail" src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=500&q=85" alt="Retrato cercano de un perro" loading="lazy" />
      </div>
    </section>

    <section class="public-join">
      <div><span class="public-eyebrow"><PawPrint :size="13" /> UNA IDENTIDAD PARA TODA SU VIDA</span><h2>Su historia puede empezar hoy.</h2><p>Registra un animal y conserva sus datos esenciales en un espacio privado.</p></div>
      <RouterLink class="join-button" to="/register">Comenzar <ArrowRight :size="16" /></RouterLink>
    </section>

    <footer class="public-footer"><RouterLink class="brand" to="/" :aria-label="brand.name"><span class="brand-mark" :class="{ 'brand-mark--custom': brand.logoUrl }"><img v-if="brand.logoUrl" class="brand-logo" :src="brand.logoUrl" alt="" /><PawPrint v-else :size="17" /></span><span class="brand-name">{{ brand.name }}</span></RouterLink><span>Registro privado digital; no es un documento gubernamental oficial.</span><RouterLink to="/register">Crear cuenta</RouterLink></footer>
  </main>
</template>

<style scoped>
.public-site { --public-ink: var(--ink); --public-muted: var(--muted); --public-green: var(--green); min-height: 100vh; color: var(--public-ink); background: var(--canvas); }
.public-header { position: sticky; top: 0; z-index: 20; height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 0 clamp(19px, 5vw, 76px); border-bottom: 1px solid var(--line); background: rgba(255, 253, 248, .93); backdrop-filter: blur(18px); }
.public-header .brand { min-width: auto; }
.public-header nav, .public-header-actions { display: flex; align-items: center; gap: 25px; }
.public-header nav a, .public-login-link { color: #68776d; font-size: 11px; font-weight: 600; }
.public-header nav a:hover, .public-login-link:hover { color: var(--public-green); }
.public-header-actions { gap: 17px; }
.public-header-cta { min-height: 39px; display: inline-flex; align-items: center; gap: 7px; padding: 0 15px; border: 1px solid var(--green); border-radius: 999px; color: #fff; background: var(--green); font-size: 11px; font-weight: 700; transition: background .18s, transform .18s; }
.public-header-cta:hover { background: var(--green-deep); transform: translateY(-1px); }
.public-hero { position: relative; min-height: min(720px, 82vh); display: flex; align-items: center; overflow: hidden; color: white; background: #173e36; }
.hero-image, .hero-overlay { position: absolute; inset: 0; }
  .hero-image { background-image: url('https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=2200&q=90'); background-size: cover; background-position: center 48%; transform: scale(1.015); animation: hero-arrive 1s ease both; }
.hero-overlay { background: linear-gradient(90deg, rgba(16,43,36,.86), rgba(21,48,39,.53) 55%, rgba(26,40,31,.06)), linear-gradient(0deg, rgba(19,33,25,.5), transparent 40%); }
.hero-copy { position: relative; z-index: 1; width: min(880px, 100%); padding: 40px clamp(26px, 10vw, 150px); animation: copy-arrive .6s .12s ease both; }
.public-eyebrow { display: inline-flex; align-items: center; gap: 7px; color: #d4e2d1; font-size: 9px; font-weight: 700; letter-spacing: 1.4px; }
.hero-copy h1 { margin: 19px 0 9px; color: white; font-family: 'Newsreader', Georgia, serif; font-size: clamp(52px, 7vw, 82px); font-weight: 500; line-height: .98; letter-spacing: 0; }
.hero-copy > p { color: rgba(255,255,255,.83); font-family: 'Newsreader', Georgia, serif; font-size: 21px; }
.hero-actions { display: flex; align-items: center; gap: 21px; margin-top: 26px; }
.hero-primary, .hero-secondary { display: inline-flex; align-items: center; gap: 9px; font-size: 11px; font-weight: 700; }
.hero-primary { min-height: 47px; padding: 0 19px; border-radius: 999px; color: #193a32; background: #e4bd75; box-shadow: 0 8px 24px rgba(16, 39, 31, .2); }
.hero-primary:hover { background: #f0cc87; transform: translateY(-2px); }
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
.intro-image-wrap img { width: 100%; height: 315px; display: block; border-radius: 22px; object-fit: cover; box-shadow: var(--shadow); }
.image-index { position: absolute; right: -10px; bottom: -11px; padding: 11px 14px; border: 4px solid var(--canvas); border-radius: 999px; color: #fff; background: var(--green-deep); font-size: 8px; font-weight: 700; letter-spacing: 1px; }
.public-benefits { display: grid; grid-template-columns: minmax(230px, .7fr) minmax(390px, 1fr); gap: 10vw; padding: 84px clamp(25px, 10vw, 145px) 88px; background: #e9eee4; }
.benefits-heading h2 { font-size: 35px; }
.benefit-list { display: grid; }
.benefit-list article { display: grid; grid-template-columns: 38px minmax(0, 1fr) 24px; align-items: start; gap: 13px; margin-bottom: 9px; padding: 17px 15px; border: 1px solid rgba(211, 220, 205, .9); border-radius: 14px; background: rgba(255, 253, 248, .66); transition: transform .18s, box-shadow .18s; }
.benefit-list article:hover { transform: translateY(-2px); box-shadow: var(--shadow-soft); }
.benefit-list article:first-child { padding-top: 17px; }
.benefit-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; color: #397456; background: #d7e7d8; }
.coral-icon { color: #a45d50; background: #f1ddd5; }
.gold-icon { color: #856c35; background: #f0e7c9; }
.benefit-list h3 { margin: 1px 0 4px; color: #35443a; font-size: 12px; }
.benefit-list p { max-width: 430px; margin: 0; color: #79877d; font-size: 10px; line-height: 1.6; }
.benefit-number { color: #a0aea1; font-family: 'Newsreader', Georgia, serif; font-size: 12px; }
.public-recommendations { width: min(1120px, 100%); display: grid; grid-template-columns: minmax(250px, .7fr) minmax(360px, 1fr); align-items: center; gap: 8vw; margin: 0 auto; padding: 105px 30px 112px; }
.recommendations-copy h2 { font-size: 38px; }
.recommendation-art { position: relative; min-height: 340px; }
.recommendation-main { width: 74%; height: 310px; display: block; border-radius: 22px; object-fit: cover; box-shadow: var(--shadow); }
.recommendation-note { position: absolute; z-index: 1; top: 37px; right: 0; width: 43%; padding: 22px 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); box-shadow: var(--shadow); }
.recommendation-note > span:first-child { color: #818e80; font-size: 8px; font-weight: 700; letter-spacing: .8px; }
.recommendation-note p { margin: 13px 0 17px; color: #405046; font-family: 'Newsreader', Georgia, serif; font-size: 21px; line-height: 1.15; }
.recommendation-note .note-byline { display: flex; align-items: center; gap: 5px; color: var(--public-green); font-size: 8px; font-weight: 700; letter-spacing: .6px; }
.recommendation-detail { position: absolute; right: 4%; bottom: 0; width: 34%; height: 106px; border: 6px solid var(--canvas); border-radius: 18px; object-fit: cover; }
.public-join { display: flex; align-items: center; justify-content: space-between; gap: 25px; padding: 48px clamp(25px, 10vw, 145px); color: #fff; background: var(--green-deep); }
.public-join .public-eyebrow { color: #d5e4d5; }
.public-join h2 { margin: 8px 0 3px; color: white; font-family: 'Newsreader', Georgia, serif; font-size: 30px; font-weight: 500; }
.public-join p { margin: 0; color: #ccdbcf; font-size: 10px; }
.join-button { min-height: 46px; display: inline-flex; align-items: center; gap: 8px; flex: 0 0 auto; padding: 0 18px; border-radius: 999px; color: #193a32; background: #e4bd75; font-size: 11px; font-weight: 700; transition: background .18s, transform .18s; }
.join-button:hover { background: #f0cc87; transform: translateY(-2px); }
.public-footer { min-height: 82px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 15px clamp(20px, 5vw, 76px); background: var(--paper); }
.public-footer .brand { min-width: auto; }
.public-footer > span, .public-footer > a:last-child { color: #8a968d; font-size: 9px; }
.public-footer > a:last-child { color: var(--public-green); font-weight: 700; }
@keyframes hero-arrive { from { transform: scale(1.07); filter: saturate(.8); } to { transform: scale(1.015); filter: saturate(1); } }
@keyframes copy-arrive { from { opacity: 0; transform: translateY(13px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 760px) {
  .public-header { height: 62px; gap: 8px; padding-right: 12px; padding-left: 12px; }
  .public-header nav { display: none; }
  .public-header .brand { gap: 7px; }
  .public-header .brand-mark { width: 32px; height: 32px; }
  .public-header .brand-name { font-size: 13px; }
  .public-header-actions { flex: 0 0 auto; gap: 6px; }
  .public-login-link { min-height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0 9px; border: 1px solid var(--line); border-radius: 999px; color: var(--ink); background: transparent; font-size: 9px; white-space: nowrap; }
  .public-header-cta { min-height: 34px; gap: 4px; padding: 0 9px; font-size: 9px; white-space: nowrap; }
  .public-header-cta svg { width: 12px; height: 12px; }
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

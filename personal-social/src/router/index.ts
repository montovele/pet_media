import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AlbumsView from '../views/AlbumsView.vue'
import ProfileView from '../views/ProfileView.vue'
import StoryView from '../views/StoryView.vue'
import SocialAccountsView from '../modules/social/views/SocialAccountsView.vue'
import SocialPublicationsView from '../modules/social/views/SocialPublicationsView.vue'
import PublicLandingView from '../views/PublicLandingView.vue'
import PublicExploreView from '../views/PublicExploreView.vue'
import RegisterView from '../views/RegisterView.vue'
import LoginView from '../views/LoginView.vue'
import NotificationsView from '../modules/notifications/views/NotificationsView.vue'
import ActivitiesView from '../modules/activities/views/ActivitiesView.vue'
import PhotosView from '../modules/photos/views/PhotosView.vue'
import PhotoDetailView from '../modules/photos/views/PhotoDetailView.vue'
import AlbumDetailView from '../modules/albums/views/AlbumDetailView.vue'
import ModerationView from '../modules/moderation/views/ModerationView.vue'
import SupervisionView from '../modules/moderation/views/SupervisionView.vue'
import AdsManagerView from '../modules/ads/views/AdsManagerView.vue'
import AdCheckoutView from '../modules/ads/views/AdCheckoutView.vue'
import BrandSettingsView from '../modules/brand/views/BrandSettingsView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'public-home', component: PublicLandingView, meta: { publicOnly: true, title: 'Entremomentos' } },
    { path: '/explore', name: 'public-explore', component: PublicExploreView, meta: { publicOnly: true, title: 'Historias públicas' } },
    { path: '/register', name: 'register', component: RegisterView, meta: { publicOnly: true, guestOnly: true, title: 'Crear cuenta' } },
    { path: '/login', name: 'login', component: LoginView, meta: { publicOnly: true, guestOnly: true, title: 'Iniciar sesión' } },
    { path: '/home', name: 'home', component: HomeView, meta: { requiresAuth: true, filter: 'all', title: 'Tu espacio' } },
    { path: '/stories/:id', name: 'story-detail', component: StoryView, meta: { publicOnly: true, title: 'Historia' } },
    { path: '/stories', name: 'stories', component: HomeView, meta: { requiresAuth: true, filter: 'story', title: 'Historias' } },
    { path: '/activities', name: 'activities', component: ActivitiesView, meta: { requiresAuth: true, title: 'Actividades' } },
    { path: '/photos', name: 'photos', component: PhotosView, meta: { requiresAuth: true, title: 'Fotos' } },
    { path: '/photos/:id', name: 'photo-detail', component: PhotoDetailView, meta: { requiresAuth: true, title: 'Foto' } },
    { path: '/albums', name: 'albums', component: AlbumsView, meta: { requiresAuth: true, title: 'Álbumes' } },
    { path: '/albums/:id', name: 'album-detail', component: AlbumDetailView, meta: { requiresAuth: true, title: 'Álbum' } },
    { path: '/profile', name: 'profile', component: ProfileView, meta: { requiresAuth: true, title: 'Mi perfil' } },
    { path: '/notifications', name: 'notifications', component: NotificationsView, meta: { requiresAuth: true, title: 'Notificaciones' } },
    { path: '/settings/social', name: 'social-accounts', component: SocialAccountsView, meta: { requiresAuth: true, title: 'Cuentas conectadas' } },
    { path: '/social/publications', name: 'social-publications', component: SocialPublicationsView, meta: { requiresAuth: true, title: 'Publicaciones externas' } },
    { path: '/moderation', name: 'moderation', component: ModerationView, meta: { requiresAuth: true, moderatorOnly: true, title: 'Moderación' } },
    { path: '/supervision', name: 'supervision', component: SupervisionView, meta: { requiresAuth: true, superadminOnly: true, title: 'Panorama del usuario' } },
    { path: '/admin/ads', name: 'ads-manager', component: AdsManagerView, meta: { requiresAuth: true, superadminOnly: true, title: 'Anuncios de marca' } },
    { path: '/admin/brand', name: 'brand-settings', component: BrandSettingsView, meta: { requiresAuth: true, superadminOnly: true, title: 'Identidad de marca' } },
    { path: '/ads/checkout', name: 'ad-checkout', component: AdCheckoutView, meta: { requiresAuth: true, title: 'Promocionar mi marca' } },
  ],
  scrollBehavior: () => ({ top: 0, behavior: 'smooth' }),
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !(await auth.refreshSession(to.meta.moderatorOnly === true || to.meta.superadminOnly === true))) {
    return { name: 'login', query: { next: to.fullPath } }
  }
  if (to.meta.moderatorOnly && !auth.user?.isModerator) return { name: 'home' }
  if (to.meta.superadminOnly && auth.user?.role !== 'superadmin') return { name: 'home' }
  if (to.meta.guestOnly && await auth.refreshSession()) return { name: 'home' }
})

export default router

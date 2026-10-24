import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../modules/animals/views/DashboardView.vue'
import AnimalsView from '../modules/animals/views/AnimalsView.vue'
import AnimalStoriesView from '../modules/animals/views/AnimalStoriesView.vue'
import BioActaWorkspaceView from '../modules/animals/views/BioActaWorkspaceView.vue'
import BioActaAccessView from '../modules/animals/views/BioActaAccessView.vue'
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
import CampaignManagerView from '../modules/campaigns/views/CampaignManagerView.vue'
import CampaignCheckoutView from '../modules/campaigns/views/CampaignCheckoutView.vue'
import BrandSettingsView from '../modules/brand/views/BrandSettingsView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'public-home', component: PublicLandingView, meta: { publicOnly: true, title: 'BIO-ACTA' } },
    { path: '/explore', name: 'public-explore', component: PublicExploreView, meta: { publicOnly: true, title: 'Historias públicas' } },
    { path: '/register', name: 'register', component: RegisterView, meta: { publicOnly: true, guestOnly: true, title: 'Crear cuenta' } },
    { path: '/login', name: 'login', component: LoginView, meta: { publicOnly: true, guestOnly: true, title: 'Iniciar sesión' } },
    { path: '/lost-found', name: 'public-lost-found', component: BioActaWorkspaceView, meta: { publicOnly: true, title: 'Reportar animal perdido o encontrado' } },
    { path: '/bioacta/public/:publicId', name: 'public-bio-acta', component: BioActaWorkspaceView, meta: { publicOnly: true, title: 'Bio-Acta pública' } },
    { path: '/home', name: 'home', component: DashboardView, meta: { requiresAuth: true, title: 'Panel de cuidado' } },
    { path: '/bioacta/administracion', name: 'bioacta-administration', component: BioActaWorkspaceView, meta: { requiresAuth: true, superadminOnly: true, title: 'Administración BIO-ACTA' } },
    { path: '/bioacta/acceso/:grantId', name: 'bioacta-access', component: BioActaAccessView, meta: { requiresAuth: true, title: 'Abrir acceso BIO-ACTA' } },
    { path: '/bioacta', redirect: '/bioacta/inicio' },
    { path: '/bioacta/:section', name: 'bioacta-workspace', component: BioActaWorkspaceView, meta: { requiresAuth: true, title: 'BIO-ACTA' } },
    { path: '/stories/:id', name: 'story-detail', component: StoryView, meta: { publicOnly: true, title: 'Historia' } },
    { path: '/stories', name: 'stories', component: AnimalStoriesView, meta: { requiresAuth: true, title: 'Historias de vida' } },
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
    { path: '/admin/campaigns', name: 'ads-manager', component: CampaignManagerView, meta: { requiresAuth: true, superadminOnly: true, title: 'Anuncios de marca' } },
    { path: '/admin/brand', name: 'brand-settings', component: BrandSettingsView, meta: { requiresAuth: true, superadminOnly: true, title: 'Identidad de marca' } },
    { path: '/campaigns/checkout', name: 'ad-checkout', component: CampaignCheckoutView, meta: { requiresAuth: true, title: 'Promocionar mi marca' } },
    { path: '/animals', name: 'animals', component: AnimalsView, meta: { requiresAuth: true, title: 'Mis animales' } },
    { path: '/animals/:animalId', name: 'animal-detail', component: AnimalsView, meta: { requiresAuth: true, title: 'Identidad animal' } },
  ],
  scrollBehavior: () => ({ top: 0, behavior: 'smooth' }),
})

function accessGrantLanding(user: NonNullable<ReturnType<typeof useAuthStore>['user']>) {
  const grant = user.accessGrant
  if (!grant) return { name: 'animals' }
  const animalId = grant.animalIds[0] ?? grant.animalId
  const query = { animalId }
  if (grant.permissions.includes('health:read') || grant.permissions.includes('health:manage')) {
    return { path: '/bioacta/salud', query }
  }
  if (grant.permissions.includes('care:read') || grant.permissions.includes('care:manage')) return { path: '/bioacta/cuidados', query }
  return { name: 'animal-detail', params: { animalId } }
}

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const previousGuest = auth.user?.isAccessGuest ? auth.user : null
  if (to.meta.guestOnly && await auth.refreshSession()) {
    return auth.user?.isAccessGuest ? accessGrantLanding(auth.user) : { name: 'home' }
  }
  if (to.meta.requiresAuth && !(await auth.refreshSession(to.meta.moderatorOnly === true || to.meta.superadminOnly === true))) {
    const invitation = previousGuest?.accessGrant
      ? router.resolve({
        name: 'bioacta-access',
        params: { grantId: previousGuest.accessGrant.id },
        query: { animalId: previousGuest.accessGrant.animalId, email: previousGuest.email },
      }).fullPath
      : to.fullPath
    return { name: 'login', query: { next: invitation, email: previousGuest?.email ?? (typeof to.query.email === 'string' ? to.query.email : undefined) } }
  }
  if (auth.user?.isAccessGuest) {
    const grant = auth.user.accessGrant
    if (!grant) return { name: 'login' }
    const permittedHealth = grant.permissions.includes('health:read') || grant.permissions.includes('health:manage')
    const permittedCare = grant.permissions.includes('care:read') || grant.permissions.includes('care:manage')
    if (
      ['animals', 'animal-detail'].includes(String(to.name))
      && (grant.allAnimals || (grant.animalIds.length ? grant.animalIds : [grant.animalId]).includes(String(to.params.animalId ?? '')))
    ) return true
    if (to.name === 'bioacta-workspace' && (
      to.params.section === 'salud' && permittedHealth
      || to.params.section === 'cuidados' && permittedCare
    )) return true
    return accessGrantLanding(auth.user)
  }
  if (to.meta.moderatorOnly && !auth.user?.isModerator) return { name: 'home' }
  if (to.meta.superadminOnly && auth.user?.role !== 'superadmin') return { name: 'home' }
  if (to.meta.guestOnly && await auth.refreshSession()) return { name: 'home' }
})

export default router

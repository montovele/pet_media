# Plataforma Social Personal — Especificación de Desarrollo Frontend Vue 3

## 1. Objetivo

Desarrollar el frontend de una plataforma social personal orientada a documentar actividades y momentos cotidianos mediante fotografías, videos, textos e historias multimedia.

La aplicación permitirá:

- Crear una cuenta y administrar el perfil.
- Publicar fotografías, videos y texto.
- Crear actividades.
- Convertir una actividad en una historia multimedia.
- Consultar un timeline personal.
- Abrir una historia completa y navegar por su contenido.
- Crear álbumes.
- Interactuar mediante reacciones y comentarios.
- Configurar privacidad.
- Conectar cuentas sociales.
- Preparar publicaciones para Instagram y Facebook.
- Consultar el estado de publicaciones externas.
- Mantener una arquitectura preparada para futuras funciones de IA, mapas, notificaciones y una red social más completa.

El frontend se desarrollará con **Vue 3**, utilizando Composition API y `<script setup>`.

---

# 2. Principios de arquitectura

El frontend debe diseñarse como una aplicación modular y escalable.

Principios:

1. Separación entre vistas, componentes, módulos de dominio y servicios.
2. Componentes reutilizables.
3. Estado global únicamente cuando sea necesario.
4. Servicios HTTP independientes de los componentes.
5. Tipado mediante TypeScript.
6. Formularios con validación.
7. Carga multimedia desacoplada del editor de historias.
8. Manejo explícito de estados `loading`, `success`, `error` y `empty`.
9. Diseño responsive desde el inicio.
10. Preparación para PWA sin acoplar la V1 a capacidades móviles específicas.

---

# 3. Stack frontend recomendado

## Base

- Vue 3
- Vite
- TypeScript
- Vue Router
- Pinia

## UI

Se recomienda utilizar un sistema de componentes consistente. Puede utilizarse una biblioteca UI o un sistema propio basado en componentes Vue.

## Multimedia

- `<input type="file">`
- Drag & Drop
- Previsualización local
- Upload progresivo
- Barra de progreso
- Video preview
- Image preview

## HTTP

- Axios o `fetch`
- Interceptores para autenticación
- Manejo centralizado de errores

## Validación

- Zod o una solución equivalente
- Validación reutilizable de formularios

## Calidad

- ESLint
- Prettier
- Vitest
- Vue Test Utils
- Playwright para pruebas E2E

---

# 4. Creación inicial del proyecto

```bash
npm create vite@latest personal-social -- --template vue-ts

cd personal-social

npm install

npm install vue-router pinia axios

npm install zod

npm install

npm run dev
```

### Ejecución local del proyecto

El backend y el frontend son procesos independientes. Inicia cada uno en una terminal distinta y deja ambas terminales abiertas mientras trabajas.

Terminal 1, desde la carpeta `backend`:

```bash
npm install
npm run dev
```

El backend debe mostrar `Servidor escuchando en http://localhost:4020` y mantener esa terminal ocupada. Comprueba que responde en `http://localhost:4020/health`; debe devolver `{"ok":true,"message":"API funcionando"}`. Para detenerlo usa `Ctrl+C` en esa terminal. `npm start` también inicia el servidor, pero no reinicia automáticamente al cambiar archivos.

Terminal 2, desde la carpeta `personal-social`:

```bash
npm install
npm run dev
```

Abre la URL `http://localhost:5199` de Vite. Si el prompt vuelve justo después del mensaje de escucha, comprueba `/health` antes de iniciar otra instancia: puede haber otro proceso del backend activo en una terminal distinta.

Para pruebas:

```bash
npm install -D vitest @vue/test-utils jsdom
```

Para E2E:

```bash
npm install -D playwright
```

---

# 5. Estructura del proyecto

Se recomienda organizar el proyecto por responsabilidades y módulos de dominio.

```text
src/
│
├── assets/
│
├── components/
│   ├── common/
│   ├── layout/
│   ├── media/
│   ├── stories/
│   ├── posts/
│   ├── profile/
│   ├── social/
│   └── notifications/
│
├── composables/
│
├── layouts/
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── profile/
│   ├── feed/
│   ├── posts/
│   ├── stories/
│   ├── activities/
│   ├── media/
│   ├── albums/
│   ├── comments/
│   ├── reactions/
│   ├── followers/
│   ├── notifications/
│   └── social/
│
├── router/
│
├── services/
│   ├── api/
│   ├── auth/
│   ├── media/
│   └── social/
│
├── stores/
│
├── types/
│
├── utils/
│
├── views/
│
├── App.vue
└── main.ts
```

---

# 6. Organización por módulos

Cada módulo debería contener sus propios componentes, tipos, servicios y lógica específica.

Ejemplo:

```text
modules/stories/
│
├── components/
│   ├── StoryCard.vue
│   ├── StoryViewer.vue
│   ├── StoryEditor.vue
│   ├── StoryBlock.vue
│   ├── StoryBlockEditor.vue
│   ├── StoryHeader.vue
│   └── StoryPrivacySelector.vue
│
├── composables/
│   ├── useStory.ts
│   ├── useStoryEditor.ts
│   └── useStoryBlocks.ts
│
├── services/
│   └── storiesApi.ts
│
├── types/
│   └── story.types.ts
│
└── index.ts
```

Esto evita terminar con cientos de componentes mezclados en una única carpeta.

---

# 7. Layout general

La aplicación tendrá un layout principal:

```text
App
│
└── MainLayout
    │
    ├── AppHeader
    │
    ├── Sidebar
    │
    ├── MainContent
    │
    └── MobileNavigation
```

En escritorio:

```text
┌──────────────────────────────────────────────┐
│ Logo              Buscar       🔔   Perfil   │
├───────────┬──────────────────────────────────┤
│           │                                  │
│ Inicio    │                                  │
│ Historias │           CONTENIDO              │
│ Fotos     │                                  │
│ Álbumes   │                                  │
│ Perfil    │                                  │
│           │                                  │
│           │                                  │
└───────────┴──────────────────────────────────┘
```

En móvil:

```text
┌─────────────────────┐
│ Logo          🔔    │
├─────────────────────┤
│                     │
│      CONTENIDO      │
│                     │
│                     │
├─────────────────────┤
│ 🏠  ＋  📖  👤     │
└─────────────────────┘
```

---

# 8. Rutas principales

La primera versión debería contemplar:

```text
/
├── /login
├── /register
│
├── /home
├── /feed
│
├── /profile
├── /profile/:username
│
├── /activities
├── /activities/new
├── /activities/:id
│
├── /stories
├── /stories/new
├── /stories/:id
├── /stories/:id/edit
│
├── /posts
├── /posts/new
├── /posts/:id
│
├── /photos
├── /videos
├── /albums
├── /albums/:id
│
├── /notifications
│
├── /settings
│   ├── /account
│   ├── /privacy
│   └── /social
│
└── /social
    ├── /accounts
    └── /publications
```

---

# 9. Router

Ejemplo:

```ts
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),

  routes: [
    {
      path: '/',
      redirect: '/home',
    },

    {
      path: '/login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: {
        guestOnly: true,
      },
    },

    {
      path: '/home',
      component: () => import('@/views/home/HomeView.vue'),
      meta: {
        requiresAuth: true,
      },
    },

    {
      path: '/stories/new',
      component: () => import('@/views/stories/StoryCreateView.vue'),
      meta: {
        requiresAuth: true,
      },
    },

    {
      path: '/stories/:id',
      component: () => import('@/views/stories/StoryView.vue'),
      meta: {
        requiresAuth: true,
      },
    },
  ],
})

export default router
```

El guard de autenticación deberá consultar el estado de sesión mediante un store de Pinia.

---

# 10. Stores globales

No todo debe convertirse en estado global.

Se recomienda inicialmente:

```text
stores/
├── auth.store.ts
├── ui.store.ts
├── notification.store.ts
└── social.store.ts
```

Los estados específicos de historias, posts y actividades pueden permanecer dentro de sus módulos.

---

# 11. Auth Store

Ejemplo conceptual:

```ts
interface AuthUser {
  id: number
  username: string
  name: string
  avatarUrl?: string
}

interface AuthState {
  user: AuthUser | null
  authenticated: boolean
  loading: boolean
}
```

Funciones:

```ts
login()
logout()
refreshSession()
loadUser()
```

La aplicación debe evitar guardar información sensible innecesaria en `localStorage`.

Preferentemente la sesión deberá utilizar cookies seguras gestionadas por el backend.

---

# 12. Cliente HTTP

Crear:

```text
services/api/client.ts
```

Ejemplo:

```ts
import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})
```

Interceptores:

```ts
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Manejar sesión expirada
    }

    return Promise.reject(error)
  },
)
```

---

# 13. Variables de entorno

`.env` en desarrollo local:

```env
VITE_API_URL=/api
VITE_APP_NAME=Personal Social
```

Vite reenvía las peticiones `/api` a `http://localhost:4020` mediante `server.proxy` en `vite.config.ts`. También se puede definir `VITE_API_URL=http://localhost:4020/api` para conectar directamente al backend; en ese caso el proxy no se utiliza.

Producción:

```env
VITE_API_URL=https://api.example.com/api
VITE_APP_NAME=Personal Social
```

Nunca incluir secretos de servidor en variables `VITE_*`.

---

# 14. Modelo de contenido

El frontend debe diferenciar:

```text
Post
Story
Activity
Media
Album
```

Aunque estén relacionados, no deben tratarse como una sola entidad.

---

# 15. TypeScript — Media

```ts
export type MediaType = 'image' | 'video'

export interface Media {
  id: number
  type: MediaType
  url: string
  thumbnailUrl?: string
  width?: number
  height?: number
  duration?: number
  mimeType?: string
  size?: number
  createdAt: string
}
```

---

# 16. TypeScript — Activity

```ts
export interface Activity {
  id: number
  title: string
  description?: string
  date: string
  locationName?: string
  latitude?: number
  longitude?: number
  category?: string
  coverMedia?: Media
}
```

---

# 17. TypeScript — Story

```ts
export type StoryBlockType =
  | 'text'
  | 'image'
  | 'video'
  | 'gallery'
  | 'location'

export interface StoryBlock {
  id?: number
  type: StoryBlockType
  position: number
  text?: string
  mediaId?: number
  media?: Media[]
  metadata?: Record<string, unknown>
}

export interface Story {
  id: number
  title: string
  description?: string
  activityId?: number
  coverMedia?: Media
  visibility: 'public' | 'private' | 'followers' | 'friends'
  publishedAt?: string
  blocks: StoryBlock[]
}
```

---

# 18. Timeline

La vista principal deberá mostrar una combinación de actividades, historias y publicaciones.

```text
FeedView
│
├── CreateContentBox
│
├── StoryHighlights
│
└── FeedTimeline
    │
    ├── ActivityCard
    ├── StoryCard
    ├── PostCard
    ├── StoryCard
    └── PostCard
```

No es necesario que el backend entregue todos los tipos como una única tabla.

El frontend puede consumir un endpoint de feed que normalice los elementos:

```ts
interface FeedItem {
  id: string
  type: 'post' | 'story' | 'activity'
  createdAt: string
  data: unknown
}
```

---

# 19. Story Card

La tarjeta debe mostrar únicamente información resumida.

```text
┌─────────────────────────────────────┐
│ Paseo por el parque                 │
│ 7 octubre 2026                      │
│                                     │
│ [          FOTO PRINCIPAL          ]│
│                                     │
│ Hoy salimos a caminar con los...   │
│                                     │
│ 8 fotos · 2 videos                  │
│                                     │
│ [Leer historia]                     │
└─────────────────────────────────────┘
```

Componente:

```text
StoryCard.vue
```

Props:

```ts
interface Props {
  story: Story
}
```

Eventos:

```text
open
share
react
comment
```

---

# 20. Story Viewer

La vista completa:

```text
StoryView
│
├── StoryHeader
├── StoryCover
├── StoryContent
│   ├── StoryBlock
│   ├── StoryBlock
│   └── StoryBlock
│
├── StoryActions
├── Comments
└── RelatedStories
```

La historia debe ser visualmente similar a un artículo multimedia.

---

# 21. Story Editor

El editor es uno de los componentes principales del proyecto.

```text
StoryEditor
│
├── StoryTitleInput
├── StoryDescriptionInput
├── StoryDateInput
├── StoryLocationInput
├── StoryPrivacySelector
│
├── StoryBlockEditor
│   ├── TextBlockEditor
│   ├── ImageBlockEditor
│   ├── VideoBlockEditor
│   └── GalleryBlockEditor
│
└── StoryEditorActions
```

---

# 22. Editor basado en bloques

El usuario podrá insertar:

```text
+ Texto
+ Foto
+ Video
+ Galería
+ Ubicación
```

Ejemplo de menú:

```text
Agregar contenido

[ Texto ]
[ Foto ]
[ Video ]
[ Galería ]
[ Ubicación ]
```

El estado del editor puede manejarse así:

```ts
const blocks = ref<StoryBlock[]>([])
```

Agregar bloque:

```ts
function addBlock(type: StoryBlockType) {
  blocks.value.push({
    type,
    position: blocks.value.length,
  })
}
```

---

# 23. Reordenamiento de bloques

Los bloques deben poder moverse:

```text
↑
↓
```

o mediante Drag & Drop.

Ejemplo:

```text
[ Texto ]             ↕
[ Foto ]              ↕
[ Texto ]             ↕
[ Video ]             ↕
[ Galería ]           ↕
```

Al guardar se recalcula:

```ts
blocks.value.forEach((block, index) => {
  block.position = index
})
```

---

# 24. Upload de imágenes

Crear:

```text
modules/media/components/MediaUploader.vue
```

Características:

- Selección múltiple.
- Drag & Drop.
- Preview.
- Validación MIME.
- Validación de tamaño.
- Eliminación.
- Progreso.
- Cancelación.
- Reintento.

Flujo:

```text
Archivo
  ↓
Validación
  ↓
Preview
  ↓
Upload
  ↓
Media ID
  ↓
Story Block
```

El frontend no debería considerar que una imagen está publicada solamente porque el upload local terminó.

---

# 25. Upload de videos

El componente deberá mostrar:

```text
Video seleccionado

[████████████░░░░] 72%

Procesando...
```

Después:

```text
✓ Video cargado

[ Preview ]

Duración: 00:32
```

El backend será responsable del procesamiento definitivo.

---

# 26. Crear actividad

La actividad debe poder crearse antes o después de la historia.

Flujo recomendado:

```text
Nueva actividad
      ↓
Información básica
      ↓
Agregar multimedia
      ↓
Crear historia
      ↓
Publicar
```

Formulario:

```text
Título
[ Paseo por el parque ]

Fecha
[ 07/10/2026 ]

Categoría
[ Mascotas ]

Ubicación
[ Parque ]

Descripción
[ ... ]

[Continuar]
```

---

# 27. Home

La página principal:

```text
HomeView
│
├── WelcomeHeader
│
├── QuickActions
│   ├── Nueva publicación
│   ├── Nueva historia
│   └── Nueva actividad
│
├── StoryHighlights
│
└── FeedTimeline
```

Quick actions:

```text
┌─────────────┐
│ 📷 Foto     │
├─────────────┤
│ 🎥 Video    │
├─────────────┤
│ 📖 Historia │
├─────────────┤
│ 📅 Actividad│
└─────────────┘
```

---

# 28. Perfil

```text
ProfileView
│
├── ProfileHeader
├── ProfileStats
├── ProfileTabs
│   ├── Historias
│   ├── Publicaciones
│   ├── Fotos
│   ├── Videos
│   └── Álbumes
│
└── ProfileContent
```

---

# 29. Álbumes

Un álbum agrupa contenido multimedia.

Ejemplo:

```text
Álbumes

[ Vacaciones 2026 ]
34 fotos · 5 videos

[ Mis perros ]
128 fotos · 12 videos

[ Familia ]
56 fotos · 8 videos
```

Ruta:

```text
/albums/:id
```

---

# 30. Comentarios

Componente:

```text
CommentSection.vue
```

Estructura:

```text
Comentarios

Ana:
Qué bonito paseo ❤️

Juan:
Gracias.

[ Escribe un comentario... ]

[Enviar]
```

La primera versión puede soportar un nivel de comentarios.

Posteriormente:

```text
comentario
 └── respuesta
      └── respuesta
```

---

# 31. Reacciones

Inicialmente:

```text
❤️ Me gusta
😂
😍
👏
```

Modelo:

```ts
interface Reaction {
  type: string
  count: number
  reacted: boolean
}
```

El componente:

```text
ReactionButton.vue
```

debe ser reutilizable en:

- Posts.
- Stories.
- Activities.
- Comments.

---

# 32. Privacidad

Crear:

```text
PrivacySelector.vue
```

Opciones:

```text
🌎 Público
👥 Seguidores
👫 Amigos
🔒 Solo yo
```

La interfaz debe explicar claramente qué significa cada opción.

---

# 33. Compartir internamente

Componente:

```text
ShareDialog.vue
```

Opciones:

```text
Compartir

○ Publicar en mi perfil
○ Copiar enlace
○ Compartir con amigos

Redes externas:

☐ Instagram
☐ Facebook
```

La publicación externa debe ser una acción explícita.

---

# 34. Integración social

Módulo:

```text
modules/social/
│
├── components/
│   ├── SocialAccountCard.vue
│   ├── SocialConnectButton.vue
│   ├── SocialPublishDialog.vue
│   └── SocialPublicationStatus.vue
│
├── services/
│   └── socialApi.ts
│
└── types/
    └── social.types.ts
```

---

# 35. Cuentas sociales

Modelo:

```ts
export type SocialPlatform =
  | 'facebook'
  | 'instagram'

export interface SocialAccount {
  id: number
  platform: SocialPlatform
  accountName: string
  connected: boolean
  connectedAt?: string
}
```

Vista:

```text
Cuentas conectadas

Facebook
🟢 Conectado

Instagram
🟢 Conectado

[Conectar cuenta]
```

El frontend nunca debe almacenar tokens OAuth directamente si el backend puede gestionarlos.

---

# 36. Publicación externa

Flujo:

```text
Historia
   ↓
Compartir
   ↓
Seleccionar plataforma
   ↓
Confirmar contenido
   ↓
Enviar al backend
   ↓
PENDING
   ↓
PROCESSING
   ↓
PUBLISHED / FAILED
```

El frontend debe consultar el estado o recibir actualizaciones mediante el mecanismo de eventos elegido por el backend.

---

# 37. Social Publish Dialog

```text
Publicar en redes

Contenido:

[Preview]

Instagram
☑

Facebook
☐

Texto:

[ Hoy tuvimos una excelente tarde
  en el parque... ]

[Cancelar] [Publicar]
```

Posteriormente se pueden agregar:

- Hashtags.
- Mención.
- Programación.
- Adaptación automática del texto.
- Diferentes textos por red social.

---

# 38. Estados de UI

Cada vista debe contemplar:

```text
Loading
Empty
Success
Error
```

Ejemplo:

```vue
<template>
  <LoadingState v-if="loading" />

  <ErrorState
    v-else-if="error"
    :message="error"
  />

  <EmptyState
    v-else-if="stories.length === 0"
    message="Todavía no tienes historias."
  />

  <StoryList
    v-else
    :stories="stories"
  />
</template>
```

---

# 39. Infinite Scroll

El timeline debe evitar cargar cientos de publicaciones inicialmente.

Usar paginación:

```text
GET /feed?page=1&limit=20
```

Respuesta:

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

El frontend puede implementar:

```text
IntersectionObserver
```

para solicitar automáticamente la siguiente página.

---

# 40. Skeleton Loading

En lugar de mostrar una pantalla vacía:

```text
[████████████████]
[██████████]
[████████████████████]
```

usar skeletons para:

- StoryCard.
- PostCard.
- Profile.
- MediaGrid.
- Comments.

---

# 41. Manejo de errores

Crear:

```text
utils/errors.ts
```

Normalizar errores:

```ts
interface AppError {
  message: string
  code?: string
  status?: number
}
```

Mensajes amigables:

```text
No pudimos cargar la historia.

[Intentar nuevamente]
```

No mostrar directamente errores internos del backend.

---

# 42. Notificaciones

Crear:

```text
NotificationCenter.vue
```

Tipos:

```text
LIKE
COMMENT
FOLLOW
STORY_PUBLISHED
SOCIAL_PUBLISHED
SOCIAL_FAILED
```

Ejemplo:

```text
🔔 Notificaciones

Ana reaccionó a tu historia.

Facebook publicó correctamente
"Paseo por el parque".

Instagram no pudo publicar
la historia.
```

---

# 43. Composables

Reutilizar lógica mediante composables.

Ejemplos:

```text
composables/
├── usePagination.ts
├── useInfiniteScroll.ts
├── useMediaUpload.ts
├── useModal.ts
├── useDebounce.ts
└── usePermissions.ts
```

Y dentro de módulos:

```text
modules/stories/composables/
├── useStory.ts
├── useStoryEditor.ts
└── useStoryBlocks.ts
```

---

# 44. Diseño responsive

Breakpoints mínimos:

```text
Mobile
< 768px

Tablet
768px - 1023px

Desktop
>= 1024px
```

La prioridad debe ser:

```text
Mobile
↓
Tablet
↓
Desktop
```

porque la plataforma estará orientada a capturar y publicar contenido desde dispositivos móviles.

---

# 45. Experiencia móvil

La creación de contenido debe requerir pocos pasos.

Botón principal:

```text
              +
```

Al tocarlo:

```text
¿Qué quieres crear?

📷 Foto
🎥 Video
📖 Historia
📅 Actividad
```

También debe ser posible acceder directamente a la cámara/galería mediante las capacidades estándar del navegador.

---

# 46. Diseño de la historia

La experiencia de lectura debe priorizar contenido multimedia.

```text
┌───────────────────────────────┐
│ ← Paseo por el parque         │
│   7 octubre 2026              │
│                               │
│       [ IMAGEN ]              │
│                               │
│ Hoy salimos a caminar...      │
│                               │
│       [ VIDEO ]               │
│                               │
│ Después jugamos...            │
│                               │
│       [ GALERÍA ]             │
│                               │
│ ❤️ 12   💬 3   Compartir      │
└───────────────────────────────┘
```

---

# 47. Accesibilidad

Desde la primera versión:

- `alt` para imágenes.
- Labels para formularios.
- Navegación por teclado.
- Contraste adecuado.
- Focus visible.
- Botones accesibles.
- Estados `aria`.
- No depender únicamente del color.
- Texto alternativo para contenido multimedia cuando sea necesario.

---

# 48. Seguridad frontend

El frontend nunca debe considerarse una barrera de seguridad.

Validaciones:

```text
Frontend
   ↓
Backend
   ↓
Storage
```

El backend debe volver a validar:

- Tipo de archivo.
- Tamaño.
- Autorización.
- Propiedad del contenido.
- Privacidad.
- Permisos sociales.

No confiar en:

```text
user_id
visibility
role
permissions
```

enviados por el navegador.

---

# 49. Protección XSS

Nunca renderizar HTML arbitrario del usuario con:

```vue
v-html
```

salvo que exista una sanitización robusta.

Para las historias, inicialmente almacenar texto estructurado.

Si posteriormente se permite contenido enriquecido, sanitizarlo en backend y frontend.

---

# 50. Optimización multimedia

La aplicación no debe descargar imágenes originales cuando solamente necesita una miniatura.

Usar:

```text
thumbnail
small
medium
large
original
```

Ejemplo:

```ts
interface MediaVariants {
  thumbnail: string
  small: string
  medium: string
  large: string
  original: string
}
```

La interfaz seleccionará el tamaño adecuado.

---

# 51. Galería

Crear:

```text
MediaGallery.vue
```

Funciones:

- Grid.
- Preview.
- Lightbox.
- Navegación anterior/siguiente.
- Zoom.
- Video.
- Contador.

Ejemplo:

```text
┌────────┬────────┬────────┐
│ FOTO   │ FOTO   │ VIDEO  │
├────────┼────────┼────────┤
│ FOTO   │ FOTO   │ FOTO   │
└────────┴────────┴────────┘
```

---

# 52. Estado del editor

El editor debe diferenciar:

```text
draft
saving
saved
publishing
published
error
```

Ejemplo:

```text
Borrador guardado ✓
```

Esto permitirá posteriormente implementar auto-save.

---

# 53. Auto-save

Una evolución importante será:

```text
Usuario escribe
      ↓
debounce 1-2 segundos
      ↓
guardar borrador
```

Estado:

```text
Guardando...
```

Después:

```text
Guardado ✓
```

El usuario no debería perder una historia por cerrar accidentalmente el navegador.

---

# 54. Borradores

Crear una sección:

```text
/stories/drafts
```

Ejemplo:

```text
Mis borradores

Paseo por el parque
Modificado hace 5 minutos

Cumpleaños
Modificado ayer

Viaje
Modificado hace 3 días
```

---

# 55. API frontend esperada

El frontend puede asumir inicialmente endpoints como:

```text
POST   /auth/login
POST   /auth/logout
GET    /auth/me

GET    /feed

GET    /stories
GET    /stories/:id
POST   /stories
PUT    /stories/:id
DELETE /stories/:id

POST   /stories/:id/publish

GET    /activities
POST   /activities
GET    /activities/:id

POST   /media/upload
GET    /media/:id
DELETE /media/:id

GET    /albums
POST   /albums
GET    /albums/:id

POST   /comments
DELETE /comments/:id

POST   /reactions
DELETE /reactions/:id

GET    /notifications

GET    /social/accounts
POST   /social/:platform/connect
DELETE /social/:platform/disconnect

POST   /social/publications
GET    /social/publications
GET    /social/publications/:id
```

Los nombres pueden ajustarse al contrato definitivo del backend.

---

# 56. Separación frontend/backend

El frontend no debe contener lógica específica de Meta.

Incorrecto:

```text
StoryView
 └── Facebook API
```

Correcto:

```text
StoryView
    ↓
SocialPublishDialog
    ↓
socialApi
    ↓
Backend
    ↓
Meta API
```

Esto mantiene desacoplada la aplicación.

---

# 57. Arquitectura de componentes

Una historia completa:

```text
StoryView
│
├── StoryHeader
│
├── StoryCover
│
├── StoryRenderer
│   │
│   ├── TextBlock
│   ├── ImageBlock
│   ├── VideoBlock
│   ├── GalleryBlock
│   └── LocationBlock
│
├── StoryActions
│   ├── ReactionButton
│   ├── CommentButton
│   └── ShareButton
│
├── CommentSection
│
└── RelatedStories
```

El `StoryRenderer` decide qué componente utilizar según:

```ts
block.type
```

---

# 58. Story Renderer

Ejemplo conceptual:

```vue
<component
  :is="resolveBlockComponent(block.type)"
  :block="block"
/>
```

Mapa:

```ts
const blockComponents = {
  text: TextBlock,
  image: ImageBlock,
  video: VideoBlock,
  gallery: GalleryBlock,
  location: LocationBlock,
}
```

Esto permite agregar nuevos tipos sin modificar toda la aplicación.

---

# 59. Arquitectura de estado

La regla recomendada:

```text
Estado global
    ↓
Sesión
UI global
Notificaciones
Configuración

Estado de módulo
    ↓
Stories
Posts
Activities
Albums

Estado local
    ↓
Formularios
Modales
Filtros
Editor
```

Evitar introducir Pinia para cada pequeño estado.

---

# 60. Primera fase de implementación

Orden recomendado:

## Sprint 1 — Base

```text
✓ Vite
✓ Vue 3
✓ TypeScript
✓ Router
✓ Pinia
✓ Axios
✓ Layout
✓ Auth
```

## Sprint 2 — Perfil

```text
✓ Perfil
✓ Avatar
✓ Estadísticas
✓ Configuración
```

## Sprint 3 — Media

```text
✓ Upload
✓ Preview
✓ Galería
✓ Imagen
✓ Video
```

## Sprint 4 — Actividades

```text
✓ Crear actividad
✓ Editar
✓ Ver actividad
✓ Timeline
```

## Sprint 5 — Historias

```text
✓ Crear historia
✓ Editor
✓ Bloques
✓ Reordenamiento
✓ Preview
✓ Publicación
```

## Sprint 6 — Social

```text
✓ Reacciones
✓ Comentarios
✓ Seguidores
✓ Notificaciones
```

## Sprint 7 — Redes externas

```text
✓ Cuentas sociales
✓ OAuth
✓ Instagram
✓ Facebook
✓ Estado de publicaciones
```

---

# 61. MVP real

Para no sobredimensionar la primera entrega, el MVP frontend debería limitarse a:

```text
AUTH
 ├── Login
 └── Registro

PROFILE
 └── Perfil

HOME
 └── Timeline

MEDIA
 ├── Foto
 └── Video

ACTIVITIES
 └── Crear actividad

STORIES
 ├── Crear
 ├── Editar
 ├── Publicar
 └── Leer completa

SOCIAL
 └── Compartir
```

Dejar para una segunda etapa:

```text
Seguidores
Mensajería
Stories efímeras
Algoritmo avanzado
Live streaming
IA
Edición avanzada de video
Programación social
Marketplace
```

---

# 62. Roadmap visual

```text
                V1
                 │
        ┌────────┴────────┐
        │                 │
     CUENTA             CONTENIDO
        │                 │
        │           ┌─────┴─────┐
        │           │           │
      PERFIL       FOTOS       VIDEOS
        │           │           │
        └───────────┼───────────┘
                    ↓
                ACTIVIDADES
                    ↓
                 HISTORIAS
                    ↓
                 TIMELINE
                    ↓
               INTERACCIONES
                    ↓
             FACEBOOK / INSTAGRAM
                    ↓
                   V2
                    │
          ┌─────────┼─────────┐
          ↓         ↓         ↓
          IA      MAPAS     PWA
```

---

# 63. Criterios de aceptación del frontend

La V1 será considerada funcional cuando:

- El usuario pueda autenticarse.
- El usuario pueda visualizar su perfil.
- El usuario pueda crear una actividad.
- El usuario pueda cargar fotografías.
- El usuario pueda cargar videos.
- El usuario pueda crear una historia.
- La historia permita múltiples bloques.
- Los bloques puedan reordenarse.
- El usuario pueda guardar un borrador.
- El usuario pueda publicar una historia.
- El timeline muestre las historias.
- El usuario pueda abrir una historia completa.
- Las fotografías puedan visualizarse en galería.
- Los videos puedan reproducirse.
- El contenido tenga controles de privacidad.
- Existan estados de carga y error.
- La interfaz funcione correctamente en móvil y escritorio.
- La arquitectura permita posteriormente conectar Facebook e Instagram sin rehacer el módulo de historias.

---

# 64. Resultado esperado

La primera experiencia del usuario debería ser extremadamente sencilla:

```text
                 ENTRAR
                    ↓
                  HOME
                    ↓
                 [+]
                    ↓
          ¿Qué quieres crear?
                    │
       ┌────────────┼────────────┐
       ↓            ↓            ↓
      FOTO        VIDEO       HISTORIA
                                  ↓
                              ACTIVIDAD
                                  ↓
                         Agregar contenido
                                  ↓
                              HISTORIA
                                  ↓
                              PUBLICAR
                                  ↓
                        ┌─────────┴─────────┐
                        ↓                   ↓
                    Mi perfil          Redes sociales
                                            │
                                  ┌─────────┴─────────┐
                                  ↓                   ↓
                              Instagram           Facebook
```

La prioridad del frontend debe ser que **capturar un momento sea rápido**, mientras que la consulta posterior permita **leer y revivir la historia completa**.

---

# 65. Siguiente etapa técnica

Después de aprobar esta arquitectura, la implementación puede comenzar en este orden:

1. Crear el proyecto Vue 3 + TypeScript.
2. Configurar Router y Pinia.
3. Crear `MainLayout`.
4. Crear autenticación.
5. Crear `HomeView`.
6. Crear `ProfileView`.
7. Implementar `MediaUploader`.
8. Implementar `ActivityCreateView`.
9. Implementar `StoryEditor`.
10. Implementar `StoryRenderer`.
11. Implementar `StoryView`.
12. Implementar timeline.
13. Implementar comentarios y reacciones.
14. Implementar configuración de privacidad.
15. Implementar módulo social.
16. Integrar los endpoints reales del backend.
17. Implementar pruebas.
18. Preparar build de producción.

---

# 66. Estructura final recomendada

```text
personal-social/
│
├── public/
│
├── src/
│   │
│   ├── assets/
│   │
│   ├── components/
│   │
│   ├── composables/
│   │
│   ├── layouts/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── profile/
│   │   ├── feed/
│   │   ├── posts/
│   │   ├── stories/
│   │   ├── activities/
│   │   ├── media/
│   │   ├── albums/
│   │   ├── comments/
│   │   ├── reactions/
│   │   ├── followers/
│   │   ├── notifications/
│   │   └── social/
│   │
│   ├── router/
│   │
│   ├── services/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── media/
│   │   └── social/
│   │
│   ├── stores/
│   │
│   ├── types/
│   │
│   ├── utils/
│   │
│   ├── views/
│   │
│   ├── App.vue
│   └── main.ts
│
├── .env
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

Esta estructura debe considerarse la **especificación base del frontend Vue 3**. El contrato API definitivo deberá coordinarse posteriormente con el backend para que entidades como `Story`, `Activity`, `Media`, `Post` y `SocialPublication` mantengan nombres y estructuras consistentes entre ambos proyectos.

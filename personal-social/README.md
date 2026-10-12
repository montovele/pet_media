# Entremomentos

Frontend inicial de una plataforma social personal para guardar historias, actividades y publicaciones cotidianas. Está construido con Vue 3, TypeScript, Vite, Vue Router y Pinia.

## Ejecutar

Requiere Node.js 22 LTS y npm. El backend debe arrancar en una terminal separada antes de abrir el frontend.

```bash
# Terminal 1 - backend
cd backend
npm install
npm run dev
```

```bash
# Terminal 2 - frontend
cd personal-social
npm install
npm run dev -- --host
```

Deja ambas terminales abiertas: los servidores siguen ejecutándose hasta que pulses `Ctrl+C`. Comprueba el backend en `http://localhost:4000/health`; debe responder `{"ok":true,"message":"API funcionando"}`. Vite muestra la URL del frontend al iniciar y puede elegir otro puerto, como `5175`, si el predeterminado está ocupado.

El frontend usa Vite proxy para redirigir `/api` hacia `http://localhost:4000`; conserva `VITE_API_URL=/api` (o deja la variable sin definir) para usar ese proxy. Si `/api/auth/me` devuelve `502 Bad Gateway`, confirma primero que el backend siga corriendo y que `/health` responda. Un `401` en `/api/auth/me` sin haber iniciado sesión es normal: indica que el backend respondió pero no hay cookie de sesión válida.

El build de producción se valida con:

```bash
npm run build
```

## Alcance implementado

- Inicio con timeline de publicaciones e historias; actividades se registran y consultan en su módulo propio.
- Portada pública en `/` con información del producto, beneficios e invitación a crear cuenta; exploración anónima en `/explore` limitada a historias públicas.
- Formulario de registro validado y preparado para `POST /auth/register`.
- Exploración anónima de historias y lectura pública limitada a contenido con visibilidad pública.
- Formulario de inicio de sesión y guardas frontend que requieren la sesión de cookie reportada por `GET /auth/me` para las rutas personales.
- Publicaciones de texto y reacciones guardadas en el estado de Pinia.
- Creación local de historias con título, texto, privacidad y previsualización opcional de imagen o video.
- Lectura de historias individuales con bloques ordenados de texto, imagen y video; las reacciones se actualizan en el estado local.
- Estructura social para cuentas de Instagram/Facebook, solicitud de publicación desde una historia y consulta de estados externos.
- Perfil personal con estado vacío y acceso a historias.
- Biblioteca de fotos propias de historias y publicaciones, con búsqueda local.
- Creación de álbumes persistentes y selección de fotos desde la biblioteca personal.
- Navegación responsive para escritorio y móvil.
- Cliente Axios preparado para conectar una API.

Los datos del feed son locales y se reinician al recargar. Los archivos elegidos generan una previsualización en el navegador; todavía no se cargan a un servidor ni se guardan como borradores persistentes.

## API

Copia `.env.example` a `.env`. En desarrollo, usa `VITE_API_URL=/api` para que Vite reenvíe las solicitudes a `http://localhost:4000`. No incluyas secretos en variables `VITE_*`.

El módulo de autenticación espera `POST /auth/register` con `name`, `email` y `password`; `POST /auth/login`; `POST /auth/logout`; y `GET /auth/me`. La sesión debe gestionarse con cookies seguras `HttpOnly`, `Secure` en producción y protección CSRF acorde al backend. El frontend no guarda contraseñas ni tokens en `localStorage`. Las guardas de Vue solo mejoran la navegación: los permisos y la privacidad siempre deben validarse también en cada endpoint del backend.

El módulo social espera que el backend gestione OAuth y tokens, sin exponer credenciales de Meta al navegador. Contrato frontend esperado:

```text
GET    /social/accounts                  -> SocialAccount[]
POST   /social/:platform/connect         -> { authorizationUrl }
DELETE /social/:platform/disconnect
POST   /social/publications              -> { items: SocialPublication[] }
GET    /social/publications              -> { items: SocialPublication[] }
GET    /social/publications/:id          -> SocialPublication
```

Para habilitar la conexión real, configura las variables OAuth de Meta y la URI de retorno en `backend/.env`; consulta `backend/README.md`.

La solicitud de publicación contiene `storyId`, `storyTitle`, `platforms` y `caption`. Cada publicación debe reportar `PENDING`, `PROCESSING`, `PUBLISHED` o `FAILED`. La pantalla de estado permite actualización manual; el polling o eventos en tiempo real quedan pendientes de acordar con el backend.

## Siguiente etapa

Completar autenticación/inicio de sesión y conectar el endpoint de registro, implementar los endpoints sociales/OAuth y ampliar la gestión de álbumes. Después agregar pruebas unitarias y E2E para los flujos de publicación.

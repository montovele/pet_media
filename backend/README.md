- Configura `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` y `CLIENT_URL` en `backend/.env`. En producción, `CLIENT_URL` debe ser el origen público del frontend: se usa para enlazar a `/explore` al final de las publicaciones compartidas. Instagram debe ser una cuenta profesional vinculada a una página de Facebook; Facebook requiere una página administrable.\n
# Backend de Plataforma Social

API REST con Express, MySQL y sesiones JWT en cookie `httpOnly`.

## Requisitos

- Node.js 20 o superior
- MySQL 8

## Desarrollo local

1. Copia `.env.example` a `.env` y configura las credenciales de MySQL.
2. Sustituye `JWT_SECRET` por una cadena aleatoria de al menos 32 caracteres.
3. Instala dependencias con `npm install`.
4. Crea la base y sus tablas con `npm run init:db` (puedes volver a ejecutarlo para agregar tablas nuevas sin borrar datos).
5. Carga los datos de demostración con `npm run seed:db`.
6. Inicia la API con `npm run dev`.

Para desarrollo, `MODERATOR_EMAILS` acepta una lista separada por comas. La configuración local usa `mariana.demo@example.test`; en producción reemplázala por direcciones verificadas y controladas por el equipo de moderación.

La API escucha en `http://localhost:4000`; `GET /health` comprueba que Express está activo. El frontend debe usar `VITE_API_URL=http://localhost:4000/api` durante el desarrollo.

## Autenticación disponible

- `POST /api/auth/register`: `{ "name", "email", "password" }`; contraseña de 10 a 128 caracteres.
- `POST /api/auth/login`: valida credenciales y establece la cookie `social_session`.
- `POST /api/auth/logout`: elimina la cookie de sesión.
- `GET /api/auth/me`: devuelve el usuario de la sesión actual.

Las rutas de registro/login validan el cuerpo de entrada. Las contraseñas se almacenan con bcrypt y los errores de servidor no exponen detalles internos.

## Identidad de marca

- `GET /api/brand` devuelve el nombre y el logo globales de la plataforma.
- `PATCH /api/brand` permite actualizar `name` y `logoUrl`; requiere rol `superadmin`. Para cambiar el logo, primero carga un JPG, PNG o WebP con `POST /api/media/upload` y envía la ruta `/api/media/:id` devuelta.
- Ejecuta `npm run init:db` en instalaciones existentes para crear `brand_settings`. El logo solo se sirve públicamente mientras siga asignado como identidad de marca.

## Archivos multimedia

- `POST /api/media/upload` recibe `multipart/form-data` con hasta 20 campos `files` por petición y requiere sesión. Admite varias imágenes (JPG, PNG o WebP) y videos (MP4 o WebM), de hasta 50 MB cada uno. El frontend divide galerías grandes en peticiones consecutivas, sin limitar la cantidad total de archivos por historia.
- `GET /api/media/:id` sirve los archivos asociados a historias públicas; para historias privadas o de seguidores solo puede acceder su propietario.
- Los archivos se guardan en `backend/uploads/`, que está excluido de Git. `PUBLIC_API_URL` es opcional y permite definir la URL pública base de la API cuando está detrás de un proxy.
- Ejecuta `npm run init:db` para crear la tabla `story_media` en instalaciones existentes antes de publicar archivos.

## Actividades

- `GET /api/activities` devuelve las actividades de la sesión actual.
- `POST /api/activities` crea una actividad con `title`, `date` (`YYYY-MM-DD`) y opcionalmente `description`, `locationName`, `category` (`walk`, `travel`, `food`, `wellness`, `culture` o `other`) y `videoId`.
- Para adjuntar un video, súbelo primero con `POST /api/media/upload` como MP4 o WebM (máximo 50 MB) y envía su ID como `videoId`. La API valida propiedad, tipo y que el archivo no esté asociado a otra historia o actividad.
- Ejecuta `npm run init:db` en bases existentes para agregar `activities` y `activity_media`; este comando conserva las tablas y datos actuales. Los videos asociados a actividades solo son visibles para su propietario.

## Fotos y álbumes

- `GET /api/photos` devuelve las imágenes propias de historias y publicaciones de la sesión actual.
- `GET /api/photos/:id` devuelve el detalle de una imagen de esa biblioteca personal.
- `GET /api/albums` lista las colecciones personales y sus fotos.
- `GET /api/albums/:id` devuelve el detalle de una colección propia.
- `POST /api/albums` crea una colección con `title`, `description` opcional y una lista de `photoIds` de la biblioteca propia; el backend verifica propiedad antes de guardar.
- Ejecuta `npm run init:db` en bases existentes para agregar `albums` y `album_photos` sin eliminar datos actuales.

## Conexión con Meta

- `GET /api/social/accounts`, `POST /api/social/:platform/connect` y `DELETE /api/social/:platform/disconnect` requieren sesión.
- Meta regresa a `GET /api/social/callback`; registra en Meta for Developers el mismo URI indicado por `META_REDIRECT_URI`.
- Configura `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `CLIENT_URL` y `PUBLIC_APP_URL` en `backend/.env`. `PUBLIC_APP_URL` debe ser el dominio público del frontend; se añade al pie de cada publicación como enlace de invitación a `/explore`. Si no se define, se conserva la invitación textual y no se publica una URL local de localhost.
- Cada publicación externa incluye la atribución “Compartido desde Entre Momentos” y una invitación a conocer la comunidad. Instagram debe ser una cuenta profesional vinculada a una página de Facebook; Facebook requiere una página administrable.
- Sin las credenciales, el inicio de conexión responde `503` con instrucciones; no crea conexiones ficticias. Meta también requiere que la app esté configurada y tenga los permisos aprobados para las cuentas objetivo.

## Datos de demostración

El seed crea tres usuarios de prueba y contenido asociado en publicaciones, historias, comentarios, reacciones, notificaciones y publicaciones sociales. Es seguro volver a ejecutarlo: conserva los IDs de muestra y actualiza sus datos.

- `mariana.demo@example.test`
- `mateo.demo@example.test`
- `lucia.demo@example.test`
- Contraseña común: `SocialDemo2026!`

Las cuentas sociales de muestra quedan desconectadas y no tienen tokens reales.

## Moderación

- Configura `SUPERADMIN_EMAILS` con el correo de una cuenta ya registrada para designar el primer superadministrador. Solo un superadministrador puede asignar roles desde la interfaz; no se puede asignar otro superadministrador desde el panel. `MODERATOR_EMAILS` se conserva como compatibilidad para instalaciones anteriores.
- Ejecuta `npm run init:db` para migrar `users.role`, el estado de revisión de historias/publicaciones y las tablas de auditoría. Las publicaciones públicas que ya existían se conservan aprobadas; el contenido público nuevo queda pendiente.
- `GET /api/moderation/publications?status=pending|approved|rejected|all` consulta la bandeja. Los roles `superadmin`, `admin`, `editor` y `moderator` pueden aprobar o rechazar contenido; un rechazo exige un motivo.
- `PATCH /api/moderation/content/:kind/:contentId/review` registra la decisión y su auditoría. Los endpoints de feed público y de medios solo muestran contenido público aprobado; el autor puede ver sus elementos pendientes o rechazados.
- `GET /api/moderation/users` y `PATCH /api/moderation/users/:userId/role` son exclusivos del superadministrador. Roles disponibles: `admin`, `editor`, `moderator` y `user`.
- `PATCH /api/moderation/users/:userId/status` activa o desactiva una cuenta y exige un motivo; la acción queda en `moderation_actions`.

## Anuncios de marca

- `/admin/ads` es el estudio privado del superadministrador para crear y editar campañas de marca. Las rutas `GET/POST/PUT/DELETE /api/ads` exigen rol `superadmin`; `GET /api/ads/public` solo devuelve campañas activas dentro de su periodo vigente.
- Ejecuta `npm run init:db` para crear `brand_ads`. Se agregan tres ejemplos (`Entre Momentos`, `Taller Horizonte` y `Café de Barrio`) como borradores y una campaña `Campaña de prueba` activa para demostrar la ubicación en el feed; el ejemplo activo enlaza a `/explore` y se crea una sola vez.
- Las campañas incluyen marca, titular, texto, creatividad, CTA, destino y fechas opcionales. Inicio y Explorar las muestran intercaladas con una etiqueta visible `ANUNCIO`; son promociones internas de la plataforma, no campañas pagadas administradas por Meta/Facebook Ads.
- Las creatividades de campaña se suben desde el panel a `backend/uploads/ads/`; admite JPG, PNG y WebP de hasta 8 MB, comprueba el tipo real del archivo y no depende de URLs de imágenes externas. `npm run init:db` limpia las referencias de imagen externas que existan en campañas antiguas para que puedan sustituirse con una carga local.
- El destino admite rutas internas o URLs HTTP/HTTPS públicas. Sustituye los destinos `example.com` de los ejemplos antes de activar campañas reales.

### Contratación y pagos

- Los clientes autenticados crean su creatividad en `/ads/checkout`, seleccionan una duración y reciben una cotización calculada por el backend con las reglas administradas por el superadmin. El importe que llega del navegador nunca determina el cobro.
- Los pagos se procesan en Stripe Checkout alojado. Configura `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `PUBLIC_APP_URL` en `backend/.env`. Registra `POST https://TU_API/api/ads/webhook` en Stripe con eventos `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` y `charge.refunded`. Para desarrollo local, reenvía eventos con Stripe CLI a `http://localhost:4000/api/ads/webhook`.
- Las nuevas campañas permanecen en borrador mientras se paga. Solo el webhook con firma válida y con monto/moneda coincidentes confirma el pedido y activa la campaña durante los días contratados. Un reembolso completo pausa el anuncio; eventos repetidos son idempotentes.
- El superadmin configura precio diario, moneda, duración mínima/máxima y disponibilidad desde el estudio. El precio queda congelado en cada pedido. Las claves de Stripe no se introducen en la base de datos ni en el frontend.
- Sin la clave privada y el secreto de webhook, el checkout responde `503` y no se activa ninguna campaña; no existe modo de cobro simulado.
- Las cuentas desactivadas no pueden iniciar sesión ni usar sesiones existentes; sus publicaciones y medios dejan de estar disponibles en el feed público.
- Ejecuta `npm run init:db` en bases existentes para aplicar los campos de estado de usuario y crear el registro de auditoría.
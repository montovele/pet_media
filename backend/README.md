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
4. Crea la base y sus tablas con `npm run init:db` (puedes volver a ejecutarlo para agregar tablas nuevas sin borrar datos). En una base existente donde solo necesites habilitar BIO-ACTA, ejecuta `npm run init:bioacta`; requiere que la base y la tabla `users` ya existan.
5. Carga los datos de demostración de la plataforma con `npm run seed:db`. Para poblar también los módulos de la interfaz y BIO-ACTA, ejecuta `npm run seed:demo -- --email=correo-de-la-cuenta`; el correo debe pertenecer a una cuenta activa existente. Si omites `--email`, usa `mateo.demo@example.test`.
6. Inicia la API con `npm run dev`.

Para desarrollo, `MODERATOR_EMAILS` acepta una lista separada por comas. La configuración local usa `mariana.demo@example.test`; en producción reemplázala por direcciones verificadas y controladas por el equipo de moderación.

La API escucha en `http://localhost:4020`; `GET /health` comprueba que Express está activo. El frontend debe usar `VITE_API_URL=http://localhost:4020/api` durante el desarrollo.

## Autenticación disponible

- `POST /api/auth/register`: `{ "name", "email", "password" }`; contraseña de 10 a 128 caracteres.
- `POST /api/auth/login`: valida credenciales y establece la cookie `social_session`.
- `POST /api/auth/logout`: elimina la cookie de sesión.
- `GET /api/auth/me`: devuelve el usuario de la sesión actual.

Las rutas de registro/login validan el cuerpo de entrada. Las contraseñas se almacenan con bcrypt y los errores de servidor no exponen detalles internos.

## Identidad de marca

- `GET /api/brand` devuelve el nombre, el logo y los colores globales de la plataforma.
- `PATCH /api/brand` permite actualizar `name`, `logoUrl`, `primaryColor` y `secondaryColor` (colores hexadecimales `#RRGGBB`); requiere rol `superadmin`. Para cambiar el logo, primero carga un JPG, PNG o WebP con `POST /api/media/upload` y envía la ruta `/api/media/:id` devuelta.
- Ejecuta `npm run init:db` o `npm run init:bioacta` en instalaciones existentes para crear o actualizar `brand_settings` y sus colores. Reinicia la API después de aplicar la migración. El logo solo se sirve públicamente mientras siga asignado como identidad de marca.

## Archivos multimedia

- `POST /api/media/upload` recibe `multipart/form-data` con hasta 20 campos `files` por petición y requiere sesión. Admite varias imágenes (JPG, PNG, WebP, GIF, AVIF o BMP) y videos (MP4 o WebM), de hasta 100 MB cada uno. El frontend divide galerías grandes en peticiones consecutivas, sin limitar la cantidad total de archivos por historia.
- `GET /api/media/:id` sirve los archivos asociados a historias públicas; para historias privadas o de seguidores solo puede acceder su propietario.
- Los archivos se guardan en `backend/uploads/`, que está excluido de Git. `PUBLIC_API_URL` es opcional y permite definir la URL pública base de la API cuando está detrás de un proxy.
- Ejecuta `npm run init:db` para crear la tabla `story_media` en instalaciones existentes antes de publicar archivos.

## Actividades

- `GET /api/activities` devuelve las actividades de la sesión actual, incluyendo los datos básicos del animal asociado cuando exista.
- `POST /api/activities` crea una actividad asociada obligatoriamente a `animalId`, con `title`, `date` (`YYYY-MM-DD`) y opcionalmente `description`, `locationName`, `category` (`walk`, `travel`, `food`, `wellness`, `culture` o `other`) y `videoId`. La API comprueba el acceso autorizado del usuario al animal.
- Para adjuntar un video, súbelo primero con `POST /api/media/upload` como MP4 o WebM (máximo 100 MB) y envía su ID como `videoId`. La API valida propiedad, tipo y que el archivo no esté asociado a otra historia o actividad.
- Ejecuta `npm run init:db` en bases existentes para agregar `activities`, `activity_media` y `activities.animal_id`; este comando conserva las tablas y datos actuales. Las actividades anteriores quedan sin animal asociado y no se incluyen en las historias BIO-ACTA. Los videos asociados a actividades son visibles a sus titulares y a las personas con acceso vigente al expediente del animal.

## BIO-ACTA: identidades, cuidados y continuidad

- `POST /api/animals` crea una identidad con especie, atributos opcionales, `provisional` y hasta ocho identificadores privados (microchip, tatuaje, registro u otro). La API asigna un UUID interno y un identificador público aleatorio; los registros nuevos son `registered` o `provisional`, nunca certificados por esta acción.
- `POST /api/animals/duplicates` busca coincidencias exactas normalizadas por especie, nombre/señas públicas e identificadores. Solo devuelve los datos mínimos de registros con visibilidad pública; para una coincidencia privada por identificador devuelve únicamente una señal de posible coincidencia, sin revelar sus datos. La interfaz obliga a crear como provisional si hay una posible coincidencia; todavía no hay búsqueda aproximada, revisión profesional ni fusión de identidades.
- `GET /api/animals` y `GET /api/animals/:animalId` requieren propiedad/custodia vigente o permiso explícito `animal:read` (el permiso `animal:manage` lo incluye).
- `POST /api/animals/:animalId/photos` recibe una fotografía `photo` JPG, PNG o WebP de hasta 8 MB y texto alternativo opcional. `GET /api/animals/photos/:photoId` requiere acceso al expediente. Las fotos solo son públicas cuando el responsable habilita expresamente la visibilidad pública del animal.
- `POST /api/animals/:animalId/public-visibility` controla la ficha pública. `GET /api/animals/:animalId/qr` genera un QR únicamente cuando está habilitada. `GET /api/animals/public/:publicId` devuelve campos autorizados y registros sanitarios certificados; las fotos públicas se sirven en `/api/animals/public/photos/:photoId`. El identificador por sí solo no habilita la ficha.
- `GET/POST /api/animals/:animalId/health-records` consulta o añade eventos sanitarios (`Vacuna`, `Enfermedad`, `Alergia`, `Cirugía`, `Tratamiento`, `Medicamento` u `Otro`). `details` admite `productName`, `dose`, `lotNumber` y `nextDueDate`. Las altas de cuidadores se almacenan como `caregiver` y `certified=false`; el cuerpo de la solicitud no permite declararlos certificados.
- `GET/POST /api/animals/:animalId/care-schedules` consulta o crea programaciones con frecuencia cada 12 horas, diaria, semanal, mensual, una vez o personalizada (1-365 horas/días/semanas). `POST /api/care-schedules/:scheduleId/logs` conserva cada resultado y persona que lo confirma; al registrar una dosis administrada u omitida, avanza la fecha según la recurrencia o finaliza la programación de una sola vez. El proceso interno guarda notificaciones en la app cuando vencen los cuidados; las alertas web push, especialmente con el navegador cerrado, aún no están habilitadas.
- El servidor genera notificaciones internas para cada usuario responsable/custodio o con permiso vigente `care:manage` cuando una programación vence. El proceso revisa cada minuto y la clave única por usuario/programación/fecha evita duplicados entre instancias. Las alertas aparecen en el centro de notificaciones de la aplicación; no son web push y no garantizan aviso inmediato si no se abre la app.
- `POST /api/lost-found-reports` permite enviar reportes públicos con o sin sesión y limita los envíos por IP a cinco cada 15 minutos. `GET /api/public/lost-found-reports` omite deliberadamente método de contacto e identidad de quien reportó e indica si hay bandeja interna disponible, sin exponer la identidad.
- Los reportes vinculados a una cuenta se consultan en `GET /api/lost-found-reports/mine`; su titular puede cambiar estado mediante `PATCH /api/lost-found-reports/:reportId/status` (`open`, `resolved` o `closed`). `POST /api/lost-found-reports/:reportId/contact` inicia o continúa una conversación privada entre cuentas, y `GET /api/lost-found-reports/messages/mine` consulta los mensajes de los que la cuenta forma parte. Los mensajes generan notificación interna al destinatario y están limitados por IP a diez cada 15 minutos. Los reportes anónimos no tienen titular/bandeja en la aplicación y no admiten mensajes ni gestión de estado. Los límites usan memoria local; en despliegues con varias instancias se debe configurar un almacén compartido para el rate limiter.
- `GET/POST /api/animals/:animalId/access-grants` administra permisos limitados con expiración y alcance seleccionable (animales concretos o todos los animales actuales/futuros creados por quien comparte o bajo su custodia de cuidador). La identidad básica siempre está incluida; `health:read` y `care:read` habilitan de forma independiente la consulta del historial sanitario y de cuidados. Las altas nuevas requieren el correo autorizado y una contraseña exclusiva (mínimo 10 caracteres), almacenada con hash; no se requiere una cuenta normal. `PATCH /api/access-grants/:grantId` permite editar animales, permisos de lectura, rol, expiración y contraseña; cada animal seleccionado se vuelve a validar contra la custodia de quien administra. Ejecuta `npm run init:bioacta` para migrar las columnas de alcance en bases existentes. `POST /api/auth/access-grant-login` valida el identificador de invitación, el correo y esa contraseña; `POST /api/auth/login` también acepta las credenciales temporales cuando identifican un único acceso vigente para el correo. Si coinciden varios accesos (o diez o más), se debe usar el enlace de invitación para elegir el expediente. En ambos casos se crea una sesión HTTP-only de ocho horas, limitada a la consulta del expediente autorizado y a sus permisos de lectura. Los enlaces no contienen la contraseña; compártela por un canal privado distinto. Las personas que ya iniciaron sesión con una cuenta también pueden usar `POST /api/access-grants/:grantId/unlock` para habilitar el acceso durante ocho horas. `DELETE /api/access-grants/:grantId` revoca el permiso y también invalida las sesiones temporales. Los accesos preexistentes sin hash mantienen su comportamiento anterior; deben revocarse y recrearse para exigir contraseña. Los recordatorios de cuidado no se envían a permisos protegidos por contraseña porque el proceso en segundo plano no puede comprobar la sesión de desbloqueo del navegador.
- `POST /api/animals/transfers` envía una solicitud por correo, `GET /api/animals/transfers/incoming` y `/outgoing` consultan pendientes, `POST /api/animals/transfers/:transferId/accept` requiere aceptación de la cuenta receptora y `DELETE /api/animals/transfers/:transferId` cancela la solicitud. Al aceptar, cambia la custodia, conserva el historial y revoca accesos previamente compartidos.
- `GET /api/admin/audit-logs` requiere rol `superadmin` o `admin`. El resumen profesional responde `501` hasta que exista verificación de credenciales y soporte profesional real.
- La historia combina actividades y eventos sanitarios; los eventos anteriores permanecen asociados al animal al transferirlo.
- Ejecuta `npm run init:bioacta` para crear las tablas BIO-ACTA y migrar animales existentes a custodia inicial. Este comando enfocado conserva los registros y datos existentes y requiere una tabla `users`; `npm run init:db` sigue disponible para inicializar todos los módulos de la plataforma.
- `npm run seed:demo -- --email=correo-de-la-cuenta` puebla la cuenta elegida con cinco perros de razas distintas y ejemplos visibles en Panel, BIO-ACTA, Animales, Historias, Perfil, Actividades, Fotos, Álbumes, Notificaciones, Cuentas conectadas y Publicaciones externas. Incluye contenido pendiente para la bandeja de moderación cuando se inicia sesión con un rol autorizado. Requiere una cuenta activa para el correo elegido y la cuenta colaboradora activa `lucia.demo@example.test`; no crea cuentas ni cambia contraseñas o roles. Los datos se identifican como demostración, el comando es repetible y no elimina contenido ajeno. Las cuentas sociales permanecen desconectadas, la publicación externa es solo un ejemplo fallido local y no se simulan pagos. Los registros sanitarios son ficticios, no certificados y no constituyen indicaciones médicas; no se reutilizan archivos multimedia privados. `npm run seed:bioacta-demo` sigue disponible como alias.
- Aún no se implementan certificación profesional, búsqueda aproximada ni conciliación/fusión de duplicados, administración y contacto de reportes anónimos, documentos clínicos, notificaciones fiables, biometría, integración institucional ni políticas operativas de respaldo/recuperación. BIO-ACTA sigue siendo un registro privado digital, no un documento gubernamental.
- La PWA incluye manifiesto instalable y una shell offline limitada a HTML, recursos compilados e icono; no cachea `/api` ni información privada. Para activar los recordatorios persistentes y la idempotencia de notificaciones en una base ya existente, ejecuta `npm run init:bioacta` antes de iniciar el servidor.

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
- Los pagos se procesan en Stripe Checkout alojado. Configura `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `PUBLIC_APP_URL` en `backend/.env`. Registra `POST https://TU_API/api/ads/webhook` en Stripe con eventos `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` y `charge.refunded`. Para desarrollo local, reenvía eventos con Stripe CLI a `http://localhost:4020/api/ads/webhook`.
- Las nuevas campañas permanecen en borrador mientras se paga. Solo el webhook con firma válida y con monto/moneda coincidentes confirma el pedido y activa la campaña durante los días contratados. Un reembolso completo pausa el anuncio; eventos repetidos son idempotentes.
- El superadmin configura precio diario, moneda, duración mínima/máxima y disponibilidad desde el estudio. El precio queda congelado en cada pedido. Las claves de Stripe no se introducen en la base de datos ni en el frontend.
- Sin la clave privada y el secreto de webhook, el checkout responde `503` y no se activa ninguna campaña; no existe modo de cobro simulado.
- Las cuentas desactivadas no pueden iniciar sesión ni usar sesiones existentes; sus publicaciones y medios dejan de estar disponibles en el feed público.
- Ejecuta `npm run init:db` en bases existentes para aplicar los campos de estado de usuario y crear el registro de auditoría.
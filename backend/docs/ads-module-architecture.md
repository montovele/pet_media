# Análisis técnico del módulo de publicidad y patrón reutilizable

## 1. Resumen ejecutivo

El módulo de publicidad del backend está implementado como una arquitectura de capas bastante clara y reutilizable:

- Capa de entrada: rutas HTTP en `backend/src/modules/ads/ads.routes.js`
- Capa de negocio: lógica principal en `backend/src/modules/ads/ads.service.js`
- Capa de persistencia: MySQL a través de `backend/src/config/db.js`
- Capa de integración externa: Stripe para checkout y webhooks
- Capa de validación: validaciones de entrada, URL, imagen, fechas y estados

La pieza más importante no es un “motor” aislado con nombre propio, sino un engine de dominio contenido en el servicio: validación + cálculo + transacción + activación/desactivación + webhook de evento. Ese patrón se puede aplicar a cualquier módulo con flujo de negocio más complejo: pagos, aprobación, publicación, suscripciones, campañas, etc.

---

## 2. Arquitectura real del módulo

### 2.1 Flujo de ejecución

El flujo típico del módulo es:

1. La app registra el router en `backend/src/app.js`
2. Las rutas permiten acceso público y privado
3. Las rutas delegan la lógica a `ads.service.js`
4. El servicio valida y ejecuta operaciones con transacciones MySQL
5. Para pagos, se integra con Stripe y se procesa el webhook del proveedor
6. El estado del anuncio y del pedido cambia según eventos del ciclo de vida

### 2.2 Rutas y responsabilidades

Los endpoints están divididos por rol y finalidad:

- Público:
  - `GET /api/ads/public`: devuelve campañas activas visibles al público
  - `GET /api/ads/pricing`: regla de precios y configuración
  - `POST /api/ads/webhook`: recibe eventos de Stripe
  - `GET /api/ads/media/:filename`: sirve imágenes de anuncios

- Usuario autenticado:
  - `POST /api/ads/quote`: calcula pressupuestos
  - `POST /api/ads/checkout`: crea sesión de pago
  - `GET /api/ads/my-orders`: lista pedidos del usuario
  - `GET /api/ads/my-orders/:orderId`: detalle de pedido
  - `POST /api/ads/upload-image`: sube imagen local

- Administrador:
  - `GET /api/ads`: lista campañas
  - `PUT /api/ads/pricing`: actualiza precios
  - `GET /api/ads/orders`: lista pedidos globales
  - `POST /api/ads`: crea campaña manualmente
  - `PUT /api/ads/:id`: actualiza campaña
  - `DELETE /api/ads/:id`: elimina campaña si no tiene pedidos asociados

Esto deja claro que la capa HTTP no contiene lógica de negocio. Solo interpreta HTTP, valida autenticación/roles, y delega todo al servicio.

---

## 3. El “engine” del módulo

El engine del módulo es un conjunto de funciones dentro de `ads.service.js` que coordina el ciclo de vida del anuncio:

### 3.1 Motor de pricing

Funciones relevantes:

- `getPricingRules()`
- `updatePricingRules()`
- `quoteDuration()`
- `quoteCampaign()`

Responsabilidades:

- Lee la regla global de precios desde `ad_pricing_rules`
- Valida moneda, duración y totales
- Calcula total con fórmula:

  total = precioPorDia × cantidadDeDias

- Bloquea operaciones si el checkout está deshabilitado
- Hace guardado de auditoría en `ad_pricing_actions`

Esto convierte el cálculo en una regla de negocio central y auditable.

### 3.2 Motor de checkout y pago

Funciones relevantes:

- `createCheckoutSession()`
- `listCustomerOrders()`
- `getCustomerOrder()`
- `listAdminOrders()`

Responsabilidades:

- Crear una campaña en estado `draft`
- Crear un pedido en `ad_orders` con `status = checkout_pending`
- Generar sesión de Stripe con `client_reference_id` y metadata
- Limpiar transacciones si Stripe falla
- Guardar id de sesión y luego pasar a estado `paid` cuando llega el webhook

Es importante observar que la plataforma crea primero una entidad de negocio y luego una sesión de pago. Esto evita inconsistencias entre orden y campaña.

### 3.3 Motor de validación de dominio

Funciones relevantes:

- `validateCampaign(input, { creating = false })`
- `parseUrl(value, field, required)`

Responsabilidades:

- Normaliza texto
- Valida longitud de marca, headline, body, CTA
- Acepta solo URLs públicas HTTP/HTTPS
- Restringe imágenes al almacenamiento local autorizado
- Valida fechas de inicio y fin
- Mantiene un estado permitido consistente con el enum del modelo

La validación está en el servicio y no en la ruta. Eso hace que el módulo sea consistente aunque se acceda desde más de un endpoint o futuro consumidor.

### 3.4 Motor de publicación y visibilidad

Funciones relevantes:

- `listPublicAds()`
- `formatCampaign()`

Responsabilidades:

- Consultar campañas con status `active`
- Excluir anuncios fuera de rango de fecha
- Ordenar aleatoriamente para la pantalla pública
- Exponer un DTO público reducido, sin internals de operación ni datos sensibles

Este punto es esencial para separar el contexto público del administrador.

### 3.5 Motor de eventos de pago

Funciones relevantes:

- `processStripeEvent(event)`
- `verifyStripeWebhook(payload, signature)`

Responsabilidades:

- Verificar firma del webhook de Stripe
- Procesar eventos:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.expired`
  - `checkout.session.async_payment_failed`
  - `charge.refunded`
- Actualizar el estado de la campaña y del pedido
- Garantizar que las transiciones sean coherentes: `checkout_pending -> paid`, `active -> paused` en reembolso

Este patrón es la base para cualquier módulo que dependa de eventos externos.

---

## 4. Modelo de datos y relación entre entidades

### 4.1 Tabla `brand_ads`

Representa la campaña publicitaria.

Campos clave:

- `id`: identificador único
- `brand_name`: nombre de marca
- `headline`: titular
- `body`: cuerpo del anuncio
- `image_url`: recurso público o local
- `cta_label`: texto del botón
- `destination_url`: URL de destino
- `status`: `draft | active | paused | archived`
- `starts_at`, `ends_at`: rango de publicación
- `created_by`: usuario creador

Índices y decisiones:

- `idx_brand_ads_placement(status, starts_at, ends_at)`
- Permite consultar campañas activas por ventana de tiempo sin escaneo completo

### 4.2 Tabla `ad_orders`

Representa el pedido de contratación de la campaña.

Campos clave:

- `user_id`
- `campaign_id`
- `duration_days`
- `unit_price_cents`
- `total_amount_cents`
- `currency`
- `status`: `checkout_pending | paid | expired | failed | refunded`
- `stripe_checkout_session_id`
- `stripe_payment_intent_id`
- `paid_at`

Sirve como fuente canónica de la operación de cobro y vínculo entre usuario, campaña y pago.

### 4.3 Tabla `ad_pricing_rules`

Es un singleton por diseño (`id = 1`) con configuración de pricing.

Se usa para:

- definir el precio por día
- limitar duración mínima y máxima
- habilitar/deshabilitar checkout
- centralizar el valor de la moneda

### 4.4 Tabla `ad_pricing_actions`

Registra el historial de cambios administrativos en precios.

Esto es una buena práctica para auditoría, trazabilidad y posible análisis de decisiones comerciales.

---

## 5. Patrones arquitectónicos visibles en el código

### 5.1 Separación de responsabilidades

La separación es consistente:

- Rutas: HTTP y autorizaciones
- Servicio: negocio
- SQL: persistencia
- Stripe: integración externa
- Validadores: reglas de dominio

### 5.2 Transacciones donde importa el estado

Para operaciones que combinan varias tablas, se usa `pool.getConnection()` + `beginTransaction()`:

- creación del pedido y la campaña en la reserva del checkout
- activación de campaña tras pago confirmado
- reembolso y pausa de campaña

Esto evita estados inconsistentes como:

- pedido pagado y campaña todavía en `draft`
- campaña activa sin pedido válido

### 5.3 Estado de negocio explícito

Los enums del módulo actúan como máquina de estados:

- `draft` → campaña preparada pero no publicada
- `active` → publicada
- `paused` → temporalmente detenida
- `archived` → historial o cierre

Y para pagos:

- `checkout_pending` → proceso de pago
- `paid` → cobro confirmado
- `expired` / `failed` / `refunded` → terminales

Esto permite que cada operación decida si es válida según el estado actual.

### 5.4 Validación centralizada

La lógica de validación no está repartida en rutas, sino en el servicio. Eso reduce duplicación y facilita el testeo.

### 5.5 Capa pública y privada

La API pública expone el mínimo necesario: solo metas visibles, sin entidad interna ni integraciones.

---

## 6. Qué hace que este módulo sea “engine-ready”

El módulo se comporta como un motor porque:

1. Tiene un punto de entrada claro: `ads.service.js`
2. Tiene reglas de dominio separadas de la infraestructura
3. Tiene estado formal y validado
4. Tiene eventos externos que disparan cambios de estado
5. Tiene transacciones de negocio en lugar de operaciones sueltas
6. Tiene una API pública y una API administrativa bien segmentadas

En otras palabras, no es solo un CRUD: es un mini sistema de gestión de campañas con flujo financiero y de activación.

---

## 7. Patrón reutilizable para otro módulo

### 7.1 Estructura recomendada

```text
backend/src/modules/mi_modulo/
  mi_modulo.routes.js
  mi_modulo.service.js
  mi_modulo.validation.js
  mi_modulo.types.js
```

### 7.2 Regla general

Para cualquier módulo de negocio con flujo de estado, seguir este patrón:

- `routes.js`: gestiona HTTP, auth y roles
- `service.js`: implementa negocio, validación y coordinación
- `validation.js`: reglas de dominio y sanitización
- SQL: tabla maestra + tabla de eventos o historial
- `status` enum: definir estados explícitos

### 7.3 Patrón de servicio ideal

```js
async function createItem(actorId, input) {
  const value = validateItem(input, { creating: true })
  const id = randomUUID()

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.query('INSERT INTO item (...) VALUES (...)', [id, ...])
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  return getItem(id)
}
```

### 7.4 Patrón de validación recomendado

- Normalizar con `String(...)` y `trim()`
- Validar longitud, tipo, obligatorios y rangos
- Rechazar datos inválidos con `statusCode`
- Separar validación y formato de respuesta

### 7.5 Patrón de eventos y estados

Si el módulo debe responder a acciones externas, usa:

- tabla de entidad principal
- tabla de historial de cambios o auditoría
- eventos con estados recomendados
- verificación de firma o callback si procede

---

## 8. Recomendaciones de mejora para escalar

1. Extraer un repositorio dedicado por módulo
   - `brandAds.repository.js`
   - reduce lógica SQL en el servicio

2. Crear un state machine explícito
   - centralizar transiciones válidas por estado

3. Añadir tests de integración por estado
   - `draft -> active`
   - `paid -> refunded`
   - `expired -> failed`

4. Separar DTOs públicos y administrativos
   - evitar filtrar internals en respuestas públicas

5. Añadir colas o jobs para activaciones programadas
   - si se gestionan fechas más complejas o lotes masivos

6. Hacer auditoría de cambios por actor
   - útil cuando varios roles modifican campañas o precios

---

## 9. Plantilla de implementación para otro módulo

### 9.1 Estructura sugerida

```text
backend/src/modules/mis_pedidos/
  mis_pedidos.routes.js
  mis_pedidos.service.js
  mis_pedidos.validation.js
```

### 9.2 Servicio base

```js
const { randomUUID } = require('crypto')
const pool = require('../../config/db')

const statuses = new Set(['draft', 'active', 'paused', 'archived'])

function validateItem(input, { creating = false } = {}) {
  const value = {
    name: String(input?.name || '').trim(),
    status: String(input?.status || (creating ? 'draft' : '')).trim(),
  }

  if (!statuses.has(value.status)) {
    throw Object.assign(new Error('Estado no válido.'), { statusCode: 400 })
  }

  if (value.name.length < 2 || value.name.length > 120) {
    throw Object.assign(new Error('Nombre inválido.'), { statusCode: 400 })
  }

  return value
}

async function createItem(actorId, input) {
  const value = validateItem(input, { creating: true })
  const id = randomUUID()

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.query(
      'INSERT INTO items (id, name, status, created_by) VALUES (?, ?, ?, ?)',
      [id, value.name, value.status, actorId],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  return getItem(id)
}
```

### 9.3 Endpoint base

```js
router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await service.createItem(req.user.id, req.body || {}))
  } catch (error) {
    next(error)
  }
})
```

---

## 10. Conclusión

El módulo de publicidad del proyecto está bien estructurado porque combina tres cualidades importantes:

- es un módulo funcional real,
- tiene un ciclo de vida definido,
- y encapsula una lógica de negocio fuerte detrás de una API limpia.

El patrón más importante para reutilizar en otro módulo es este:

> Rutas → servicio → validación → transacción → estado → auditoría/eventos → respuesta pública.

Si se replica este diseño, cualquier otro módulo con características de aprobación, publicación, suscripción, cobrabilidad o flujo de trabajo puede escalar sin perder trazabilidad ni consistencia.

const { randomUUID } = require('crypto')
const Stripe = require('stripe')
const pool = require('../../config/db')

const statuses = new Set(['draft', 'active', 'paused', 'archived'])
const stripeClient = () => process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

function paymentSetupError() {
  return Object.assign(new Error('Los pagos todavía no están configurados. Contacta al administrador de la plataforma.'), { statusCode: 503 })
}

function orderSummary(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    brandName: row.brand_name,
    headline: row.headline,
    body: row.campaign_body || '',
    imageUrl: row.image_url || undefined,
    ctaLabel: row.cta_label || undefined,
    destinationUrl: row.destination_url || undefined,
    campaignStatus: row.campaign_status || undefined,
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    durationDays: Number(row.duration_days),
    unitPriceCents: Number(row.unit_price_cents),
    totalAmountCents: Number(row.total_amount_cents),
    currency: row.currency,
    status: row.status,
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

async function getPricingRules() {
  const [rows] = await pool.query('SELECT * FROM ad_pricing_rules WHERE id = 1')
  if (!rows.length) throw new Error('No se encontraron las reglas de precios de publicidad.')
  const row = rows[0]
  return {
    currency: row.currency.toLowerCase(),
    pricePerDayCents: Number(row.price_per_day_cents),
    minDurationDays: Number(row.min_duration_days),
    maxDurationDays: Number(row.max_duration_days),
    checkoutEnabled: Boolean(row.checkout_enabled),
    stripeReady: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

async function updatePricingRules(actorId, input) {
  const currency = String(input?.currency || '').toLowerCase()
  const pricePerDayCents = Number(input?.pricePerDayCents)
  const minDurationDays = Number(input?.minDurationDays)
  const maxDurationDays = Number(input?.maxDurationDays)
  const checkoutEnabled = input?.checkoutEnabled
  if (!['mxn', 'usd'].includes(currency)) throw Object.assign(new Error('Selecciona MXN o USD como moneda.'), { statusCode: 400 })
  if (!Number.isInteger(pricePerDayCents) || pricePerDayCents < 100 || pricePerDayCents > 10000000) throw Object.assign(new Error('El precio diario debe estar entre 1 y 100,000 en la moneda elegida.'), { statusCode: 400 })
  if (!Number.isInteger(minDurationDays) || minDurationDays < 1 || minDurationDays > 365
    || !Number.isInteger(maxDurationDays) || maxDurationDays < minDurationDays || maxDurationDays > 365) {
    throw Object.assign(new Error('La duración debe estar entre 1 y 365 días y el máximo no puede ser menor al mínimo.'), { statusCode: 400 })
  }
  if (typeof checkoutEnabled !== 'boolean') throw Object.assign(new Error('Indica si la contratación está habilitada.'), { statusCode: 400 })

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.query(
      `UPDATE ad_pricing_rules SET currency = ?, price_per_day_cents = ?, min_duration_days = ?,
        max_duration_days = ?, checkout_enabled = ?, updated_by = ? WHERE id = 1`,
      [currency, pricePerDayCents, minDurationDays, maxDurationDays, checkoutEnabled, actorId],
    )
    await connection.query(
      `INSERT INTO ad_pricing_actions
        (id, actor_id, currency, price_per_day_cents, min_duration_days, max_duration_days, checkout_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), actorId, currency, pricePerDayCents, minDurationDays, maxDurationDays, checkoutEnabled],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
  return getPricingRules()
}

function quoteDuration(rules, durationDays) {
  const days = Number(durationDays)
  if (!rules.checkoutEnabled) throw Object.assign(new Error('La contratación de anuncios está pausada por la administración.'), { statusCode: 403 })
  if (!Number.isInteger(days) || days < rules.minDurationDays || days > rules.maxDurationDays) {
    throw Object.assign(new Error(`Elige una duración de ${rules.minDurationDays} a ${rules.maxDurationDays} días.`), { statusCode: 400 })
  }
  const totalAmountCents = rules.pricePerDayCents * days
  if (!Number.isSafeInteger(totalAmountCents) || totalAmountCents > 4200000000) {
    throw Object.assign(new Error('El total excede el límite de cobro admitido. Ajusta el precio o la duración.'), { statusCode: 400 })
  }
  return { durationDays: days, currency: rules.currency, unitPriceCents: rules.pricePerDayCents, totalAmountCents }
}

async function quoteCampaign(durationDays) {
  return quoteDuration(await getPricingRules(), durationDays)
}

async function createCheckoutSession(userId, input) {
  const stripe = stripeClient()
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) throw paymentSetupError()
  const rules = await getPricingRules()
  const quote = quoteDuration(rules, input?.durationDays)
  const campaign = validateCampaign({ ...input, status: 'draft' }, { creating: true })
  const campaignId = randomUUID()
  const orderId = randomUUID()
  const connection = await pool.getConnection()
  let orderCreated = false
  let session
  try {
    await connection.beginTransaction()
    await connection.query(
      `INSERT INTO brand_ads
        (id, brand_name, headline, body, image_url, cta_label, destination_url, status, starts_at, ends_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', NULL, NULL, ?)`,
      [campaignId, campaign.brandName, campaign.headline, campaign.body, campaign.imageUrl, campaign.ctaLabel, campaign.destinationUrl, userId],
    )
    await connection.query(
      `INSERT INTO ad_orders
        (id, user_id, campaign_id, duration_days, unit_price_cents, total_amount_cents, currency, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'checkout_pending')`,
      [orderId, userId, campaignId, quote.durationDays, quote.unitPriceCents, quote.totalAmountCents, quote.currency],
    )
    await connection.commit()
    orderCreated = true
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const clientUrl = process.env.PUBLIC_APP_URL || process.env.CLIENT_URL || 'http://localhost:5173'
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: orderId,
      metadata: { orderId, campaignId, userId },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: quote.currency,
          unit_amount: quote.totalAmountCents,
          product_data: {
            name: `Publicidad: ${campaign.brandName}`,
            description: `${quote.durationDays} días · ${campaign.headline}`.slice(0, 500),
          },
        },
      }],
      success_url: `${clientUrl.replace(/\/$/, '')}/ads/checkout?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl.replace(/\/$/, '')}/ads/checkout?cancelled=1&order_id=${orderId}`,
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60),
    })
    await pool.query('UPDATE ad_orders SET stripe_checkout_session_id = ? WHERE id = ?', [session.id, orderId])
    return { orderId, checkoutUrl: session.url, quote }
  } catch (error) {
    if (session?.id) await stripe.checkout.sessions.expire(session.id).catch(() => {})
    if (orderCreated) {
      const cleanup = await pool.getConnection()
      try {
        await cleanup.beginTransaction()
        await cleanup.query('DELETE FROM ad_orders WHERE id = ? AND status = \'checkout_pending\'', [orderId])
        await cleanup.query('DELETE FROM brand_ads WHERE id = ? AND status = \'draft\'', [campaignId])
        await cleanup.commit()
      } catch {
        await cleanup.rollback().catch(() => {})
      } finally {
        cleanup.release()
      }
    }
    if (error.statusCode) throw error
    throw Object.assign(new Error('No pudimos iniciar el checkout. Inténtalo de nuevo.'), { statusCode: 502 })
  }
}

async function listCustomerOrders(userId) {
  const [rows] = await pool.query(
    `SELECT orders.*, ads.brand_name, ads.headline, ads.body AS campaign_body, ads.image_url,
      ads.cta_label, ads.destination_url, ads.status AS campaign_status, ads.starts_at, ads.ends_at
     FROM ad_orders orders JOIN brand_ads ads ON ads.id = orders.campaign_id
     WHERE orders.user_id = ? ORDER BY orders.created_at DESC LIMIT 100`,
    [userId],
  )
  return rows.map(orderSummary)
}

async function getCustomerOrder(userId, orderId) {
  const [rows] = await pool.query(
    `SELECT orders.*, ads.brand_name, ads.headline, ads.body AS campaign_body, ads.image_url,
      ads.cta_label, ads.destination_url, ads.status AS campaign_status, ads.starts_at, ads.ends_at
     FROM ad_orders orders JOIN brand_ads ads ON ads.id = orders.campaign_id
     WHERE orders.user_id = ? AND (orders.id = ? OR orders.stripe_checkout_session_id = ?) LIMIT 1`,
    [userId, orderId, orderId],
  )
  if (!rows.length) throw Object.assign(new Error('No encontramos ese pedido.'), { statusCode: 404 })
  return orderSummary(rows[0])
}

async function listAdminOrders() {
  const [rows] = await pool.query(
    `SELECT orders.*, ads.brand_name, ads.headline, ads.body AS campaign_body, ads.image_url,
      ads.cta_label, ads.destination_url, ads.status AS campaign_status, ads.starts_at, ads.ends_at,
      users.email
     FROM ad_orders orders JOIN brand_ads ads ON ads.id = orders.campaign_id
     JOIN users ON users.id = orders.user_id ORDER BY orders.created_at DESC LIMIT 300`,
  )
  return rows.map((row) => ({ ...orderSummary(row), customerEmail: row.email }))
}

async function processStripeEvent(event) {
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object
    if (session.payment_status !== 'paid') return
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [orders] = await connection.query(
        'SELECT * FROM ad_orders WHERE id = ? AND stripe_checkout_session_id = ? FOR UPDATE',
        [session.metadata?.orderId, session.id],
      )
      if (!orders.length) {
        await connection.commit()
        return
      }
      const order = orders[0]
      if (Number(session.amount_total) !== Number(order.total_amount_cents) || String(session.currency).toLowerCase() !== order.currency) {
        throw Object.assign(new Error('El monto o moneda confirmados por Stripe no coinciden con el pedido.'), { statusCode: 400 })
      }
      if (order.status === 'checkout_pending') {
        await connection.query(
          `UPDATE ad_orders SET status = 'paid', stripe_payment_intent_id = ?, paid_at = UTC_TIMESTAMP() WHERE id = ?`,
          [typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null, order.id],
        )
        await connection.query(
          `UPDATE brand_ads SET status = 'active', starts_at = UTC_TIMESTAMP(),
            ends_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY) WHERE id = ? AND created_by = ?`,
          [order.duration_days, order.campaign_id, order.user_id],
        )
      }
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
    return
  }

  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object
    const status = event.type === 'checkout.session.expired' ? 'expired' : 'failed'
    await pool.query(
      `UPDATE ad_orders SET status = ? WHERE stripe_checkout_session_id = ? AND status = 'checkout_pending'`,
      [status, session.id],
    )
    return
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object
    if (!charge.refunded && Number(charge.amount_refunded) < Number(charge.amount)) return
    const [orders] = await pool.query('SELECT id, campaign_id FROM ad_orders WHERE stripe_payment_intent_id = ? AND status = \'paid\'', [charge.payment_intent])
    for (const order of orders) {
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        await connection.query("UPDATE ad_orders SET status = 'refunded' WHERE id = ? AND status = 'paid'", [order.id])
        await connection.query("UPDATE brand_ads SET status = 'paused' WHERE id = ? AND status = 'active'", [order.campaign_id])
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    }
  }
}

function verifyStripeWebhook(payload, signature) {
  const stripe = stripeClient()
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) throw paymentSetupError()
  try {
    return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    throw Object.assign(new Error('Firma de webhook de pago no válida.'), { statusCode: 400 })
  }
}

function parseUrl(value, field, required = false) {
  const input = String(value || '').trim()
  if (!input && !required) return null
  if (field === 'La imagen') {
    if (/^\/api\/ads\/media\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(input)) return input
    const error = new Error('La imagen debe subirse al almacenamiento local desde el formulario.')
    error.statusCode = 400
    throw error
  }
  if (input.startsWith('/') && !input.startsWith('//') && !input.includes('\\')) return input
  let parsed
  try {
    parsed = new URL(input)
  } catch {
    const error = new Error(`${field} debe ser una URL válida.`)
    error.statusCode = 400
    throw error
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    const error = new Error(`${field} debe usar una dirección web pública HTTP o HTTPS.`)
    error.statusCode = 400
    throw error
  }
  return parsed.toString()
}

function validateCampaign(input, { creating = false } = {}) {
  const value = {
    brandName: String(input?.brandName || '').trim(),
    headline: String(input?.headline || '').trim(),
    body: String(input?.body || '').trim(),
    imageUrl: parseUrl(input?.imageUrl, 'La imagen'),
    ctaLabel: String(input?.ctaLabel || 'Conocer más').trim(),
    destinationUrl: parseUrl(input?.destinationUrl, 'El destino', true),
    status: String(input?.status || (creating ? 'draft' : '')).trim(),
    startsAt: input?.startsAt ? new Date(input.startsAt) : null,
    endsAt: input?.endsAt ? new Date(input.endsAt) : null,
  }
  if (value.brandName.length < 2 || value.brandName.length > 100) throw Object.assign(new Error('El nombre de marca debe tener entre 2 y 100 caracteres.'), { statusCode: 400 })
  if (value.headline.length < 4 || value.headline.length > 120) throw Object.assign(new Error('El titular debe tener entre 4 y 120 caracteres.'), { statusCode: 400 })
  if (value.body.length < 10 || value.body.length > 500) throw Object.assign(new Error('El texto debe tener entre 10 y 500 caracteres.'), { statusCode: 400 })
  if (value.ctaLabel.length < 2 || value.ctaLabel.length > 40) throw Object.assign(new Error('El botón debe tener entre 2 y 40 caracteres.'), { statusCode: 400 })
  if (!statuses.has(value.status)) throw Object.assign(new Error('Estado de campaña no válido.'), { statusCode: 400 })
  if ((value.startsAt && Number.isNaN(value.startsAt.getTime())) || (value.endsAt && Number.isNaN(value.endsAt.getTime()))) {
    throw Object.assign(new Error('Las fechas de campaña no son válidas.'), { statusCode: 400 })
  }
  if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
    throw Object.assign(new Error('La fecha final debe ser posterior a la inicial.'), { statusCode: 400 })
  }
  return value
}

function formatCampaign(row) {
  return {
    id: row.id,
    brandName: row.brand_name,
    headline: row.headline,
    body: row.body,
    imageUrl: row.image_url || undefined,
    ctaLabel: row.cta_label,
    destinationUrl: row.destination_url,
    status: row.status,
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }
}

async function listCampaigns() {
  const [rows] = await pool.query('SELECT * FROM brand_ads ORDER BY updated_at DESC LIMIT 300')
  return rows.map(formatCampaign)
}

async function listPublicAds() {
  const [rows] = await pool.query(
    `SELECT id, brand_name, headline, body, image_url, cta_label, destination_url
    FROM brand_ads
    WHERE status = 'active'
      AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP())
      AND (ends_at IS NULL OR ends_at > UTC_TIMESTAMP())
    ORDER BY RAND() LIMIT 3`,
  )
  return rows.map((row) => ({
    id: row.id,
    brandName: row.brand_name,
    headline: row.headline,
    body: row.body,
    imageUrl: row.image_url || undefined,
    ctaLabel: row.cta_label,
    destinationUrl: row.destination_url,
  }))
}

async function createCampaign(actorId, input) {
  const value = validateCampaign(input, { creating: true })
  const id = randomUUID()
  await pool.query(
    `INSERT INTO brand_ads
      (id, brand_name, headline, body, image_url, cta_label, destination_url, status, starts_at, ends_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, value.brandName, value.headline, value.body, value.imageUrl, value.ctaLabel, value.destinationUrl, value.status, value.startsAt, value.endsAt, actorId],
  )
  const [rows] = await pool.query('SELECT * FROM brand_ads WHERE id = ?', [id])
  return formatCampaign(rows[0])
}

async function updateCampaign(id, input) {
  const value = validateCampaign(input)
  const [result] = await pool.query(
    `UPDATE brand_ads SET brand_name = ?, headline = ?, body = ?, image_url = ?, cta_label = ?,
      destination_url = ?, status = ?, starts_at = ?, ends_at = ? WHERE id = ?`,
    [value.brandName, value.headline, value.body, value.imageUrl, value.ctaLabel, value.destinationUrl, value.status, value.startsAt, value.endsAt, id],
  )
  if (!result.affectedRows) throw Object.assign(new Error('No encontramos esa campaña.'), { statusCode: 404 })
  const [rows] = await pool.query('SELECT * FROM brand_ads WHERE id = ?', [id])
  return formatCampaign(rows[0])
}

async function deleteCampaign(id) {
  const [orders] = await pool.query('SELECT id FROM ad_orders WHERE campaign_id = ? LIMIT 1', [id])
  if (orders.length) {
    throw Object.assign(new Error('Esta campaña tiene pedidos asociados. Paúsala o archívala para conservar el historial de pagos.'), { statusCode: 409 })
  }
  const [result] = await pool.query('DELETE FROM brand_ads WHERE id = ?', [id])
  if (!result.affectedRows) throw Object.assign(new Error('No encontramos esa campaña.'), { statusCode: 404 })
}

module.exports = {
  listCampaigns,
  listPublicAds,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getPricingRules,
  updatePricingRules,
  quoteCampaign,
  createCheckoutSession,
  listCustomerOrders,
  getCustomerOrder,
  listAdminOrders,
  verifyStripeWebhook,
  processStripeEvent,
}
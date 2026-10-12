const crypto = require('crypto')
const { randomUUID } = require('crypto')
const fs = require('fs')
const path = require('path')
const pool = require('../../config/db')
const { signOAuthState, verifyOAuthState } = require('../../utils/jwt')
const notificationsService = require('../notifications/notifications.service')

const platforms = new Set(['instagram', 'facebook'])
const defaultGraphVersion = 'v25.0'
const uploadDirectory = path.resolve(__dirname, '../../../uploads')

function encryptionKey() {
  const source = process.env.SOCIAL_ENCRYPTION_KEY || process.env.JWT_SECRET || 'social-config-default-key-32-chars'
  return crypto.createHash('sha256').update(source).digest()
}

function encryptValue(value) {
  const key = encryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

function decryptValue(value) {
  const key = encryptionKey()
  const buffer = Buffer.from(String(value), 'base64')
  const iv = buffer.subarray(0, 16)
  const tag = buffer.subarray(16, 32)
  const encrypted = buffer.subarray(32)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

function configError() {
  const error = new Error('Configura META_APP_ID, META_APP_SECRET y META_REDIRECT_URI en backend/.env o guarda la configuración desde el frontend para conectar Meta.')
  error.statusCode = 503
  return error
}

function resolveClientOrigin(origin) {
  const configuredOrigin = new URL(process.env.CLIENT_URL || 'http://localhost:5173').origin
  if (!origin) return configuredOrigin

  try {
    const requestedUrl = new URL(origin)
    if (requestedUrl.origin !== origin) return configuredOrigin
    if (requestedUrl.origin === configuredOrigin) return requestedUrl.origin
    if (process.env.NODE_ENV !== 'production'
      && requestedUrl.protocol === 'http:'
      && ['localhost', '127.0.0.1'].includes(requestedUrl.hostname)) {
      return requestedUrl.origin
    }
  } catch {
    return configuredOrigin
  }

  return configuredOrigin
}

function assertPlatform(platform) {
  if (!platforms.has(platform)) {
    const error = new Error('Plataforma social no válida.')
    error.statusCode = 404
    throw error
  }
}

async function getStoredConfig() {
  const [rows] = await pool.query('SELECT key_name, value_encrypted FROM social_config')
  const config = {}
  for (const row of rows) {
    try {
      config[row.key_name] = decryptValue(row.value_encrypted)
    } catch {
      // ignore invalid stored values to keep the service available
    }
  }
  return config
}

async function oauthConfig() {
  const stored = await getStoredConfig()
  const appId = stored.META_APP_ID || process.env.META_APP_ID
  const appSecret = stored.META_APP_SECRET || process.env.META_APP_SECRET
  const redirectUri = stored.META_REDIRECT_URI || process.env.META_REDIRECT_URI
  const graphVersion = stored.META_GRAPH_VERSION || process.env.META_GRAPH_VERSION || defaultGraphVersion
  if (!appId || !appSecret || !redirectUri) throw configError()
  return { appId, appSecret, redirectUri, graphVersion }
}

async function getAccounts(userId) {
  const [rows] = await pool.query(
    `SELECT id, platform, account_name, connected, connected_at
    FROM social_accounts WHERE user_id = ? ORDER BY platform ASC`,
    [userId],
  )
  return rows.map((row) => ({
    id: row.id,
    platform: row.platform,
    accountName: row.account_name || (row.platform === 'instagram' ? 'Instagram' : 'Facebook'),
    connected: Boolean(row.connected),
    connectedAt: row.connected_at ? new Date(row.connected_at).toISOString() : undefined,
  }))
}

async function createAuthorizationUrl(userId, platform, clientOrigin) {
  assertPlatform(platform)
  const { appId, redirectUri, graphVersion } = await oauthConfig()
  const state = signOAuthState({ userId, platform, nonce: randomUUID(), clientOrigin: resolveClientOrigin(clientOrigin) })
  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`)
  url.search = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: platform === 'instagram'
      ? 'pages_show_list,pages_read_engagement,instagram_basic'
      : 'pages_show_list,pages_read_engagement,pages_manage_posts',
  }).toString()
  return url.toString()
}

async function graphRequest(path, params, graphVersion) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${path.replace(/^\//, '')}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  const response = await fetch(url)
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message || 'Meta rechazó la solicitud OAuth.')
    error.statusCode = 502
    throw error
  }
  return body
}

async function graphPost(path, params, graphVersion) {
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${path.replace(/^\//, '')}`)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.error) {
    const error = new Error(body.error?.error_user_msg || body.error?.message || 'Meta no pudo publicar en Facebook.')
    error.statusCode = 502
    throw error
  }
  return body
}

async function graphPostPhoto(endpointPath, media, message, accessToken, graphVersion, published = true) {
  const filePath = pathResolveUpload(media.filename)
  const file = await fs.promises.readFile(filePath)
  const mimeType = ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' })[path.extname(filePath).toLowerCase()]
  if (!mimeType) {
    const error = new Error('Facebook solo admite imágenes JPG, PNG o WebP en esta publicación.')
    error.statusCode = 400
    throw error
  }

  const form = new FormData()
  form.append('source', new Blob([file], { type: mimeType }), path.basename(filePath))
  form.append('message', message)
  form.append('access_token', accessToken)
  if (!published) form.append('published', 'false')
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${endpointPath.replace(/^\//, '')}`)
  const response = await fetch(url, { method: 'POST', body: form })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.error) {
    const error = new Error(body.error?.error_user_msg || body.error?.message || 'Meta no pudo publicar la imagen en Facebook.')
    error.statusCode = 502
    throw error
  }
  return body
}

function pathResolveUpload(filename) {
  const filePath = path.resolve(uploadDirectory, filename)
  if (!filename || path.dirname(filePath) !== uploadDirectory) {
    const error = new Error('No se pudo localizar el archivo de la historia para compartir.')
    error.statusCode = 400
    throw error
  }
  return filePath
}

async function getOwnedEntry(userId, entryId) {
  const [stories] = await pool.query(
    'SELECT id, title, caption, image_url, media_type FROM stories WHERE id = ? AND user_id = ? LIMIT 1',
    [entryId, userId],
  )
  if (stories.length) {
    const [media] = await pool.query(
      'SELECT filename, media_type FROM story_media WHERE story_id = ? ORDER BY position ASC',
      [entryId],
    )
    return { ...stories[0], kind: 'story', media }
  }

  const [posts] = await pool.query(
    'SELECT id, title, caption, image_url, media_type FROM posts WHERE id = ? AND user_id = ? LIMIT 1',
    [entryId, userId],
  )
  if (posts.length) return { ...posts[0], kind: 'post', media: [] }

  const error = new Error('No encontramos una historia o publicación tuya para compartir.')
  error.statusCode = 404
  throw error
}

function publicationFromRow(row) {
  return {
    id: row.id,
    storyId: row.story_id || undefined,
    storyTitle: row.title || 'Publicación personal',
    platform: row.platform,
    status: row.status,
    caption: row.caption || '',
    createdAt: new Date(row.created_at).toISOString(),
    externalUrl: row.external_url || undefined,
    errorMessage: row.error_message || undefined,
  }
}

function publicationAttribution() {
  const configuredUrl = process.env.PUBLIC_APP_URL || process.env.CLIENT_URL
  let exploreUrl = ''
  if (configuredUrl) {
    try {
      const publicOrigin = new URL(configuredUrl)
      if (['http:', 'https:'].includes(publicOrigin.protocol)
        && !['localhost', '127.0.0.1', '::1'].includes(publicOrigin.hostname)) {
        exploreUrl = new URL('/explore', publicOrigin).toString()
      }
    } catch {
      exploreUrl = ''
    }
  }
  return `Compartido desde Entre Momentos\nUna red social para historias y recuerdos.\nTe invitamos a conocer la comunidad${exploreUrl ? `: ${exploreUrl}` : '.'}`
}

async function getPublications(userId) {
  const [rows] = await pool.query(
    `SELECT id, story_id, platform, title, caption, external_url, status, error_message, created_at
    FROM social_publications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    [userId],
  )
  return rows.map(publicationFromRow)
}

async function publishFacebook(userId, entryId, caption) {
  const entry = await getOwnedEntry(userId, entryId)
  const [accounts] = await pool.query(
    `SELECT access_token, metadata FROM social_accounts
    WHERE user_id = ? AND platform = 'facebook' AND connected = TRUE LIMIT 1`,
    [userId],
  )
  if (!accounts.length) {
    const error = new Error('Conecta primero una Página de Facebook en Cuentas conectadas.')
    error.statusCode = 400
    throw error
  }

  let metadata
  try {
    metadata = typeof accounts[0].metadata === 'string'
      ? JSON.parse(accounts[0].metadata || '{}')
      : accounts[0].metadata || {}
  } catch {
    metadata = {}
  }
  if (!metadata.pageId || !accounts[0].access_token) {
    const error = new Error('La conexión de Facebook no contiene una Página válida. Desconéctala y vuelve a conectarla.')
    error.statusCode = 400
    throw error
  }

  const media = entry.media || []
  if (media.length > 10) {
    const error = new Error('Facebook admite hasta 10 imágenes por publicación. Divide esta historia en varias publicaciones.')
    error.statusCode = 400
    throw error
  }
  const videoCount = media.filter((item) => item.media_type === 'video').length
  if (videoCount || (!media.length && entry.media_type === 'video')) {
    const error = new Error('La publicación de videos requiere un flujo de carga distinto y todavía no está habilitada. Las historias con videos no se pueden compartir en Facebook desde aquí.')
    error.statusCode = 400
    throw error
  }

  const { graphVersion } = await oauthConfig()
  const captionText = String(caption ?? entry.caption ?? '').trim()
  const message = `${captionText}\n\n${publicationAttribution()}`
  if (message.length > 2200) {
    const error = new Error('El texto y la atribución superan el límite de 2.200 caracteres. Reduce el texto para publicar.')
    error.statusCode = 400
    throw error
  }
  let result
  if (media.length > 1) {
    const uploadedPhotos = []
    for (const photo of media) {
      uploadedPhotos.push(await graphPostPhoto(
        `${metadata.pageId}/photos`, photo, '', accounts[0].access_token, graphVersion, false,
      ))
    }
    const attachedMedia = Object.fromEntries(uploadedPhotos.map((photo, index) => [
      `attached_media[${index}]`, JSON.stringify({ media_fbid: photo.id }),
    ]))
    result = await graphPost(`${metadata.pageId}/feed`, {
      message,
      access_token: accounts[0].access_token,
      ...attachedMedia,
    }, graphVersion)
  } else if (media.length === 1) {
    result = await graphPostPhoto(`${metadata.pageId}/photos`, media[0], message, accounts[0].access_token, graphVersion)
  } else {
    result = await graphPost(`${metadata.pageId}/feed`, {
      message,
      access_token: accounts[0].access_token,
    }, graphVersion)
  }
  const publicationId = randomUUID()
  const title = String(entry.title || '').slice(0, 180) || 'Publicación personal'
  const externalId = result.post_id || result.id
  const externalUrl = result.permalink_url || (externalId ? `https://www.facebook.com/${externalId}` : null)

  await pool.query(
    `INSERT INTO social_publications
      (id, user_id, platform, story_id, title, caption, external_url, status)
    VALUES (?, ?, 'facebook', ?, ?, ?, ?, 'PUBLISHED')`,
    [publicationId, userId, entry.kind === 'story' ? entry.id : null, title, message, externalUrl],
  )
  await notificationsService.createForUser(
    userId,
    'social',
    'Publicación compartida',
    `“${title}” se publicó correctamente en Facebook.`,
  )

  return {
    id: publicationId,
    storyId: entry.kind === 'story' ? entry.id : undefined,
    storyTitle: title,
    platform: 'facebook',
    status: 'PUBLISHED',
    caption: message,
    createdAt: new Date().toISOString(),
    externalUrl: externalUrl || undefined,
  }
}

async function completeOAuth({ code, state }) {
  const { appId, appSecret, redirectUri, graphVersion } = await oauthConfig()
  let oauthState
  try {
    oauthState = verifyOAuthState(state)
  } catch {
    const error = new Error('El estado OAuth venció o no es válido. Intenta conectar la cuenta otra vez.')
    error.statusCode = 400
    throw error
  }
  assertPlatform(oauthState.platform)

  const tokenResponse = await graphRequest('oauth/access_token', {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  }, graphVersion)
  const pages = await graphRequest('me/accounts', {
    fields: 'id,name,access_token,instagram_business_account{id,username}',
    access_token: tokenResponse.access_token,
  }, graphVersion)
  const targetPage = oauthState.platform === 'instagram'
    ? pages.data?.find((page) => page.instagram_business_account)
    : pages.data?.[0]

  if (!targetPage) {
    const error = new Error(oauthState.platform === 'instagram'
      ? 'No encontramos una cuenta de Instagram profesional vinculada a una Página de Facebook que administres. Cambia Instagram a cuenta de Creador o Empresa, vincúlala a una Página y vuelve a conectar.'
      : 'No encontramos una página de Facebook que puedas administrar.')
    error.statusCode = 400
    throw error
  }

  const accountName = oauthState.platform === 'instagram'
    ? targetPage.instagram_business_account.username || targetPage.name
    : targetPage.name
  const metadata = JSON.stringify({ pageId: targetPage.id, instagramAccountId: targetPage.instagram_business_account?.id })
  await pool.query(
    `INSERT INTO social_accounts
      (id, user_id, platform, account_name, connected, access_token, metadata, connected_at)
    VALUES (?, ?, ?, ?, TRUE, ?, ?, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE account_name = VALUES(account_name), connected = TRUE,
      access_token = VALUES(access_token), refresh_token = NULL,
      metadata = VALUES(metadata), connected_at = CURRENT_TIMESTAMP`,
    [randomUUID(), oauthState.userId, oauthState.platform, accountName, targetPage.access_token || tokenResponse.access_token, metadata],
  )
  return { userId: oauthState.userId, platform: oauthState.platform, clientOrigin: resolveClientOrigin(oauthState.clientOrigin) }
}

function getOAuthClientOrigin(state) {
  try {
    return resolveClientOrigin(verifyOAuthState(state).clientOrigin)
  } catch {
    return resolveClientOrigin()
  }
}

async function disconnect(userId, platform) {
  assertPlatform(platform)
  await pool.query('DELETE FROM social_accounts WHERE user_id = ? AND platform = ?', [userId, platform])
}

async function getSocialConfigStatus() {
  const stored = await getStoredConfig()
  const missing = ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI']
    .filter((key) => !stored[key] && !process.env[key])

  return {
    configured: missing.length === 0,
    missing,
    appId: stored.META_APP_ID || process.env.META_APP_ID || '',
    redirectUri: stored.META_REDIRECT_URI || process.env.META_REDIRECT_URI || '',
    graphVersion: stored.META_GRAPH_VERSION || process.env.META_GRAPH_VERSION || defaultGraphVersion,
    hasAppSecret: Boolean(stored.META_APP_SECRET || process.env.META_APP_SECRET),
    message: missing.length
      ? 'Configura META_APP_ID, META_APP_SECRET y META_REDIRECT_URI en backend/.env o guardalos desde el formulario de configuración para conectar Meta.'
      : 'La configuración de Meta está lista.',
  }
}

async function saveSocialConfig(userId, values) {
  if (!userId) {
    const error = new Error('Sesión requerida para guardar la configuración de Meta.')
    error.statusCode = 401
    throw error
  }

  const stored = await getStoredConfig()
  const submitted = {
    META_APP_ID: String(values?.appId || '').trim(),
    META_APP_SECRET: String(values?.appSecret || '').trim(),
    META_REDIRECT_URI: String(values?.redirectUri || '').trim(),
    META_GRAPH_VERSION: String(values?.graphVersion || '').trim(),
  }
  const effective = {
    META_APP_ID: submitted.META_APP_ID || stored.META_APP_ID || process.env.META_APP_ID,
    META_APP_SECRET: submitted.META_APP_SECRET || stored.META_APP_SECRET || process.env.META_APP_SECRET,
    META_REDIRECT_URI: submitted.META_REDIRECT_URI || stored.META_REDIRECT_URI || process.env.META_REDIRECT_URI,
    META_GRAPH_VERSION: submitted.META_GRAPH_VERSION || stored.META_GRAPH_VERSION || process.env.META_GRAPH_VERSION || defaultGraphVersion,
  }

  if (!effective.META_APP_ID || !effective.META_APP_SECRET || !effective.META_REDIRECT_URI) {
    const error = new Error('Faltan META_APP_ID, META_APP_SECRET o META_REDIRECT_URI.')
    error.statusCode = 400
    throw error
  }
  if (!/^v\d+\.\d+$/.test(effective.META_GRAPH_VERSION)) {
    const error = new Error('La versión de Graph API debe tener un formato válido, por ejemplo v25.0.')
    error.statusCode = 400
    throw error
  }
  try {
    const redirectUrl = new URL(effective.META_REDIRECT_URI)
    if (!['http:', 'https:'].includes(redirectUrl.protocol)) throw new Error('Protocolo no válido')
  } catch {
    const error = new Error('La Redirect URI debe ser una URL HTTP o HTTPS válida.')
    error.statusCode = 400
    throw error
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const configEntries = Object.entries(submitted).filter(([, value]) => value)

    for (const [keyName, value] of configEntries) {
      await connection.query(
        `INSERT INTO social_config (id, key_name, value_encrypted)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value_encrypted = VALUES(value_encrypted), updated_at = CURRENT_TIMESTAMP`,
        [randomUUID(), keyName, encryptValue(value)],
      )
    }

    await connection.commit()
    return getSocialConfigStatus()
  } catch (error) {
    await connection.rollback().catch(() => {})
    throw error
  } finally {
    connection.release()
  }
}

module.exports = {
  getAccounts,
  createAuthorizationUrl,
  completeOAuth,
  getOAuthClientOrigin,
  disconnect,
  getPublications,
  publishFacebook,
  getSocialConfigStatus,
  saveSocialConfig,
}
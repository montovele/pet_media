const pool = require('../../config/db')

const defaultBrand = {
  name: 'entremomentos',
  logoUrl: null,
  primaryColor: '#187a75',
  secondaryColor: '#d55d45',
}

async function getBrandSettings() {
  const [rows] = await pool.query(
    'SELECT company_name, logo_url, primary_color, secondary_color FROM brand_settings WHERE id = 1 LIMIT 1',
  )
  if (!rows.length) return defaultBrand
  return {
    name: rows[0].company_name,
    logoUrl: rows[0].logo_url || null,
    primaryColor: rows[0].primary_color,
    secondaryColor: rows[0].secondary_color,
  }
}

async function updateBrandSettings(userId, updates) {
  const current = await getBrandSettings()
  const name = updates.name ?? current.name
  const logoUrl = updates.logoUrl === undefined ? current.logoUrl : updates.logoUrl
  const primaryColor = updates.primaryColor ?? current.primaryColor
  const secondaryColor = updates.secondaryColor ?? current.secondaryColor

  if (updates.logoUrl) {
    const match = updates.logoUrl.match(/^\/api\/media\/([0-9a-f-]{36})$/i)
    if (!match) {
      const error = new Error('Selecciona un logo cargado en la plataforma.')
      error.statusCode = 400
      throw error
    }
    const [media] = await pool.query(
      `SELECT id FROM story_media
      WHERE id = ? AND user_id = ? AND media_type = 'image' AND story_id IS NULL
      LIMIT 1`,
      [match[1], userId],
    )
    if (!media.length) {
      const error = new Error('El logo no está disponible para esta cuenta.')
      error.statusCode = 400
      throw error
    }
  }

  await pool.query(
    `INSERT INTO brand_settings (id, company_name, logo_url, primary_color, secondary_color, updated_by)
    VALUES (1, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), logo_url = VALUES(logo_url),
      primary_color = VALUES(primary_color), secondary_color = VALUES(secondary_color), updated_by = VALUES(updated_by)`,
    [name, logoUrl, primaryColor, secondaryColor, userId],
  )
  return getBrandSettings()
}

module.exports = { getBrandSettings, updateBrandSettings }
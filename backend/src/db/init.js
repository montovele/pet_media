require('dotenv').config()

const mysql = require('mysql2/promise')

async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  })

  try {
    const database = process.env.DB_NAME || 'social_db'
    const escapedDatabase = database.replace(/`/g, '``')
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${escapedDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
    await connection.query(`USE \`${escapedDatabase}\``)

    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(180) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        username VARCHAR(80) UNIQUE,
        bio TEXT,
        avatar_url VARCHAR(255),
        cover_url VARCHAR(255),
        role ENUM('superadmin', 'admin', 'editor', 'moderator', 'user') NOT NULL DEFAULT 'user',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        moderation_note TEXT,
        deactivated_at TIMESTAMP NULL,
        deactivated_by CHAR(36) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS posts (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        title VARCHAR(180),
        caption TEXT NOT NULL,
        image_url VARCHAR(255),
        media_type VARCHAR(40),
        visibility ENUM('public', 'followers', 'private') DEFAULT 'public',
        moderation_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
        moderation_note VARCHAR(1000) NULL,
        likes_count INT UNSIGNED DEFAULT 0,
        comments_count INT UNSIGNED DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_posts_feed (visibility, created_at),
        INDEX idx_posts_user_created (user_id, created_at),
        CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS stories (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        title VARCHAR(180),
        caption TEXT NOT NULL,
        image_url VARCHAR(255),
        media_type VARCHAR(40),
        visibility ENUM('public', 'followers', 'private') DEFAULT 'public',
        moderation_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
        moderation_note VARCHAR(1000) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_stories_feed (visibility, created_at),
        INDEX idx_stories_user_created (user_id, created_at),
        CONSTRAINT fk_stories_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS activities (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        title VARCHAR(120) NOT NULL,
        description TEXT,
        activity_date DATE NOT NULL,
        location_name VARCHAR(180),
        category ENUM('walk', 'travel', 'food', 'wellness', 'culture', 'other') DEFAULT 'other',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_activities_user_date (user_id, activity_date),
        CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS albums (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        title VARCHAR(120) NOT NULL,
        description VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_albums_user_created (user_id, created_at),
        CONSTRAINT fk_albums_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS album_photos (
        id CHAR(36) PRIMARY KEY,
        album_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        photo_id VARCHAR(50) NOT NULL,
        photo_url VARCHAR(500) NOT NULL,
        position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_album_photo (album_id, photo_id),
        INDEX idx_album_photos_order (album_id, position),
        CONSTRAINT fk_album_photos_album FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
        CONSTRAINT fk_album_photos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS story_media (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        story_id CHAR(36) NULL,
        filename VARCHAR(80) NOT NULL UNIQUE,
        media_type ENUM('image', 'video') NOT NULL,
        position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_story_media_story (story_id, position),
        CONSTRAINT fk_story_media_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_story_media_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS activity_media (
        activity_id CHAR(36) PRIMARY KEY,
        media_id CHAR(36) NOT NULL UNIQUE,
        user_id CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_activity_media_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
        CONSTRAINT fk_activity_media_media FOREIGN KEY (media_id) REFERENCES story_media(id) ON DELETE CASCADE,
        CONSTRAINT fk_activity_media_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS comments (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        post_id CHAR(36),
        story_id CHAR(36),
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_comments_post (post_id, created_at),
        INDEX idx_comments_story (story_id, created_at),
        CONSTRAINT chk_comments_one_target CHECK ((post_id IS NULL) <> (story_id IS NULL)),
        CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        CONSTRAINT fk_comments_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS comment_reactions (
        id CHAR(36) PRIMARY KEY,
        comment_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        type VARCHAR(30) NOT NULL DEFAULT 'like',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_comment_reaction_user (comment_id, user_id, type),
        INDEX idx_comment_reactions_comment (comment_id, type),
        CONSTRAINT fk_comment_reactions_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        CONSTRAINT fk_comment_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS reactions (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        post_id CHAR(36),
        story_id CHAR(36),
        type VARCHAR(30) DEFAULT 'like',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reactions_post (post_id),
        INDEX idx_reactions_story (story_id),
        CONSTRAINT chk_reactions_one_target CHECK ((post_id IS NULL) <> (story_id IS NULL)),
        CONSTRAINT fk_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_reactions_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        CONSTRAINT fk_reactions_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS user_follows (
        follower_user_id CHAR(36) NOT NULL,
        following_user_id CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (follower_user_id, following_user_id),
        INDEX idx_user_follows_following (following_user_id, created_at),
        CONSTRAINT fk_user_follows_follower FOREIGN KEY (follower_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_follows_following FOREIGN KEY (following_user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        type VARCHAR(40) NOT NULL,
        title VARCHAR(180) NOT NULL,
        description TEXT NOT NULL,
        read_flag BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_user_created (user_id, created_at),
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS moderation_actions (
        id CHAR(36) PRIMARY KEY,
        moderator_id CHAR(36) NOT NULL,
        target_user_id CHAR(36) NOT NULL,
        action ENUM('deactivate', 'reactivate') NOT NULL,
        reason VARCHAR(1000) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_moderation_target_created (target_user_id, created_at),
        CONSTRAINT fk_moderation_moderator FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_moderation_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS content_moderation_actions (
        id CHAR(36) PRIMARY KEY,
        moderator_id CHAR(36) NOT NULL,
        content_id CHAR(36) NOT NULL,
        content_kind ENUM('post', 'story') NOT NULL,
        action ENUM('approve', 'reject') NOT NULL,
        reason VARCHAR(1000),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_content_moderation_created (created_at),
        CONSTRAINT fk_content_moderation_moderator FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS role_assignment_actions (
        id CHAR(36) PRIMARY KEY,
        actor_id CHAR(36) NOT NULL,
        target_user_id CHAR(36) NOT NULL,
        previous_role ENUM('superadmin', 'admin', 'editor', 'moderator', 'user') NOT NULL,
        new_role ENUM('admin', 'editor', 'moderator', 'user') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_role_assignment_created (created_at),
        CONSTRAINT fk_role_assignment_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_role_assignment_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS brand_ads (
        id CHAR(36) PRIMARY KEY,
        brand_name VARCHAR(100) NOT NULL,
        headline VARCHAR(120) NOT NULL,
        body VARCHAR(500) NOT NULL,
        image_url VARCHAR(1000),
        cta_label VARCHAR(40) NOT NULL DEFAULT 'Conocer más',
        destination_url VARCHAR(1000) NOT NULL,
        status ENUM('draft', 'active', 'paused', 'archived') NOT NULL DEFAULT 'draft',
        starts_at DATETIME NULL,
        ends_at DATETIME NULL,
        created_by CHAR(36) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_brand_ads_placement (status, starts_at, ends_at),
        CONSTRAINT fk_brand_ads_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS ad_pricing_rules (
        id TINYINT UNSIGNED PRIMARY KEY,
        currency CHAR(3) NOT NULL DEFAULT 'mxn',
        price_per_day_cents INT UNSIGNED NOT NULL DEFAULT 4900,
        min_duration_days SMALLINT UNSIGNED NOT NULL DEFAULT 1,
        max_duration_days SMALLINT UNSIGNED NOT NULL DEFAULT 30,
        checkout_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        updated_by CHAR(36) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT chk_ad_pricing_singleton CHECK (id = 1),
        CONSTRAINT fk_ad_pricing_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS ad_orders (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        campaign_id CHAR(36) NOT NULL,
        duration_days SMALLINT UNSIGNED NOT NULL,
        unit_price_cents INT UNSIGNED NOT NULL,
        total_amount_cents INT UNSIGNED NOT NULL,
        currency CHAR(3) NOT NULL,
        status ENUM('checkout_pending', 'paid', 'expired', 'failed', 'refunded') NOT NULL DEFAULT 'checkout_pending',
        stripe_checkout_session_id VARCHAR(255) UNIQUE,
        stripe_payment_intent_id VARCHAR(255),
        paid_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ad_orders_user_created (user_id, created_at),
        INDEX idx_ad_orders_status_created (status, created_at),
        CONSTRAINT fk_ad_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_ad_orders_campaign FOREIGN KEY (campaign_id) REFERENCES brand_ads(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS ad_pricing_actions (
        id CHAR(36) PRIMARY KEY,
        actor_id CHAR(36) NOT NULL,
        currency CHAR(3) NOT NULL,
        price_per_day_cents INT UNSIGNED NOT NULL,
        min_duration_days SMALLINT UNSIGNED NOT NULL,
        max_duration_days SMALLINT UNSIGNED NOT NULL,
        checkout_enabled BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ad_pricing_action_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS social_config (
        id CHAR(36) PRIMARY KEY,
        key_name VARCHAR(50) NOT NULL UNIQUE,
        value_encrypted TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS brand_settings (
        id TINYINT UNSIGNED PRIMARY KEY,
        company_name VARCHAR(80) NOT NULL DEFAULT 'entremomentos',
        logo_url VARCHAR(255) NULL,
        updated_by CHAR(36) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT chk_brand_settings_singleton CHECK (id = 1),
        CONSTRAINT fk_brand_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS social_accounts (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        platform ENUM('instagram', 'facebook') NOT NULL,
        account_name VARCHAR(180),
        connected BOOLEAN DEFAULT FALSE,
        access_token TEXT,
        refresh_token TEXT,
        metadata JSON,
        connected_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_social_account_user_platform (user_id, platform),
        CONSTRAINT fk_social_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS social_publications (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        platform ENUM('instagram', 'facebook') NOT NULL,
        story_id CHAR(36),
        title VARCHAR(180),
        caption TEXT,
        external_url VARCHAR(255),
        status ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED') DEFAULT 'PENDING',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_social_publications_user_created (user_id, created_at),
        CONSTRAINT fk_social_publications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_social_publications_story FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ]

    for (const tableSql of tables) {
      await connection.query(tableSql)
    }

    const userColumns = [
      ['cover_url', 'VARCHAR(255) NULL'],
      ['role', "ENUM('superadmin', 'admin', 'editor', 'moderator', 'user') NOT NULL DEFAULT 'user'"],
      ['is_active', 'BOOLEAN NOT NULL DEFAULT TRUE'],
      ['moderation_note', 'TEXT NULL'],
      ['deactivated_at', 'TIMESTAMP NULL'],
      ['deactivated_by', 'CHAR(36) NULL'],
    ]
    for (const [column, definition] of userColumns) {
      const [columns] = await connection.query('SHOW COLUMNS FROM users LIKE ?', [column])
      if (!columns.length) await connection.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`)
    }
    await connection.query(
      `INSERT INTO ad_pricing_rules (id, currency, price_per_day_cents, min_duration_days, max_duration_days, checkout_enabled)
       VALUES (1, 'mxn', 4900, 1, 30, TRUE)
       ON DUPLICATE KEY UPDATE id = VALUES(id)`,
    )
    await connection.query(
      `INSERT INTO brand_settings (id, company_name) VALUES (1, 'entremomentos')
       ON DUPLICATE KEY UPDATE id = VALUES(id)`,
    )
    for (const table of ['posts', 'stories']) {
      for (const [column, definition] of [
        ['moderation_status', "ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved'"],
        ['moderation_note', 'VARCHAR(1000) NULL'],
      ]) {
        const [columns] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column])
        if (!columns.length) await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
      }
    }
    const [brandAdExamples] = await connection.query('SELECT COUNT(*) AS total FROM brand_ads')
    if (Number(brandAdExamples[0].total) === 0) {
      const examples = [
        ['Entre Momentos', 'Un espacio para lo que importa', 'Guarda tus historias, fotos y pequeños momentos en un solo lugar.', 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=85', 'Explorar historias', 'https://example.com/explore'],
        ['Taller Horizonte', 'Regala tiempo creativo', 'Ideas, materiales y talleres para hacer algo bonito con tus manos.', 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=85', 'Ver el taller', 'https://example.com/taller-horizonte'],
        ['Café de Barrio', 'Una pausa sabe mejor cerca', 'Descubre un café tranquilo para tus conversaciones sin prisa.', 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1200&q=85', 'Conocer el café', 'https://example.com/cafe-de-barrio'],
      ]
      for (const [brand, headline, body, imageUrl, cta, destination] of examples) {
        await connection.query(
          'INSERT INTO brand_ads (id, brand_name, headline, body, image_url, cta_label, destination_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, \'draft\')',
          [require('crypto').randomUUID(), brand, headline, body, imageUrl, cta, destination],
        )
      }
    }
    const [demoCampaign] = await connection.query("SELECT id FROM brand_ads WHERE brand_name = 'Campaña de prueba' LIMIT 1")
    if (!demoCampaign.length) {
      await connection.query(
        `INSERT INTO brand_ads (id, brand_name, headline, body, image_url, cta_label, destination_url, status)
         VALUES (?, 'Campaña de prueba', 'Descubre historias que inspiran', 'Este anuncio de demostración enseña cómo una marca puede aparecer entre las historias de la comunidad.', ?, 'Explorar historias', '/explore', 'active')`,
        [require('crypto').randomUUID(), 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=85'],
      )
    }
    await connection.query("UPDATE brand_ads SET image_url = NULL WHERE image_url LIKE 'http://%' OR image_url LIKE 'https://%'")
    console.log(`Base de datos ${database} lista; ${tables.length} tablas verificadas`)
  } finally {
    await connection.end()
  }
}

initializeDatabase().catch((error) => {
  console.error('No se pudo inicializar la base de datos:', error.code || error.message)
  process.exitCode = 1
})
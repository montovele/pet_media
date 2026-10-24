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
      `CREATE TABLE IF NOT EXISTS animals (
        id CHAR(36) PRIMARY KEY,
        public_id CHAR(43) NOT NULL UNIQUE,
        created_by CHAR(36) NULL,
        species VARCHAR(80) NOT NULL,
        name VARCHAR(120) NULL,
        sex VARCHAR(40) NULL,
        estimated_age VARCHAR(120) NULL,
        physical_description TEXT NULL,
        identity_status ENUM('provisional', 'registered') NOT NULL DEFAULT 'registered',
        public_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_animals_creator_created (created_by, created_at),
        CONSTRAINT fk_animals_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS animal_photos (
        id CHAR(36) PRIMARY KEY,
        animal_id CHAR(36) NOT NULL,
        created_by CHAR(36) NOT NULL,
        filename VARCHAR(80) NOT NULL UNIQUE,
        alt_text VARCHAR(180) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_animal_photos_animal (animal_id, created_at),
        CONSTRAINT fk_animal_photos_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
        CONSTRAINT fk_animal_photos_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS animal_identifiers (
        id CHAR(36) PRIMARY KEY,
        animal_id CHAR(36) NOT NULL,
        created_by CHAR(36) NOT NULL,
        identifier_type ENUM('microchip', 'tattoo', 'registry', 'other') NOT NULL,
        reference_value VARCHAR(120) NOT NULL,
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_animal_identifiers_reference (identifier_type, reference_value),
        INDEX idx_animal_identifiers_animal (animal_id, created_at),
        CONSTRAINT fk_animal_identifiers_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
        CONSTRAINT fk_animal_identifiers_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS animal_custody (
        id CHAR(36) PRIMARY KEY,
        animal_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        role VARCHAR(40) NOT NULL DEFAULT 'caregiver',
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP NULL,
        INDEX idx_animal_custody_current (animal_id, ended_at, user_id),
        CONSTRAINT fk_animal_custody_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
        CONSTRAINT fk_animal_custody_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS custody_transfers (
        id CHAR(36) PRIMARY KEY,
        animal_id CHAR(36) NOT NULL,
        from_user_id CHAR(36) NOT NULL,
        to_user_id CHAR(36) NULL,
        recipient_email VARCHAR(180) NOT NULL,
        status ENUM('pending', 'accepted', 'cancelled') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL,
        INDEX idx_custody_transfer_recipient (to_user_id, status, created_at),
        CONSTRAINT fk_custody_transfer_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
        CONSTRAINT fk_custody_transfer_from FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_custody_transfer_to FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS health_records (
        id CHAR(36) PRIMARY KEY,
        animal_id CHAR(36) NOT NULL,
        created_by CHAR(36) NOT NULL,
        record_type VARCHAR(80) NOT NULL,
        description TEXT NOT NULL,
        record_date DATE NOT NULL,
        details JSON NULL,
        source ENUM('caregiver', 'professional') NOT NULL DEFAULT 'caregiver',
        professional_name VARCHAR(180) NULL,
        certified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_health_records_animal_date (animal_id, record_date),
        CONSTRAINT fk_health_records_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
        CONSTRAINT fk_health_records_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS care_schedules (
        id CHAR(36) PRIMARY KEY,
        animal_id CHAR(36) NOT NULL,
        created_by CHAR(36) NOT NULL,
        name VARCHAR(120) NOT NULL,
        dose VARCHAR(100) NULL,
        frequency VARCHAR(120) NOT NULL,
        interval_value SMALLINT UNSIGNED NOT NULL DEFAULT 1,
        interval_unit ENUM('hours', 'days', 'weeks') NOT NULL DEFAULT 'days',
        next_at DATETIME NOT NULL,
        time_zone VARCHAR(80) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_care_schedules_animal_next (animal_id, active, next_at),
        CONSTRAINT fk_care_schedules_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
        CONSTRAINT fk_care_schedules_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS care_logs (
        id CHAR(36) PRIMARY KEY,
        schedule_id CHAR(36) NOT NULL,
        animal_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        result ENUM('administered', 'skipped') NOT NULL,
        administered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_care_logs_schedule_date (schedule_id, administered_at),
        CONSTRAINT fk_care_logs_schedule FOREIGN KEY (schedule_id) REFERENCES care_schedules(id) ON DELETE CASCADE,
        CONSTRAINT fk_care_logs_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
        CONSTRAINT fk_care_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS lost_found_reports (
        id CHAR(36) PRIMARY KEY,
        animal_id CHAR(36) NULL,
        user_id CHAR(36) NULL,
        report_type ENUM('lost', 'found') NOT NULL,
        species VARCHAR(80) NOT NULL,
        report_date DATE NOT NULL,
        location_approximate VARCHAR(180) NOT NULL,
        description TEXT NOT NULL,
        contact_method VARCHAR(180) NOT NULL,
        status ENUM('open', 'resolved', 'closed') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lost_found_public (status, report_type, report_date),
        CONSTRAINT fk_lost_found_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL,
        CONSTRAINT fk_lost_found_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS lost_found_messages (
        id CHAR(36) PRIMARY KEY,
        report_id CHAR(36) NOT NULL,
        sender_user_id CHAR(36) NOT NULL,
        recipient_user_id CHAR(36) NOT NULL,
        thread_id CHAR(36) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lost_found_messages_report (report_id, created_at),
        INDEX idx_lost_found_messages_sender (sender_user_id, created_at),
        INDEX idx_lost_found_messages_thread (thread_id, created_at),
        CONSTRAINT fk_lost_found_messages_report FOREIGN KEY (report_id) REFERENCES lost_found_reports(id) ON DELETE CASCADE,
        CONSTRAINT fk_lost_found_messages_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_lost_found_messages_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS access_grants (
        id CHAR(36) PRIMARY KEY,
        animal_id CHAR(36) NOT NULL,
        created_by CHAR(36) NOT NULL,
        recipient_email VARCHAR(180) NOT NULL,
        password_hash VARCHAR(255) NULL,
        role VARCHAR(60) NOT NULL,
        permissions JSON NOT NULL,
        expires_at DATETIME NULL,
        revoked_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_access_grants_animal (animal_id, revoked_at, expires_at),
        INDEX idx_access_grants_email (recipient_email, revoked_at),
        CONSTRAINT fk_access_grants_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE CASCADE,
        CONSTRAINT fk_access_grants_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id CHAR(36) PRIMARY KEY,
        actor_id CHAR(36) NULL,
        action VARCHAR(80) NOT NULL,
        entity_type VARCHAR(80) NOT NULL,
        entity_id CHAR(36) NULL,
        changes JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_logs_created (created_at),
        INDEX idx_audit_logs_actor (actor_id, created_at),
        CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
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
        animal_id CHAR(36) NULL,
        title VARCHAR(120) NOT NULL,
        description TEXT,
        activity_date DATE NOT NULL,
        location_name VARCHAR(180),
        category ENUM('walk', 'travel', 'food', 'wellness', 'culture', 'other') DEFAULT 'other',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_activities_user_date (user_id, activity_date),
        INDEX idx_activities_animal_date (animal_id, activity_date),
        CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_activities_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL
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
        activity_id CHAR(36) NOT NULL,
        media_id CHAR(36) NOT NULL UNIQUE,
        user_id CHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (activity_id, media_id),
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
        dedupe_key VARCHAR(220) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_user_created (user_id, created_at),
        UNIQUE KEY uq_notifications_user_dedupe (user_id, dedupe_key),
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
        primary_color CHAR(7) NOT NULL DEFAULT '#187a75',
        secondary_color CHAR(7) NOT NULL DEFAULT '#d55d45',
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
    for (const [column, definition] of [
      ['primary_color', "CHAR(7) NOT NULL DEFAULT '#187a75'"],
      ['secondary_color', "CHAR(7) NOT NULL DEFAULT '#d55d45'"],
    ]) {
      const [columns] = await connection.query('SHOW COLUMNS FROM brand_settings LIKE ?', [column])
      if (!columns.length) await connection.query(`ALTER TABLE brand_settings ADD COLUMN ${column} ${definition}`)
    }
    const [accessGrantPasswordColumn] = await connection.query("SHOW COLUMNS FROM access_grants LIKE 'password_hash'")
    if (!accessGrantPasswordColumn.length) {
      await connection.query('ALTER TABLE access_grants ADD COLUMN password_hash VARCHAR(255) NULL AFTER recipient_email')
    }
    const [accessGrantAnimalIdsColumn] = await connection.query("SHOW COLUMNS FROM access_grants LIKE 'animal_ids'")
    if (!accessGrantAnimalIdsColumn.length) {
      await connection.query('ALTER TABLE access_grants ADD COLUMN animal_ids JSON NULL')
    }
    const [accessGrantAllAnimalsColumn] = await connection.query("SHOW COLUMNS FROM access_grants LIKE 'all_animals'")
    if (!accessGrantAllAnimalsColumn.length) {
      await connection.query('ALTER TABLE access_grants ADD COLUMN all_animals BOOLEAN NOT NULL DEFAULT FALSE')
    }
    const [notificationDedupeColumn] = await connection.query("SHOW COLUMNS FROM notifications LIKE 'dedupe_key'")
    if (!notificationDedupeColumn.length) {
      await connection.query('ALTER TABLE notifications ADD COLUMN dedupe_key VARCHAR(220) NULL')
    }
    const [notificationDedupeIndex] = await connection.query("SHOW INDEX FROM notifications WHERE Key_name = 'uq_notifications_user_dedupe'")
    if (!notificationDedupeIndex.length) {
      await connection.query('ALTER TABLE notifications ADD UNIQUE KEY uq_notifications_user_dedupe (user_id, dedupe_key)')
    }
    const [healthDetailsColumn] = await connection.query("SHOW COLUMNS FROM health_records LIKE 'details'")
    if (!healthDetailsColumn.length) {
      await connection.query('ALTER TABLE health_records ADD COLUMN details JSON NULL AFTER record_date')
    }
    for (const [column, definition] of [
      ['recipient_user_id', 'CHAR(36) NULL'],
      ['thread_id', 'CHAR(36) NULL'],
    ]) {
      const [columns] = await connection.query('SHOW COLUMNS FROM lost_found_messages LIKE ?', [column])
      if (!columns.length) await connection.query(`ALTER TABLE lost_found_messages ADD COLUMN ${column} ${definition}`)
    }
    await connection.query(
      `UPDATE lost_found_messages messages
       JOIN lost_found_reports reports ON reports.id = messages.report_id
       SET messages.recipient_user_id = reports.user_id
       WHERE messages.recipient_user_id IS NULL`,
    )
    await connection.query(
      'UPDATE lost_found_messages SET thread_id = id WHERE thread_id IS NULL',
    )
    const [threadIndex] = await connection.query("SHOW INDEX FROM lost_found_messages WHERE Key_name = 'idx_lost_found_messages_thread'")
    if (!threadIndex.length) {
      await connection.query('ALTER TABLE lost_found_messages ADD INDEX idx_lost_found_messages_thread (thread_id, created_at)')
    }
    for (const [column, definition] of [
      ['interval_value', 'SMALLINT UNSIGNED NOT NULL DEFAULT 1'],
      ['interval_unit', "ENUM('hours', 'days', 'weeks') NOT NULL DEFAULT 'days'"],
    ]) {
      const [columns] = await connection.query('SHOW COLUMNS FROM care_schedules LIKE ?', [column])
      if (!columns.length) await connection.query(`ALTER TABLE care_schedules ADD COLUMN ${column} ${definition}`)
    }
    const [identityStatusColumn] = await connection.query("SHOW COLUMNS FROM animals LIKE 'identity_status'")
    if (!identityStatusColumn.length) {
      await connection.query("ALTER TABLE animals ADD COLUMN identity_status ENUM('provisional', 'registered') NOT NULL DEFAULT 'registered'")
    } else if (!identityStatusColumn[0].Type.includes("'registered'")) {
      await connection.query("ALTER TABLE animals MODIFY identity_status ENUM('provisional', 'verified', 'registered') NOT NULL DEFAULT 'registered'")
      await connection.query("UPDATE animals SET identity_status = 'registered' WHERE identity_status = 'verified'")
      await connection.query("ALTER TABLE animals MODIFY identity_status ENUM('provisional', 'registered') NOT NULL DEFAULT 'registered'")
    }
    const [publicEnabledColumn] = await connection.query("SHOW COLUMNS FROM animals LIKE 'public_enabled'")
    if (!publicEnabledColumn.length) {
      await connection.query('ALTER TABLE animals ADD COLUMN public_enabled BOOLEAN NOT NULL DEFAULT FALSE')
    }
    const [recipientEmailColumn] = await connection.query("SHOW COLUMNS FROM custody_transfers LIKE 'recipient_email'")
    if (!recipientEmailColumn.length) {
      await connection.query('ALTER TABLE custody_transfers ADD COLUMN recipient_email VARCHAR(180) NULL')
      await connection.query(
        `UPDATE custody_transfers transfers
         JOIN users ON users.id = transfers.to_user_id
         SET transfers.recipient_email = users.email
         WHERE transfers.recipient_email IS NULL`,
      )
    }
    await connection.query(
      `UPDATE custody_transfers transfers
       JOIN users ON users.id = transfers.to_user_id
       SET transfers.recipient_email = users.email
       WHERE transfers.recipient_email IS NULL OR transfers.recipient_email = ''`,
    )
    const [transferEmailColumn] = await connection.query("SHOW COLUMNS FROM custody_transfers LIKE 'recipient_email'")
    if (transferEmailColumn[0]?.Null === 'YES') {
      await connection.query('ALTER TABLE custody_transfers MODIFY recipient_email VARCHAR(180) NOT NULL')
    }
    const [transferRecipientColumn] = await connection.query("SHOW COLUMNS FROM custody_transfers LIKE 'to_user_id'")
    if (transferRecipientColumn.length && transferRecipientColumn[0].Null === 'NO') {
      await connection.query('ALTER TABLE custody_transfers MODIFY to_user_id CHAR(36) NULL')
    }
    const [animalsMissingCustody] = await connection.query(
      `SELECT animals.id, animals.created_by
       FROM animals LEFT JOIN animal_custody
         ON animal_custody.animal_id = animals.id
         AND animal_custody.user_id = animals.created_by
         AND animal_custody.ended_at IS NULL
       WHERE animals.created_by IS NOT NULL AND animal_custody.id IS NULL`,
    )
    for (const animal of animalsMissingCustody) {
      await connection.query(
        "INSERT INTO animal_custody (id, animal_id, user_id, role) VALUES (?, ?, ?, 'caregiver')",
        [require('crypto').randomUUID(), animal.id, animal.created_by],
      )
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
    const [activityAnimalColumn] = await connection.query("SHOW COLUMNS FROM activities LIKE 'animal_id'")
    if (!activityAnimalColumn.length) {
      await connection.query('ALTER TABLE activities ADD COLUMN animal_id CHAR(36) NULL AFTER user_id')
      await connection.query('ALTER TABLE activities ADD INDEX idx_activities_animal_date (animal_id, activity_date)')
      await connection.query('ALTER TABLE activities ADD CONSTRAINT fk_activities_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL')
    }
    const [activityMediaPrimaryKey] = await connection.query(
      "SHOW INDEX FROM activity_media WHERE Key_name = 'PRIMARY'",
    )
    if (activityMediaPrimaryKey.length === 1 && activityMediaPrimaryKey[0].Column_name === 'activity_id') {
      await connection.query(
        'ALTER TABLE activity_media DROP PRIMARY KEY, ADD PRIMARY KEY (activity_id, media_id)',
      )
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
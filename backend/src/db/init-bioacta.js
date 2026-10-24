require('dotenv').config()

const mysql = require('mysql2/promise')
const { randomUUID } = require('crypto')

async function ensureColumn(connection, table, column, definition) {
  const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column])
  if (!columns.length) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
}

async function ensureIndex(connection, table, indexName, definition) {
  const [indexes] = await connection.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName])
  if (!indexes.length) await connection.query(`ALTER TABLE \`${table}\` ADD ${definition}`)
}

async function initializeBioActa() {
  const database = process.env.DB_NAME || 'social_db'
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
  })

  try {
    const [usersTable] = await connection.query("SHOW TABLES LIKE 'users'")
    if (!usersTable.length) throw new Error(`La base ${database} no tiene la tabla requerida users.`)

    const tables = [
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
    ]

    for (const tableSql of tables) await connection.query(tableSql)

    await ensureColumn(connection, 'brand_settings', 'primary_color', "CHAR(7) NOT NULL DEFAULT '#187a75'")
    await ensureColumn(connection, 'brand_settings', 'secondary_color', "CHAR(7) NOT NULL DEFAULT '#d55d45'")
    await connection.query(
      `INSERT INTO brand_settings (id, company_name) VALUES (1, 'entremomentos')
       ON DUPLICATE KEY UPDATE id = VALUES(id)`,
    )
    await ensureColumn(connection, 'access_grants', 'password_hash', 'VARCHAR(255) NULL')
    await ensureColumn(connection, 'access_grants', 'animal_ids', 'JSON NULL')
    await ensureColumn(connection, 'access_grants', 'all_animals', 'BOOLEAN NOT NULL DEFAULT FALSE')
    await ensureColumn(connection, 'animals', 'identity_status', "ENUM('provisional', 'registered') NOT NULL DEFAULT 'registered'")
    await ensureColumn(connection, 'animals', 'public_enabled', 'BOOLEAN NOT NULL DEFAULT FALSE')
    await ensureColumn(connection, 'health_records', 'details', 'JSON NULL')
    await ensureColumn(connection, 'care_schedules', 'interval_value', 'SMALLINT UNSIGNED NOT NULL DEFAULT 1')
    await ensureColumn(connection, 'care_schedules', 'interval_unit', "ENUM('hours', 'days', 'weeks') NOT NULL DEFAULT 'days'")
    await ensureColumn(connection, 'lost_found_messages', 'recipient_user_id', 'CHAR(36) NULL')
    await ensureColumn(connection, 'lost_found_messages', 'thread_id', 'CHAR(36) NULL')
    await connection.query(
      `UPDATE lost_found_messages messages
       JOIN lost_found_reports reports ON reports.id = messages.report_id
       SET messages.recipient_user_id = reports.user_id
       WHERE messages.recipient_user_id IS NULL`,
    )
    await connection.query('UPDATE lost_found_messages SET thread_id = id WHERE thread_id IS NULL')
    await ensureIndex(
      connection,
      'lost_found_messages',
      'idx_lost_found_messages_thread',
      'INDEX idx_lost_found_messages_thread (thread_id, created_at)',
    )

    const [notificationTable] = await connection.query("SHOW TABLES LIKE 'notifications'")
    if (notificationTable.length) {
      await ensureColumn(connection, 'notifications', 'dedupe_key', 'VARCHAR(220) NULL')
      await ensureIndex(
        connection,
        'notifications',
        'uq_notifications_user_dedupe',
        'UNIQUE KEY uq_notifications_user_dedupe (user_id, dedupe_key)',
      )
    }

    const [activitiesTable] = await connection.query("SHOW TABLES LIKE 'activities'")
    if (activitiesTable.length) {
      await ensureColumn(connection, 'activities', 'animal_id', 'CHAR(36) NULL')
      await ensureIndex(
        connection,
        'activities',
        'idx_activities_animal_date',
        'INDEX idx_activities_animal_date (animal_id, activity_date)',
      )
      const [foreignKeys] = await connection.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activities'
           AND COLUMN_NAME = 'animal_id' AND REFERENCED_TABLE_NAME = 'animals'`,
      )
      if (!foreignKeys.length) {
        await connection.query(
          'ALTER TABLE activities ADD CONSTRAINT fk_activities_animal FOREIGN KEY (animal_id) REFERENCES animals(id) ON DELETE SET NULL',
        )
      }
      const [activityMediaTable] = await connection.query("SHOW TABLES LIKE 'activity_media'")
      if (activityMediaTable.length) {
        const [activityMediaPrimaryKey] = await connection.query(
          "SHOW INDEX FROM activity_media WHERE Key_name = 'PRIMARY'",
        )
        if (activityMediaPrimaryKey.length === 1 && activityMediaPrimaryKey[0].Column_name === 'activity_id') {
          await connection.query(
            'ALTER TABLE activity_media DROP PRIMARY KEY, ADD PRIMARY KEY (activity_id, media_id)',
          )
        }
      }
    }

    const [animalsWithoutCustody] = await connection.query(
      `SELECT animals.id, animals.created_by
       FROM animals LEFT JOIN animal_custody
         ON animal_custody.animal_id = animals.id
         AND animal_custody.user_id = animals.created_by
         AND animal_custody.ended_at IS NULL
       WHERE animals.created_by IS NOT NULL AND animal_custody.id IS NULL`,
    )
    for (const animal of animalsWithoutCustody) {
      await connection.query(
        "INSERT INTO animal_custody (id, animal_id, user_id, role) VALUES (?, ?, ?, 'caregiver')",
        [randomUUID(), animal.id, animal.created_by],
      )
    }

    console.log(`Esquema BIO-ACTA listo en ${database}; tablas existentes y datos preservados.`)
  } finally {
    await connection.end()
  }
}

initializeBioActa().catch((error) => {
  console.error('No se pudo inicializar BIO-ACTA:', error.code || error.message)
  process.exitCode = 1
})

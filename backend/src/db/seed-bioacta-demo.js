require('dotenv').config()

const { createHash } = require('crypto')
const mysql = require('mysql2/promise')

const targetEmailArg = process.argv.slice(2).find((argument) => argument.startsWith('--email='))
const ownerEmail = process.env.BIOACTA_DEMO_USER_EMAIL
  || targetEmailArg?.slice('--email='.length)
  || 'mateo.demo@example.test'
const collaboratorEmail = 'lucia.demo@example.test'
let owner
let collaborator

const dogs = [
  {
    id: '91000000-0000-4000-8000-000000000001',
    name: 'Luna',
    breed: 'Labrador Retriever',
    sex: 'Hembra',
    age: '4 años',
    description: 'Raza: Labrador Retriever. Muy sociable; disfruta los paseos junto al agua.',
    status: 'registered',
    public: true,
  },
  {
    id: '91000000-0000-4000-8000-000000000002',
    name: 'Bruno',
    breed: 'Pastor Alemán',
    sex: 'Macho',
    age: '6 años',
    description: 'Raza: Pastor Alemán. Activo y atento; responde bien al entrenamiento positivo.',
    status: 'registered',
    public: false,
  },
  {
    id: '91000000-0000-4000-8000-000000000003',
    name: 'Nala',
    breed: 'Corgi Galés de Pembroke',
    sex: 'Hembra',
    age: '2 años',
    description: 'Raza: Corgi Galés de Pembroke. Curiosa, juguetona y acostumbrada a convivir en familia.',
    status: 'provisional',
    public: true,
  },
  {
    id: '91000000-0000-4000-8000-000000000004',
    name: 'Koda',
    breed: 'Beagle',
    sex: 'Macho',
    age: '5 años',
    description: 'Raza: Beagle. Le gusta explorar senderos; usa arnés durante los paseos.',
    status: 'registered',
    public: false,
  },
  {
    id: '91000000-0000-4000-8000-000000000005',
    name: 'Frida',
    breed: 'Bulldog Francés',
    sex: 'Hembra',
    age: '3 años',
    description: 'Raza: Bulldog Francés. Tranquila; sus actividades se adaptan a su tolerancia al calor.',
    status: 'registered',
    public: false,
  },
]

let nextRecordId = 1
function recordId() {
  return `92000000-0000-4000-8000-${String(nextRecordId++).padStart(12, '0')}`
}

function dateAtOffset(days, hour = 12) {
  const date = new Date()
  date.setUTCHours(hour, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + days)
  return date
}

function sqlDate(date) {
  return date.toISOString().slice(0, 10)
}

function sqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function publicId(animalId) {
  return createHash('sha256').update(`bioacta-demo:${animalId}`).digest('base64url')
}

async function upsertRows(connection, table, rows, updateColumns) {
  if (!rows.length) return
  const columns = Object.keys(rows[0])
  const placeholders = columns.map(() => '?').join(', ')
  const updates = updateColumns.map((column) => `${column} = VALUES(${column})`).join(', ')
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updates}`
  for (const row of rows) {
    try {
      await connection.query(sql, columns.map((column) => row[column] ?? null))
    } catch (error) {
      error.seedTable = table
      throw error
    }
  }
}

async function insertRowsIfMissing(connection, table, rows) {
  if (!rows.length) return
  const columns = Object.keys(rows[0])
  const placeholders = columns.map(() => '?').join(', ')
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE id = id`
  for (const row of rows) {
    await connection.query(sql, columns.map((column) => row[column] ?? null))
  }
}

async function seedBioActaDemo() {
  const database = process.env.DB_NAME || 'social_db'
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
  })

  try {
    const [users] = await connection.query(
      'SELECT id, email FROM users WHERE LOWER(email) IN (?, ?) AND is_active = TRUE',
      [ownerEmail.toLowerCase(), collaboratorEmail.toLowerCase()],
    )
    owner = users.find((user) => user.email.toLowerCase() === ownerEmail.toLowerCase())
    collaborator = users.find((user) => user.email.toLowerCase() === collaboratorEmail.toLowerCase())
    if (!owner || !collaborator) {
      throw new Error(`Se requieren cuentas activas para ${ownerEmail} y ${collaboratorEmail}; no se modificaron cuentas ni contraseñas.`)
    }

    await connection.beginTransaction()
    const animals = dogs.map((dog) => ({
      id: dog.id,
      public_id: publicId(dog.id),
      created_by: owner.id,
      species: `Perro · ${dog.breed}`,
      name: dog.name,
      sex: dog.sex,
      estimated_age: dog.age,
      physical_description: dog.description,
      identity_status: dog.status,
      public_enabled: dog.public,
    }))
    await upsertRows(connection, 'animals', animals, [
      'created_by', 'species', 'name', 'sex', 'estimated_age',
      'physical_description', 'identity_status', 'public_enabled',
    ])

    await upsertRows(connection, 'animal_custody', dogs.map((dog) => ({
      id: `93000000-0000-4000-8000-${dog.id.slice(-12)}`,
      animal_id: dog.id,
      user_id: owner.id,
      role: 'caregiver',
      ended_at: null,
    })), ['user_id', 'role', 'ended_at'])

    await upsertRows(connection, 'animal_identifiers', dogs.map((dog, index) => ({
      id: `94000000-0000-4000-8000-${dog.id.slice(-12)}`,
      animal_id: dog.id,
      created_by: owner.id,
      identifier_type: 'microchip',
      reference_value: `DEMO-MC-${String(index + 1).padStart(5, '0')}`,
      verified: false,
    })), ['created_by', 'identifier_type', 'reference_value', 'verified'])

    const healthRecords = dogs.flatMap((dog, index) => {
      const recentDate = sqlDate(dateAtOffset(-30 - index * 3))
      const earlierDate = sqlDate(dateAtOffset(-180 - index * 7))
      return [
        {
          id: recordId(),
          animal_id: dog.id,
          created_by: owner.id,
          record_type: 'Vacuna',
          description: 'Registro ficticio de demostración; confirmar el esquema con un profesional veterinario.',
          record_date: recentDate,
          details: JSON.stringify({
            productName: 'Vacuna polivalente (dato de muestra)',
            dose: '1 dosis',
            lotNumber: `DEMO-${String(index + 1).padStart(3, '0')}`,
            nextDueDate: sqlDate(dateAtOffset(335 - index * 10)),
          }),
          source: 'caregiver',
          professional_name: null,
          certified: false,
        },
        {
          id: recordId(),
          animal_id: dog.id,
          created_by: owner.id,
          record_type: index % 2 ? 'Tratamiento' : 'Medicamento',
          description: 'Nota de ejemplo para visualizar la historia; no constituye una indicación médica.',
          record_date: earlierDate,
          details: JSON.stringify({
            productName: 'Registro de muestra',
            dose: 'Según valoración profesional',
            lotNumber: null,
            nextDueDate: null,
          }),
          source: 'caregiver',
          professional_name: null,
          certified: false,
        },
      ]
    })
    await upsertRows(connection, 'health_records', healthRecords, [
      'created_by', 'record_type', 'description', 'record_date', 'details',
      'source', 'professional_name', 'certified',
    ])

    const schedules = dogs.map((dog, index) => {
      const nextAt = index === 0
        ? dateAtOffset(-1, 9)
        : dateAtOffset(index + 1, 9)
      return {
        id: `95000000-0000-4000-8000-${dog.id.slice(-12)}`,
        animal_id: dog.id,
        created_by: owner.id,
        name: ['Revisión de agua y alimento', 'Paseo y actividad', 'Cepillado', 'Control preventivo', 'Pausa e hidratación'][index],
        dose: null,
        frequency: index === 2 ? 'Semanal' : 'Diaria',
        interval_value: 1,
        interval_unit: 'days',
        next_at: sqlDateTime(nextAt),
        time_zone: 'America/Mexico_City',
        active: true,
      }
    })
    await upsertRows(connection, 'care_schedules', schedules, [
      'created_by', 'name', 'dose', 'frequency', 'interval_value', 'interval_unit',
      'next_at', 'time_zone', 'active',
    ])

    await upsertRows(connection, 'care_logs', dogs.flatMap((dog, index) => {
      const scheduleId = schedules[index].id
      return [-2, -1].map((daysAgo, logIndex) => ({
        id: `96000000-0000-4000-8000-${String(index * 2 + logIndex + 1).padStart(12, '0')}`,
        schedule_id: scheduleId,
        animal_id: dog.id,
        user_id: owner.id,
        result: logIndex === 0 ? 'administered' : 'skipped',
        administered_at: sqlDateTime(dateAtOffset(daysAgo, 9)),
      }))
    }), ['schedule_id', 'animal_id', 'user_id', 'result', 'administered_at'])

    const activities = dogs.flatMap((dog, index) => [-1, -4].map((daysAgo, itemIndex) => ({
      id: `97000000-0000-4000-8000-${String(index * 2 + itemIndex + 1).padStart(12, '0')}`,
      user_id: owner.id,
      animal_id: dog.id,
      title: ['Paseo matutino', 'Juego y enriquecimiento'][itemIndex],
      description: `Actividad de demostración con ${dog.name}; registro ficticio para probar la historia BIO-ACTA.`,
      activity_date: sqlDate(dateAtOffset(daysAgo)),
      location_name: ['Parque del barrio', 'Sendero del bosque'][index % 2],
      category: itemIndex === 0 ? 'walk' : 'wellness',
    })))
    await upsertRows(connection, 'activities', activities, [
      'user_id', 'animal_id', 'title', 'description', 'activity_date', 'location_name', 'category',
    ])

    await upsertRows(connection, 'access_grants', [
      {
        id: '98000000-0000-4000-8000-000000000001',
        animal_id: dogs[0].id,
        created_by: owner.id,
        recipient_email: collaborator.email,
        role: 'Veterinario',
        permissions: JSON.stringify(['health:read']),
        expires_at: sqlDateTime(dateAtOffset(30, 23)),
        revoked_at: null,
      },
      {
        id: '98000000-0000-4000-8000-000000000002',
        animal_id: dogs[1].id,
        created_by: owner.id,
        recipient_email: collaborator.email,
        role: 'Cuidador',
        permissions: JSON.stringify(['animal:read', 'health:read', 'care:manage']),
        expires_at: null,
        revoked_at: null,
      },
    ], ['created_by', 'recipient_email', 'role', 'permissions', 'expires_at', 'revoked_at'])

    await upsertRows(connection, 'custody_transfers', [{
      id: '99000000-0000-4000-8000-000000000001',
      animal_id: dogs[4].id,
      from_user_id: owner.id,
      to_user_id: collaborator.id,
      recipient_email: collaborator.email,
      status: 'pending',
      resolved_at: null,
    }], ['animal_id', 'from_user_id', 'to_user_id', 'recipient_email', 'status', 'resolved_at'])

    const reportId = '9a000000-0000-4000-8000-000000000001'
    const threadId = '9a000000-0000-4000-8000-000000000002'
    await upsertRows(connection, 'lost_found_reports', [
      {
        id: reportId,
        animal_id: dogs[3].id,
        user_id: owner.id,
        report_type: 'lost',
        species: `Perro · ${dogs[3].breed}`,
        report_date: sqlDate(dateAtOffset(-1)),
        location_approximate: 'Parque del barrio, zona norte',
        description: 'Reporte ficticio para demostración. Beagle visto por última vez con arnés azul.',
        contact_method: 'Mensajes internos de BIO-ACTA',
        status: 'open',
      },
      {
        id: '9a000000-0000-4000-8000-000000000003',
        animal_id: null,
        user_id: collaborator.id,
        report_type: 'found',
        species: 'Perro · Mestizo mediano',
        report_date: sqlDate(dateAtOffset(-2)),
        location_approximate: 'Jardín comunitario',
        description: 'Reporte ficticio: perro amistoso encontrado con collar rojo; se busca a su familia.',
        contact_method: 'Mensajes internos de BIO-ACTA',
        status: 'open',
      },
    ], ['animal_id', 'user_id', 'report_type', 'species', 'report_date', 'location_approximate', 'description', 'contact_method', 'status'])

    await upsertRows(connection, 'lost_found_messages', [
      {
        id: '9b000000-0000-4000-8000-000000000001',
        report_id: reportId,
        sender_user_id: collaborator.id,
        recipient_user_id: owner.id,
        thread_id: threadId,
        message: 'Hola, vi el reporte de Koda. ¿Puedes confirmar si llevaba un arnés azul?',
      },
      {
        id: '9b000000-0000-4000-8000-000000000002',
        report_id: reportId,
        sender_user_id: owner.id,
        recipient_user_id: collaborator.id,
        thread_id: threadId,
        message: 'Sí, es correcto. Gracias por ayudar; responderé por aquí si hay novedades.',
      },
    ], ['report_id', 'sender_user_id', 'recipient_user_id', 'thread_id', 'message'])

    const dueAt = schedules[0].next_at
    const dueDate = new Date(`${dueAt.replace(' ', 'T')}Z`)
    const dueKey = `care:${schedules[0].id}:${dueDate.toISOString()}:${owner.id}`
    await upsertRows(connection, 'notifications', [
      {
        id: '9c000000-0000-4000-8000-000000000001',
        user_id: owner.id,
        type: 'care',
        title: 'Recordatorio de cuidado',
        description: `${schedules[0].name} · ${dogs[0].name} requiere atención.`,
        read_flag: false,
        dedupe_key: dueKey,
        created_at: sqlDateTime(dateAtOffset(0, 8)),
      },
      {
        id: '9c000000-0000-4000-8000-000000000002',
        user_id: owner.id,
        type: 'lost_found',
        title: 'Nuevo mensaje sobre un reporte',
        description: 'Recibiste un mensaje privado sobre un reporte de perro.',
        read_flag: false,
        dedupe_key: null,
        created_at: sqlDateTime(dateAtOffset(-1, 15)),
      },
    ], ['user_id', 'type', 'title', 'description', 'read_flag', 'dedupe_key', 'created_at'])

    const auditLogs = dogs.map((dog) => ({
      id: recordId(),
      actor_id: owner.id,
      action: 'animal.created',
      entity_type: 'animal',
      entity_id: dog.id,
      changes: JSON.stringify({ demo: true, breed: dog.breed }),
    }))
    await upsertRows(connection, 'audit_logs', auditLogs, [
      'actor_id', 'action', 'entity_type', 'entity_id', 'changes',
    ])

    const posts = [
      {
        id: 'a1000000-0000-4000-8000-000000000001',
        user_id: owner.id,
        title: 'Un paseo que empezó con sol',
        caption: 'Luna encontró su lugar favorito junto al agua. Registro ficticio de demostración.',
        image_url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1200&q=85',
        media_type: 'image',
        visibility: 'public',
        moderation_status: 'approved',
        moderation_note: null,
        likes_count: 0,
        comments_count: 0,
        created_at: sqlDateTime(dateAtOffset(-1, 16)),
      },
      {
        id: 'a1000000-0000-4000-8000-000000000002',
        user_id: owner.id,
        title: 'Pequeños pasos, grandes aventuras',
        caption: 'Koda olfateó cada rincón del sendero. Contenido de prueba.',
        image_url: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=1200&q=85',
        media_type: 'image',
        visibility: 'followers',
        moderation_status: 'approved',
        moderation_note: null,
        likes_count: 0,
        comments_count: 0,
        created_at: sqlDateTime(dateAtOffset(-3, 11)),
      },
    ]
    await upsertRows(connection, 'posts', posts, [
      'user_id', 'title', 'caption', 'image_url', 'media_type', 'visibility',
      'moderation_status', 'moderation_note', 'likes_count', 'comments_count', 'created_at',
    ])

    const stories = [
      {
        id: 'a2000000-0000-4000-8000-000000000001',
        user_id: owner.id,
        title: 'La primera vuelta al parque',
        caption: 'Bruno y su paseo de hoy. Historia pública de demostración.',
        image_url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=85',
        media_type: 'image',
        visibility: 'public',
        moderation_status: 'approved',
        moderation_note: null,
        created_at: sqlDateTime(dateAtOffset(-1, 10)),
      },
      {
        id: 'a2000000-0000-4000-8000-000000000002',
        user_id: owner.id,
        title: 'Una pausa a la sombra',
        caption: 'Frida disfruta una tarde tranquila. Historia para personas seguidoras.',
        image_url: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=85',
        media_type: 'image',
        visibility: 'followers',
        moderation_status: 'approved',
        moderation_note: null,
        created_at: sqlDateTime(dateAtOffset(-2, 14)),
      },
      {
        id: 'a2000000-0000-4000-8000-000000000003',
        user_id: owner.id,
        title: 'Revisión de contenido de demostración',
        caption: 'Historia pública ficticia para mostrar la bandeja de revisión; no representa contenido real de una persona.',
        image_url: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=1200&q=85',
        media_type: 'image',
        visibility: 'public',
        moderation_status: 'pending',
        moderation_note: null,
        created_at: sqlDateTime(dateAtOffset(0, 8)),
      },
    ]
    await upsertRows(connection, 'stories', stories, [
      'user_id', 'title', 'caption', 'image_url', 'media_type', 'visibility',
      'moderation_status', 'moderation_note', 'created_at',
    ])

    await upsertRows(connection, 'comments', [
      {
        id: 'a3000000-0000-4000-8000-000000000001',
        user_id: collaborator.id,
        post_id: posts[0].id,
        story_id: null,
        text: 'Qué buen paseo; Luna se ve feliz.',
      },
      {
        id: 'a3000000-0000-4000-8000-000000000002',
        user_id: owner.id,
        post_id: null,
        story_id: stories[0].id,
        text: 'El parque estaba muy tranquilo esta mañana.',
      },
    ], ['user_id', 'post_id', 'story_id', 'text'])

    await upsertRows(connection, 'reactions', [
      {
        id: 'a4000000-0000-4000-8000-000000000001',
        user_id: collaborator.id,
        post_id: posts[0].id,
        story_id: null,
        type: 'like',
      },
      {
        id: 'a4000000-0000-4000-8000-000000000002',
        user_id: owner.id,
        post_id: null,
        story_id: stories[0].id,
        type: 'like',
      },
    ], ['user_id', 'post_id', 'story_id', 'type'])

    await upsertRows(connection, 'user_follows', [
      { follower_user_id: owner.id, following_user_id: collaborator.id, created_at: sqlDateTime(dateAtOffset(-7)) },
      { follower_user_id: collaborator.id, following_user_id: owner.id, created_at: sqlDateTime(dateAtOffset(-6)) },
    ], ['created_at'])

    const albumId = 'a5000000-0000-4000-8000-000000000001'
    await upsertRows(connection, 'albums', [{
      id: albumId,
      user_id: owner.id,
      title: 'Paseos y patas',
      description: 'Selección ficticia de fotos para probar la biblioteca y los álbumes.',
      created_at: sqlDateTime(dateAtOffset(-1, 17)),
    }], ['user_id', 'title', 'description', 'created_at'])

    await upsertRows(connection, 'album_photos', [
      {
        id: 'a6000000-0000-4000-8000-000000000001',
        album_id: albumId,
        user_id: owner.id,
        photo_id: `post:${posts[0].id}`,
        photo_url: posts[0].image_url,
        position: 0,
      },
      {
        id: 'a6000000-0000-4000-8000-000000000002',
        album_id: albumId,
        user_id: owner.id,
        photo_id: `story:${stories[0].id}`,
        photo_url: stories[0].image_url,
        position: 1,
      },
    ], ['album_id', 'user_id', 'photo_id', 'photo_url', 'position'])

    await insertRowsIfMissing(connection, 'social_accounts', [
      {
        id: 'a7000000-0000-4000-8000-000000000001',
        user_id: owner.id,
        platform: 'instagram',
        account_name: 'Instagram · demostración local',
        connected: false,
        metadata: JSON.stringify({ demo: true }),
      },
      {
        id: 'a7000000-0000-4000-8000-000000000002',
        user_id: owner.id,
        platform: 'facebook',
        account_name: 'Facebook · demostración local',
        connected: false,
        metadata: JSON.stringify({ demo: true }),
      },
    ])

    await upsertRows(connection, 'social_publications', [{
      id: 'a8000000-0000-4000-8000-000000000001',
      user_id: owner.id,
      platform: 'instagram',
      story_id: stories[0].id,
      title: 'Ejemplo local — paseo de Bruno',
      caption: 'Registro ficticio; no se envió a Instagram.',
      external_url: null,
      status: 'FAILED',
      error_message: 'Ejemplo de interfaz. No hay cuenta externa conectada ni se realizó una publicación.',
    }], ['user_id', 'platform', 'story_id', 'title', 'caption', 'external_url', 'status', 'error_message'])

    await connection.commit()
    console.log(`Datos de demostración listos en ${database} para ${owner.email}.`)
    console.log('Se incluyeron cinco perros, salud/cuidados, actividades, historias/publicaciones, fotos/álbum, interacciones, reportes, permisos, transferencia y notificaciones.')
    console.log('Los registros sanitarios no están certificados; las cuentas Meta permanecen desconectadas y no se simularon pagos.')
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.end()
  }
}

seedBioActaDemo().catch((error) => {
  console.error(
    'No se pudieron cargar los datos BIO-ACTA de demostración:',
    error.code
      ? `${error.code}${error.seedTable ? ` en ${error.seedTable}` : ''}: ${error.sqlMessage || error.message}`
      : error.message,
  )
  process.exitCode = 1
})

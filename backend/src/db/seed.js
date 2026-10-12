require('dotenv').config()

const bcrypt = require('bcryptjs')
const pool = require('../config/db')

const demoPassword = 'SocialDemo2026!'
const users = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Mariana López',
    email: 'mariana.demo@example.test',
    username: 'mariana_demo',
    bio: 'Coleccionando días bonitos.',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Mateo Ruiz',
    email: 'mateo.demo@example.test',
    username: 'mateo_demo',
    bio: 'Caminos largos y café recién hecho.',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Lucía Torres',
    email: 'lucia.demo@example.test',
    username: 'lucia_demo',
    bio: 'Guardando pequeños momentos.',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  },
]

async function upsertRows(connection, table, columns, rows, updateColumns) {
  const placeholders = columns.map(() => '?').join(', ')
  const updates = updateColumns.map((column) => `${column} = VALUES(${column})`).join(', ')
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`
  for (const row of rows) {
    await connection.query(sql, columns.map((column) => row[column] ?? null))
  }
}

async function seedDatabase() {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const passwordHash = await bcrypt.hash(demoPassword, 12)
    const userRows = users.map((user) => ({ ...user, password_hash: passwordHash }))

    await upsertRows(
      connection,
      'users',
      ['id', 'name', 'email', 'password_hash', 'username', 'bio', 'avatar_url'],
      userRows,
      ['name', 'password_hash', 'username', 'bio', 'avatar_url'],
    )

    await upsertRows(connection, 'posts',
      ['id', 'user_id', 'title', 'caption', 'image_url', 'media_type', 'visibility', 'likes_count', 'comments_count'],
      [
        { id: '20000000-0000-4000-8000-000000000001', user_id: users[0].id, title: 'Pequeño recuerdo', caption: 'Los días sencillos también merecen ser guardados.', image_url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=85', media_type: 'image', visibility: 'public', likes_count: 2, comments_count: 1 },
        { id: '20000000-0000-4000-8000-000000000002', user_id: users[1].id, title: 'Ruta del domingo', caption: 'Un poco de aire fresco para empezar bien la semana.', image_url: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=85', media_type: 'image', visibility: 'public', likes_count: 1, comments_count: 1 },
        { id: '20000000-0000-4000-8000-000000000003', user_id: users[2].id, title: 'Tarde tranquila', caption: 'Pausa, luz de ventana y una taza de té.', image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85', media_type: 'image', visibility: 'followers', likes_count: 1, comments_count: 1 },
        { id: '20000000-0000-4000-8000-000000000004', user_id: users[0].id, title: 'Solo para mí', caption: 'Una nota privada para probar la visibilidad.', image_url: null, media_type: 'text', visibility: 'private', likes_count: 0, comments_count: 0 },
      ],
      ['user_id', 'title', 'caption', 'image_url', 'media_type', 'visibility', 'likes_count', 'comments_count'],
    )

    await upsertRows(connection, 'stories',
      ['id', 'user_id', 'title', 'caption', 'image_url', 'media_type', 'visibility'],
      [
        { id: '30000000-0000-4000-8000-000000000001', user_id: users[0].id, title: 'Una mañana sin prisa', caption: 'Nos escapamos temprano al sendero. El aire olía a tierra mojada.', image_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=85', media_type: 'image', visibility: 'public' },
        { id: '30000000-0000-4000-8000-000000000002', user_id: users[1].id, title: 'Café de camino', caption: 'Parada breve antes de seguir explorando.', image_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=85', media_type: 'image', visibility: 'public' },
        { id: '30000000-0000-4000-8000-000000000003', user_id: users[2].id, title: 'Un detalle', caption: 'Un recuerdo visible solo para seguidores.', image_url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=85', media_type: 'image', visibility: 'followers' },
      ],
      ['user_id', 'title', 'caption', 'image_url', 'media_type', 'visibility'],
    )

    await upsertRows(connection, 'comments',
      ['id', 'user_id', 'post_id', 'story_id', 'text'],
      [
        { id: '40000000-0000-4000-8000-000000000001', user_id: users[1].id, post_id: '20000000-0000-4000-8000-000000000001', story_id: null, text: 'Qué bonito recuerdo.' },
        { id: '40000000-0000-4000-8000-000000000002', user_id: users[2].id, post_id: '20000000-0000-4000-8000-000000000002', story_id: null, text: 'Ese sendero se ve increíble.' },
        { id: '40000000-0000-4000-8000-000000000003', user_id: users[0].id, post_id: '20000000-0000-4000-8000-000000000003', story_id: null, text: 'Me encantó la luz de esta foto.' },
        { id: '40000000-0000-4000-8000-000000000004', user_id: users[2].id, post_id: null, story_id: '30000000-0000-4000-8000-000000000001', text: 'Se siente la calma de la mañana.' },
      ],
      ['user_id', 'post_id', 'story_id', 'text'],
    )

    await upsertRows(connection, 'reactions',
      ['id', 'user_id', 'post_id', 'story_id', 'type'],
      [
        { id: '50000000-0000-4000-8000-000000000001', user_id: users[1].id, post_id: '20000000-0000-4000-8000-000000000001', story_id: null, type: 'like' },
        { id: '50000000-0000-4000-8000-000000000002', user_id: users[2].id, post_id: '20000000-0000-4000-8000-000000000001', story_id: null, type: 'love' },
        { id: '50000000-0000-4000-8000-000000000003', user_id: users[0].id, post_id: '20000000-0000-4000-8000-000000000002', story_id: null, type: 'like' },
        { id: '50000000-0000-4000-8000-000000000004', user_id: users[0].id, post_id: '20000000-0000-4000-8000-000000000003', story_id: null, type: 'like' },
      ],
      ['user_id', 'post_id', 'story_id', 'type'],
    )

    await upsertRows(connection, 'notifications',
      ['id', 'user_id', 'type', 'title', 'description', 'read_flag'],
      [
        { id: '60000000-0000-4000-8000-000000000001', user_id: users[0].id, type: 'comment', title: 'Nuevo comentario', description: 'Mateo comentó tu publicación.', read_flag: false },
        { id: '60000000-0000-4000-8000-000000000002', user_id: users[1].id, type: 'reaction', title: 'Nueva reacción', description: 'Mariana reaccionó a tu publicación.', read_flag: false },
        { id: '60000000-0000-4000-8000-000000000003', user_id: users[2].id, type: 'story', title: 'Historia respondida', description: 'Mariana respondió a tu historia.', read_flag: true },
      ],
      ['user_id', 'type', 'title', 'description', 'read_flag'],
    )

    await upsertRows(connection, 'social_accounts',
      ['id', 'user_id', 'platform', 'account_name', 'connected', 'metadata'],
      [
        { id: '70000000-0000-4000-8000-000000000001', user_id: users[0].id, platform: 'instagram', account_name: 'mariana.demo', connected: false, metadata: JSON.stringify({ demo: true }) },
        { id: '70000000-0000-4000-8000-000000000002', user_id: users[0].id, platform: 'facebook', account_name: 'Mariana Demo', connected: false, metadata: JSON.stringify({ demo: true }) },
      ],
      ['user_id', 'platform', 'account_name', 'connected', 'metadata'],
    )

    await upsertRows(connection, 'social_publications',
      ['id', 'user_id', 'platform', 'story_id', 'title', 'caption', 'status'],
      [
        { id: '80000000-0000-4000-8000-000000000001', user_id: users[0].id, platform: 'instagram', story_id: '30000000-0000-4000-8000-000000000001', title: 'Una mañana sin prisa', caption: 'Nos escapamos temprano al sendero.', status: 'PENDING' },
      ],
      ['user_id', 'platform', 'story_id', 'title', 'caption', 'status'],
    )

    await connection.commit()
    console.log('Seed de demostración completado.')
    console.log(`Usuarios: ${users.map((user) => user.email).join(', ')}`)
    console.log(`Contraseña de demostración para todos: ${demoPassword}`)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
    await pool.end()
  }
}

seedDatabase().catch((error) => {
  console.error('No se pudo cargar el seed:', error.code || error.message)
  process.exitCode = 1
})
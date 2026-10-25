# Backend Express + Node.js para la plataforma social con MySQL

Este documento describe cómo construir un backend completamente funcional para la plataforma social, con Express y Node.js, usando MySQL como persistencia principal, compatible con el frontend Vue 3 ya desarrollado.

## 1. Objetivo

Crear una API REST con:

- Autenticación con JWT
- Registro e inicio de sesión
- Gestión de usuarios y perfiles
- Feed de publicaciones, historias y actividades
- Privacidad por tipo de contenido
- Comentarios y reacciones
- Sistema de notificaciones
- Integración con redes sociales (Instagram/Facebook)
- Upload de media y almacenamiento local o en cloud
- Persistencia en MySQL
- Validación y manejo seguro de errores
- Documentación con Swagger

---

## 2. Stack recomendado

- Node.js 20+
- Express.js
- MySQL 8
- mysql2
- TypeScript (recomendado)
- JWT
- bcryptjs
- Zod
- multer
- cors
- dotenv
- nodemailer (opcional)
- Swagger UI Express (opcional)

> Este backend está pensado para trabajar con MySQL como base de datos relacional, sin depender de Prisma para no complicar la implementación inicial.

---

## 3. Estructura del proyecto

```text
backend/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   ├── db.js
│   │   └── env.js
│   ├── db/
│   │   ├── init.js
│   │   ├── seed.js
│   │   └── queries.js
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.routes.js
│   │   │   ├── auth.service.js
│   │   │   └── auth.validation.js
│   │   ├── users/
│   │   │   ├── user.controller.js
│   │   │   ├── user.routes.js
│   │   │   ├── user.service.js
│   │   │   └── user.validation.js
│   │   ├── posts/
│   │   │   ├── post.controller.js
│   │   │   ├── post.routes.js
│   │   │   ├── post.service.js
│   │   │   └── post.validation.js
│   │   ├── stories/
│   │   │   ├── story.controller.js
│   │   │   ├── story.routes.js
│   │   │   ├── story.service.js
│   │   │   └── story.validation.js
│   │   ├── comments/
│   │   │   ├── comment.controller.js
│   │   │   ├── comment.routes.js
│   │   │   ├── comment.service.js
│   │   │   └── comment.validation.js
│   │   ├── notifications/
│   │   │   ├── notification.controller.js
│   │   │   ├── notification.routes.js
│   │   │   └── notification.service.js
│   │   ├── social/
│   │   │   ├── social.controller.js
│   │   │   ├── social.routes.js
│   │   │   ├── social.service.js
│   │   │   └── social.validation.js
│   │   └── media/
│   │       ├── media.controller.js
│   │       ├── media.routes.js
│   │       └── media.service.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   │   ├── error.middleware.js
│   │   │   ├── notFound.middleware.js
│   │   │   └── validate.middleware.js
│   ├── utils/
│   │   ├── jwt.js
│   │   ├── hash.js
│   │   ├── response.js
│   │   └── helpers.js
│   └── docs/
│       └── swagger.js
├── uploads/
├── .env
├── .env.example
├── package.json
├── db_social.js
├── init_db.js
├── seed_db.js
├── README.md
└── server.js
```

---

## 4. Inicialización del proyecto

```bash
mkdir plataforma-social-backend
cd plataforma-social-backend
npm init -y
```

Instalación base:

```bash
npm install express mysql2 cors dotenv bcryptjs jsonwebtoken zod multer
npm install -D nodemon
```

Si prefieres TypeScript:

```bash
npm install -D typescript ts-node @types/node @types/express @types/cors @types/jsonwebtoken @types/multer
```

---

## 5. Configuración del paquete

`package.json`:

```json
{
  "name": "plataforma-social-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "init:db": "node src/db/init.js",
    "seed:db": "node src/db/seed.js"
  }
}
```

> Si usas TypeScript, cambia `main` y scripts para apuntar a `dist/server.js`.

---

## 6. Variables de entorno

Crea `.env`:

```env
PORT=4020
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_password_mysql
DB_NAME=social_db
JWT_SECRET=tu_clave_secreta_super_segura
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5199
UPLOAD_DIR=./uploads
SOCIAL_INSTAGRAM_CLIENT_ID=
SOCIAL_INSTAGRAM_CLIENT_SECRET=
SOCIAL_FACEBOOK_APP_ID=
SOCIAL_FACEBOOK_APP_SECRET=
```

---

## 7. Configuración de MySQL

La conexión se puede hacer con `mysql2/promise` tal como ya lo tienes en `db_social.js`.

Archivo sugerido: `src/config/db.js`

```js
const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'social_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
})

module.exports = pool
```

Y el ejemplo que ya usas en `db_social.js` es compatible:

```js
// ./config/db_ct.js
import mysql from 'mysql2/promise';

export const poolCT = mysql.createPool({
  host: process.env.CT_DB_HOST || 'localhost',
  user: process.env.CT_DB_USER || 'root',
  password: process.env.CT_DB_PASS || 'Metroman_1',
  database: process.env.CT_DB_NAME || 'social_db',
  timezone: 'Z',
  waitForConnections: true,
  connectionLimit: 10,
})

export default poolCT
```

> Este patrón es válido para MySQL y sirve exactamente para la persistencia del backend.

---

## 8. Crear la base de datos y tablas con MySQL

### 8.1. Crear la base de datos

Ejecuta en MySQL:

```sql
CREATE DATABASE social_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE social_db;
```

### 8.2. Crear tablas principales

```sql
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(80) UNIQUE,
  bio TEXT,
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(180),
  caption TEXT NOT NULL,
  image_url VARCHAR(255),
  media_type VARCHAR(40),
  visibility ENUM('public', 'followers', 'private') DEFAULT 'public',
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE stories (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(180),
  caption TEXT NOT NULL,
  image_url VARCHAR(255),
  media_type VARCHAR(40),
  visibility ENUM('public', 'followers', 'private') DEFAULT 'public',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE comments (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  post_id CHAR(36),
  story_id CHAR(36),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

CREATE TABLE reactions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  post_id CHAR(36),
  story_id CHAR(36),
  type VARCHAR(30) DEFAULT 'like',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  read_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE social_accounts (
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE social_publications (
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 9. Datos iniciales mínimos para la BD

Crea un script `src/db/seed.js` y agrega usuarios de ejemplo, historias y publicaciones base para poder arrancar la app con datos reales.

```js
const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')
const pool = require('../config/db')

async function seed() {
  const connection = await pool.getConnection()

  try {
    const passwordHash = await bcrypt.hash('123456', 10)

    const userId = randomUUID()
    await connection.query(
      `INSERT INTO users (id, name, email, password_hash, username, bio, avatar_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email = VALUES(email)`,
      [
        userId,
        'Mariana López',
        'mariana@example.com',
        passwordHash,
        'mariana',
        'Coleccionando días bonitos.',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
      ]
    )

    const storyId = randomUUID()
    await connection.query(
      `INSERT INTO stories (id, user_id, title, caption, image_url, media_type, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title)`,
      [
        storyId,
        userId,
        'Una mañana sin prisa',
        'Nos escapamos temprano al sendero. El aire olía a tierra mojada.',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1400&q=85',
        'image',
        'public',
      ]
    )

    const postId = randomUUID()
    await connection.query(
      `INSERT INTO posts (id, user_id, title, caption, image_url, media_type, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE caption = VALUES(caption)`,
      [
        postId,
        userId,
        'Pequeño recuerdo',
        'Los días sencillos también merecen ser guardados.',
        'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=85',
        'image',
        'public',
      ]
    )

    await connection.query(
      `INSERT INTO comments (id, user_id, post_id, text)
       VALUES (?, ?, ?, ?), (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE text = VALUES(text)`,
      [
        randomUUID(), userId, postId, 'Qué bonito recuerdo.',
        randomUUID(), userId, postId, 'Me encantó este momento.',
      ]
    )

    console.log('Seed ejecutado correctamente')
  } catch (error) {
    console.error('Error en seed:', error)
  } finally {
    connection.release()
  }
}

seed()
```

---

## 10. Script de inicialización de base de datos

Archivo `src/db/init.js`:

```js
const mysql = require('mysql2/promise')

async function createDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT) || 3306,
  })

  await connection.query('CREATE DATABASE IF NOT EXISTS social_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')
  await connection.end()

  console.log('Base de datos social_db lista')
}

createDatabase()
```

Ejecuta:

```bash
npm run init:db
npm run seed:db
```

---

## 11. Backend Express base

`src/app.js`

```js
const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const authRoutes = require('./modules/auth/auth.routes')
const userRoutes = require('./modules/users/user.routes')
const postRoutes = require('./modules/posts/post.routes')
const storyRoutes = require('./modules/stories/story.routes')
const commentRoutes = require('./modules/comments/comment.routes')
const notificationRoutes = require('./modules/notifications/notification.routes')
const socialRoutes = require('./modules/social/social.routes')
const mediaRoutes = require('./modules/media/media.routes')
const { notFoundMiddleware, errorMiddleware } = require('./middleware/error.middleware')

dotenv.config()
const app = express()

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5199',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'API funcionando con MySQL' })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/stories', storyRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/media', mediaRoutes)

app.use(notFoundMiddleware)
app.use(errorMiddleware)

module.exports = app
```

`src/server.js`

```js
const app = require('./app')

const PORT = process.env.PORT || 4020

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`)
})
```

---

## 12. Autenticación con JWT

`src/utils/jwt.js`

```js
const jwt = require('jsonwebtoken')

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET)
}

module.exports = { signToken, verifyToken }
```

`src/middleware/auth.middleware.js`

```js
const { verifyToken } = require('../utils/jwt')

function requireAuth(req, res, next) {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado' })
  }

  const token = header.split(' ')[1]

  try {
    const decoded = verifyToken(token)
    req.user = { id: decoded.userId }
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' })
  }
}

module.exports = { requireAuth }
```

---

## 13. Registro y login

`src/modules/auth/auth.service.js`

```js
const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')
const pool = require('../../config/db')
const { signToken } = require('../../utils/jwt')

async function register({ name, email, password, username }) {
  const existing = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
  if (existing[0].length) {
    throw new Error('El correo ya está registrado')
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const userId = randomUUID()

  await pool.query(
    'INSERT INTO users (id, name, email, password_hash, username) VALUES (?, ?, ?, ?, ?)',
    [userId, name, email, passwordHash, username || null]
  )

  const token = signToken({ userId })

  return {
    user: {
      id: userId,
      name,
      email,
      username,
    },
    token,
  }
}

async function login({ email, password }) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email])
  if (!rows.length) {
    throw new Error('Credenciales inválidas')
  }

  const user = rows[0]
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    throw new Error('Credenciales inválidas')
  }

  const token = signToken({ userId: user.id })

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      bio: user.bio,
      avatarUrl: user.avatar_url,
    },
    token,
  }
}

module.exports = { register, login }
```

---

## 14. CRUD de publicaciones y historias

### Posts

```sql
SELECT * FROM posts WHERE visibility = 'public' ORDER BY created_at DESC;
SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC;
```

### Histories

```sql
SELECT * FROM stories WHERE visibility = 'public' ORDER BY created_at DESC;
```

### Filtros por privacidad

- public: cualquiera puede verlo
- followers: solo seguidores
- private: solo el usuario

---

## 15. Comentarios y reacciones

### Crear comentario

```js
const [rows] = await pool.query(
  'INSERT INTO comments (id, user_id, post_id, text) VALUES (?, ?, ?, ?)',
  [randomUUID(), userId, postId, text]
)
```

### Incrementar contador

```js
await pool.query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?', [postId])
```

### Crear reacción

```js
await pool.query(
  'INSERT INTO reactions (id, user_id, post_id, type) VALUES (?, ?, ?, ?)',
  [randomUUID(), userId, postId, 'like']
)
```

---

## 16. Notificaciones

```sql
CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  read_flag BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Insert de ejemplo:

```js
await pool.query(
  'INSERT INTO notifications (id, user_id, type, title, description, read_flag) VALUES (?, ?, ?, ?, ?, ?)',
  [randomUUID(), userId, 'comment', 'Comentario nuevo', 'Mateo respondió a tu historia.', false]
)
```

---

## 17. Upload de imágenes y videos

Usa `multer` como en el documento base, pero con MySQL guardando la ruta o URL en la base de datos.

```js
const multer = require('multer')
const path = require('path')

const storage = multer.diskStorage({
  destination: './uploads',
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
})
```

---

## 18. Integración social (Instagram/Facebook)

### Requisitos

- App registrada en Meta/Facebook Developers
- OAuth con redirección segura
- Guardado de tokens y metadata en MySQL

### Tabla recomendada

```sql
CREATE TABLE social_accounts (
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Publicación

```js
await pool.query(
  'INSERT INTO social_publications (id, user_id, platform, title, caption, status) VALUES (?, ?, ?, ?, ?, ?)',
  [randomUUID(), userId, 'instagram', 'Historia publicada', 'Hoy compartí un momento muy bonito.', 'PENDING']
)
```

---

## 19. Middleware de errores

```js
function notFoundMiddleware(_req, res) {
  res.status(404).json({ message: 'Ruta no encontrada' })
}

function errorMiddleware(err, _req, res, _next) {
  console.error(err)

  const status = err.statusCode || 500
  const message = err.message || 'Error interno del servidor'

  res.status(status).json({ message })
}

module.exports = { notFoundMiddleware, errorMiddleware }
```

---

## 20. Flujo recomendado para la entrega funcional

1. Crear MySQL local
2. Crear base de datos social_db
3. Crear tablas con SQL
4. Ejecutar script de seed
5. Crear backend Express con rutas auth, users, posts, stories y comments
6. Agregar JWT y protección
7. Agregar uploads
8. Agregar notificaciones
9. Agregar social accounts + publicaciones
10. Conectar frontend a `http://localhost:4020/api`

---

## 21. Comandos útiles de MySQL

```sql
SHOW DATABASES;
USE social_db;
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM posts;
SELECT * FROM stories;
```

---

## 22. Recomendación final

Para este proyecto, usar MySQL + Express + Node.js es una buena decisión porque:

- tiene buena compatibilidad con relaciones complejas
- facilita la persistencia de usuarios, feed y redes sociales
- es muy apropiado para un MVP real
- se puede conectar fácilmente con archivos, tokens y registros de actividad

La conexión que ya defines en `db_social.js` es clave para que el backend pueda arrancar con la base correcta.

---

## 23. Configuración final para el frontend

En el frontend Vue 3, define esto:

```ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4020/api',
  withCredentials: true,
})
```

Y luego reemplaza los stores actuales por llamadas a endpoints reales de MySQL.

---

## 24. Resumen práctico

Si quieres que el backend funcione correctamente con este proyecto, la base mínima debe ser:

- MySQL 8
- `mysql2/promise`
- Express
- JWT
- bcryptjs
- multer
- rutas REST para auth, feed, stories, comments, social, notifications
- base de datos `social_db`
- seed inicial con usuario y contenido de ejemplo

Con esto ya puedes convertir el frontend actual de demo a una app con persistencia real.

`src/app.ts`

```ts
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './modules/auth/auth.routes'
import userRoutes from './modules/users/user.routes'
import postRoutes from './modules/posts/post.routes'
import storyRoutes from './modules/stories/story.routes'
import commentRoutes from './modules/comments/comment.routes'
import notificationRoutes from './modules/notifications/notification.routes'
import socialRoutes from './modules/social/social.routes'
import mediaRoutes from './modules/media/media.routes'
import { errorMiddleware } from './middleware/error.middleware'
import { notFoundMiddleware } from './middleware/notFound.middleware'

dotenv.config()

const app = express()

app.use(cors({
  origin: process.env.CLIENT_URL ?? 'http://localhost:5199',
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'API funcionando correctamente' })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/stories', storyRoutes)
app.use('/api/comments', commentRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/media', mediaRoutes)

app.use(notFoundMiddleware)
app.use(errorMiddleware)

export default app
```

`src/server.ts`

```ts
import app from './app'

const port = Number(process.env.PORT ?? 4020)

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`)
})
```

---

## 10. Autenticación

### 10.1. Registro

Endpoint: `POST /api/auth/register`

Request body:

```json
{
  "name": "Mariana López",
  "email": "mariana@gmail.com",
  "password": "123456",
  "username": "mariana"
}
```

Response:

```json
{
  "user": {
    "id": "abc123",
    "name": "Mariana López",
    "email": "mariana@gmail.com",
    "username": "mariana"
  },
  "token": "eyJhbGciOi..."
}
```

### 10.2. Login

Endpoint: `POST /api/auth/login`

Request body:

```json
{
  "email": "mariana@gmail.com",
  "password": "123456"
}
```

Response:

```json
{
  "user": {
    "id": "abc123",
    "name": "Mariana López",
    "email": "mariana@gmail.com"
  },
  "token": "eyJhbGciOi..."
}
```

### 10.3. Usuario actual

Endpoint: `GET /api/auth/me`

Requiere JWT en Authorization: Bearer token.

### 10.4. Middleware de autenticación

`src/middleware/auth.middleware.ts`

```ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No autorizado' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string }
    ;(req as any).user = { id: decoded.userId }
    return next()
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' })
  }
}
```

---

## 11. Rutas principales

### 11.1. Usuarios

- `GET /api/users/me`
- `PATCH /api/users/me`
- `GET /api/users/:id`

### 11.2. Feed y contenido

- `GET /api/posts` – obtener publicaciones
- `POST /api/posts` – crear publicación
- `GET /api/stories` – obtener historias
- `POST /api/stories` – crear historia
- `GET /api/posts/:id/comments`
- `POST /api/posts/:id/comments`
- `POST /api/posts/:id/react`
- `POST /api/stories/:id/react`

### 11.3. Comentarios

- `POST /api/comments` – crear comentario
- `DELETE /api/comments/:id`

### 11.4. Notificaciones

- `GET /api/notifications`
- `PATCH /api/notifications/read-all`

### 11.5. Redes sociales

- `GET /api/social/accounts`
- `POST /api/social/connect/instagram`
- `POST /api/social/connect/facebook`
- `POST /api/social/disconnect/:platform`
- `POST /api/social/publish`
- `GET /api/social/publications`

### 11.6. Media

- `POST /api/media/upload`
- `GET /api/media/:filename`

---

## 12. Validación con Zod

Ejemplo base de validación:

```ts
import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  username: z.string().min(3).max(30).optional(),
})
```

Middleware sugerido:

```ts
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        message: 'Validación fallida',
        errors: result.error.flatten(),
      })
    }
    req.body = result.data
    return next()
  }
}
```

---

## 13. Manejo de archivos multimedia

Usa `multer` para subir imágenes o videos:

```ts
import multer from 'multer'
import path from 'path'

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, './uploads')
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Tipo de archivo no permitido'))
  },
})
```

Endpoint de ejemplo:

```ts
app.post('/api/media/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No se recibió ningún archivo' })
  return res.status(201).json({ url: `/uploads/${req.file.filename}` })
})
```

---

## 14. Integración con redes sociales

### Instagram

- Usa OAuth 2.0 de Meta.
- Debes registrar la app en Meta for Developers.
- El backend debe generar la URL de autorización.
- Luego intercambia el `code` por `access_token`.
- Guarda token y estado de conexión en `SocialAccount`.

### Facebook

- Usa el flujo OAuth de Facebook.
- La app debe publicar contenidos vía Graph API.
- Para páginas, requiere permisos adicionales.

Ejemplo de flujo:

```ts
app.post('/api/social/connect/instagram', requireAuth, async (req, res) => {
  const redirectUrl = `https://www.facebook.com/dialog/oauth?client_id=${process.env.SOCIAL_INSTAGRAM_CLIENT_ID}&redirect_uri=${process.env.CLIENT_URL}/social/callback&scope=instagram_basic,pages_show_list,pages_manage_posts&response_type=code`

  res.json({ authorizationUrl: redirectUrl })
})
```

Posteriormente:

```ts
app.post('/api/social/publish', requireAuth, async (req, res) => {
  // tomar story/post, preparar payload, enviar a Meta Graph API
  // actualizar estado de publicación
})
```

---

## 15. Feed y contenido

Para que el frontend pueda consumir el contenido, crea endpoints normalizados. Un ejemplo del payload del feed:

```json
{
  "entries": [
    {
      "id": "story_123",
      "kind": "story",
      "title": "Una mañana sin prisa",
      "caption": "Nos escapamos temprano al sendero.",
      "imageUrl": "/uploads/story-1.jpg",
      "visibility": "public",
      "author": {
        "name": "Sofía Herrera",
        "handle": "@sofia.herrera",
        "avatar": "/uploads/avatar-1.jpg"
      },
      "likes": 24,
      "comments": 6,
      "createdAt": "2026-10-07T10:30:00Z"
    }
  ]
}
```

---

## 16. Endpoints sugeridos para el frontend

### Autenticación

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Feed

- `GET /api/feed?filter=all`
- `GET /api/feed?filter=story`
- `GET /api/feed?filter=activity`
- `GET /api/feed?filter=photos`

### Historias

- `GET /api/stories/:id`
- `POST /api/stories`
- `PATCH /api/stories/:id`
- `DELETE /api/stories/:id`

### Publicaciones

- `GET /api/posts`
- `POST /api/posts`
- `POST /api/posts/:id/comments`
- `POST /api/posts/:id/react`

### Sociales

- `GET /api/social/accounts`
- `POST /api/social/publication`
- `GET /api/social/publications`

---

## 17. Manejo de errores

Configura un middleware global:

```ts
export function errorMiddleware(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err)

  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Validación fallida' })
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ message: 'No autorizado' })
  }

  return res.status(500).json({
    message: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
}
```

---

## 18. Seguridad

- Usar JWT con expiración corta
- Guardar passwordHash con bcryptjs
- Validar todos los inputs con Zod
- Usar CORS configurado
- No guardar tokens de redes sociales en el frontend
- Usar variables de entorno para secretos
- No exponer información sensible en respuestas
- Implementar rate limiting en producción

Paquetes recomendados:

```bash
npm install express-rate-limit helmet
```

---

## 19. Documentación API

Instala Swagger:

```bash
npm install swagger-ui-express swagger-jsdoc
```

Configura un endpoint:

```ts
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs))
```

---

## 20. Flujo de desarrollo recomendado

### Fase 1: base técnica

1. Crear proyecto Express
2. Conectar PostgreSQL con Prisma
3. Configurar JWT y auth
4. Crear usuarios y perfiles

### Fase 2: contenido

1. Crear posts, stories, comentarios, likes
2. Permitir visibilidad por tipo
3. Construir feed con filtros

### Fase 3: media

1. Upload local o cloud
2. Guardar URLs reales
3. Esto habilita feed con imágenes/videos reales

### Fase 4: redes sociales

1. OAuth de Meta
2. Conexión de cuentas
3. Publicación y estado de job

### Fase 5: producción

1. Rate limiting
2. Logs
3. Sentry o monitoring
4. CI/CD
5. Cloud storage

---

## 21. Comandos útiles

```bash
# instalar dependencias
npm install

# migrar DB
npx prisma migrate dev

# generar cliente Prisma
npx prisma generate

# correr servidor en modo dev
npm run dev

# compilar TypeScript
npm run build

# iniciar compilado
npm start
```

---

## 22. Recomendación final

Para que este backend sea totalmente funcional con el frontend actual, la prioridad debe ser esta secuencia:

1. Auth con JWT
2. CRUD de usuarios
3. Feed, stories y publicaciones
4. Comentarios y likes
5. Upload de media
6. Notificaciones
7. Conexión a Instagram/Facebook
8. Documentación y despliegue

Con eso ya puedes reemplazar el estado local actual y conectar todos los módulos del frontend a una API real.

---

## 23. Siguiente paso recomendado

Una vez tengas este backend construido, conecta el frontend con axios apuntando a:

```ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4020/api',
})
```

Y reemplaza los stores actuales de `auth`, `feed`, `social` y `notifications` para consumir endpoints reales en lugar de datos simulados.

---

## 24. Consejo práctico

Si quieres una implementación rápida y sólida, usa:

- Node.js + Express
- TypeScript
- Prisma + PostgreSQL
- JWT + bcryptjs
- Zod
- Multer
- Axios en el frontend

Esto te da una base muy clara, segura y mantenible para continuar el proyecto con menos fricción.

const authService = require('./auth.service')

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
}

async function register(req, res) {
  await authService.register(req.body)
  return res.status(201).json({ message: 'Cuenta creada correctamente' })
}

async function login(req, res) {
  const { user, token } = await authService.login(req.body)
  res.cookie('social_session', token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  return res.status(200).json({ user })
}

function logout(_req, res) {
  res.clearCookie('social_session', cookieOptions)
  return res.status(204).end()
}

async function me(req, res) {
  return res.json(await authService.getCurrentUser(req.user.id))
}

async function updateProfile(req, res) {
  const updatedUser = await authService.updateProfile(req.user.id, req.body)
  return res.json(updatedUser)
}

async function nearby(req, res) {
  return res.json(await authService.getNearbyUsers(req.user.id))
}

async function userSummary(req, res) {
  return res.json(await authService.getUserFollowSummary(req.user.id, req.params.userId))
}

async function followUser(req, res) {
  return res.json(await authService.toggleFollow(req.user.id, req.params.userId, true))
}

async function unfollowUser(req, res) {
  return res.json(await authService.toggleFollow(req.user.id, req.params.userId, false))
}

module.exports = { register, login, logout, me, updateProfile, nearby, userSummary, followUser, unfollowUser }
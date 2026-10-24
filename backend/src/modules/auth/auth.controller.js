const authService = require('./auth.service')
const bioActaService = require('../animals/bioActa.service')
const { signAccessGrantSessionToken } = require('../../utils/jwt')

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
  try {
    const { user, token } = await authService.login(req.body)
    res.clearCookie('bioacta_guest_session', cookieOptions)
    res.cookie('social_session', token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    return res.status(200).json({ user })
  } catch (error) {
    if (error.statusCode !== 401) throw error
    const grant = await bioActaService.findAccessGrantLogin(req.body.email, req.body.password)
    if (!grant) throw error
    return establishAccessGrantSession(res, grant)
  }
}

function establishAccessGrantSession(res, grant) {
  res.clearCookie('social_session', cookieOptions)
  res.cookie('bioacta_guest_session', signAccessGrantSessionToken({
    grantId: grant.grantId,
    email: grant.email,
  }), {
    ...cookieOptions,
    maxAge: 8 * 60 * 60 * 1000,
  })
  return res.json({
    user: {
      id: grant.grantId,
      name: 'Invitado BIO-ACTA',
      email: grant.email,
      username: 'invitado',
      avatarUrl: '/default-avatar.svg',
      role: 'user',
      isModerator: false,
      isAccessGuest: true,
      accessGrant: {
        id: grant.grantId,
        animalId: grant.animalId,
        animalIds: grant.animalIds,
        allAnimals: grant.allAnimals,
        role: grant.role,
        permissions: grant.permissions,
        expiresAt: grant.expiresAt,
      },
    },
  })
}

async function loginAccessGrant(req, res) {
  const grant = await bioActaService.loginAccessGrant(req.body.grantId, req.body.email, req.body.password)
  return establishAccessGrantSession(res, grant)
}

function logout(_req, res) {
  res.clearCookie('social_session', cookieOptions)
  res.clearCookie('bioacta_guest_session', cookieOptions)
  return res.status(204).end()
}

async function me(req, res) {
  if (req.user.isAccessGuest) {
    return res.json({
      id: req.user.id,
      name: 'Invitado BIO-ACTA',
      email: req.user.email,
      username: 'invitado',
      avatarUrl: '/default-avatar.svg',
      role: 'user',
      isModerator: false,
      isAccessGuest: true,
      accessGrant: req.user.accessGrant,
    })
  }
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

module.exports = { register, login, loginAccessGrant, logout, me, updateProfile, nearby, userSummary, followUser, unfollowUser }
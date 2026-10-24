const jwt = require('jsonwebtoken')

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    const error = new Error('JWT_SECRET debe tener al menos 32 caracteres')
    error.statusCode = 500
    throw error
  }
  return secret
}

function signToken(payload) {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

function verifyToken(token) {
  return jwt.verify(token, getSecret())
}

function signAccessGrantToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '8h', audience: 'bioacta-access-grant' })
}

function verifyAccessGrantToken(token) {
  return jwt.verify(token, getSecret(), { audience: 'bioacta-access-grant' })
}

function signAccessGrantSessionToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '8h', audience: 'bioacta-access-session' })
}

function verifyAccessGrantSessionToken(token) {
  return jwt.verify(token, getSecret(), { audience: 'bioacta-access-session' })
}

function signOAuthState(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '10m', audience: 'meta-oauth' })
}

function verifyOAuthState(token) {
  return jwt.verify(token, getSecret(), { audience: 'meta-oauth' })
}

module.exports = {
  signToken,
  verifyToken,
  signAccessGrantToken,
  verifyAccessGrantToken,
  signAccessGrantSessionToken,
  verifyAccessGrantSessionToken,
  signOAuthState,
  verifyOAuthState,
}
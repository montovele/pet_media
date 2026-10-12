function notFoundMiddleware(_req, res) {
  res.status(404).json({ message: 'Ruta no encontrada' })
}

function errorMiddleware(error, _req, res, _next) {
  const statusCode = error.statusCode || (error.code?.startsWith('LIMIT_') ? 400 : 500)
  if (statusCode >= 500 && !error.statusCode) {
    console.error(error)
  }
  const message = statusCode >= 500 && !error.message
    ? 'Error interno del servidor'
    : error.message || 'Error interno del servidor'

  res.status(statusCode).json({ message })
}

module.exports = { notFoundMiddleware, errorMiddleware }
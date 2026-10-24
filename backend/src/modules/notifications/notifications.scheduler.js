const notificationsService = require('./notifications.service')

function startNotificationScheduler() {
  const timer = setInterval(() => {
    notificationsService.createDueCareReminders().catch((error) => {
      console.error('No se pudieron generar recordatorios de cuidados:', error.code || error.message)
    })
  }, 60 * 1000)
  timer.unref()
  return timer
}

module.exports = { startNotificationScheduler }

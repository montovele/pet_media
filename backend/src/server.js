const app = require('./app')
const { startNotificationScheduler } = require('./modules/notifications/notifications.scheduler')

const port = Number(process.env.PORT) || 4020
startNotificationScheduler()
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`)
})
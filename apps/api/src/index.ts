import 'dotenv/config'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { startScheduler } from './jobs/scheduler.js'
import { logger } from './lib/logger.js'

const config = loadConfig()
const app = createApp(config)
const server = app.listen(config.PORT, () => {
  logger.info(`JobPilot API listening on ${config.PORT}`)
})

if (config.NODE_ENV !== 'test') startScheduler(undefined, config)

function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

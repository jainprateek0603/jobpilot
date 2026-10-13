import cron from 'node-cron'
import { loadConfig, type Config } from '../config.js'
import { logger } from '../lib/logger.js'
import { processDueReminders } from '../services/reminder-service.js'

let started = false

export function reminderTick(config: Config = loadConfig()) {
  return processDueReminders(config)
}

export function startScheduler(schedule: typeof cron.schedule = cron.schedule, config: Config = loadConfig()) {
  if (started) return
  started = true
  schedule('* * * * *', () => {
    void reminderTick(config).catch((error: unknown) => {
      logger.error('reminder tick failed', error)
    })
  })
}

export function resetSchedulerForTests() {
  started = false
}

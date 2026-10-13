import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import { allowedOrigins, type Config } from './config.js'
import { errorHandler } from './middleware/error.js'
import { globalLimiter } from './middleware/rate-limit.js'
import { aiRouter } from './routes/ai.js'
import { analyticsRouter, calendarRouter, reminderRouter } from './routes/reminders.js'
import { applicationRouter, contactRouter } from './routes/applications.js'
import { authRouter, healthRouter } from './routes/auth.js'
import { profileRouter, settingsRouter } from './routes/profile.js'
import { resumeRouter } from './routes/resumes.js'

export function createApp(config: Config) {
  const app = express()
  app.disable('x-powered-by')
  app.locals.config = config
  if (config.trustProxy) app.set('trust proxy', 1)

  app.use(
    helmet({
      contentSecurityPolicy:
        config.NODE_ENV === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
              },
            }
          : false,
    }),
  )
  app.use(compression())
  app.use(cookieParser())
  app.use(express.json({ limit: '2mb' }))
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins(config).includes(origin)) {
          callback(null, true)
          return
        }
        callback(null, false)
      },
      credentials: true,
    }),
  )

  if (!config.rateLimitDisabled) app.use('/api', globalLimiter())
  app.use('/api/health', healthRouter())
  app.use('/api/auth', authRouter(config))
  app.use('/api/profile', profileRouter())
  app.use('/api/settings', settingsRouter())
  app.use('/api/applications', applicationRouter())
  app.use('/api/contacts', contactRouter())
  app.use('/api/resumes', resumeRouter(config))
  app.use('/api/ai', aiRouter(config))
  app.use('/api/reminders', reminderRouter(config))
  app.use('/api/analytics', analyticsRouter())
  app.use('/api/calendar', calendarRouter())
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'That page does not exist' } })
  })

  if (config.WEB_DIST) {
    const root = path.resolve(config.WEB_DIST)
    app.use(express.static(root, { index: false, maxAge: '1h' }))
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next()
        return
      }
      if (req.path.startsWith('/api')) {
        next()
        return
      }
      res.sendFile(path.join(root, 'index.html'), (error) => {
        if (error) next()
      })
    })
  }

  app.use(errorHandler)
  return app
}

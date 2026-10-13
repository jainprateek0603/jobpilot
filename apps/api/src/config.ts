import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().min(1).default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'mock']).default('mock'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().min(1).default('gpt-4o-mini'),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-sonnet-4-5'),
  UPLOAD_DIR: z.string().min(1).default('./uploads'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().min(1).default('JobPilot <noreply@jobpilot.local>'),
  RATE_LIMIT_DISABLED: z.enum(['true', 'false']).default('false'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(20),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
  WEB_DIST: z.string().default(''),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
})

export type Config = z.infer<typeof envSchema> & {
  rateLimitDisabled: boolean
  cookieSecure: boolean
  trustProxy: boolean
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(', ')
    throw new Error(`Invalid configuration: ${fields}`)
  }
  return {
    ...parsed.data,
    rateLimitDisabled: parsed.data.RATE_LIMIT_DISABLED === 'true',
    cookieSecure: parsed.data.COOKIE_SECURE
      ? parsed.data.COOKIE_SECURE === 'true'
      : parsed.data.NODE_ENV === 'production',
    trustProxy: parsed.data.TRUST_PROXY === 'true',
  }
}

export function allowedOrigins(config: Config): string[] {
  return config.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
}

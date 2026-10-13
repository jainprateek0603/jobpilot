import nodemailer from 'nodemailer'
import type { Config } from '../config.js'
import { logger } from '../lib/logger.js'
import { prisma } from '../lib/prisma.js'

type Transport = { sendMail: (message: { from: string; to: string; subject: string; text: string }) => Promise<unknown> }

export async function sendUserEmail(
  config: Config,
  input: { userId: string; reminderId?: string; to: string; subject: string; body: string },
  createTransport: (options: Record<string, unknown>) => Transport = (options) =>
    nodemailer.createTransport(options as Parameters<typeof nodemailer.createTransport>[0]) as Transport,
) {
  if (!config.SMTP_HOST) {
    await prisma.emailOutbox.create({
      data: {
        userId: input.userId,
        reminderId: input.reminderId,
        toAddress: input.to,
        subject: input.subject,
        body: input.body,
        status: 'skipped_no_smtp',
      },
    })
    return 'skipped_no_smtp'
  }
  try {
    const transport = createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    })
    await transport.sendMail({
      from: config.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      text: input.body,
    })
    await prisma.emailOutbox.create({
      data: {
        userId: input.userId,
        reminderId: input.reminderId,
        toAddress: input.to,
        subject: input.subject,
        body: input.body,
        status: 'sent',
      },
    })
    return 'sent'
  } catch (error) {
    logger.error('email failed', error)
    await prisma.emailOutbox.create({
      data: {
        userId: input.userId,
        reminderId: input.reminderId,
        toAddress: input.to,
        subject: input.subject,
        body: input.body,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Email failed',
      },
    })
    return 'failed'
  }
}

import { describe, expect, it, vi } from 'vitest'
import { loadConfig } from '../src/config.js'
import { prisma } from '../src/lib/prisma.js'
import { sendUserEmail } from '../src/services/mailer.js'
import { seedDemo } from '../src/services/seed-data.js'

describe('mail and seed', () => {
  it('records skipped, sent, and failed mail, then seeds the demo account', async () => {
    const user = await prisma.user.create({
      data: { email: `mail-${Date.now()}@example.com`, name: 'Mail', passwordHash: 'x' },
    })
    const skipped = await sendUserEmail(loadConfig(), {
      userId: user.id,
      to: user.email,
      subject: 'Hi',
      body: 'Body',
    })
    expect(skipped).toBe('skipped_no_smtp')

    const sendMail = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce('down')
    const createTransport = vi.fn(() => ({ sendMail }))
    const smtp = loadConfig({
      ...process.env,
      SMTP_HOST: 'smtp.example',
      SMTP_PORT: '465',
      SMTP_USER: 'jobpilot',
      SMTP_PASS: 'secret',
    })
    expect(await sendUserEmail(smtp, { userId: user.id, to: user.email, subject: 'Sent', body: 'Hello' }, createTransport)).toBe('sent')
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true, auth: { user: 'jobpilot', pass: 'secret' } }))
    expect(await sendUserEmail({ ...smtp, SMTP_USER: '' }, { userId: user.id, to: user.email, subject: 'Fail', body: 'Hello' }, createTransport)).toBe('failed')

    const demo = await seedDemo()
    expect(demo.email).toBe('demo@jobpilot.app')
    expect(await prisma.application.count({ where: { userId: (await prisma.user.findUniqueOrThrow({ where: { email: demo.email } })).id } })).toBe(5)
  })
})

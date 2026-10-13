import { hashPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { loadConfig } from '../config.js'

const demoEmail = 'demo@jobpilot.app'

export async function seedDemo() {
  const config = loadConfig()
  const passwordHash = await hashPassword('DemoPass123', config.BCRYPT_ROUNDS)
  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      name: 'Demo Candidate',
      passwordHash,
      headline: 'Product-minded engineer',
      location: 'Bengaluru',
      timezone: 'Asia/Kolkata',
    },
    create: {
      email: demoEmail,
      name: 'Demo Candidate',
      passwordHash,
      headline: 'Product-minded engineer',
      location: 'Bengaluru',
      timezone: 'Asia/Kolkata',
      theme: 'system',
    },
  })

  await prisma.practiceAnswer.deleteMany({ where: { question: { prep: { userId: user.id } } } })
  await prisma.interviewQuestion.deleteMany({ where: { prep: { userId: user.id } } })
  await prisma.interviewPrep.deleteMany({ where: { userId: user.id } })
  await prisma.coverLetter.deleteMany({ where: { userId: user.id } })
  await prisma.tailoredResume.deleteMany({ where: { userId: user.id } })
  await prisma.emailOutbox.deleteMany({ where: { userId: user.id } })
  await prisma.reminder.deleteMany({ where: { userId: user.id } })
  await prisma.timelineEvent.deleteMany({ where: { application: { userId: user.id } } })
  await prisma.contact.deleteMany({ where: { application: { userId: user.id } } })
  await prisma.application.deleteMany({ where: { userId: user.id } })
  await prisma.resume.deleteMany({ where: { userId: user.id } })

  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      title: 'Base resume',
      isDefault: true,
      content: [
        'Demo Candidate',
        'Engineer who ships internal tools with TypeScript and React.',
        'Led a small team, wrote hiring plans, and mentored two interns.',
        'Previously improved a billing workflow and cut manual review time.',
      ].join('\n'),
    },
  })

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const apps = [
    { company: 'Northwind', role: 'Product Manager', status: 'WISHLIST', position: 0 },
    { company: 'Lumen Freight', role: 'Platform Engineer', status: 'APPLIED', position: 0, appliedAt: new Date() },
    {
      company: 'Harbor Studio',
      role: 'Product Designer',
      status: 'INTERVIEW',
      position: 0,
      appliedAt: new Date(),
      interviewAt: tomorrow,
    },
    { company: 'Kepler Bank', role: 'Data Analyst', status: 'OFFER', position: 0, appliedAt: new Date() },
    { company: 'Brightline', role: 'Support Lead', status: 'REJECTED', position: 0, appliedAt: new Date() },
  ]

  for (const app of apps) {
    const created = await prisma.application.create({
      data: {
        userId: user.id,
        company: app.company,
        role: app.role,
        status: app.status,
        position: app.position,
        currency: 'INR',
        location: 'Remote',
        source: 'seed',
        appliedAt: 'appliedAt' in app ? app.appliedAt : null,
        interviewAt: 'interviewAt' in app ? app.interviewAt : null,
        jobDescription: `${app.company} is hiring a ${app.role}. TypeScript, product sense, and clear writing matter.`,
        events: {
          create: [
            { type: 'created', title: 'Added to the board', body: app.status },
            ...(app.status === 'WISHLIST'
              ? []
              : [{ type: 'status_change', title: `Moved to ${label(app.status)}`, body: app.status }]),
          ],
        },
      },
    })
    if (app.company === 'Harbor Studio') {
      await prisma.contact.create({
        data: { applicationId: created.id, name: 'Mina Rao', role: 'Design manager', email: 'mina@harbor.example' },
      })
    }
    if (app.company === 'Lumen Freight') {
      await prisma.reminder.create({
        data: {
          userId: user.id,
          applicationId: created.id,
          title: 'Follow up with Lumen Freight',
          body: 'Ask if they need a work sample.',
          dueAt: nextWeek,
          type: 'follow_up',
        },
      })
    }
  }

  await prisma.reminder.create({
    data: {
      userId: user.id,
      title: 'Review the week',
      body: 'Look at which applications moved.',
      dueAt: tomorrow,
      type: 'custom',
    },
  })

  return { email: user.email, resumeId: resume.id }
}

function label(status: string) {
  if (status === 'APPLIED') return 'Applied'
  if (status === 'INTERVIEW') return 'Interview'
  if (status === 'OFFER') return 'Offer'
  if (status === 'REJECTED') return 'Rejected'
  return 'Wishlist'
}

import 'dotenv/config'
import { prisma } from '../lib/prisma.js'
import { seedDemo } from '../services/seed-data.js'

seedDemo()
  .then((result) => {
    console.log(`Seeded ${result.email}`)
    return prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Cargar variables de entorno
config({ path: '.env.local' })

const prismaAdapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({
  adapter: prismaAdapter,
  log: ['query'],
})

async function clearData() {
  console.log('🧹 Limpiando destinos de la base de datos...')

  const deletedCount = await prisma.destino.deleteMany()

  console.log(`✅ Eliminados ${deletedCount.count} destinos`)
  console.log('🗑️ Base de datos limpia!')
}

clearData()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
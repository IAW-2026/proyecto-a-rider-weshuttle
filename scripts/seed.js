const { config } = require('dotenv')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

// Cargar variables de entorno
config({ path: '.env.local' })

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prismaAdapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter: prismaAdapter,
  log: ['query'],
})

async function main() {
  console.log('🧹 Limpiando base de datos (Destinos y Reservas)...')

  await prisma.reserva.deleteMany()
  const deletedCount = await prisma.destino.deleteMany()
  console.log(`✅ Eliminados ${deletedCount.count} destinos`)

  console.log('🌱 Inyectando destinos predeterminados...')
  
  const destinos = await Promise.all([
    prisma.destino.create({
      data: { nombre: 'Polo Petroquímico', ubicacion_lat_long: '-38.7964, -62.2694' }
    }),
    prisma.destino.create({
      data: { nombre: 'Puerto de Ingeniero White', ubicacion_lat_long: '-38.7842, -62.2667' }
    }),
    prisma.destino.create({
      data: { nombre: 'Parque Industrial', ubicacion_lat_long: '-38.7753, -62.2709' }
    })
  ])

  console.log('✅ ¡Destinos creados exitosamente!')
  destinos.forEach(d => {
    console.log(`  📍 ${d.nombre} (${d.ubicacion_lat_long})`)
  })
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
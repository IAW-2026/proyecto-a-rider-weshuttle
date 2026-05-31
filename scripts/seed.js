const { config } = require('dotenv')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

// Cargar variables de entorno
config({ path: ['.env.local', '.env'] }) // Lee tus configuraciones

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prismaAdapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter: prismaAdapter,
  log: ['query'],
})

async function main() {
  console.log('🧹 Limpiando base de datos...')

  await prisma.passengerNotification.deleteMany()
  await prisma.reservation.deleteMany()
  await prisma.passenger.deleteMany()
  await prisma.pool.deleteMany()
  const deletedCount = await prisma.destination.deleteMany()
  console.log(`✅ Eliminados ${deletedCount.count} destinos`)

  console.log('🌱 Inyectando destinos predeterminados...')
  
  const destinos = await Promise.all([
    prisma.destination.create({ data: { name: 'Polo Petroquímico', address: 'Ruta Nacional 3, Km 578', lat: -38.7964, lng: -62.2694, active: true } }),
    prisma.destination.create({ data: { name: 'Puerto de Ingeniero White', address: 'Puerto Ing. White', lat: -38.7842, lng: -62.2667, active: true } }),
    prisma.destination.create({ data: { name: 'Parque Industrial', address: 'Parque Industrial, Calle 1', lat: -38.7753, lng: -62.2709, active: true } })
  ])

  console.log('✅ ¡Destinos creados exitosamente!')
  destinos.forEach(d => {
    console.log(`  📍 ${d.name} (${d.address})`)
  })

  console.log('🚐 Inyectando viajes de prueba (Pools)...')
  await prisma.pool.createMany({
    data: [
      { conductor_nombre: 'Carlos Gómez', vehiculo_patente: 'Toyota - AF 123 CD', estado: 'Programado' },
      { conductor_nombre: 'Juliana Pagani', vehiculo_patente: 'Sprinter - AF 123 JK', estado: 'En camino' },
      { conductor_nombre: 'Marcos Silva', vehiculo_patente: 'Transit - AB 456 EF', estado: 'Finalizado' },
    ]
  });
  console.log('✅ ¡Viajes creados exitosamente!')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
const { config } = require('dotenv')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

// Cargar variables de entorno
config() // Ahora lee de tu archivo .env directamente

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prismaAdapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter: prismaAdapter,
  log: ['query'],
})

async function main() {
  console.log('🧹 Limpiando base de datos (Destinos y Reservas)...')

  await prisma.reserva.deleteMany()
  await prisma.pool.deleteMany()
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
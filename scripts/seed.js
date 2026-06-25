const { config } = require('dotenv')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const fs = require('fs')
const path = require('path')

// Cargar variables de entorno
config({ path: ['.env.local', '.env'] })

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prismaAdapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter: prismaAdapter,
})

async function main() {
  console.log('🧹 Limpiando base de datos...')
  await prisma.passengerNotification.deleteMany()
  await prisma.reservation.deleteMany()
  await prisma.passenger.deleteMany()
  await prisma.destination.deleteMany()
  console.log('✅ Base de datos limpia.')

  console.log('🌱 Inyectando destinos predeterminados...')
  const destinos = [
    { id: 'dest_polo_petroquimico', name: 'Polo Petroquímico', address: 'Ruta Nacional 3, Km 578', lat: -38.7964, lng: -62.2694, active: true },
    { id: 'dest_puerto_ingeniero_white', name: 'Puerto de Ingeniero White', address: 'Puerto Ing. White', lat: -38.7842, lng: -62.2667, active: true },
    { id: 'dest_parque_industrial', name: 'Parque Industrial', address: 'Parque Industrial, Calle 1', lat: -38.7753, lng: -62.2709, active: true }
  ]

  for (const dest of destinos) {
    await prisma.destination.create({ data: dest })
  }
  console.log('✅ Destinos creados.')

  console.log('🌱 Inyectando pasajeros reales y de prueba...')
  const passengers = [
    {
      id: "cmqltaxps000004jmzfim60c8",
      clerk_user_id: "user_3EYQtdZpi4fPlmXGq4EKEa1onL0",
      full_name: "Juan Bassi",
      phone: "2915241534",
      company_code: null,
      status: "ACTIVE"
    },
    {
      id: "cmqlx8ac9000404lbr1d2wqpb",
      clerk_user_id: "user_3Dwjs2tNYWJq2r3WfN06m9gm533",
      full_name: "Juan",
      phone: "2915241534",
      company_code: null,
      status: "ACTIVE"
    },
    {
      id: "cmqn73h9l000004jpt5hylq5k",
      clerk_user_id: "user_3FQc2n3EzY9IuARMfRHIV6zL6LI",
      full_name: "Kevin Gomez",
      phone: "+54 9 2914328394",
      company_code: "COCA-COLA-12",
      status: "ACTIVE"
    },
    {
      id: "cmqlgbvkw0000fey105sv0wor",
      clerk_user_id: "user_3EYGQCDMhqZaMRhMIgYvm46DK1P",
      full_name: "Juan Perez",
      phone: "291523456",
      company_code: null,
      status: "ACTIVE"
    },
    {
      id: "cmqnyzfh90000svy1bwymln5c",
      clerk_user_id: "user_3EYGNPDkh6Nqg38YBdCb0TeAdNi",
      full_name: "Franco Gulino",
      phone: "291523489",
      company_code: null,
      status: "ACTIVE"
    },
    {
      id: "cmqlor03c000004l8hlvnss0i",
      clerk_user_id: "user_3Db8E5HISehCv1nAJkIwlHXxtiG",
      full_name: "Gulino Franco",
      phone: "2915010701",
      company_code: null,
      status: "ACTIVE"
    },
    {
      id: "cmqlptvne000204l1ahzsve8j",
      clerk_user_id: "user_3EZBdD7n2UefoPdzP4FS1Unf864",
      full_name: "Santiago Lopez",
      phone: "2914567891",
      company_code: null,
      status: "ACTIVE"
    }
  ]

  for (const pass of passengers) {
    await prisma.passenger.create({ data: pass })
  }
  console.log('✅ Pasajeros inyectados.')

  console.log('🌱 Generando reservas con patrones de negocio...');
  const today = new Date()
  const reservations = []

  // Total de reservas a crear: 500
  // Exitosas: 360, Canceladas: 140 (28% cancelaciones, dispara la alerta de retención > 25% de forma realista)
  const passengerAssignments = []

  // 1. Asignaciones Exitosas (360 en total)
  for (let i = 0; i < 110; i++) passengerAssignments.push({ clerk_user_id: "user_3EYGNPDkh6Nqg38YBdCb0TeAdNi", status: "CONFIRMED", payment: "PAID" }) // VIP #1 (110 viajes)
  for (let i = 0; i < 100; i++) passengerAssignments.push({ clerk_user_id: "user_3Db8E5HISehCv1nAJkIwlHXxtiG", status: "CONFIRMED", payment: "PAID" }) // VIP #2 (100 viajes)
  for (let i = 0; i < 60; i++) passengerAssignments.push({ clerk_user_id: "user_3FQc2n3EzY9IuARMfRHIV6zL6LI", status: "CONFIRMED", payment: "PAID" })  // VIP #3 (60 viajes)

  // Otros usuarios con viajes exitosos pero menores para no interferir en el VIP
  for (let i = 0; i < 35; i++) passengerAssignments.push({ clerk_user_id: "user_3EYQtdZpi4fPlmXGq4EKEa1onL0", status: "CONFIRMED", payment: "PAID" }) // Juan Bassi
  for (let i = 0; i < 20; i++) passengerAssignments.push({ clerk_user_id: "user_3EZBdD7n2UefoPdzP4FS1Unf864", status: "CONFIRMED", payment: "PAID" }) // Santiago Lopez
  for (let i = 0; i < 20; i++) passengerAssignments.push({ clerk_user_id: "user_3Dwjs2tNYWJq2r3WfN06m9gm533", status: "CONFIRMED", payment: "PAID" }) // Juan
  for (let i = 0; i < 15; i++) passengerAssignments.push({ clerk_user_id: "user_3EYGQCDMhqZaMRhMIgYvm46DK1P", status: "CONFIRMED", payment: "PAID" }) // Juan Perez

  // 2. Asignaciones Canceladas (140 en total)
  // Juan Perez, Santiago Lopez y Juan son los Críticos de Alto Riesgo.
  for (let i = 0; i < 45; i++) passengerAssignments.push({ clerk_user_id: "user_3EYGQCDMhqZaMRhMIgYvm46DK1P", status: "CANCELED", payment: "PAID" }) // Juan Perez: 45 cancelados / 60 totales = 75% tasa
  for (let i = 0; i < 38; i++) passengerAssignments.push({ clerk_user_id: "user_3EZBdD7n2UefoPdzP4FS1Unf864", status: "CANCELED", payment: "PAID" }) // Santiago Lopez: 38 cancelados / 58 totales = 65.5% tasa
  for (let i = 0; i < 32; i++) passengerAssignments.push({ clerk_user_id: "user_3Dwjs2tNYWJq2r3WfN06m9gm533", status: "CANCELED", payment: "PAID" }) // Juan: 32 cancelados / 52 totales = 61.5% tasa

  // Pocas cancelaciones adicionales a otros para rellenar
  for (let i = 0; i < 15; i++) passengerAssignments.push({ clerk_user_id: "user_3EYQtdZpi4fPlmXGq4EKEa1onL0", status: "CANCELED", payment: "PAID" }) // Juan Bassi (30% tasa)
  for (let i = 0; i < 10; i++) passengerAssignments.push({ clerk_user_id: "user_3FQc2n3EzY9IuARMfRHIV6zL6LI", status: "CANCELED", payment: "PAID" })  // Kevin Gomez (14.3% tasa)

  // Rango de fechas: [-90, 7] días para cubrir al menos 3 meses de actividad
  const datesByDayOfWeek = {
    0: [], // Domingo
    1: [], // Lunes
    2: [], // Martes
    3: [], // Miércoles
    4: [], // Jueves
    5: [], // Viernes
    6: []  // Sábado
  }

  for (let i = -90; i <= -1; i++) {
    const d = new Date()
    d.setDate(today.getDate() + i)
    const dayOfWeek = d.getDay() // getDay() local
    datesByDayOfWeek[dayOfWeek].push(d)
  }

  // Distribución de días de la semana especificada por el usuario (500 en total):
  // Lunes: 100, Martes: 50, Miércoles: 80, Jueves: 30, Viernes: 120, Sábado: 90, Domingo: 30
  const targetDays = []
  for (let i = 0; i < 30; i++) targetDays.push(0)  // Domingo (30)
  for (let i = 0; i < 100; i++) targetDays.push(1) // Lunes (100)
  for (let i = 0; i < 50; i++) targetDays.push(2)  // Martes (50)
  for (let i = 0; i < 80; i++) targetDays.push(3)  // Miércoles (80)
  for (let i = 0; i < 30; i++) targetDays.push(4)  // Jueves (30)
  for (let i = 0; i < 120; i++) targetDays.push(5) // Viernes (120)
  for (let i = 0; i < 90; i++) targetDays.push(6)  // Sábado (90)

  // Mezclar asignaciones para que queden mezcladas en el tiempo
  const shuffledAssignments = [...passengerAssignments].sort(() => Math.random() - 0.5)

  // Asignar horas y generar registros
  let horaPicoCount = 0
  const pools = [
    'pool_lunes_1', 'pool_lunes_2', 'pool_viernes_1', 'pool_viernes_2',
    'pool_sabado_1', 'pool_sabado_2', 'pool_domingo_1', 'pool_domingo_2'
  ]

  for (let index = 0; index < 500; index++) {
    const assignment = shuffledAssignments[index]
    const pProfile = passengers.find(p => p.clerk_user_id === assignment.clerk_user_id)

    const assignedDay = targetDays[index]
    const datesList = datesByDayOfWeek[assignedDay]
    const dateObj = datesList[index % datesList.length]

    const reservationDate = new Date(dateObj)

    // Evitar desbordes el último día del rango
    const limitDate = new Date()
    limitDate.setDate(today.getDate() - 1)
    const isLastDay = reservationDate.toDateString() === limitDate.toDateString()

    let horaLocal
    // Colocar hora pico en los días de mayor volumen (Lunes, Viernes, Sábado)
    if (horaPicoCount < 130 && (assignedDay === 1 || assignedDay === 5 || assignedDay === 6) && !isLastDay) {
      horaLocal = 21 // 21:00 hs (hora pico)
      horaPicoCount++
    } else {
      const options = [8, 12, 17]
      horaLocal = options[index % options.length]
    }

    const year = reservationDate.getFullYear()
    const month = reservationDate.getMonth()
    const day = reservationDate.getDate()

    let departureTimeUTC
    if (horaLocal === 21) {
      departureTimeUTC = new Date(Date.UTC(year, month, day + 1, 0, 0, 0))
    } else {
      departureTimeUTC = new Date(Date.UTC(year, month, day, horaLocal + 3, 0, 0))
    }

    let destId
    if (index % 2 === 0) {
      destId = 'dest_polo_petroquimico'
    } else if (index % 4 === 1) {
      destId = 'dest_puerto_ingeniero_white'
    } else {
      destId = 'dest_parque_industrial'
    }

    const poolId = assignment.status === "CONFIRMED" ? pools[index % pools.length] : null

    const maxPrice = 3500
    const amountCharged = maxPrice
    const finalTripPrice = assignment.status === "CONFIRMED" ? 3000 : null
    const creditGranted = assignment.status === "CONFIRMED" ? (maxPrice - 3000) : 0

    reservations.push({
      id: `res_seed_${index + 1}`,
      passenger_id: pProfile.id,
      passenger_user_id: pProfile.clerk_user_id,
      pool_id: poolId,
      destination_id: destId,
      departure_time: departureTimeUTC,
      pickup_address: "Av. Alem 1250, Bahía Blanca",
      pickup_lat: -38.7183,
      pickup_lng: -62.2662,
      reservation_status: assignment.status,
      payment_status: assignment.payment,
      max_price: maxPrice,
      amount_charged: amountCharged,
      credit_applied: 0,
      final_trip_price: finalTripPrice,
      credit_granted: creditGranted,
      currency: "ARS",
      payment_transaction_id: `tx_seed_${index + 1}`
    })
  }

  // Inyectar en base de datos
  for (const res of reservations) {
    await prisma.reservation.create({ data: res })
  }
  console.log(`✅ Inyectadas ${reservations.length} reservas balanceadas en la base de datos.`);

  // Exportar manifiesto
  const manifestData = {
    destinations: destinos,
    passengers: passengers,
    reservations: reservations.map(r => ({
      ...r,
      departure_time: r.departure_time.toISOString()
    }))
  }

  const manifestPath = path.join(__dirname, '../seed-manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf-8')
  console.log(`📦 Manifiesto exportado exitosamente en: ${manifestPath}`)
}

main()
  .catch((e) => {
    console.error('❌ Error al ejecutar el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
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

function getDepartureTime(dateStr, horaLocal) {
  const parts = dateStr.split('-')
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  
  if (horaLocal === 21) {
    return new Date(Date.UTC(year, month, day + 1, 0, 0, 0))
  } else {
    return new Date(Date.UTC(year, month, day, horaLocal + 3, 0, 0))
  }
}

async function main() {
  console.log('🧹 Limpiando base de datos...')
  await prisma.$transaction([
    prisma.passengerNotification.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.passenger.deleteMany(),
    prisma.destination.deleteMany()
  ])
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

  // Generar 38 pasajeros mock adicionales para alcanzar un total de 45 usuarios
  const firstNames = ['Mariano', 'Agustina', 'Facundo', 'Camila', 'Gaston', 'Martina', 'Bautista', 'Florencia', 'Joaquin', 'Delfina', 'Tomas', 'Jazmin', 'Mateo', 'Catalina', 'Federico', 'Sofia', 'Renzo', 'Victoria', 'Julian', 'Paula', 'Manuel', 'Abril', 'Bruno', 'Valentina', 'Guido', 'Morena', 'Lucas', 'Lola', 'Esteban', 'Clara', 'Ignacio', 'Juana', 'Marcos', 'Emilia', 'Ivan', 'Olivia', 'Lautaro', 'Elena']
  const lastNames = ['Gomez', 'Rodriguez', 'Gonzalez', 'Fernandez', 'Lopez', 'Diaz', 'Martinez', 'Perez', 'Garcia', 'Sanchez', 'Romero', 'Alvarez', 'Torres', 'Ruiz', 'Ramirez', 'Flores', 'Acosta', 'Benitez', 'Silva', 'Castro', 'Rojas', 'Medina', 'Ortiz', 'Suarez', 'Rios', 'Molina', 'Cabrera', 'Vidal', 'Peralta', 'Ledesma', 'Vega', 'Guerrero', 'Juarez', 'Herrera', 'Caceres', 'Gimenez', 'Mendez', 'Bustos']

  for (let i = 1; i <= 38; i++) {
    const name = `${firstNames[(i - 1) % firstNames.length]} ${lastNames[(i + 2) % lastNames.length]}`
    passengers.push({
      id: `cmql_mock_passenger_${i}`,
      clerk_user_id: `user_mock_clerk_${i}`,
      full_name: name,
      phone: `291${Math.floor(1000000 + Math.random() * 9000000)}`,
      company_code: i % 4 === 0 ? `COMP-${100 + i}` : null,
      status: "ACTIVE"
    })
  }

  for (const pass of passengers) {
    await prisma.passenger.create({ data: pass })
  }
  console.log(`✅ ${passengers.length} pasajeros inyectados (7 del equipo + 38 mocks).`)

  console.log('🌱 Generando reservas con patrones de negocio...');
  const today = new Date()
  const reservations = []

  // Estructuras de control
  const passengerPoolSet = new Set()
  const poolPassengerCount = {}

  // 1. Inyectar pools especiales requeridos por el usuario de forma manual
  // Todos confirmados con pago exitoso
  const specialPoolSpecs = [
    { poolId: 'pool_1_parque_industrial_21_2026-06-22', dateStr: '2026-06-22', horaLocal: 21, destId: 'dest_parque_industrial', assignedDay: 1, passengerCount: 13 },
    { poolId: 'pool_3_polo_petroquimico_17_2026-06-17', dateStr: '2026-06-17', horaLocal: 17, destId: 'dest_polo_petroquimico', assignedDay: 3, passengerCount: 12 },
    { poolId: 'pool_0_parque_industrial_17_2026-06-14', dateStr: '2026-06-14', horaLocal: 17, destId: 'dest_parque_industrial', assignedDay: 0, passengerCount: 14 },
    { poolId: 'pool_6_parque_industrial_12_2026-06-06', dateStr: '2026-06-06', horaLocal: 12, destId: 'dest_parque_industrial', assignedDay: 6, passengerCount: 11 },
    { poolId: 'pool_4_puerto_ingeniero_white_12_2026-06-04', dateStr: '2026-06-04', horaLocal: 12, destId: 'dest_puerto_ingeniero_white', assignedDay: 4, passengerCount: 12 },
    { poolId: 'pool_4_polo_petroquimico_17_2026-05-28', dateStr: '2026-05-28', horaLocal: 17, destId: 'dest_polo_petroquimico', assignedDay: 4, passengerCount: 13 }
  ]

  let reservationIndex = 1
  const passengerConfirmedCounts = {} // clerk_user_id -> confirmadas consumidas
  const passengerCanceledCounts = {}

  // Inicializar conteos por pasajero
  for (const pass of passengers) {
    passengerConfirmedCounts[pass.clerk_user_id] = 0
    passengerCanceledCounts[pass.clerk_user_id] = 0
  }

  for (const spec of specialPoolSpecs) {
    const poolId = spec.poolId
    // Mezclar pasajeros y elegir los primeros 'passengerCount' para este pool
    const shuffledPassengers = [...passengers].sort(() => Math.random() - 0.5)
    
    for (let i = 0; i < spec.passengerCount; i++) {
      const p = shuffledPassengers[i]
      const departureTime = getDepartureTime(spec.dateStr, spec.horaLocal)
      
      reservations.push({
        id: `res_seed_${reservationIndex++}`,
        passenger_id: p.id,
        passenger_user_id: p.clerk_user_id,
        pool_id: poolId,
        destination_id: spec.destId,
        departure_time: departureTime,
        pickup_address: "Av. Alem 1250, Bahía Blanca",
        pickup_lat: -38.7183,
        pickup_lng: -62.2662,
        reservation_status: "CONFIRMED",
        payment_status: "PAID",
        max_price: 3500,
        amount_charged: 3500,
        credit_applied: 0,
        final_trip_price: 3000,
        credit_granted: 500,
        currency: "ARS",
        payment_transaction_id: `tx_seed_spec_${reservationIndex}`
      })
      
      passengerPoolSet.add(`${p.clerk_user_id}_${poolId}`)
      poolPassengerCount[poolId] = (poolPassengerCount[poolId] || 0) + 1
      passengerConfirmedCounts[p.clerk_user_id]++
    }
  }

  console.log(`✅ Inyectadas ${reservations.length} reservas específicas en los 6 pools requeridos.`);

  // 2. Generar reservas del loop general
  // Queremos 2500 en total (1800 confirmadas y 700 canceladas).
  // Ya inyectamos 75 confirmadas.
  // Quedan 1725 confirmadas y 700 canceladas por inyectar en el loop general.
  const targetConfirmTotal = 1800
  const targetCancelTotal = 700
  const specialConfirmCount = reservations.length // 75

  const passengerAssignments = []

  // Límites totales por usuario (confirmados totales y cancelados totales)
  const userConfirmLimits = {
    "user_3EYGNPDkh6Nqg38YBdCb0TeAdNi": 120, // Franco Gulino (VIP #1)
    "user_3Db8E5HISehCv1nAJkIwlHXxtiG": 100, // Gulino Franco (VIP #2)
    "user_3FQc2n3EzY9IuARMfRHIV6zL6LI": 80,  // Kevin Gomez (VIP #3)
    "user_3EYQtdZpi4fPlmXGq4EKEa1onL0": 60,  // Juan Bassi
    "user_3EZBdD7n2UefoPdzP4FS1Unf864": 40,  // Santiago Lopez (Alto Riesgo)
    "user_3Dwjs2tNYWJq2r3WfN06m9gm533": 40,  // Juan (Alto Riesgo)
    "user_3EYGQCDMhqZaMRhMIgYvm46DK1P": 20,  // Juan Perez (Alto Riesgo)
  }

  const userCancelLimits = {
    "user_3EYGNPDkh6Nqg38YBdCb0TeAdNi": 30,
    "user_3Db8E5HISehCv1nAJkIwlHXxtiG": 30,
    "user_3FQc2n3EzY9IuARMfRHIV6zL6LI": 20,
    "user_3EYQtdZpi4fPlmXGq4EKEa1onL0": 20,
    "user_3EZBdD7n2UefoPdzP4FS1Unf864": 100, // Alto Riesgo
    "user_3Dwjs2tNYWJq2r3WfN06m9gm533": 90,  // Alto Riesgo
    "user_3EYGQCDMhqZaMRhMIgYvm46DK1P": 100, // Alto Riesgo
  }

  // Cargar confirmadas generales para los 7 usuarios reales
  for (const [userId, targetConf] of Object.entries(userConfirmLimits)) {
    const currentConf = passengerConfirmedCounts[userId] || 0
    const remainingConf = targetConf - currentConf
    for (let i = 0; i < remainingConf; i++) {
      passengerAssignments.push({ clerk_user_id: userId, status: "CONFIRMED", payment: "PAID" })
      passengerConfirmedCounts[userId]++
    }
  }

  // Cargar canceladas generales para los 7 usuarios reales
  for (const [userId, targetCanc] of Object.entries(userCancelLimits)) {
    const currentCanc = passengerCanceledCounts[userId] || 0
    const remainingCanc = targetCanc - currentCanc
    for (let i = 0; i < remainingCanc; i++) {
      passengerAssignments.push({ clerk_user_id: userId, status: "CANCELED", payment: "PAID" })
      passengerCanceledCounts[userId]++
    }
  }

  // Rellenar confirmadas de los mocks (hasta llegar a 1800 totales)
  const currentTotalConf = Object.values(passengerConfirmedCounts).reduce((a,b) => a+b, 0)
  const remainingMockConf = targetConfirmTotal - currentTotalConf
  for (let i = 0; i < remainingMockConf; i++) {
    const mockClerkId = `user_mock_clerk_${(i % 38) + 1}`
    passengerAssignments.push({ clerk_user_id: mockClerkId, status: "CONFIRMED", payment: "PAID" })
    passengerConfirmedCounts[mockClerkId]++
  }

  // Rellenar canceladas de los mocks (hasta llegar a 700 totales)
  const currentTotalCanc = Object.values(passengerCanceledCounts).reduce((a,b) => a+b, 0)
  const remainingMockCanc = targetCancelTotal - currentTotalCanc
  for (let i = 0; i < remainingMockCanc; i++) {
    const mockClerkId = `user_mock_clerk_${(i % 38) + 1}`
    passengerAssignments.push({ clerk_user_id: mockClerkId, status: "CANCELED", payment: "PAID" })
    passengerCanceledCounts[mockClerkId]++
  }

  // Rango de fechas: [-95, -1] días
  const datesByDayOfWeek = {
    0: [], // Domingo
    1: [], // Lunes
    2: [], // Martes
    3: [], // Miércoles
    4: [], // Jueves
    5: [], // Viernes
    6: []  // Sábado
  }

  for (let i = -95; i <= -1; i++) {
    const d = new Date()
    d.setDate(today.getDate() + i)
    const dayOfWeek = d.getDay() // getDay() local
    datesByDayOfWeek[dayOfWeek].push(d)
  }

  // Distribución de días de la semana (2425 totales en el loop general):
  // Lunes: 485, Martes: 242, Miércoles: 388, Jueves: 145, Viernes: 582, Sábado: 436, Domingo: 147
  // Ajustado para que sume exactamente 2425
  const targetDays = []
  for (let i = 0; i < 147; i++) targetDays.push(0) // Domingo (147)
  for (let i = 0; i < 485; i++) targetDays.push(1) // Lunes (485)
  for (let i = 0; i < 242; i++) targetDays.push(2) // Martes (242)
  for (let i = 0; i < 388; i++) targetDays.push(3) // Miércoles (388)
  for (let i = 0; i < 145; i++) targetDays.push(4) // Jueves (145)
  for (let i = 0; i < 582; i++) targetDays.push(5) // Viernes (582)
  for (let i = 0; i < 436; i++) targetDays.push(6) // Sábado (436)

  // Mezclar asignaciones del loop general
  const shuffledAssignments = [...passengerAssignments].sort(() => Math.random() - 0.5)

  let horaPicoCount = 0

  for (let index = 0; index < shuffledAssignments.length; index++) {
    const assignment = shuffledAssignments[index]
    const pProfile = passengers.find(p => p.clerk_user_id === assignment.clerk_user_id)

    const assignedDay = targetDays[index]
    const datesList = datesByDayOfWeek[assignedDay]
    const dateObj = datesList[index % datesList.length]

    let reservationDate = new Date(dateObj)

    // Evitar desbordes el último día del rango
    const limitDate = new Date()
    limitDate.setDate(today.getDate() - 1)
    const isLastDay = reservationDate.toDateString() === limitDate.toDateString()

    let destId
    if (assignment.status === "CONFIRMED") {
      // Concentración extrema confirmados: Polo Petroquímico (90%), Parque Industrial (10%)
      const r = Math.random()
      if (r < 0.90) {
        destId = 'dest_polo_petroquimico'
      } else {
        destId = 'dest_parque_industrial'
      }
    } else {
      if (index % 2 === 0) {
        destId = 'dest_polo_petroquimico'
      } else if (index % 4 === 1) {
        destId = 'dest_puerto_ingeniero_white'
      } else {
        destId = 'dest_parque_industrial'
      }
    }

    let horaLocal
    if (assignment.status === "CONFIRMED") {
      // Concentración extrema confirmados: entrada laboral (8hs - 50%), salida laboral (17hs - 50%)
      const r = Math.random()
      if (r < 0.50) {
        horaLocal = 8
      } else {
        horaLocal = 17
      }
    } else {
      // Colocar hora pico en los días de mayor volumen (Lunes, Viernes, Sábado)
      if (horaPicoCount < 600 && (assignedDay === 1 || assignedDay === 5 || assignedDay === 6) && !isLastDay) {
        horaLocal = 21 // 21:00 hs (hora pico)
        horaPicoCount++
      } else {
        const options = [8, 12, 17]
        horaLocal = options[index % options.length]
      }
    }

    const dateStr = dateObj.toISOString().split('T')[0] // YYYY-MM-DD

    // Si es confirmado, generamos un pool único por fecha, hora y destino
    let poolId = null
    let currentReservationDate = new Date(reservationDate)
    if (assignment.status === "CONFIRMED") {
      let basePoolId = `pool_${assignedDay}_${destId.replace('dest_', '')}_${horaLocal}_${dateStr}`
      let uniquePoolId = basePoolId
      let attempt = 0
      const passengerId = pProfile.clerk_user_id
      const hours = [8, 12, 17, 21]
      const initialHourIndex = hours.indexOf(horaLocal)

      // Si el pasajero ya está en ese pool, o el pool tiene >= 15 personas, buscamos otra hora para el mismo día u otro día
      while (
        (passengerPoolSet.has(`${passengerId}_${uniquePoolId}`) || (poolPassengerCount[uniquePoolId] || 0) >= 15) &&
        attempt < 30
      ) {
        attempt++
        // Si ya probamos todas las horas del día actual, avanzamos al siguiente día
        if (attempt % hours.length === 0) {
          currentReservationDate.setDate(currentReservationDate.getDate() + 1)
        }
        const alternativeHour = hours[(initialHourIndex + attempt) % hours.length]
        const altDateStr = currentReservationDate.toISOString().split('T')[0]
        const altAssignedDay = currentReservationDate.getDay()
        
        uniquePoolId = `pool_${altAssignedDay}_${destId.replace('dest_', '')}_${alternativeHour}_${altDateStr}`
        
        // Actualizamos horaLocal si cambia por el desplazamiento
        horaLocal = alternativeHour
      }

      poolId = uniquePoolId
      passengerPoolSet.add(`${passengerId}_${poolId}`)
      poolPassengerCount[poolId] = (poolPassengerCount[poolId] || 0) + 1
      reservationDate = currentReservationDate
    }

    const departureTime = getDepartureTime(reservationDate.toISOString().split('T')[0], horaLocal)

    const maxPrice = 3500
    const amountCharged = maxPrice
    const finalTripPrice = assignment.status === "CONFIRMED" ? 3000 : null
    const creditGranted = assignment.status === "CONFIRMED" ? (maxPrice - 3000) : 0

    reservations.push({
      id: `res_seed_${reservationIndex++}`,
      passenger_id: pProfile.id,
      passenger_user_id: pProfile.clerk_user_id,
      pool_id: poolId,
      destination_id: destId,
      departure_time: departureTime,
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
      payment_transaction_id: `tx_seed_${reservationIndex}`
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
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

// --- MOCKS DE APIs EXTERNAS --- //

async function fetchPaymentsAppMock() {
  // Simula la respuesta de: GET /api/payments/pricing-estimate
  return {
    "currency": "ARS",
    "max_price": 5000,
    "estimated_price": 4200,
    "current_passengers": 5,
    "pricing_detail": {
      "base_price": 5000,
      "estimated_discount": 800,
      "discount_reason": "OCCUPANCY_DISCOUNT"
    }
  }
}

async function fetchDriverAppPoolMock() {
  // Simula la respuesta de: POST /api/pools
  return {
    "pool_id": `pool_mock_${Math.floor(Math.random() * 1000)}`, // Genera un ID falso aleatorio
    "status": "AVAILABLE",
    "current_passengers": 1,
    "max_capacity": 15
  }
}

export default async function NuevaReservaPage() {
  // Protegemos la página al entrar
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Traemos los destinos reales de la base de datos
  const destinos = await prisma.destino.findMany()

  // --- SERVER ACTION: Lo que pasa al tocar "Confirmar" ---
  async function confirmarReserva(formData: FormData) {
    'use server'
    const destino_id = formData.get('destino_id') as string
    const horario = formData.get('horario') as string
    const punto_partida = formData.get('punto_partida') as string

    // SEGURIDAD (Backend): Validamos que los datos no estén vacíos ni sean puros espacios
    if (!destino_id || !horario || !punto_partida || punto_partida.trim().length < 5) {
      throw new Error("Datos inválidos. Por favor completá todos los campos correctamente.")
    }

    // Buscamos al usuario de Clerk RECIÉN cuando se ejecuta la acción
    const { userId: actionUserId } = await auth()
    const user = await currentUser()
    if (!actionUserId || !user) return

    // El string de horario viene sin zona horaria. Le avisamos a Node que es hora de Argentina (-03:00)
    // para que lo valide y lo guarde correctamente en la base de datos.
    const fechaViaje = new Date(`${horario}-03:00`)
    // Margen operativo: La reserva debe hacerse con al menos 2 horas de anticipación
    // (Le damos 5 minutos de gracia por si el usuario tardó en llenar el formulario)
    const fechaMinima = new Date(Date.now() + 2 * 60 * 60 * 1000 - 5 * 60 * 1000)
    if (fechaViaje < fechaMinima) {
      throw new Error("Error de negocio: Las reservas deben realizarse con al menos 2 horas de anticipación.")
    }

    // 1. Consultamos a las APIs amigas (Mocks por ahora)
    const paymentsData = await fetchPaymentsAppMock()
    const driverData = await fetchDriverAppPoolMock()

    // 2. Asegurarnos de que el Pasajero exista en nuestra base de datos
    await prisma.pasajero.upsert({
      where: { clerk_user_id: actionUserId },
      update: {},
      create: {
        clerk_user_id: actionUserId,
        nombre: user?.firstName || 'Pasajero',
        email: user?.emailAddresses[0]?.emailAddress,
        rol: 'RIDER'
      }
    })

    // 3. Crear la reserva inmutable guardando los datos de las APIs externas
    await prisma.reserva.create({
      data: {
        clerk_user_id: actionUserId,
        destino_id: destino_id,
        horario: fechaViaje, // ¡Usamos la fecha con la zona horaria corregida para que Vercel no la rompa!
        punto_de_partida: punto_partida,
        estado_reserva: 'PENDING_DRIVER',
        precio_maximo: paymentsData.max_price, // Guardamos el Snapshot del precio!
        pool_id: driverData.pool_id // Lo asociamos a la combi de la Driver App!
      }
    })

    // 4. Al terminar lo mandamos a ver su ticket
    redirect('/mis-viajes')
  }

  // Calculamos la hora actual en Argentina (UTC-3) para bloquear fechas pasadas en el calendario
  const ahoraUtc = new Date()
  // Le restamos 3 horas (por Arg) y le SUMAMOS 2 horas de margen operativo
  const minArgConMargen = new Date(ahoraUtc.getTime() - 3 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000) 
  const minDateTime = minArgConMargen.toISOString().slice(0, 16)

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black font-sans flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-white p-8 rounded-[2rem] border border-gray-200 shadow-sm">
        <header className="mb-8">
          <Link href="/" className="text-[10px] font-bold uppercase text-blue-600 hover:underline">
            ← Volver al inicio
          </Link>
          <h1 className="text-3xl font-black italic mt-2">Reservar Asiento</h1>
          <p className="text-gray-500 text-sm mt-1">Elegí a dónde y cuándo querés viajar.</p>
        </header>

        <form action={confirmarReserva} className="flex flex-col gap-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">¿A dónde vamos?</label>
            <select name="destino_id" required className="w-full p-4 rounded-xl border border-gray-200 text-sm font-bold bg-gray-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all">
              <option value="">Seleccioná un destino...</option>
              {destinos.map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">¿A qué hora?</label>
            <input type="datetime-local" name="horario" min={minDateTime} defaultValue={minDateTime} required className="w-full p-4 rounded-xl border border-gray-200 text-sm font-bold bg-gray-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">¿Por dónde te buscamos?</label>
            <input type="text" name="punto_partida" placeholder="Ej: Sarmiento 850, Bahía Blanca" required minLength={5} maxLength={100} className="w-full p-4 rounded-xl border border-gray-200 text-sm font-bold bg-gray-50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" />
          </div>
          <button type="submit" className="w-full bg-black text-white text-xs font-black uppercase tracking-[0.2em] py-5 rounded-2xl hover:bg-blue-600 transition-colors shadow-md mt-4">Confirmar Reserva</button>
        </form>
      </div>
    </div>
  )
}
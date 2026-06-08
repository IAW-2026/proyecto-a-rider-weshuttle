import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { fetchPaymentsAppPricingMock, createDriverAppPoolMock } from '@/lib/api'
import { UserButton } from "@clerk/nextjs"
import { revalidatePath } from 'next/cache'
import AddressAutocomplete from './AddressAutocomplete'

export default async function NuevaReservaPage() {
  // 1. Verificamos que el usuario esté autenticado
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // 2. Obtenemos datos necesarios para el formulario
  const destinos = await prisma.destination.findMany({ where: { active: true } })
  const user = await currentUser()
  const userEmail = user?.emailAddresses[0]?.emailAddress?.toLowerCase() ?? '';
  const adminEmailsList = (process.env.ADMIN_EMAIL ?? '').split(',').map(e => e.trim().toLowerCase());
  const isAdmin = adminEmailsList.includes(userEmail);

  const notificaciones = userId ? await prisma.passengerNotification.findMany({
    where: { passenger_user_id: userId, read_at: null },
    orderBy: { id: 'desc' }
  }) : []

  // --- SERVER ACTION: Procesar la nueva reserva ---
  async function confirmarReserva(formData: FormData) {
    'use server'
    const destino_id = formData.get('destino_id') as string
    const horario = formData.get('horario') as string
    const punto_partida = formData.get('punto_partida') as string

    // Validación básica de los datos ingresados
    const tieneLetras = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(punto_partida || '');
    if (!destino_id || !horario || !punto_partida || punto_partida.trim().length < 5 || !tieneLetras) {
      throw new Error("Datos inválidos. El punto de recogida debe ser una dirección real (ej: Calle 123).")
    }

    const { userId: actionUserId } = await auth()
    const actionUser = await currentUser()
    if (!actionUserId || !actionUser) return

    // Regla de Negocio: Las reservas deben hacerse con al menos 2 horas de anticipación
    const fechaViaje = new Date(`${horario}-03:00`)
    const fechaMinima = new Date(Date.now() + 2 * 60 * 60 * 1000 - 5 * 60 * 1000)
    if (fechaViaje < fechaMinima) {
      throw new Error("Error de negocio: Las reservas deben realizarse con al menos 2 horas de anticipación.")
    }

    // Simulación de consulta a microservicios externos
    const paymentsData = await fetchPaymentsAppPricingMock()
    const driverData = await createDriverAppPoolMock()

    // Regla de Negocio: Verificar que haya asientos disponibles
    if (driverData.current_passengers >= driverData.max_capacity) {
      throw new Error("Error de negocio: No hay asientos disponibles en la unidad para este horario y destino.")
    }

    // 🌟 NUEVO: Obtener coordenadas reales usando la API de OpenStreetMap (Geocoding)
    let lat = -38.7183; // Coordenada por defecto (Centro de Bahía Blanca)
    let lng = -62.2663;
    try {
      // Le sumamos la ciudad para que la búsqueda sea mucho más exacta
      const query = encodeURIComponent(`${punto_partida}, Bahía Blanca, Argentina`);
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
        headers: { 'User-Agent': 'WeShuttle-RiderApp/1.0' }
      });
      const geoData = await geoRes.json();
      if (geoData && geoData.length > 0) {
        lat = parseFloat(geoData[0].lat);
        lng = parseFloat(geoData[0].lon);
      }
    } catch (error) {
      console.error("Error obteniendo coordenadas:", error);
    }

    // Registramos al usuario en nuestra base de datos si es su primera vez
    const pasajeroDb = await prisma.passenger.upsert({
      where: { clerk_user_id: actionUserId },
      update: {},
      create: {
        clerk_user_id: actionUserId,
        full_name: actionUser?.firstName || 'Pasajero',
        phone: "Sin registrar", // Fallback por el contrato
        email: actionUser?.emailAddresses[0]?.emailAddress,
        status: "ACTIVE",
        rol: 'RIDER'
      }
    })

    // Creamos la reserva inmutable con los datos obtenidos
    await prisma.reservation.create({
      data: {
        passenger_id: pasajeroDb.id,
        passenger_user_id: actionUserId,
        destination_id: destino_id,
        departure_time: fechaViaje,
        pickup_address: punto_partida,
        pickup_lat: lat, // 🌟 Guardamos latitud real
        pickup_lng: lng, // 🌟 Guardamos longitud real
        status: 'PENDING_DRIVER',
        max_price: paymentsData.max_price,
        currency: paymentsData.currency || "ARS",
        pool_id: driverData.pool_id
      }
    })

    redirect('/mis-viajes?toast=Estado:+Buscando+Unidad')
  }

  // Calculamos la hora mínima permitida para el input date (ahora + 2hs)
  const ahoraUtc = new Date()
  const minArgConMargen = new Date(ahoraUtc.getTime() - 3 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000) 
  const minDateTime = minArgConMargen.toISOString().slice(0, 16)

  // --- SERVER ACTION: Limpiar notificaciones ---
  async function limpiarNotificaciones() {
    'use server'
    const { userId: actionUserId } = await auth()
    if (actionUserId) {
      await prisma.passengerNotification.updateMany({
        where: { passenger_user_id: actionUserId, read_at: null },
        data: { read_at: new Date() }
      })
      revalidatePath('/reservar')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB] text-[#0A192F]">
      
      {/* NAVEGACIÓN SUPERIOR (TopNavBar) */}
      <nav className="bg-[#FFFFFF] h-20 w-full flex items-center justify-between px-6 sticky top-0 z-50 border-b border-[#D8DADC] shadow-sm">
        <div className="flex items-center">
          <Link href="/" className="text-[24px] font-extrabold italic text-[#0A192F] tracking-tight">WeShuttle</Link>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center h-full gap-8">
          <Link href="/" className="text-[#4B5563] hover:text-[#0A192F] transition-colors duration-200 font-medium text-[14px] h-full flex items-center border-b-2 border-transparent">Inicio</Link>
          <Link href="/mis-viajes" className="text-[#4B5563] hover:text-[#0A192F] transition-colors duration-200 font-medium text-[14px] h-full flex items-center border-b-2 border-transparent">Mis Viajes</Link>
          <Link href="/reservar" className="text-[#0A192F] font-bold text-[14px] h-full flex items-center border-b-2 border-[#0A192F]">Reservar</Link>
        </div>
        <div className="flex items-center gap-4 h-full">
          <div className="relative group flex items-center h-full" tabIndex={0}>
            <div className="cursor-pointer text-[#4B5563] hover:text-[#0A192F] transition-colors duration-200 relative flex items-center justify-center p-2 rounded-full hover:bg-[#F7F9FB]">
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              {notificaciones.length > 0 && <span className="absolute top-1 right-1 bg-[#DC2626] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-bounce">{notificaciones.length}</span>}
            </div>
            <div className="fixed left-4 right-4 top-[72px] sm:absolute sm:top-[100%] sm:left-auto sm:right-0 sm:w-72 z-50 hidden group-hover:block group-focus-within:block sm:pt-1">
              <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-[#D8DADC] flex justify-between items-center bg-[#F7F9FB]">
                  <h2 className="text-[16px] font-semibold text-[#0A192F]">Notificaciones</h2>
                  {notificaciones.length > 0 && (
                    <form action={limpiarNotificaciones}>
                      <button type="submit" className="text-[12px] text-[#0A192F] font-bold uppercase tracking-widest hover:underline">Marcar leídas</button>
                    </form>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {notificaciones.length === 0 ? (
                    <p className="p-4 text-center text-[14px] text-[#475569]">No hay avisos nuevos.</p>
                  ) : (
                    notificaciones.map(notif => (
                      <div key={notif.id} className="p-3 mb-1 bg-[#F7F9FB] text-[#0A192F] text-[12px] rounded-lg border border-[#D8DADC]">
                        {notif.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          {isAdmin && (
            <Link href="/admin" className="border border-[#0A192F] text-[#0A192F] px-3 py-1.5 rounded-lg text-[12px] font-bold hover:bg-[#F7F9FB] transition-colors duration-200">
              Panel Admin
            </Link>
          )}
          <div className="w-[40px] h-[40px] rounded-full border border-[#D8DADC] flex items-center justify-center overflow-hidden bg-white">
            <UserButton />
          </div>
        </div>
      </nav>

      <main className="py-[40px] px-[24px] md:px-[48px] max-w-4xl mx-auto pb-24 md:pb-8">
        
        <div className="w-full bg-[#FFFFFF] p-[40px] md:p-[48px] rounded-[12px] border border-[#D8DADC] shadow-sm">
          <header className="mb-8">
            <Link href="/" className="inline-flex items-center gap-1.5 text-[#475569] hover:text-[#0A192F] text-[12px] font-bold uppercase tracking-widest transition-colors mb-4">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span> Volver al Inicio
            </Link>
            <h1 className="text-[32px] font-bold text-[#0A192F] tracking-tight">Reservar Asiento</h1>
            <p className="text-[#475569] text-[16px] mt-1">Complete los detalles para asegurar su lugar en el próximo servicio de WeShuttle.</p>
          </header>

          <form action={confirmarReserva} className="flex flex-col gap-6">
            
            <div>
              <label htmlFor="destino_id" className="block text-[12px] font-bold uppercase tracking-widest text-[#0A192F] mb-2">Destino Final</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]">map</span>
                <select id="destino_id" name="destino_id" required className="w-full min-w-0 h-[56px] pl-10 pr-8 rounded-[8px] border border-[#D8DADC] text-[16px] md:text-[14px] font-semibold bg-[#FFFFFF] outline-none focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] transition-all text-[#0A192F] appearance-none cursor-pointer truncate">
                  <option value="">Seleccione su destino...</option>
                  {destinos.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none">expand_more</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 w-full overflow-hidden">
                <label htmlFor="horario" className="block text-[12px] font-bold uppercase tracking-widest text-[#0A192F] mb-2">Fecha y Horario de Partida</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]">calendar_clock</span>
                  <input type="datetime-local" id="horario" name="horario" min={minDateTime} defaultValue={minDateTime} required className="w-full appearance-none min-w-0 max-w-full h-[56px] pl-10 pr-2 md:pr-4 rounded-[8px] border border-[#D8DADC] text-[16px] md:text-[14px] font-semibold bg-[#FFFFFF] outline-none focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] transition-all text-[#0A192F]" />
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="punto_partida" className="block text-[12px] font-bold uppercase tracking-widest text-[#0A192F] mb-2">Punto de Recogida</label>
              <AddressAutocomplete />
              <p className="text-[12px] text-[#475569] mt-2">Ej: Entrada principal Edificio Titanium</p>
            </div>
            
            <button type="submit" className="w-full h-[56px] bg-[#0A192F] text-white rounded-[8px] text-[14px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-colors shadow-sm flex items-center justify-center gap-2 mt-2">
              Confirmar Reserva <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </button>
            
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] text-center mt-2">Garantía de puntualidad WeShuttle</p>
          </form>
        </div>

        <footer className="mt-12 pt-6 flex flex-col items-center gap-4 text-center">
          <Link href="#" className="text-[14px] font-medium text-[#0A192F] hover:underline">¿Necesita asistencia especial? Contacte a Logística</Link>
          <div className="flex gap-4 text-[12px] text-[#475569]">
            <Link href="#" className="hover:text-[#0A192F]">Términos</Link>
            <span>|</span>
            <Link href="#" className="hover:text-[#0A192F]">Privacidad</Link>
          </div>
        </footer>
      </main>

      {/* NAVEGACIÓN MÓVIL (Bottom Bar estilo App) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[64px] bg-[#FFFFFF] border-t border-[#D8DADC] flex items-center justify-around z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
        <Link href="/" className="flex flex-col items-center justify-center w-full h-full text-[#475569] hover:text-[#0A192F] active:bg-[#F7F9FB]">
          <span className="material-symbols-outlined text-[24px]">home</span>
          <span className="text-[10px] font-bold mt-0.5">Inicio</span>
        </Link>
        <Link href="/mis-viajes" className="flex flex-col items-center justify-center w-full h-full text-[#475569] hover:text-[#0A192F] active:bg-[#F7F9FB]">
          <span className="material-symbols-outlined text-[24px]">directions_bus</span>
          <span className="text-[10px] font-bold mt-0.5">Mis Viajes</span>
        </Link>
        <Link href="/reservar" className="flex flex-col items-center justify-center w-full h-full text-[#0A192F] bg-[#F7F9FB]">
          <span className="material-symbols-outlined text-[24px] font-bold">add_circle</span>
          <span className="text-[10px] font-bold mt-0.5">Reservar</span>
        </Link>
      </div>
    </div>
  )
}
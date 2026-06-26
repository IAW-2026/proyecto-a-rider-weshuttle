import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { fetchPaymentsAppPricing } from '@/lib/api'
import { UserButton } from "@clerk/nextjs"
import { revalidatePath } from 'next/cache'
import AddressAutocomplete from './AddressAutocomplete'
import DateTimeInputs from './DateTimeInputs'
import Navbar from '@/app/ui/Navbar'

export default async function NuevaReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  // 1. Verificamos que el usuario esté autenticado
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  // Procesamos los query params para la pre-selección inteligente
  const params = await searchParams;
  const preselectedDestino = typeof params?.destino_id === 'string' ? params.destino_id : '';

  const isAdmin = sessionClaims?.role === 'admin';

  // 2. Obtenemos datos necesarios para el formulario
  const destinos = await prisma.destination.findMany({ where: { active: true } })

  const notificaciones = userId ? await prisma.passengerNotification.findMany({
    where: { passenger_user_id: userId, read_at: null },
    orderBy: { id: 'desc' }
  }) : []

  // --- SERVER ACTION: Procesar la nueva reserva ---
  async function confirmarReserva(formData: FormData) {
    'use server'
    const destino_id = formData.get('destino_id') as string
    const fecha = formData.get('fecha') as string
    const hora = formData.get('hora') as string
    const punto_partida = formData.get('punto_partida') as string

    // Validación básica de los datos ingresados
    const tieneLetras = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(punto_partida || '');
    if (!destino_id || !fecha || !hora || !punto_partida || punto_partida.trim().length < 5 || !tieneLetras) {
      redirect('/reservar?toast=Error:%20Direccion%20invalida&toastType=error');
    }

    const { userId: actionUserId } = await auth()
    const actionUser = await currentUser()
    if (!actionUserId || !actionUser) return

    // Regla de Negocio: La brecha horaria permitida es desde 24 horas hasta 2 horas antes de la partida.
    const horario = `${fecha}T${hora}`;
    const fechaViaje = new Date(`${horario}-03:00`)
    const ahora = Date.now()
    const dosHorasEnMs = 2 * 60 * 60 * 1000 - (5 * 60 * 1000) // 2h con 5 mins de margen
    const veinticuatroHorasEnMs = 24 * 60 * 60 * 1000

    const minutos = fechaViaje.getMinutes();
    if (minutos !== 0 && minutos !== 30) {
      redirect('/reservar?toast=Error:%20Los%20viajes%20deben%20ser%20en%20punto%20o%20media%20hora&toastType=error');
    }

    if (fechaViaje.getTime() < ahora + dosHorasEnMs || fechaViaje.getTime() > ahora + veinticuatroHorasEnMs) {
      redirect('/reservar?toast=Error:%20Horario%20invalido&toastType=error');
    }

    // Regla de Negocio: Verificar que haya asientos disponibles
    const asientosDisponibles = true; // Simulación
    if (!asientosDisponibles) {
      redirect('/reservar?toast=Error:%20Sin%20asientos%20disponibles&toastType=error');
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

    // Consulta a microservicios externos para cotizar (enviamos lat, lng, destino y ocupación 1 para evitar bug de validación de 0)
    let paymentsData;
    try {
      paymentsData = await fetchPaymentsAppPricing(lat, lng, destino_id, 1)
    } catch (e) {
      console.error("Error cotizando viaje:", e);
      redirect('/reservar?toast=Error:%20No%20se%20pudo%20cotizar%20el%20viaje&toastType=error');
    }

    // Registramos al usuario en nuestra base de datos si es su primera vez
    const defaultFullName = [actionUser?.firstName, actionUser?.lastName].filter(Boolean).join(' ') || 'Pasajero';
    const pasajeroDb = await prisma.passenger.upsert({
      where: { clerk_user_id: actionUserId },
      update: {},
      create: {
        clerk_user_id: actionUserId,
        full_name: defaultFullName,
        phone: "Sin registrar",
      }
    })

    // Regla de Negocio: Usuarios bloqueados no pueden crear nuevas reservas
    if (pasajeroDb.status === 'BLOCKED') {
      redirect('/reservar?toast=Estado%20Pasajero:%20Bloqueado&toastType=error');
    }

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
        reservation_status: 'PENDING_PAYMENT',
        payment_status: 'UNPAID',
        max_price: paymentsData.max_price,
        currency: paymentsData.currency || "ARS",
        pool_id: null // Se asigna recién cuando se procesa el pago exitosamente
      }
    })

    redirect('/mis-viajes?toast=Reserva%20creada%20con%20exito')
  }

  // Calculamos la hora mínima y máxima permitida para el input date
  const ahoraUtc = new Date()
  const minArgConMargen = new Date(ahoraUtc.getTime() - 3 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000)

  // Redondear minArgConMargen hacia arriba al próximo intervalo de 30 minutos (:00 o :30)
  const intervaloMs = 30 * 60 * 1000;
  const minArgRedondeado = new Date(Math.ceil(minArgConMargen.getTime() / intervaloMs) * intervaloMs);

  const minDateTime = minArgRedondeado.toISOString().slice(0, 16)
  const maxArgConMargen = new Date(ahoraUtc.getTime() - 3 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000)
  const maxDateTime = maxArgConMargen.toISOString().slice(0, 16)

  const minDate = minDateTime.slice(0, 10);
  const maxDate = maxDateTime.slice(0, 10);
  const defaultTime = minDateTime.slice(11, 16);
  const maxTime = maxDateTime.slice(11, 16);

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

      <Navbar isAdmin={isAdmin} notificaciones={notificaciones} limpiarNotificaciones={limpiarNotificaciones} />

      <main className="py-[24px] px-[20px] md:px-[40px] max-w-4xl mx-auto pb-24 md:pb-8">

        <div className="w-full bg-[#FFFFFF] p-6 md:p-8 rounded-[12px] border border-[#D8DADC] shadow-sm">
          <header className="mb-6">
            <Link href="/" className="inline-flex items-center gap-1.5 text-[#475569] hover:text-[#0A192F] text-[12px] font-bold uppercase tracking-widest transition-colors mb-3">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span> Volver al Inicio
            </Link>
            <h1 className="text-[28px] font-bold text-[#0A192F] tracking-tight">Reservar Asiento</h1>
            <p className="text-[#475569] text-[14px] mt-1">Complete los detalles para asegurar su lugar en el próximo servicio de WeShuttle.</p>
          </header>

          <form action={confirmarReserva} className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">

              {/* Columna Izquierda: Detalles del Destino y Origen */}
              <div className="space-y-4 flex flex-col justify-start">
                <div>
                  <label htmlFor="destino_id" className="block text-[12px] font-bold uppercase tracking-widest text-[#0A192F] mb-1.5">Destino Final</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]">map</span>
                    <select id="destino_id" name="destino_id" defaultValue={preselectedDestino} required className="w-full min-w-0 h-[50px] pl-10 pr-8 rounded-[8px] border border-[#D8DADC] text-[15px] md:text-[14px] font-semibold bg-[#FFFFFF] outline-none focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] transition-all text-[#0A192F] appearance-none cursor-pointer truncate">
                      <option value="">Seleccione su destino...</option>
                      {destinos.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none">expand_more</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="punto_partida" className="block text-[12px] font-bold uppercase tracking-widest text-[#0A192F] mb-1.5">Punto de Recogida</label>
                  <AddressAutocomplete />
                  <p className="text-[11px] text-[#475569] mt-1.5">Ej: Entrada principal Edificio Titanium</p>
                </div>
              </div>

              {/* Columna Derecha: Selección de Horario Destacada */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 md:p-5 rounded-[12px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-center">
                <DateTimeInputs minDate={minDate} maxDate={maxDate} minTime={defaultTime} maxTime={maxTime} />
              </div>

            </div>

            <div className="pt-4 border-t border-[#E2E8F0] flex flex-col gap-2">
              <button type="submit" className="w-full h-[50px] bg-[#0A192F] text-white rounded-[8px] text-[13px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-all shadow-sm flex items-center justify-center gap-2 hover:scale-[1.005] active:scale-[0.995]">
                Confirmar Reserva <span className="material-symbols-outlined text-[20px]">check_circle</span>
              </button>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] text-center">Garantía de puntualidad WeShuttle</p>
            </div>
          </form>
        </div>

        <footer className="mt-6 pt-4 flex flex-col items-center gap-3 text-center">
          <Link href="#" className="text-[13px] font-medium text-[#0A192F] hover:underline">¿Necesita asistencia especial? Contacte a Logística</Link>
          <div className="flex gap-4 text-[11px] text-[#475569]">
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
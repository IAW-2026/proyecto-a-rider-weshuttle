import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { submitFeedbackMock, getDriverAppAssignedDriverMock, fetchPaymentsAppPricingMock, cancelReservationMock, getFeedbackAppRatingMock, getDriverAppPoolStatusMock } from '@/lib/api'
import { UserButton } from "@clerk/nextjs"

export const dynamic = 'force-dynamic'

export default async function MisViajesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { userId } = await auth()
  const user = await currentUser()
  if (!userId) redirect('/sign-in')
  const isAdmin = user?.emailAddresses[0]?.emailAddress === process.env.ADMIN_EMAIL

  const notificaciones = await prisma.notificacion.findMany({
    where: { clerk_user_id: userId, read_at: null },
    orderBy: { id: 'desc' }
  })

  const ahora = new Date()
  const ITEMS_PER_PAGE = 5 // Mostramos 5 viajes por página en el historial
  
  // Leer el número de página desde la URL (ej: ?page=2)
  const params = await searchParams;
  const pageParam = params?.page;
  const currentPage = Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1
  const skip = (currentPage - 1) * ITEMS_PER_PAGE
  
  // Vemos si en la URL nos pasaron un viaje específico (Modo Detalle)
  const viajeIdParam = typeof params?.viaje_id === 'string' ? params.viaje_id : undefined;
  const fromParam = typeof params?.from === 'string' ? params.from : undefined;

  // 1. VIAJES ACTIVOS O MODO DETALLE
  // Si nos pasan un ID por URL, traemos ese viaje sin importar su estado o fecha.
  const viajesActivos = await prisma.reserva.findMany({
    where: viajeIdParam 
      ? { clerk_user_id: userId, id: viajeIdParam } 
      : { 
          clerk_user_id: userId, 
          estado_reserva: { in: ['PENDING_DRIVER', 'CONFIRMED'] },
          horario: { gte: ahora } 
        },
    include: { destino: true },
    orderBy: { horario: 'asc' }
  })
  
  // 2. HISTORIAL PAGINADO (Buscamos directo en la BD los pasados o cancelados)
  let historial: any[] = [];
  let totalHistorial = 0;

  // Solo cargamos el historial si NO estamos en la "Vista de Detalle"
  if (!viajeIdParam) {
    const [h, t] = await Promise.all([
      prisma.reserva.findMany({ 
        where: {
          clerk_user_id: userId,
          OR: [{ horario: { lt: ahora } }, { estado_reserva: { in: ['CANCELED', 'PAID', 'DENIED'] } }]
        }, 
        include: { destino: true }, 
        orderBy: { horario: 'desc' }, 
        take: ITEMS_PER_PAGE, 
        skip: skip 
      }),
      prisma.reserva.count({ 
        where: {
          clerk_user_id: userId,
          OR: [{ horario: { lt: ahora } }, { estado_reserva: { in: ['CANCELED', 'PAID', 'DENIED'] } }]
        } 
      })
    ])
    historial = h;
    totalHistorial = t;
  }

  const totalPages = Math.ceil(totalHistorial / ITEMS_PER_PAGE)

  // --- SERVER ACTION: Cancelar Reserva ---
  async function cancelarReserva(formData: FormData) {
    'use server'
    // Buscamos el usuario ADENTRO de la acción para que Next.js no se confunda y explote
    const { userId: actionUserId } = await auth()
    const id = formData.get('reserva_id') as string

    // Si el viaje ya tenía combi (pool_id), cumplimos el contrato avisando a la Driver App
    const reserva = await prisma.reserva.findFirst({
      where: { id: id, clerk_user_id: actionUserId || '' }
    })

    if (!reserva) return;
    if (new Date(reserva.horario) < new Date()) {
      throw new Error("No se puede cancelar un viaje que ya expiró.");
    }

    if (reserva?.pool_id) {
      await cancelReservationMock(reserva.pool_id, id)
    }

    // SEGURIDAD: Usamos updateMany para exigir que el id de la reserva coincida con tu usuario
    await prisma.reserva.updateMany({
      where: { id: id, clerk_user_id: actionUserId || '' },
      data: { estado_reserva: 'CANCELED' }
    })
    revalidatePath('/mis-viajes')
  }

  // --- SERVER ACTIONS DE SIMULACIÓN (Dev Mode) --- //
  async function simularConfirmacion(formData: FormData) {
    'use server'
    const id = formData.get('reserva_id') as string

    const reservaCheck = await prisma.reserva.findUnique({ where: { id } })
    if (!reservaCheck || new Date(reservaCheck.horario) < new Date()) {
      throw new Error("El viaje ya expiró y no puede ser confirmado.");
    }

    // Consumimos el mock de la API de la Driver App en lugar de hardcodearlo
    const driverData = await getDriverAppAssignedDriverMock("pool_abc123");
    // Consumimos el mock de la Feedback App para saber las estrellas de ESE conductor
    const ratingData = await getFeedbackAppRatingMock(driverData.driver.driver_user_id);
    // Consumimos Driver App para saber el estado real y oficial de ocupación
    const poolStatusData = await getDriverAppPoolStatusMock("pool_abc123");
    
    const driverSnapshot = {
      nombre: driverData.driver.full_name,
      patente: driverData.vehicle.license_plate,
      vehiculo: `${driverData.vehicle.brand} ${driverData.vehicle.model}`,
      rating: ratingData.average_rating,
      ocupacion: `${poolStatusData.current_passengers}/${poolStatusData.max_capacity}`
    }

    await prisma.reserva.update({
      where: { id },
      data: { 
        estado_reserva: 'CONFIRMED',
        assigned_driver_snapshot: driverSnapshot
      }
    })
    revalidatePath('/mis-viajes')
  }

  async function simularPago(formData: FormData) {
    'use server'
    const id = formData.get('reserva_id') as string
    
    const reservaCheck = await prisma.reserva.findUnique({ where: { id } })
    if (!reservaCheck || new Date(reservaCheck.horario) < new Date()) {
      throw new Error("El viaje ya expiró y no puede ser pagado.");
    }

    // Consumimos el mock de la Payments App para no hardcodear el precio
    const paymentsData = await fetchPaymentsAppPricingMock()

    await prisma.reserva.update({
      where: { id },
      data: { estado_reserva: 'PAID', precio_efectivo: paymentsData.estimated_price } 
    })
    revalidatePath('/mis-viajes')
  }

  // --- SERVER ACTION: Simular Feedback ---
  async function enviarFeedback(formData: FormData) {
    'use server'
    try {
      const id = formData.get('reserva_id') as string
      const { userId: actionUserId } = await auth()
      
      // Si hay internet y todo va bien, guarda la notificación
      if (actionUserId) {
        // Consumimos el Mock de la API externa centralizado
        await submitFeedbackMock(id, actionUserId)

        await prisma.notificacion.create({
          data: { clerk_user_id: actionUserId, tipo: 'REVIEW_SUBMITTED' }
        })
      }
    } catch (error) {
      console.error("No se pudo guardar la notificación (posible error de conexión a internet):", error)
    }
    revalidatePath('/mis-viajes')
  }

  // --- SERVER ACTION: Marcar notificaciones como leídas ---
  async function limpiarNotificaciones() {
    'use server'
    const { userId: actionUserId } = await auth()
    if (actionUserId) {
      await prisma.notificacion.updateMany({
        where: { clerk_user_id: actionUserId, read_at: null },
        data: { read_at: new Date() }
      })
      revalidatePath('/mis-viajes')
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
          <Link href="/mis-viajes" className="text-[#0A192F] font-bold text-[14px] h-full flex items-center border-b-2 border-[#0A192F]">Mis Viajes</Link>
          <Link href="/reservar" className="text-[#4B5563] hover:text-[#0A192F] transition-colors duration-200 font-medium text-[14px] h-full flex items-center border-b-2 border-transparent">Reservar</Link>
        </div>
        <div className="flex items-center gap-4 h-full">
          {/* CAMPANITA DE NOTIFICACIONES */}
          <div className="relative group flex items-center h-full" tabIndex={0}>
            <div className="cursor-pointer text-[#4B5563] hover:text-[#0A192F] transition-colors duration-200 relative flex items-center justify-center p-2 rounded-full hover:bg-[#F7F9FB]">
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              {notificaciones.length > 0 && <span className="absolute top-1 right-1 bg-[#EF4444] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-bounce">{notificaciones.length}</span>}
            </div>
            {/* Menú desplegable con puente invisible */}
            <div className="absolute -right-14 sm:right-0 top-[100%] pt-1 w-[280px] sm:w-72 z-50 hidden group-hover:block group-focus-within:block">
              <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b border-[#D8DADC] flex justify-between items-center bg-[#F7F9FB]">
                  <h3 className="text-[16px] font-semibold text-[#0A192F]">Notificaciones</h3>
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
                        {notif.tipo === 'REVIEW_SUBMITTED' ? '¡Gracias por tu reseña! ⭐ Hemos enviado el feedback al conductor.' : notif.tipo}
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

      <main className="py-[32px] px-[24px] md:px-[48px] max-w-7xl mx-auto pb-24 md:pb-8">
        
        {/* LAYOUT: DOS COLUMNAS DESIGUALES */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* --- SECCIÓN 1: VIAJES ACTIVOS --- */}
          <section className="w-full lg:w-2/3 flex flex-col gap-6">
            
            {/* ENCABEZADO (Alineado adentro de la columna para subir el historial) */}
            <header className="mb-2">
                <Link href={viajeIdParam ? (fromParam === 'home' ? '/' : '/mis-viajes') : "/"} className="inline-flex items-center gap-1.5 text-[#475569] hover:text-[#0A192F] text-[12px] font-bold uppercase tracking-widest transition-colors mb-4">
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span> {viajeIdParam ? (fromParam === 'home' ? 'Volver al Inicio' : 'Volver a Mis Viajes') : 'Volver al Inicio'}
                </Link>
                <h1 className="text-[32px] font-bold text-[#0A192F] tracking-tight">{viajeIdParam ? 'Detalle de Reserva' : 'Mis Viajes'}</h1>
                <p className="text-[#475569] text-[16px] mt-1">{viajeIdParam ? 'Información operativa específica de tu viaje.' : 'Gestión y estado en tiempo real de tus trayectos corporativos.'}</p>
            </header>

          {viajesActivos.map((reserva) => {
            const isPast = new Date(reserva.horario) < ahora;
            return (
            <div key={reserva.id} id={`viaje-${reserva.id}`} className="bg-[#FFFFFF] border border-[#D8DADC] rounded-[12px] shadow-sm flex flex-col md:flex-row scroll-mt-24 overflow-hidden">
              
              {/* PARTE IZQUIERDA: TIMELINE Y DETALLES */}
              <div className="flex-1 p-6 md:p-8 flex flex-col">
                {/* Header de Tarjeta */}
                <div className="flex justify-between items-center mb-6">
                  <p className="text-[12px] font-bold uppercase text-[#475569] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                    {new Date(reserva.horario).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  <span className={`px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border ${
                    reserva.estado_reserva === 'PENDING_DRIVER' ? 'bg-[#F59E0B]/10 text-[#D97706] border-[#F59E0B]/20' :
                    reserva.estado_reserva === 'CONFIRMED' ? 'bg-[#10B981]/10 text-[#059669] border-[#10B981]/20' :
                    reserva.estado_reserva === 'PAID' ? 'bg-[#3B82F6]/10 text-[#2563EB] border-[#3B82F6]/20' :
                    'bg-[#EF4444]/10 text-[#DC2626] border-[#EF4444]/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      reserva.estado_reserva === 'PENDING_DRIVER' ? 'bg-[#F59E0B] animate-pulse' : 
                      reserva.estado_reserva === 'CONFIRMED' ? 'bg-[#10B981]' : 
                      reserva.estado_reserva === 'PAID' ? 'bg-[#3B82F6]' : 
                      'bg-[#EF4444]'
                    }`}></span>
                    {reserva.estado_reserva === 'PENDING_DRIVER' ? 'Buscando Unidad' : reserva.estado_reserva === 'CONFIRMED' ? 'Confirmado' : reserva.estado_reserva === 'PAID' ? 'Abonado' : 'Cancelado'}
                  </span>
                </div>

                {/* Timeline */}
                <div className="relative pl-6 border-l-2 border-dashed border-[#D8DADC] ml-2 mb-8 space-y-8 flex-1">
                  <div className="relative">
                    <span className="absolute -left-[31px] top-1 w-3 h-3 bg-[#FFFFFF] border-[3px] border-[#0A192F] rounded-full"></span>
                    <p className="text-[14px] text-[#475569] font-medium leading-none mb-1">{new Date(reserva.horario).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</p>
                    <h4 className="text-[18px] font-bold text-[#0A192F] leading-tight">{reserva.punto_de_partida}</h4>
                  </div>
                  <div className="relative">
                    <span className="absolute -left-[31px] top-1 w-3 h-3 bg-[#FFFFFF] border-[3px] border-[#10B981] rounded-full"></span>
                    <p className="text-[14px] text-[#475569] font-medium leading-none mb-1">Destino Estimado</p>
                    <h4 className="text-[18px] font-bold text-[#0A192F] leading-tight">{reserva.destino.nombre}</h4>
                  </div>
                </div>

                {/* Fila de Detalles Técnicos */}
                {reserva.assigned_driver_snapshot && (
                  <div className="flex flex-col sm:flex-row gap-4 p-4 bg-[#F7F9FB] rounded-[8px] border border-[#D8DADC]">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] mb-1">Vehículo Asignado</p>
                      <p className="text-[14px] font-semibold text-[#0A192F]">{(reserva.assigned_driver_snapshot as any).vehiculo}</p>
                      <p className="text-[12px] font-mono text-[#475569] mt-0.5">{(reserva.assigned_driver_snapshot as any).patente}</p>
                    </div>
                    <div className="flex-1 sm:border-l border-[#D8DADC] sm:pl-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] mb-1">Ocupación</p>
                      <div className="flex items-center gap-1.5 text-[#0A192F]">
                        <span className="material-symbols-outlined text-[18px]">group</span>
                        <span className="text-[14px] font-bold">{(reserva.assigned_driver_snapshot as any).ocupacion || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PARTE DERECHA: CONDUCTOR Y ACCIONES */}
              <div className="w-full md:w-72 bg-[#F7F9FB] border-t md:border-t-0 md:border-l border-[#D8DADC] p-6 md:p-8 flex flex-col justify-between shrink-0">
                
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] mb-4">Información Operativa</p>
                  {reserva.assigned_driver_snapshot ? (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full border border-[#D8DADC] bg-[#FFFFFF] flex items-center justify-center text-[14px] font-bold text-[#0A192F]">
                        {(reserva.assigned_driver_snapshot as any).nombre.split(' ').map((n: string) => n[0]).join('').substring(0,2)}
                      </div>
                      <div>
                        <h4 className="text-[14px] font-bold text-[#0A192F]">{(reserva.assigned_driver_snapshot as any).nombre}</h4>
                        <p className="text-[12px] font-bold text-[#F59E0B] flex items-center gap-0.5 mt-0.5">
                          <span className="material-symbols-outlined text-[14px] fill-current">star</span> {(reserva.assigned_driver_snapshot as any).rating || '4.0'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[12px] text-[#475569] italic">Asignación pendiente...</div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-[8px] p-3 text-center mb-2 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">{reserva.estado_reserva === 'CANCELED' ? 'Tarifa Anulada' : 'Tarifa Estimada'}</p>
                    <p className={`text-[20px] font-bold mt-0.5 ${reserva.estado_reserva === 'CANCELED' ? 'text-[#475569] line-through decoration-[#EF4444] opacity-70' : 'text-[#0A192F]'}`}>${reserva.precio_maximo?.toLocaleString('es-AR') || '0'}</p>
                  </div>

                  {/* Acciones de Flujo de Negocio */}
                  {!isPast && reserva.estado_reserva === 'PENDING_DRIVER' && (
                    <form action={simularConfirmacion}>
                      <input type="hidden" name="reserva_id" value={reserva.id} />
                      <button type="submit" className="w-full py-2.5 rounded-[8px] border-2 border-[#0A192F] text-[#0A192F] text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F] hover:text-white transition-colors">
                        Simular Asignación
                      </button>
                    </form>
                  )}
                  
                  {!isPast && reserva.estado_reserva === 'CONFIRMED' && (
                    <form action={simularPago}>
                      <input type="hidden" name="reserva_id" value={reserva.id} />
                      <button type="submit" className="w-full py-2.5 rounded-[8px] bg-[#0A192F] text-white text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-colors shadow-sm">
                        Simular Pago
                      </button>
                    </form>
                  )}

                  {!isPast && ['PENDING_DRIVER', 'CONFIRMED'].includes(reserva.estado_reserva) && (
                    <form action={cancelarReserva}>
                      <input type="hidden" name="reserva_id" value={reserva.id} />
                      <button type="submit" className="w-full py-2.5 rounded-[8px] bg-[#EF4444]/10 text-[#DC2626] border border-[#EF4444]/20 text-[12px] font-bold uppercase tracking-widest hover:bg-[#EF4444]/20 transition-colors">
                        Cancelar Viaje
                      </button>
                    </form>
                  )}

                  {isPast && ['PENDING_DRIVER', 'CONFIRMED'].includes(reserva.estado_reserva) && (
                    <div className="bg-[#F7F9FB] border border-[#D8DADC] rounded-[8px] p-3 text-center shadow-sm">
                      <span className="text-[11px] font-bold text-[#EF4444] uppercase tracking-widest">Viaje Expirado</span>
                      <p className="text-[10px] text-[#475569] mt-1 leading-tight">La fecha de partida ya pasó. No se pueden realizar acciones.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
            )
          })}

          {viajesActivos.length === 0 && (
            <div className="bg-[#FFFFFF] p-12 rounded-[12px] border border-[#D8DADC] border-dashed text-center">
              <span className="material-symbols-outlined text-4xl text-[#D8DADC] mb-4 block">directions_bus</span>
              <h3 className="text-[20px] font-bold text-[#0A192F] mb-2">{viajeIdParam ? 'Viaje no encontrado' : 'No tienes viajes activos'}</h3>
              <p className="text-[#475569] text-[14px] mb-6">{viajeIdParam ? 'El detalle de esta reserva no se encuentra disponible.' : 'Aún no has agendado ningún traslado corporativo.'}</p>
              <Link href={viajeIdParam ? (fromParam === 'home' ? '/' : '/mis-viajes') : "/reservar"} className="inline-block bg-[#0A192F] text-white px-6 py-3 rounded-[8px] text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-colors shadow-sm">
                {viajeIdParam ? (fromParam === 'home' ? 'Volver al Inicio' : 'Volver a Mis Viajes') : 'Hacer mi primera reserva'}
              </Link>
            </div>
          )}
          </section>

          {/* --- SECCIÓN 2: HISTORIAL --- */}
          {totalHistorial > 0 && (
            <aside className="w-full lg:w-1/3 flex flex-col gap-4 lg:mt-[44px]">
              <h2 className="text-[20px] font-bold text-[#0A192F] mb-2">Historial Reciente</h2>
              
              <div className="flex flex-col gap-4">
                {historial.map((reserva) => (
                  <div key={reserva.id} className="bg-[#FFFFFF] border border-[#D8DADC] rounded-[12px] p-5 shadow-sm hover:border-[#0A192F]/30 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[12px] font-bold text-[#475569]">{new Date(reserva.horario).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${reserva.estado_reserva === 'PAID' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {reserva.estado_reserva === 'PAID' ? 'Completado' : 'Cancelado'}
                      </span>
                    </div>
                    <h4 className="text-[16px] font-bold text-[#0A192F] mb-4 truncate">{reserva.destino.nombre}</h4>
                    
                    <div className="flex justify-between items-center pt-4 border-t border-[#D8DADC]">
                      {reserva.estado_reserva === 'PAID' ? (
                        <form action={enviarFeedback}>
                          <input type="hidden" name="reserva_id" value={reserva.id} />
                          <button type="submit" className="text-[12px] font-bold text-[#F59E0B] hover:underline flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] fill-current">star</span> Calificar
                          </button>
                        </form>
                      ) : (
                        <span className="text-[12px] text-[#475569]">Sin acciones</span>
                      )}
                      <Link href={`/mis-viajes?viaje_id=${reserva.id}`} className="text-[12px] font-bold text-[#0A192F] hover:underline">Detalles &gt;</Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* CONTROLES DE PAGINACIÓN */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-2 pt-4 border-t border-[#D8DADC]">
                  <span className="text-[12px] text-[#475569] font-medium">Página {currentPage} de {totalPages}</span>
                  <div className="flex gap-2">
                    {currentPage > 1 ? (
                      <Link href={`/mis-viajes?page=${currentPage - 1}`} className="px-3 py-1.5 bg-[#FFFFFF] border border-[#D8DADC] text-[#0A192F] rounded hover:bg-[#F7F9FB] text-[12px] font-bold transition-colors">Anterior</Link>
                    ) : (
                      <span className="px-3 py-1.5 bg-[#F7F9FB] border border-[#D8DADC] text-[#475569] rounded text-[12px] font-bold opacity-50 cursor-not-allowed">Anterior</span>
                    )}
                    {currentPage < totalPages ? (
                      <Link href={`/mis-viajes?page=${currentPage + 1}`} className="px-3 py-1.5 bg-[#FFFFFF] border border-[#D8DADC] text-[#0A192F] rounded hover:bg-[#F7F9FB] text-[12px] font-bold transition-colors">Siguiente</Link>
                    ) : (
                      <span className="px-3 py-1.5 bg-[#F7F9FB] border border-[#D8DADC] text-[#475569] rounded text-[12px] font-bold opacity-50 cursor-not-allowed">Siguiente</span>
                    )}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>

      </main>

      {/* NAVEGACIÓN MÓVIL (Bottom Bar estilo App) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[64px] bg-[#FFFFFF] border-t border-[#D8DADC] flex items-center justify-around z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
        <Link href="/" className="flex flex-col items-center justify-center w-full h-full text-[#475569] hover:text-[#0A192F] active:bg-[#F7F9FB]">
          <span className="material-symbols-outlined text-[24px]">home</span>
          <span className="text-[10px] font-bold mt-0.5">Inicio</span>
        </Link>
        <Link href="/mis-viajes" className="flex flex-col items-center justify-center w-full h-full text-[#0A192F] bg-[#F7F9FB]">
          <span className="material-symbols-outlined text-[24px] font-bold">directions_bus</span>
          <span className="text-[10px] font-bold mt-0.5">Mis Viajes</span>
        </Link>
        <Link href="/reservar" className="flex flex-col items-center justify-center w-full h-full text-[#475569] hover:text-[#0A192F] active:bg-[#F7F9FB]">
          <span className="material-symbols-outlined text-[24px]">add_circle</span>
          <span className="text-[10px] font-bold mt-0.5">Reservar</span>
        </Link>
      </div>
    </div>
  )
}

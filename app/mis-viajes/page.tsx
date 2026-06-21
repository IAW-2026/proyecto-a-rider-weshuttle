import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { createDriverAppPool, getDriverAppAssignedDriver, fetchPaymentsAppPricing, createPaymentsCheckout, cancelReservation, getFeedbackAppRating, searchDriverAppPools, getDriverAppPoolStatus } from '@/lib/api'
import { UserButton } from "@clerk/nextjs"
import TripTracker from './TripTracker'

export const dynamic = 'force-dynamic'

export default async function MisViajesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { userId, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  const isAdmin = sessionClaims?.role === 'admin';

  const notificaciones = await prisma.passengerNotification.findMany({
    where: { passenger_user_id: userId, read_at: null },
    orderBy: { id: 'desc' }
  })

  const ahora = new Date()
  const ITEMS_PER_PAGE = 5

  // Configuración de la paginación
  const params = await searchParams;
  const pageParam = params?.page;
  const currentPage = Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1
  const skip = (currentPage - 1) * ITEMS_PER_PAGE

  const viajeIdParam = typeof params?.viaje_id === 'string' ? params.viaje_id : undefined;
  const fromParam = typeof params?.from === 'string' ? params.from : undefined;
  const tabParam = typeof params?.tab === 'string' ? params.tab : 'proximos';

  // Obtenemos los pool_ids finalizados basados en las notificaciones de feedback recibidas
  const feedbackNotifications = await prisma.passengerNotification.findMany({
    where: {
      passenger_user_id: userId,
      type: 'FEEDBACK_AVAILABLE'
    },
    select: { pool_id: true }
  })
  const completedPoolIds = feedbackNotifications
    .map(n => n.pool_id)
    .filter((id): id is string => typeof id === 'string')

  // Obtenemos los viajes activos del usuario (o el viaje específico del detalle)
  const viajesActivos = await prisma.reservation.findMany({
    where: viajeIdParam
      ? { passenger_user_id: userId, id: viajeIdParam }
      : {
        passenger_user_id: userId,
        reservation_status: { in: ['PENDING_PAYMENT', 'PENDING_DRIVER', 'CONFIRMED'] },
        departure_time: { gte: ahora },
        OR: [
          { pool_id: null },
          { pool_id: { notIn: completedPoolIds } }
        ]
      },
    include: { destination: true },
    orderBy: [
      { departure_time: 'asc' },
      { id: 'asc' }
    ]
  })

  // Obtenemos el estado real en la Driver App para cada viaje activo que posea un pool_id
  const viajesActivosCompletos: any[] = await Promise.all(
    viajesActivos.map(async (reserva) => {
      let poolStatus = 'ASSIGNED';
      if (reserva.pool_id) {
        try {
          const statusData = await getDriverAppPoolStatus(reserva.pool_id);
          poolStatus = statusData.status || 'ASSIGNED';
        } catch (err) {
          console.error(`Error al obtener estado real del pool ${reserva.pool_id}:`, err);
        }
      }
      return {
        ...reserva,
        poolStatus
      };
    })
  );

  // Clasificamos en memoria: si ya se completó o canceló en la Driver App, no va en activos
  // Pero si estamos viendo el detalle de un viaje específico (viajeIdParam está definido), no filtramos nada para poder renderizarlo.
  const viajesActivosConEstado = viajesActivosCompletos.filter(
    viaje => viajeIdParam || !['COMPLETED', 'CANCELED'].includes(viaje.poolStatus)
  );

  const recientementeFinalizados = viajesActivosCompletos.filter(
    viaje => !viajeIdParam && ['COMPLETED', 'CANCELED'].includes(viaje.poolStatus)
  );

  let historial: any[] = [];
  let totalHistorial = 0;

  // Si NO estamos en detalle, cargamos el historial paginado
  if (!viajeIdParam) {
    const [h, t] = await Promise.all([
      prisma.reservation.findMany({
        where: {
          passenger_user_id: userId,
          OR: [
            { departure_time: { lt: ahora } },
            { reservation_status: 'CANCELED' },
            { pool_id: { in: completedPoolIds } }
          ]
        },
        include: { destination: true },
        orderBy: { departure_time: 'desc' },
        take: ITEMS_PER_PAGE,
        skip: skip
      }),
      prisma.reservation.count({
        where: {
          passenger_user_id: userId,
          OR: [
            { departure_time: { lt: ahora } },
            { reservation_status: 'CANCELED' },
            { pool_id: { in: completedPoolIds } }
          ]
        }
      })
    ]);

    // Unimos los viajes recientemente finalizados en memoria con el historial
    const dbHistorialIds = new Set(h.map(item => item.id));
    const finalizadosUnicos = recientementeFinalizados.filter(item => !dbHistorialIds.has(item.id));
    const finalizadosMapeados = finalizadosUnicos.map(item => ({
      ...item,
      reservation_status: item.poolStatus === 'CANCELED' ? 'CANCELED' : 'CONFIRMED'
    }));

    // Combinamos y ordenamos todo de forma descendente por fecha de partida (más recientes primero)
    const combined = [...finalizadosMapeados, ...h];
    historial = combined.sort((a, b) => new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime());
    totalHistorial = t + finalizadosUnicos.length;
  }

  const totalPages = Math.ceil(totalHistorial / ITEMS_PER_PAGE)

  // --- SERVER ACTION: Cancelar Reserva ---
  async function cancelarReserva(formData: FormData) {
    'use server'
    const { userId: actionUserId } = await auth()
    const id = formData.get('reserva_id') as string

    const reserva = await prisma.reservation.findFirst({
      where: { id: id, passenger_user_id: actionUserId || '' }
    })

    // Verificamos que el viaje no haya expirado
    if (!reserva) return;

    if (new Date(reserva.departure_time) < new Date()) {
      redirect(`/mis-viajes?toast=Error:%20Viaje%20Expirado&toastType=error#viaje-${id}`);
    }

    const isLocked = new Date(reserva.departure_time).getTime() - new Date().getTime() <= 60 * 60 * 1000;
    if (isLocked) {
      redirect(`/mis-viajes?toast=Error:%20Pool%20Cerrado&toastType=error#viaje-${id}`);
    }

    // Consultamos el estado real del pool para ver si ya inició o finalizó
    if (reserva?.pool_id) {
      try {
        const statusData = await getDriverAppPoolStatus(reserva.pool_id);
        if (statusData && ['IN_PROGRESS', 'COMPLETED'].includes(statusData.status)) {
          redirect(`/mis-viajes?toast=Error:%20El%20viaje%20ya%20se%20encuentra%20en%20curso%20o%20finalizado&toastType=error#viaje-${id}`);
        }
      } catch (err: any) {
        if (err.digest?.includes('NEXT_REDIRECT') || err.message?.includes('NEXT_REDIRECT')) {
          throw err;
        }
        console.error("Error al verificar estado del pool antes de cancelar:", err);
      }
    }

    // 1. Actualizamos el estado a CANCELED en nuestra base de datos local
    await prisma.reservation.updateMany({
      where: { id: id, passenger_user_id: actionUserId || '' },
      data: { reservation_status: 'CANCELED' }
    })

    // 2. Avisamos a la Driver App que liberamos el asiento
    if (reserva?.pool_id) {
      try {
        await cancelReservation(reserva.pool_id, id)
      } catch (err) {
        console.error("Error al cancelar la reserva en Driver App:", err);
      }
    }

    revalidatePath('/mis-viajes')
    redirect(`/mis-viajes?toast=Viaje%20cancelado&toastType=error#viaje-${id}`)
  }

  async function simularPago(formData: FormData) {
    'use server'
    const id = formData.get('reserva_id') as string

    const reservaCheck = await prisma.reservation.findUnique({ where: { id } })
    if (!reservaCheck || new Date(reservaCheck.departure_time) < new Date()) {
      redirect(`/mis-viajes?toast=Error:%20Viaje%20Expirado&toastType=error#viaje-${id}`);
    }

    // Buscamos o creamos el pool en la Driver App
    let poolId = reservaCheck.pool_id;
    if (!poolId) {
      // 1. Buscamos si ya existe un pool compatible en la Driver App
      try {
        const searchResult = await searchDriverAppPools(reservaCheck.destination_id, reservaCheck.departure_time.toISOString());
        if (searchResult && searchResult.exists && searchResult.pool) {
          poolId = searchResult.pool.pool_id;
        }
      } catch (err) {
        console.error("Error al buscar pools en Driver App:", err);
      }

      // 2. Si no existe, creamos uno nuevo
      if (!poolId) {
        const driverData = await createDriverAppPool(
          reservaCheck.destination_id,
          reservaCheck.departure_time.toISOString(),
          reservaCheck.id,
          reservaCheck.passenger_user_id,
          {
            address: reservaCheck.pickup_address,
            lat: reservaCheck.pickup_lat,
            lng: reservaCheck.pickup_lng
          }
        )
        poolId = driverData.pool_id;
      }

      // Guardamos el pool_id de referencia en nuestra DB
      await prisma.reservation.update({
        where: { id },
        data: { pool_id: poolId }
      })
    }

    // Llamamos a la Payments App para crear el checkout real
    let checkoutData;
    try {
      checkoutData = await createPaymentsCheckout(
        reservaCheck.id,
        poolId!,
        reservaCheck.passenger_user_id,
        reservaCheck.max_price,
        reservaCheck.currency
      )
    } catch (e) {
      console.error("Error creating checkout:", e);
      redirect(`/mis-viajes?toast=Error:%20Servicio%20de%20pagos%20no%20disponible&toastType=error#viaje-${id}`);
    }

    // Redirigimos al pasajero a la URL de pago de la Payments App
    const urlToRedirect = checkoutData?.checkout_url || checkoutData?.payment_url;
    if (urlToRedirect) {
      redirect(urlToRedirect)
    } else {
      redirect(`/mis-viajes?toast=Error:%20No%20se%20pudo%20generar%20el%20link%20de%20pago&toastType=error#viaje-${id}`);
    }
  }

  // --- ACCIÓN: Consultar Asignación desde la Driver App ---
  async function verificarAsignacion(formData: FormData) {
    'use server'
    const id = formData.get('reserva_id') as string

    const reservaCheck = await prisma.reservation.findUnique({ where: { id } })
    if (!reservaCheck) {
      redirect(`/mis-viajes?toast=Error:%20Viaje%20no%20encontrado&toastType=error`);
    }

    const isPast = new Date(reservaCheck.departure_time) < new Date();
    if (isPast || reservaCheck.reservation_status === 'CANCELED') {
      redirect(`/mis-viajes?toast=Error:%20El%20viaje%20ya%20expiró%20o%20fue%20cancelado&toastType=error#viaje-${id}`);
    }

    if (!reservaCheck.pool_id) {
      redirect(`/mis-viajes?toast=Error:%20El%20viaje%20no%20tiene%20un%20pool%20asociado&toastType=error#viaje-${id}`);
    }

    let redirectUrl = '';
    try {
      // Consultamos el conductor asignado real
      const driverData = await getDriverAppAssignedDriver(reservaCheck.pool_id);

      if (!driverData || !driverData.driver) {
        redirectUrl = `/mis-viajes?toast=Aún%20sin%20conductor%20asignado.%20Consultá%20más%20tarde.&toastType=warning#viaje-${id}`;
      } else {
        const ratingData = await getFeedbackAppRating(driverData.driver.driver_user_id);

        // Consultamos la ocupación real del pool
        let currentPassengers = 1;
        let maxCapacity = 15;
        try {
          const statusData = await getDriverAppPoolStatus(reservaCheck.pool_id);
          if (statusData) {
            currentPassengers = statusData.current_passengers || 1;
            maxCapacity = statusData.max_capacity || 15;
          }
        } catch (err) {
          console.error("Error al consultar ocupación del pool:", err);
        }

        // Mapeamos los datos del vehículo de forma robusta por si vienen en castellano u otros formatos
        const v = driverData.vehicle || {};
        const vehicleSnapshot = {
          brand: v.brand || v.marca || '',
          model: v.model || v.modelo || '',
          license_plate: v.license_plate || v.patente || v.plate || v.licensePlate || ''
        };

        // Creamos el "snapshot" de la asignación según el contrato
        const driverSnapshot: any = {
          driver_user_id: driverData.driver.driver_user_id,
          driver_name: driverData.driver.full_name,
          driver_rating: ratingData.average_rating,
          vehicle: vehicleSnapshot,
          current_passengers: currentPassengers,
          max_capacity: maxCapacity
        }

        await prisma.reservation.update({
          where: { id },
          data: {
            reservation_status: 'CONFIRMED',
            assigned_driver_snapshot: driverSnapshot
          }
        })
        revalidatePath('/mis-viajes')
        redirectUrl = `/mis-viajes?toast=Conductor%20confirmado!#viaje-${id}`;
      }
    } catch (e: any) {
      console.error("Error al consultar asignación:", e);
      redirectUrl = `/mis-viajes?toast=Error%20al%20conectar%20con%20Driver%20App&toastType=error#viaje-${id}`;
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

  // --- SERVER ACTION: Limpiar notificaciones ---
  async function limpiarNotificaciones() {
    'use server'
    const { userId: actionUserId } = await auth()
    if (actionUserId) {
      await prisma.passengerNotification.updateMany({
        where: { passenger_user_id: actionUserId, read_at: null },
        data: { read_at: new Date() }
      })
      revalidatePath('/mis-viajes')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB] text-[#0A192F]">

      {/* NAVEGACIÓN SUPERIOR (TopNavBar) */}
      <nav className="bg-[#FFFFFF] h-20 w-full sticky top-0 z-50 border-b border-[#D8DADC] shadow-sm flex items-center justify-center">
        <div className="w-full max-w-5xl mx-auto h-full flex items-center justify-between px-4 md:px-8 relative">
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
              {notificaciones.length > 0 && <span className="absolute top-1 right-1 bg-[#DC2626] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-bounce">{notificaciones.length}</span>}
            </div>
            {/* Menú desplegable con puente invisible */}
            <div className="fixed left-4 right-4 top-[72px] sm:absolute sm:top-[100%] sm:left-auto sm:right-0 sm:w-72 z-50 hidden group-hover:block group-focus-within:block sm:pt-1">
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
                        {notif.type === 'FEEDBACK_AVAILABLE' ? (
                          <a 
                            href={`${process.env.NEXT_PUBLIC_FEEDBACK_APP_URL || '#'}/?return_url=${process.env.NEXT_PUBLIC_RIDER_APP_URL || '#'}`} 
                            className="text-[#3B82F6] hover:underline font-bold block"
                          >
                            {notif.message} <span className="material-symbols-outlined text-[10px] align-middle ml-1">open_in_new</span>
                          </a>
                        ) : (
                          notif.message
                        )}
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
      </div>
    </nav>

    <main className="p-4 md:p-8 max-w-3xl mx-auto pb-24 md:pb-8">

      {/* ENCABEZADO (Alineado arriba, abarcando toda la página) */}
      <header className="mb-8">
        <Link href={viajeIdParam ? (fromParam === 'home' ? '/' : '/mis-viajes') : "/"} className="inline-flex items-center gap-1.5 text-[#475569] hover:text-[#0A192F] text-[12px] font-bold uppercase tracking-widest transition-colors mb-4">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> {viajeIdParam ? (fromParam === 'home' ? 'Volver al Inicio' : 'Volver a Mis Viajes') : 'Volver al Inicio'}
        </Link>
        <h1 className="text-[32px] font-bold text-[#0A192F] tracking-tight">{viajeIdParam ? 'Detalle de Reserva' : 'Mis Viajes'}</h1>
        <p className="text-[#475569] text-[16px] mt-1">{viajeIdParam ? 'Información operativa específica de tu viaje.' : 'Gestión y estado en tiempo real de tus trayectos corporativos.'}</p>
      </header>

      {/* SI ESTAMOS EN LA VISTA DETALLADA */}
      {viajeIdParam ? (
        <div className="flex flex-col gap-6">
          {viajesActivosConEstado.map((reserva) => {
            const isPast = new Date(reserva.departure_time) < ahora;
            const isLocked = new Date(reserva.departure_time).getTime() - ahora.getTime() <= 60 * 60 * 1000 && !isPast;
            return (
              <div key={reserva.id} id={`viaje-${reserva.id}`} className="bg-[#FFFFFF] border border-[#D8DADC] rounded-[12px] shadow-sm flex flex-col md:flex-row scroll-mt-24 overflow-hidden">
                {/* PARTE IZQUIERDA: TIMELINE Y DETALLES */}
                <div className="flex-1 p-6 md:p-8 flex flex-col">
                  {/* Header de Tarjeta */}
                  <div className="flex justify-between items-center mb-6">
                    <p className="text-[12px] font-bold uppercase text-[#475569] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                      {new Date(reserva.departure_time).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </p>
                    <span className={`px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border ${reserva.reservation_status === 'CANCELED' ? 'bg-[#EF4444]/10 text-[#B91C1C] border-[#EF4444]/20' :
                        reserva.payment_status === 'UNPAID' ? 'bg-[#3B82F6]/10 text-[#1D4ED8] border-[#3B82F6]/20' :
                          reserva.reservation_status === 'PENDING_DRIVER' ? 'bg-[#F59E0B]/10 text-[#B45309] border-[#F59E0B]/20' :
                            'bg-[#10B981]/10 text-[#047857] border-[#10B981]/20'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${reserva.reservation_status === 'CANCELED' ? 'bg-[#EF4444]' :
                          reserva.payment_status === 'UNPAID' ? 'bg-[#3B82F6] animate-pulse' :
                            reserva.reservation_status === 'PENDING_DRIVER' ? 'bg-[#F59E0B] animate-pulse' :
                              'bg-[#10B981]'
                        }`}></span>
                      {reserva.reservation_status === 'CANCELED' ? 'Cancelado' : reserva.payment_status === 'UNPAID' ? 'Pago Pendiente' : reserva.reservation_status === 'PENDING_DRIVER' ? 'Buscando Unidad' : 'Confirmado'}
                    </span>
                  </div>

                  {/* Timeline */}
                  <div className="relative pl-6 border-l-2 border-dashed border-[#D8DADC] ml-2 mb-8 space-y-8 flex-1">
                    <div className="relative">
                      <span className="absolute -left-[31px] top-1 w-3 h-3 bg-[#FFFFFF] border-[3px] border-[#0A192F] rounded-full"></span>
                      <p className="text-[14px] text-[#475569] font-medium leading-none mb-1">{new Date(reserva.departure_time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })} hs</p>
                      <h3 className="text-[18px] font-bold text-[#0A192F] leading-tight">{reserva.pickup_address}</h3>
                    </div>
                    {reserva.credit_granted > 0 && (
                      <div className="bg-[#10B981]/10 text-[#047857] px-3 py-2 rounded-[8px] text-[11px] font-bold border border-[#10B981]/20 flex items-center justify-center gap-1.5 mb-2 shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                        Ahorraste: ${reserva.credit_granted}
                      </div>
                    )}
                    <div className="relative">
                      <span className="absolute -left-[31px] top-1 w-3 h-3 bg-[#FFFFFF] border-[3px] border-[#10B981] rounded-full"></span>
                      <p className="text-[14px] text-[#475569] font-medium leading-none mb-1">Destino Estimado</p>
                      <h3 className="text-[18px] font-bold text-[#0A192F] leading-tight">{reserva.destination.name}</h3>
                    </div>
                  </div>

                  {/* Fila de Detalles Técnicos */}
                  {reserva.assigned_driver_snapshot && reserva.reservation_status !== 'CANCELED' && (
                    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-[#F7F9FB] rounded-[8px] border border-[#D8DADC]">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] mb-1">Vehículo Asignado</p>
                        <p className="text-[14px] font-semibold text-[#0A192F]">{`${(reserva.assigned_driver_snapshot as any)?.vehicle?.brand || ''} ${(reserva.assigned_driver_snapshot as any)?.vehicle?.model || ''}`}</p>
                        <p className="text-[12px] font-mono text-[#475569] mt-0.5">{(reserva.assigned_driver_snapshot as any)?.vehicle?.license_plate || ''}</p>
                      </div>
                      <div className="flex-1 sm:border-l border-[#D8DADC] sm:pl-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] mb-1">Ocupación</p>
                        <div className="flex items-center gap-1.5 text-[#0A192F]">
                          <span className="material-symbols-outlined text-[18px]">group</span>
                          <span className="text-[14px] font-bold">
                            {(reserva.assigned_driver_snapshot as any)?.current_passengers && (reserva.assigned_driver_snapshot as any)?.max_capacity
                              ? `${(reserva.assigned_driver_snapshot as any).current_passengers}/${(reserva.assigned_driver_snapshot as any).max_capacity}`
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {reserva.pool_id && ['CONFIRMED', 'PENDING_DRIVER'].includes(reserva.reservation_status) && !(isPast && reserva.reservation_status === 'PENDING_DRIVER') && (
                    <TripTracker 
                      poolId={reserva.pool_id} 
                      passengerUserId={reserva.passenger_user_id} 
                      reservationId={reserva.id}
                    />
                  )}
                </div>

                {/* PARTE DERECHA: CONDUCTOR Y ACCIONES */}
                <div className="w-full md:w-72 bg-[#F7F9FB] border-t md:border-t-0 md:border-l border-[#D8DADC] p-6 md:p-8 flex flex-col justify-between shrink-0">
                  <div className="mb-6">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] mb-4">Información Operativa</p>
                    {reserva.reservation_status === 'CANCELED' ? (
                      <div className="text-[12px] text-[#EF4444] font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">cancel</span>
                        Sin chofer (Viaje Cancelado)
                      </div>
                    ) : reserva.assigned_driver_snapshot ? (
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full border border-[#D8DADC] bg-[#FFFFFF] flex items-center justify-center text-[14px] font-bold text-[#0A192F]">
                          {((reserva.assigned_driver_snapshot as any)?.driver_name || 'NN').split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                        </div>
                        <div>
                          <h3 className="text-[14px] font-bold text-[#0A192F]">{((reserva.assigned_driver_snapshot as any)?.driver_name) || 'Conductor'}</h3>
                          <p className="text-[12px] font-bold text-[#F59E0B] flex items-center gap-0.5 mt-0.5">
                            <span className="material-symbols-outlined text-[14px] fill-current">star</span> {((reserva.assigned_driver_snapshot as any)?.driver_rating) || 'N/A'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[12px] text-[#475569] italic">Asignación pendiente...</div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-[8px] p-3 text-center mb-2 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">{reserva.reservation_status === 'CANCELED' ? 'Tarifa Anulada' : 'Tarifa Máxima'}</p>
                      <p className={`text-[20px] font-bold mt-0.5 ${reserva.reservation_status === 'CANCELED' ? 'text-[#475569] line-through decoration-[#EF4444] opacity-70' : 'text-[#0A192F]'}`}>${reserva.max_price?.toLocaleString('es-AR') || '0'}</p>
                    </div>

                    {!isPast && reserva.payment_status === 'UNPAID' && reserva.reservation_status === 'PENDING_PAYMENT' && (
                      <form action={simularPago}>
                        <input type="hidden" name="reserva_id" value={reserva.id} />
                        <button type="submit" className="w-full py-2.5 rounded-[8px] bg-[#3B82F6] text-white text-[12px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-colors shadow-sm mb-2">
                          Pagar Viaje
                        </button>
                      </form>
                    )}

                    {!isPast && reserva.reservation_status === 'PENDING_DRIVER' && reserva.payment_status === 'PAID' && reserva.poolStatus !== 'CANCELED' && (
                      <form action={verificarAsignacion}>
                        <input type="hidden" name="reserva_id" value={reserva.id} />
                        <button type="submit" className="w-full py-2.5 rounded-[8px] border-2 border-[#0A192F] text-[#0A192F] text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F] hover:text-white transition-colors mb-2">
                          Consultar Asignación
                        </button>
                      </form>
                    )}

                    {!isPast && !isLocked && ['PENDING_PAYMENT', 'PENDING_DRIVER', 'CONFIRMED'].includes(reserva.reservation_status) && !['IN_PROGRESS', 'COMPLETED', 'CANCELED'].includes(reserva.poolStatus) && (
                      <form action={cancelarReserva} id={`cancel-form-${reserva.id}`}>
                        <input type="hidden" name="reserva_id" value={reserva.id} />
                        <button type="submit" className="w-full py-2.5 rounded-[8px] bg-[#EF4444]/10 text-[#DC2626] border border-[#EF4444]/20 text-[12px] font-bold uppercase tracking-widest hover:bg-[#EF4444]/20 transition-colors">
                          Cancelar Viaje
                        </button>
                      </form>
                    )}

                    {isLocked && ['PENDING_PAYMENT', 'PENDING_DRIVER', 'CONFIRMED'].includes(reserva.reservation_status) && (
                      <div className="bg-[#F7F9FB] border border-[#D8DADC] rounded-[8px] p-3 text-center shadow-sm mb-2">
                        <span className="text-[11px] font-bold text-[#F59E0B] uppercase tracking-widest">Pool Cerrado</span>
                        <p className="text-[10px] text-[#475569] mt-1 leading-tight">Falta menos de 1 hora para partir. No se puede cancelar.</p>
                      </div>
                    )}

                    {isPast && reserva.reservation_status === 'CONFIRMED' && (
                      <div className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-[8px] p-3 text-center shadow-sm">
                        <span className="text-[11px] font-bold text-[#047857] uppercase tracking-widest">Viaje Realizado</span>
                        <p className="text-[10px] text-[#047857] mt-1 leading-tight">Este viaje se completó con éxito.</p>
                      </div>
                    )}

                    {isPast && ['PENDING_PAYMENT', 'PENDING_DRIVER'].includes(reserva.reservation_status) && (
                      <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-[8px] p-3 text-center shadow-sm">
                        <span className="text-[11px] font-bold text-[#B91C1C] uppercase tracking-widest">Viaje Expirado</span>
                        <p className="text-[10px] text-[#B91C1C] mt-1 leading-tight">La fecha de partida ya pasó sin completarse la reserva.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {viajesActivosConEstado.length === 0 && (
            <div className="bg-[#FFFFFF] p-12 rounded-[12px] border border-[#D8DADC] border-dashed text-center">
              <span className="material-symbols-outlined text-4xl text-[#D8DADC] mb-4 block">directions_bus</span>
              <h3 className="text-[20px] font-bold text-[#0A192F] mb-2">Viaje no encontrado</h3>
              <p className="text-[#475569] text-[14px] mb-6">El detalle de esta reserva no se encuentra disponible.</p>
              <Link href={fromParam === 'home' ? '/' : '/mis-viajes'} className="inline-block bg-[#0A192F] text-white px-6 py-3 rounded-[8px] text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-colors shadow-sm">
                {fromParam === 'home' ? 'Volver al Inicio' : 'Volver a Mis Viajes'}
              </Link>
            </div>
          )}
        </div>
      ) : (
        /* VISTA PRINCIPAL CON SOLAPAS */
        <div className="flex flex-col gap-6">
          {/* SELECTOR DE SOLAPAS */}
          <div className="flex border-b border-[#D8DADC] mb-2">
            <Link
              href="/mis-viajes?tab=proximos"
              className={`flex-1 py-3 text-center font-bold text-[13px] uppercase tracking-widest border-b-2 transition-all duration-200 ${
                tabParam === 'proximos'
                  ? 'border-[#0A192F] text-[#0A192F]'
                  : 'border-transparent text-[#475569] hover:text-[#0A192F]'
              }`}
            >
              Próximos Viajes ({viajesActivosConEstado.length})
            </Link>
            <Link
              href="/mis-viajes?tab=historial"
              className={`flex-1 py-3 text-center font-bold text-[13px] uppercase tracking-widest border-b-2 transition-all duration-200 ${
                tabParam === 'historial'
                  ? 'border-[#0A192F] text-[#0A192F]'
                  : 'border-transparent text-[#475569] hover:text-[#0A192F]'
              }`}
            >
              Historial de Viajes ({totalHistorial})
            </Link>
          </div>

          {/* CONTENIDO SOLAPA 1: VIAJES ACTIVOS */}
          {tabParam === 'proximos' && (
            <div className="flex flex-col gap-6">
              {viajesActivosConEstado.map((reserva) => {
                const isPast = new Date(reserva.departure_time) < ahora;
                const isLocked = new Date(reserva.departure_time).getTime() - ahora.getTime() <= 60 * 60 * 1000 && !isPast;
                return (
                  <div key={reserva.id} id={`viaje-${reserva.id}`} className="bg-[#FFFFFF] border border-[#D8DADC] rounded-[12px] shadow-sm flex flex-col md:flex-row scroll-mt-24 overflow-hidden">
                    {/* PARTE IZQUIERDA: TIMELINE Y DETALLES */}
                    <div className="flex-1 p-6 md:p-8 flex flex-col">
                      {/* Header de Tarjeta */}
                      <div className="flex justify-between items-center mb-6">
                        <p className="text-[12px] font-bold uppercase text-[#475569] flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                          {new Date(reserva.departure_time).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })}
                        </p>
                        <span className={`px-2.5 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border ${reserva.reservation_status === 'CANCELED' ? 'bg-[#EF4444]/10 text-[#B91C1C] border-[#EF4444]/20' :
                            reserva.payment_status === 'UNPAID' ? 'bg-[#3B82F6]/10 text-[#1D4ED8] border-[#3B82F6]/20' :
                              reserva.reservation_status === 'PENDING_DRIVER' ? 'bg-[#F59E0B]/10 text-[#B45309] border-[#F59E0B]/20' :
                                'bg-[#10B981]/10 text-[#047857] border-[#10B981]/20'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${reserva.reservation_status === 'CANCELED' ? 'bg-[#EF4444]' :
                              reserva.payment_status === 'UNPAID' ? 'bg-[#3B82F6] animate-pulse' :
                                reserva.reservation_status === 'PENDING_DRIVER' ? 'bg-[#F59E0B] animate-pulse' :
                                  'bg-[#10B981]'
                            }`}></span>
                          {reserva.reservation_status === 'CANCELED' ? 'Cancelado' : reserva.payment_status === 'UNPAID' ? 'Pago Pendiente' : reserva.reservation_status === 'PENDING_DRIVER' ? 'Buscando Unidad' : 'Confirmado'}
                        </span>
                      </div>

                      {/* Timeline */}
                      <div className="relative pl-6 border-l-2 border-dashed border-[#D8DADC] ml-2 mb-8 space-y-8 flex-1">
                        <div className="relative">
                          <span className="absolute -left-[31px] top-1 w-3 h-3 bg-[#FFFFFF] border-[3px] border-[#0A192F] rounded-full"></span>
                          <p className="text-[14px] text-[#475569] font-medium leading-none mb-1">{new Date(reserva.departure_time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })} hs</p>
                          <h3 className="text-[18px] font-bold text-[#0A192F] leading-tight">{reserva.pickup_address}</h3>
                        </div>
                        {reserva.credit_granted > 0 && (
                          <div className="bg-[#10B981]/10 text-[#047857] px-3 py-2 rounded-[8px] text-[11px] font-bold border border-[#10B981]/20 flex items-center justify-center gap-1.5 mb-2 shadow-sm">
                            <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                            Ahorraste: ${reserva.credit_granted}
                          </div>
                        )}
                        <div className="relative">
                          <span className="absolute -left-[31px] top-1 w-3 h-3 bg-[#FFFFFF] border-[3px] border-[#10B981] rounded-full"></span>
                          <p className="text-[14px] text-[#475569] font-medium leading-none mb-1">Destino Estimado</p>
                          <h3 className="text-[18px] font-bold text-[#0A192F] leading-tight">{reserva.destination.name}</h3>
                        </div>
                      </div>

                      {/* Fila de Detalles Técnicos */}
                      {reserva.assigned_driver_snapshot && reserva.reservation_status !== 'CANCELED' && (
                        <div className="flex flex-col sm:flex-row gap-4 p-4 bg-[#F7F9FB] rounded-[8px] border border-[#D8DADC]">
                          <div className="flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] mb-1">Vehículo Asignado</p>
                            <p className="text-[14px] font-semibold text-[#0A192F]">{`${(reserva.assigned_driver_snapshot as any)?.vehicle?.brand || ''} ${(reserva.assigned_driver_snapshot as any)?.vehicle?.model || ''}`}</p>
                            <p className="text-[12px] font-mono text-[#475569] mt-0.5">{(reserva.assigned_driver_snapshot as any)?.vehicle?.license_plate || ''}</p>
                          </div>
                          <div className="flex-1 sm:border-l border-[#D8DADC] sm:pl-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] mb-1">Ocupación</p>
                            <div className="flex items-center gap-1.5 text-[#0A192F]">
                              <span className="material-symbols-outlined text-[18px]">group</span>
                              <span className="text-[14px] font-bold">
                                {(reserva.assigned_driver_snapshot as any)?.current_passengers && (reserva.assigned_driver_snapshot as any)?.max_capacity
                                  ? `${(reserva.assigned_driver_snapshot as any).current_passengers}/${(reserva.assigned_driver_snapshot as any).max_capacity}`
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {reserva.pool_id && ['CONFIRMED', 'PENDING_DRIVER'].includes(reserva.reservation_status) && !(isPast && reserva.reservation_status === 'PENDING_DRIVER') && (
                        <TripTracker 
                          poolId={reserva.pool_id} 
                          passengerUserId={reserva.passenger_user_id} 
                          reservationId={reserva.id}
                        />
                      )}
                    </div>

                    {/* PARTE DERECHA: CONDUCTOR Y ACCIONES */}
                    <div className="w-full md:w-72 bg-[#F7F9FB] border-t md:border-t-0 md:border-l border-[#D8DADC] p-6 md:p-8 flex flex-col justify-between shrink-0">
                      <div className="mb-6">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] mb-4">Información Operativa</p>
                        {reserva.reservation_status === 'CANCELED' ? (
                          <div className="text-[12px] text-[#EF4444] font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">cancel</span>
                            Sin chofer (Viaje Cancelado)
                          </div>
                        ) : reserva.assigned_driver_snapshot ? (
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full border border-[#D8DADC] bg-[#FFFFFF] flex items-center justify-center text-[14px] font-bold text-[#0A192F]">
                              {((reserva.assigned_driver_snapshot as any)?.driver_name || 'NN').split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                            </div>
                            <div>
                              <h3 className="text-[14px] font-bold text-[#0A192F]">{((reserva.assigned_driver_snapshot as any)?.driver_name) || 'Conductor'}</h3>
                              <p className="text-[12px] font-bold text-[#F59E0B] flex items-center gap-0.5 mt-0.5">
                                <span className="material-symbols-outlined text-[14px] fill-current">star</span> {((reserva.assigned_driver_snapshot as any)?.driver_rating) || 'N/A'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[12px] text-[#475569] italic">Asignación pendiente...</div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-[8px] p-3 text-center mb-2 shadow-sm">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569]">{reserva.reservation_status === 'CANCELED' ? 'Tarifa Anulada' : 'Tarifa Máxima'}</p>
                          <p className={`text-[20px] font-bold mt-0.5 ${reserva.reservation_status === 'CANCELED' ? 'text-[#475569] line-through decoration-[#EF4444] opacity-70' : 'text-[#0A192F]'}`}>${reserva.max_price?.toLocaleString('es-AR') || '0'}</p>
                        </div>

                        {!isPast && reserva.payment_status === 'UNPAID' && reserva.reservation_status === 'PENDING_PAYMENT' && (
                          <form action={simularPago}>
                            <input type="hidden" name="reserva_id" value={reserva.id} />
                            <button type="submit" className="w-full py-2.5 rounded-[8px] bg-[#3B82F6] text-white text-[12px] font-bold uppercase tracking-widest hover:bg-[#2563EB] transition-colors shadow-sm mb-2">
                              Pagar Viaje
                            </button>
                          </form>
                        )}

                        {!isPast && reserva.reservation_status === 'PENDING_DRIVER' && reserva.payment_status === 'PAID' && reserva.poolStatus !== 'CANCELED' && (
                          <form action={verificarAsignacion}>
                            <input type="hidden" name="reserva_id" value={reserva.id} />
                            <button type="submit" className="w-full py-2.5 rounded-[8px] border-2 border-[#0A192F] text-[#0A192F] text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F] hover:text-white transition-colors mb-2">
                              Consultar Asignación
                            </button>
                          </form>
                        )}

                        {!isPast && !isLocked && ['PENDING_PAYMENT', 'PENDING_DRIVER', 'CONFIRMED'].includes(reserva.reservation_status) && !['IN_PROGRESS', 'COMPLETED', 'CANCELED'].includes(reserva.poolStatus) && (
                          <form action={cancelarReserva} id={`cancel-form-${reserva.id}`}>
                            <input type="hidden" name="reserva_id" value={reserva.id} />
                            <button type="submit" className="w-full py-2.5 rounded-[8px] bg-[#EF4444]/10 text-[#DC2626] border border-[#EF4444]/20 text-[12px] font-bold uppercase tracking-widest hover:bg-[#EF4444]/20 transition-colors">
                              Cancelar Viaje
                            </button>
                          </form>
                        )}

                        {isLocked && ['PENDING_PAYMENT', 'PENDING_DRIVER', 'CONFIRMED'].includes(reserva.reservation_status) && (
                          <div className="bg-[#F7F9FB] border border-[#D8DADC] rounded-[8px] p-3 text-center shadow-sm mb-2">
                            <span className="text-[11px] font-bold text-[#F59E0B] uppercase tracking-widest">Pool Cerrado</span>
                            <p className="text-[10px] text-[#475569] mt-1 leading-tight">Falta menos de 1 hora para partir. No se puede cancelar.</p>
                          </div>
                        )}

                        {isPast && reserva.reservation_status === 'CONFIRMED' && (
                          <div className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-[8px] p-3 text-center shadow-sm">
                            <span className="text-[11px] font-bold text-[#047857] uppercase tracking-widest">Viaje Realizado</span>
                            <p className="text-[10px] text-[#047857] mt-1 leading-tight">Este viaje se completó con éxito.</p>
                          </div>
                        )}

                        {isPast && ['PENDING_PAYMENT', 'PENDING_DRIVER'].includes(reserva.reservation_status) && (
                          <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-[8px] p-3 text-center shadow-sm">
                            <span className="text-[11px] font-bold text-[#B91C1C] uppercase tracking-widest">Viaje Expirado</span>
                            <p className="text-[10px] text-[#B91C1C] mt-1 leading-tight">La fecha de partida ya pasó sin completarse la reserva.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {viajesActivosConEstado.length === 0 && (
                <div className="bg-[#FFFFFF] p-12 rounded-[12px] border border-[#D8DADC] border-dashed text-center">
                  <span className="material-symbols-outlined text-4xl text-[#D8DADC] mb-4 block">directions_bus</span>
                  <h3 className="text-[20px] font-bold text-[#0A192F] mb-2">No tienes viajes activos</h3>
                  <p className="text-[#475569] text-[14px] mb-6">Aún no has agendado ningún traslado corporativo.</p>
                  <Link href="/reservar" className="inline-block bg-[#0A192F] text-white px-6 py-3 rounded-[8px] text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-colors shadow-sm">
                    Hacer mi primera reserva
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* CONTENIDO SOLAPA 2: HISTORIAL */}
          {tabParam === 'historial' && (
            <div className="flex flex-col gap-4">
              {historial.map((reserva) => (
                <div key={reserva.id} className="bg-[#FFFFFF] border border-[#D8DADC] rounded-[12px] p-5 shadow-sm hover:border-[#0A192F]/30 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[12px] font-bold text-[#475569]">
                      {new Date(reserva.departure_time).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).toUpperCase()}
                      {' • '}
                      {new Date(reserva.departure_time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })} hs
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${
                      reserva.reservation_status === 'CANCELED' ? 'text-[#EF4444]' :
                      reserva.reservation_status === 'CONFIRMED' ? 'text-[#10B981]' :
                      'text-[#64748B]'
                    }`}>
                      {reserva.reservation_status === 'CANCELED' ? 'Cancelado' :
                       reserva.reservation_status === 'CONFIRMED' ? 'Completado' :
                       'No realizado'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2.5 mb-4 mt-2">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#475569] mt-0.5 shrink-0">location_on</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] leading-none mb-0.5">Inicio (Recogida)</p>
                        <h4 className="text-[14px] font-semibold text-[#0A192F] truncate">{reserva.pickup_address}</h4>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] text-[#10B981] mt-0.5 shrink-0">map</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#10B981] leading-none mb-0.5">Destino</p>
                        <h4 className="text-[14px] font-semibold text-[#0A192F] truncate">{reserva.destination.name}</h4>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-[#D8DADC]">
                    {reserva.reservation_status === 'CONFIRMED' ? (
                      <Link href={`${process.env.NEXT_PUBLIC_FEEDBACK_APP_URL || '#'}/?return_url=${process.env.NEXT_PUBLIC_RIDER_APP_URL || '#'}`} className="text-[12px] font-bold text-[#F59E0B] hover:underline flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] fill-current">star</span> Calificar
                      </Link>
                    ) : (
                      <span className="text-[12px] text-[#475569]">Sin acciones</span>
                    )}
                    <Link href={`/mis-viajes?viaje_id=${reserva.id}`} className="text-[12px] font-bold text-[#0A192F] hover:underline">Detalles &gt;</Link>
                  </div>
                </div>
              ))}
              
              {historial.length === 0 && (
                <div className="bg-[#FFFFFF] p-12 rounded-[12px] border border-[#D8DADC] border-dashed text-center">
                  <span className="material-symbols-outlined text-4xl text-[#D8DADC] mb-4 block">history</span>
                  <h3 className="text-[20px] font-bold text-[#0A192F] mb-2">Sin viajes pasados</h3>
                  <p className="text-[#475569] text-[14px] mb-6">Aún no registras viajes finalizados en tu historial corporativo.</p>
                </div>
              )}

              {/* CONTROLES DE PAGINACIÓN */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-2 pt-4 border-t border-[#D8DADC]">
                  <span className="text-[12px] text-[#475569] font-medium">Página {currentPage} de {totalPages}</span>
                  <div className="flex gap-2">
                    {currentPage > 1 ? (
                      <Link href={`/mis-viajes?tab=historial&page=${currentPage - 1}`} className="px-3 py-1.5 bg-[#FFFFFF] border border-[#D8DADC] text-[#0A192F] rounded hover:bg-[#F7F9FB] text-[12px] font-bold transition-colors">Anterior</Link>
                    ) : (
                      <span className="px-3 py-1.5 bg-[#F7F9FB] border border-[#D8DADC] text-[#475569] rounded text-[12px] font-bold opacity-50 cursor-not-allowed">Anterior</span>
                    )}
                    {currentPage < totalPages ? (
                      <Link href={`/mis-viajes?tab=historial&page=${currentPage + 1}`} className="px-3 py-1.5 bg-[#FFFFFF] border border-[#D8DADC] text-[#0A192F] rounded hover:bg-[#F7F9FB] text-[12px] font-bold transition-colors">Siguiente</Link>
                    ) : (
                      <span className="px-3 py-1.5 bg-[#F7F9FB] border border-[#D8DADC] text-[#475569] rounded text-[12px] font-bold opacity-50 cursor-not-allowed">Siguiente</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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

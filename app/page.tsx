import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { auth, currentUser } from '@clerk/nextjs/server'
import { UserButton } from "@clerk/nextjs"
import { revalidatePath } from 'next/cache'
import { getUserCreditBalance, getDriverAppPoolStatus } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function VistaPublicaViajes() {
  // Verificamos si hay un usuario logueado
  const { userId, sessionClaims } = await auth()
  const user = await currentUser()
  const isAdmin = sessionClaims?.role === 'admin';

  const notificaciones = userId ? await prisma.passengerNotification.findMany({
    where: { passenger_user_id: userId, read_at: null },
    orderBy: { id: 'desc' }
  }) : []

  // Buscamos el próximo viaje programado del usuario (si está logueado)
  const ahora = new Date()

  // Obtenemos los pool_ids finalizados basados en las notificaciones de feedback recibidas
  const feedbackNotifications = userId ? await prisma.passengerNotification.findMany({
    where: {
      passenger_user_id: userId,
      type: 'FEEDBACK_AVAILABLE'
    },
    select: { pool_id: true }
  }) : []
  const completedPoolIds = feedbackNotifications
    .map(n => n.pool_id)
    .filter((id): id is string => typeof id === 'string')

  const candidateViajes = userId ? await prisma.reservation.findMany({
    where: {
      passenger_user_id: userId,
      reservation_status: { in: ['PENDING_PAYMENT', 'PENDING_DRIVER', 'CONFIRMED'] },
      departure_time: { gte: ahora },
      OR: [
        { pool_id: null },
        { pool_id: { notIn: completedPoolIds } }
      ]
    },
    include: { destination: true },
    orderBy: { departure_time: 'asc' },
    take: 5
  }) : [];

  let proximoViaje: any = null;
  if (userId && candidateViajes.length > 0) {
    for (const viaje of candidateViajes) {
      let poolStatus = 'ASSIGNED';
      if (viaje.pool_id) {
        try {
          const statusData = await getDriverAppPoolStatus(viaje.pool_id);
          poolStatus = statusData.status || 'ASSIGNED';
        } catch (err) {
          console.error(`Error al obtener estado real del pool ${viaje.pool_id}:`, err);
        }
      }
      if (!['COMPLETED', 'CANCELED'].includes(poolStatus)) {
        proximoViaje = viaje;
        break;
      }
    }
  }

  // Contamos cuántos viajes completó el usuario
  const viajesRealizados = userId ? await prisma.reservation.count({
    where: { passenger_user_id: userId, payment_status: 'PAID', reservation_status: { not: 'CANCELED' } }
  }) : 0;

  // Obtenemos el saldo a favor simulando consulta a la Payments App
  const creditData = userId ? await getUserCreditBalance(userId) : { available_credit: 0 };

  // Obtenemos los datos del pasajero en la base de datos para usar su nombre real
  const passenger = userId ? await prisma.passenger.findUnique({
    where: { clerk_user_id: userId }
  }) : null;

  const emailName = user?.emailAddresses[0]?.emailAddress?.split('@')[0];
  const displayName = passenger?.full_name || user?.firstName || emailName || 'Pasajero';

  // --- SERVER ACTION: Marcar notificaciones como leídas ---
  async function limpiarNotificaciones() {
    'use server'
    const { userId: actionUserId } = await auth()
    if (actionUserId) {
      await prisma.passengerNotification.updateMany({
        where: { passenger_user_id: actionUserId, read_at: null },
        data: { read_at: new Date() }
      })
      revalidatePath('/')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB] text-[#0A192F]">
        
      {/* NAVEGACIÓN SUPERIOR (TopNavBar) */}
      <nav className="bg-[#FFFFFF] h-20 w-full sticky top-0 z-50 border-b border-[#D8DADC] shadow-sm flex items-center justify-center">
        <div className="w-full max-w-5xl mx-auto h-full flex items-center justify-between px-4 md:px-8 relative">
          {/* LOGO */}
          <div className="flex items-center">
            <h1 className="text-[24px] font-extrabold italic text-[#0A192F] tracking-tight">WeShuttle</h1>
          </div>

        {/* ENLACES CENTRALES */}
        {userId && (
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center h-full gap-8">
            <Link href="/" className="text-[#0A192F] font-bold text-[14px] h-full flex items-center border-b-2 border-[#0A192F]">Inicio</Link>
            <Link href="/mis-viajes" className="text-[#4B5563] hover:text-[#0A192F] transition-colors duration-200 font-medium text-[14px] h-full flex items-center border-b-2 border-transparent">Mis Viajes</Link>
            <Link href="/reservar" className="text-[#4B5563] hover:text-[#0A192F] transition-colors duration-200 font-medium text-[14px] h-full flex items-center border-b-2 border-transparent">Reservar</Link>
          </div>
        )}

        {/* ACCIONES DE USUARIO */}
        <div className="flex items-center gap-4 h-full">
          {userId ? (
            <>
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
              
              {/* PERFIL */}
              <div className="w-[40px] h-[40px] rounded-full border border-[#D8DADC] flex items-center justify-center overflow-hidden bg-white">
                <UserButton />
              </div>
            </>
          ) : (
            <Link href="/sign-in" className="bg-[#0A192F] text-white px-5 py-2 rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-colors shadow-sm">
              Ingresar
            </Link>
          )}
        </div>
      </div>
    </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main className="p-4 md:p-8 max-w-5xl mx-auto pb-24 md:pb-8">
        
        {/* HEADER WELCOME */}
        <header className="mb-10">
          <h2 className="text-[32px] font-bold text-[#0A192F] mb-2 tracking-tight">Bienvenido/a, {displayName}</h2>
          <p className="text-[#475569] text-[16px] max-w-2xl">Gestiona tus traslados corporativos con precisión y facilidad. Tu asiento asegurado en las mejores unidades.</p>
        </header>

        {/* HERO BANNER - ANCHO COMPLETO */}
        <section className="bg-[#0A192F] text-[#F7F9FB] p-8 md:p-10 rounded-xl shadow-sm flex flex-col items-start text-left justify-center relative overflow-hidden w-full mb-8">
          <span className="material-symbols-outlined absolute -right-10 -bottom-10 text-[180px] opacity-5 pointer-events-none">directions_bus</span>
          <h2 className="text-[32px] font-bold tracking-tight mb-3 relative z-10">¿A dónde viajamos hoy?</h2>
          <p className="text-[16px] text-[#D8DADC] mb-8 max-w-xl leading-relaxed relative z-10">Reserva tu asiento en nuestras combis corporativas con hasta 24hs de anticipación y ahorrá compartiendo el viaje.</p>
          <Link href="/reservar" className="bg-[#FFFFFF] text-[#0A192F] px-8 py-3.5 rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors shadow-sm text-center w-full sm:w-auto relative z-10">
            Agendar traslado
          </Link>
        </section>

        {/* WIDGETS DE USUARIO - GRILA DE 3 COLUMNAS SIMÉTRICA */}
        {userId && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            
            {/* Columna 1: Próximo Viaje o Placeholder */}
            {proximoViaje ? (
              <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-[#0A192F]/30 transition-colors h-full min-h-[220px]">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-widest text-[#475569] mb-3">Tu Próximo Viaje</p>
                  <div className="overflow-hidden">
                    <h3 className="text-[18px] font-bold text-[#0A192F] leading-tight truncate">{proximoViaje.pickup_address}</h3>
                    <h3 className="text-[18px] font-bold text-[#475569] leading-tight truncate">→ {proximoViaje.destination.name}</h3>
                    <p className="text-[13px] text-[#475569] mt-3 flex items-center gap-1.5 font-medium">
                      <span className="material-symbols-outlined text-[16px]">schedule</span> {new Date(proximoViaje.departure_time).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })} hs
                    </p>
                  </div>
                </div>
                <Link href={`/mis-viajes?viaje_id=${proximoViaje.id}&from=home`} className="mt-4 inline-flex items-center justify-center gap-1 text-[#0A192F] text-[12px] font-bold uppercase hover:bg-[#e2e8f0] bg-[#F7F9FB] border border-[#D8DADC] px-4 py-2.5 rounded-lg transition-colors w-full">
                  Ver detalles <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            ) : (
              <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-[#0A192F]/30 transition-colors h-full min-h-[220px]">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-widest text-[#475569] mb-3">Tu Próximo Viaje</p>
                  <div className="flex flex-col items-center text-center py-2">
                    <span className="material-symbols-outlined text-[40px] text-[#94A3B8] mb-2">calendar_today</span>
                    <p className="text-[13px] text-[#475569] font-medium leading-snug">No tenés traslados programados.</p>
                    <p className="text-[11px] text-[#94A3B8] mt-1">Reservá tu próximo viaje corporativo ahora.</p>
                  </div>
                </div>
                <Link href="/reservar" className="mt-4 inline-flex items-center justify-center gap-1 text-white text-[12px] font-bold uppercase hover:bg-[#0A192F]/90 bg-[#0A192F] px-4 py-2.5 rounded-lg transition-all w-full">
                  Agendar Viaje <span className="material-symbols-outlined text-[14px]">add_circle</span>
                </Link>
              </div>
            )}
            
            {/* Columna 2: Estadísticas de Viaje */}
            <div className="flex flex-col gap-4 h-full justify-between">
              <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-xl p-5 shadow-sm hover:border-[#0A192F]/30 transition-colors flex-1 flex flex-col justify-center min-h-[98px]">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] mb-1">Viajes Realizados</p>
                <h3 className="text-[28px] font-bold text-[#0A192F] leading-none">{viajesRealizados.toString().padStart(2, '0')}</h3>
              </div>
              
              <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-xl p-5 shadow-sm hover:border-[#0A192F]/30 transition-colors relative overflow-hidden flex-1 flex flex-col justify-center min-h-[98px]">
                <span className="material-symbols-outlined absolute -bottom-3 -right-2 text-[64px] text-[#10B981] opacity-5">account_balance_wallet</span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#10B981] mb-1">Ahorro a favor</p>
                <h3 className="text-[28px] font-bold text-[#0A192F] leading-none">${creditData.available_credit.toLocaleString('es-AR')}</h3>
              </div>
            </div>

            {/* Columna 3: Mi Cuenta & Accesos */}
            <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-xl p-5 shadow-sm hover:border-[#0A192F]/30 transition-all duration-300 flex flex-col justify-between h-full min-h-[220px]">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-widest text-[#475569] mb-3">Mi Cuenta & Accesos</p>
                <div className="flex flex-col gap-2">
                  <a 
                    href={`${process.env.NEXT_PUBLIC_PAYMENTS_APP_URL || 'https://proyecto-a-payments-weshuttle.vercel.app'}/rider`} 
                    className="flex items-center justify-between p-2 rounded-lg border border-[#D8DADC] hover:bg-[#F7F9FB] transition-colors text-[13px] font-semibold text-[#0A192F]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#10B981]">account_balance_wallet</span>
                      <span>Ver mi Billetera</span>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-[#475569]">chevron_right</span>
                  </a>

                  <a 
                    href={`${process.env.NEXT_PUBLIC_FEEDBACK_APP_URL || 'https://proyecto-a-feedback-weshuttle.vercel.app'}/dashboard/passenger/trips`} 
                    className="flex items-center justify-between p-2 rounded-lg border border-[#D8DADC] hover:bg-[#F7F9FB] transition-colors text-[13px] font-semibold text-[#0A192F]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#F59E0B]">reviews</span>
                      <span>Reseñas Recibidas</span>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-[#475569]">chevron_right</span>
                  </a>

                  <a 
                    href={`${process.env.NEXT_PUBLIC_FEEDBACK_APP_URL || 'https://proyecto-a-feedback-weshuttle.vercel.app'}/dashboard/passenger/sent-reviews`} 
                    className="flex items-center justify-between p-2 rounded-lg border border-[#D8DADC] hover:bg-[#F7F9FB] transition-colors text-[13px] font-semibold text-[#0A192F]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-[#3B82F6]">rate_review</span>
                      <span>Reseñas Enviadas</span>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-[#475569]">chevron_right</span>
                  </a>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* SECCIÓN DE BENEFICIOS / INFO CORPORATIVA */}
        <section className="mt-12 mb-8">
          <div className="mb-6">
            <h3 className="text-[20px] font-bold text-[#0A192F]">La Experiencia WeShuttle</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-xl p-6 shadow-sm flex flex-col items-start cursor-default hover:border-[#0A192F]/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-[#3B82F6]/10 flex items-center justify-center mb-4 text-[#2563EB]">
                <span className="material-symbols-outlined text-[20px]">self_improvement</span>
              </div>
              <h4 className="text-[16px] font-bold text-[#0A192F] mb-2">Viajá en primera clase</h4>
              <p className="text-[13px] text-[#475569] leading-relaxed">Olvidate del estrés de manejar en hora pico. Subite, conectate al Wi-Fi de la unidad y empezá tu jornada laboral relajado/a.</p>
            </div>
            <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-xl p-6 shadow-sm flex flex-col items-start cursor-default hover:border-[#0A192F]/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-[#10B981]/10 flex items-center justify-center mb-4 text-[#059669]">
                <span className="material-symbols-outlined text-[20px]">payments</span>
              </div>
              <h4 className="text-[16px] font-bold text-[#0A192F] mb-2">Economía compartida real</h4>
              <p className="text-[13px] text-[#475569] leading-relaxed">El pool dinámico te premia de verdad. Cuantos más compañeros compartan la ruta, más crédito acumulás a favor para tus siguientes traslados.</p>
            </div>
            <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-xl p-6 shadow-sm flex flex-col items-start cursor-default hover:border-[#0A192F]/30 transition-all duration-300">
              <div className="w-10 h-10 rounded-full bg-[#F59E0B]/10 flex items-center justify-center mb-4 text-[#D97706]">
                <span className="material-symbols-outlined text-[20px]">forest</span>
              </div>
              <h4 className="text-[16px] font-bold text-[#0A192F] mb-2">Sustentabilidad en movimiento</h4>
              <p className="text-[13px] text-[#475569] leading-relaxed">Cada combi llena equivale a retirar hasta 14 autos particulares de los accesos al Polo. Menos embotellamientos, más planeta.</p>
            </div>
          </div>
        </section>

        {/* FOOTER INFORMATIVO */}
        <footer className="mt-16 border-t border-[#D8DADC] pt-8 flex flex-col items-center justify-center text-center gap-2">
          <p className="text-[12px] font-bold text-[#0A192F]">WeShuttle Mobility © 2026</p>
          <div className="flex items-center gap-4 text-[11px] font-medium text-[#475569]">
            <Link href="#" className="hover:text-[#3B82F6] transition-colors">Términos y Condiciones</Link>
            <span>|</span>
            <Link href="#" className="hover:text-[#3B82F6] transition-colors">Preguntas Frecuentes (FAQ)</Link>
            <span>|</span>
            <Link href="#" className="hover:text-[#3B82F6] transition-colors">Soporte B2B</Link>
          </div>
        </footer>

      </main>

      {/* NAVEGACIÓN MÓVIL (Bottom Bar estilo App) */}
      {userId && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-[64px] bg-[#FFFFFF] border-t border-[#D8DADC] flex items-center justify-around z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-safe">
          <Link href="/" className="flex flex-col items-center justify-center w-full h-full text-[#475569] hover:text-[#0A192F] active:bg-[#F7F9FB]">
            <span className="material-symbols-outlined text-[24px]">home</span>
            <span className="text-[10px] font-bold mt-0.5">Inicio</span>
          </Link>
          <Link href="/mis-viajes" className="flex flex-col items-center justify-center w-full h-full text-[#475569] hover:text-[#0A192F] active:bg-[#F7F9FB]">
            <span className="material-symbols-outlined text-[24px]">directions_bus</span>
            <span className="text-[10px] font-bold mt-0.5">Mis Viajes</span>
          </Link>
          <Link href="/reservar" className="flex flex-col items-center justify-center w-full h-full text-[#475569] hover:text-[#0A192F] active:bg-[#F7F9FB]">
            <span className="material-symbols-outlined text-[24px]">add_circle</span>
            <span className="text-[10px] font-bold mt-0.5">Reservar</span>
          </Link>
        </div>
      )}
    </div>
  )
}

import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { auth, currentUser } from '@clerk/nextjs/server'
import { UserButton } from "@clerk/nextjs"
import { revalidatePath } from 'next/cache'

// Esta página NO es estática, se recarga con la base de datos
export const dynamic = 'force-dynamic'

export default async function VistaPublicaViajes() {
  // 1. Traemos los viajes de la tabla Pool
  const viajes = await prisma.pool.findMany({
    where: { estado: { not: 'Cancelado' } },
    orderBy: { id: 'desc' }
  })

  // 2. Verificamos si hay un usuario logueado
  const { userId } = await auth()
  const user = await currentUser()
  const isAdmin = user?.emailAddresses[0]?.emailAddress === process.env.ADMIN_EMAIL

  // 3. Traemos las notificaciones
  const notificaciones = userId ? await prisma.notificacion.findMany({
    where: { clerk_user_id: userId, read_at: null },
    orderBy: { id: 'desc' }
  }) : []

  // 4. Traemos el próximo viaje real y el contador de finalizados
  const ahora = new Date()
  const proximoViaje = userId ? await prisma.reserva.findFirst({
    where: {
      clerk_user_id: userId,
      estado_reserva: { in: ['PENDING_DRIVER', 'CONFIRMED'] },
      horario: { gte: ahora }
    },
    include: { destino: true },
    orderBy: { horario: 'asc' }
  }) : null;

  const viajesRealizados = userId ? await prisma.reserva.count({
    where: { clerk_user_id: userId, estado_reserva: 'PAID' }
  }) : 0;

  const emailName = user?.emailAddresses[0]?.emailAddress?.split('@')[0];
  const displayName = user?.firstName || emailName || 'Pasajero';

  // --- SERVER ACTION: Marcar notificaciones como leídas ---
  async function limpiarNotificaciones() {
    'use server'
    const { userId: actionUserId } = await auth()
    if (actionUserId) {
      await prisma.notificacion.updateMany({
        where: { clerk_user_id: actionUserId, read_at: null },
        data: { read_at: new Date() }
      })
      revalidatePath('/')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB] text-[#0A192F]">
        
      {/* NAVEGACIÓN SUPERIOR (TopNavBar) */}
      <nav className="bg-[#FFFFFF] h-20 w-full flex items-center justify-between px-6 sticky top-0 z-50 border-b border-[#D8DADC] shadow-sm">
        
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
                  {notificaciones.length > 0 && <span className="absolute top-1 right-1 bg-[#EF4444] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-bounce">{notificaciones.length}</span>}
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
              
              {/* PERFIL */}
              <div className="w-[40px] h-[40px] rounded-full border border-[#D8DADC] flex items-center justify-center overflow-hidden bg-white">
                <UserButton />
              </div>
            </>
          ) : (
            <Link href="/sign-in" className="bg-[#0A192F] text-white px-5 py-2 rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-colors shadow-sm">
              Ingreso Personal
            </Link>
          )}
        </div>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main className="p-4 md:p-8 max-w-5xl mx-auto pb-24 md:pb-8">
        
        {/* HEADER WELCOME */}
        <header className="mb-10">
          <h2 className="text-[32px] font-bold text-[#0A192F] mb-2 tracking-tight">Bienvenido/a, {displayName}</h2>
          <p className="text-[#475569] text-[16px] max-w-2xl">Gestiona tus traslados corporativos con precisión y facilidad. Visualiza el estado de la flota en tiempo real.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* HERO BANNER */}
          <section className={`bg-[#0A192F] text-[#F7F9FB] p-8 md:p-10 rounded-lg shadow-sm flex flex-col items-start text-left justify-center ${userId ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <h2 className="text-[32px] font-bold tracking-tight mb-3">¿A dónde viajas hoy?</h2>
            <p className="text-[16px] text-[#D8DADC] mb-8 max-w-xl leading-relaxed">Gestiona tus traslados corporativos con precisión y comodidad. Tu asiento asegurado en las mejores unidades.</p>
            <Link href="/reservar" className="bg-[#FFFFFF] text-[#0A192F] px-8 py-3.5 rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors shadow-sm text-center w-full sm:w-auto">
              Reservar Asiento
            </Link>
          </section>

          {/* WIDGETS DE USUARIO */}
          {userId && (
            <div className="flex flex-col gap-6 lg:col-span-1">
              
              {/* Widget: Próximo Viaje */}
              <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-lg p-6 shadow-sm flex flex-col justify-center hover:border-[#0A192F]/30 transition-colors flex-1">
                <p className="text-[12px] font-bold uppercase tracking-widest text-[#475569] mb-3">Tu Próximo Viaje</p>
                {proximoViaje ? (
                  <div className="flex flex-col gap-3">
                    <div className="overflow-hidden">
                      <h3 className="text-[18px] font-bold text-[#0A192F] leading-tight truncate">{proximoViaje.punto_de_partida}</h3>
                      <h3 className="text-[18px] font-bold text-[#475569] leading-tight truncate">→ {proximoViaje.destino.nombre}</h3>
                      <p className="text-[13px] text-[#475569] mt-3 flex items-center gap-1.5 font-medium">
                        <span className="material-symbols-outlined text-[16px]">schedule</span> {new Date(proximoViaje.horario).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} hs
                      </p>
                    </div>
                  <Link href={`/mis-viajes?viaje_id=${proximoViaje.id}&from=home`} className="mt-1 inline-flex items-center justify-center gap-1 text-[#0A192F] text-[12px] font-bold uppercase hover:bg-[#e2e8f0] bg-[#F7F9FB] border border-[#D8DADC] px-4 py-2.5 rounded-lg transition-colors w-full">
                      Ver detalles <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-[15px] font-medium text-[#475569]">No tenés viajes programados</h3>
                    <Link href="/reservar" className="inline-flex items-center justify-center gap-1 text-[#0A192F] text-[12px] font-bold uppercase hover:bg-[#e2e8f0] bg-[#F7F9FB] border border-[#D8DADC] px-4 py-2.5 rounded-lg transition-colors w-full">
                      Reservar ahora <span className="material-symbols-outlined text-[14px]">add</span>
                    </Link>
                  </div>
                )}
              </div>
              
              {/* Widget: Historial Corto */}
              <div className="bg-[#FFFFFF] border border-[#D8DADC] rounded-lg p-5 shadow-sm flex items-center justify-between hover:border-[#0A192F]/30 transition-colors">
                <p className="text-[12px] font-bold uppercase tracking-widest text-[#475569]">Viajes Completados</p>
                <h3 className="text-[28px] font-bold text-[#0A192F] leading-none">{viajesRealizados.toString().padStart(2, '0')}</h3>
              </div>

            </div>
          )}
        </div>

        {/* SECCIÓN: COMBIS EN REAL-TIME */}
        <div className="mb-6 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[20px] font-bold text-[#0A192F]">Combis en Real-Time</h2>
              <div className="relative group cursor-help flex items-center" tabIndex={0}>
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#D8DADC] text-[#0A192F] text-[10px] font-bold hover:bg-[#D8DADC]/80 transition-colors">?</span>
                <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 sm:absolute sm:top-full sm:left-1/2 sm:-translate-x-1/2 sm:translate-y-0 sm:mt-2 hidden group-hover:block group-focus-within:block w-auto sm:w-72 p-4 bg-[#0A192F] text-[#F7F9FB] text-[12px] font-normal rounded-lg shadow-2xl z-[100] leading-relaxed">
                  Monitor de partidas para pasajeros. Permite identificar tu vehículo asignado y conocer el estado de la flota en tiempo real.
                  <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 bottom-full border-4 border-transparent border-b-[#0A192F]"></div>
                </div>
              </div>
            </div>
            <p className="text-[14px] text-[#475569] mt-1">Monitor de flota activa</p>
          </div>
          <div className="flex items-center gap-2 bg-[#FFFFFF] border border-[#D8DADC] px-3 py-1.5 rounded-lg shadow-sm">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
            </span>
            <span className="text-[10px] font-bold text-[#475569] uppercase tracking-widest">Live</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {viajes.map((viaje) => {
            const iniciales = viaje.conductor_nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'DR';
            return (
              <div key={viaje.id} className="bg-[#FFFFFF] border border-[#D8DADC] rounded-lg p-5 shadow-sm flex flex-col justify-between hover:border-[#0A192F]/40 transition-colors group">
                <div className="flex justify-between items-start mb-5">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    viaje.estado === 'En camino' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 
                    viaje.estado === 'Programado' ? 'bg-[#0A192F]/5 text-[#0A192F] border-[#0A192F]/10' : 
                    viaje.estado === 'Cancelado' ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20' :
                    'bg-[#F7F9FB] text-[#475569] border-[#D8DADC]'
                  }`}>
                    {viaje.estado}
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-[#475569] bg-[#F7F9FB] border border-[#D8DADC] px-2 py-0.5 rounded">{viaje.vehiculo_patente}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#F7F9FB] border border-[#D8DADC] flex items-center justify-center text-[12px] font-bold text-[#0A192F] shrink-0 group-hover:bg-[#0A192F] group-hover:text-white transition-colors">
                    {iniciales}
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-[16px] font-bold text-[#0A192F] truncate">{viaje.conductor_nombre}</h4>
                    <p className="text-[12px] text-[#475569] flex items-center gap-1 mt-0.5 truncate">
                      <span className="material-symbols-outlined text-[14px]">schedule</span> 
                      {viaje.fecha_viaje ? new Date(viaje.fecha_viaje).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' hs' : 'Pronto'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
          
          {viajes.length === 0 && (
            <div className="col-span-full p-12 bg-[#FFFFFF] border border-[#D8DADC] border-dashed rounded-lg text-center">
              <span className="material-symbols-outlined text-4xl text-[#D8DADC] mb-2 block">directions_bus</span>
              <p className="text-[16px] font-bold text-[#0A192F]">No hay unidades activas</p>
              <p className="text-[14px] text-[#475569] mt-1">La flota se encuentra en base por el momento.</p>
            </div>
          )}
        </div>

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

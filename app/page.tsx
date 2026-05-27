import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { auth, currentUser } from '@clerk/nextjs/server'
import { UserButton } from "@clerk/nextjs"
import { revalidatePath } from 'next/cache'

// Esta página NO es estática, se recarga con la base de datos
export const dynamic = 'force-dynamic'

export default async function VistaPublicaViajes() {
  // 1. Traemos los viajes de la tabla Pool (la misma que usa el admin)
  const viajes = await prisma.pool.findMany({
    where: { estado: { not: 'Cancelado' } },
    orderBy: { id: 'desc' }
  })

  // 2. Verificamos si hay un usuario logueado
  const { userId } = await auth()
  const user = await currentUser()
  
  const isAdmin = user?.emailAddresses[0]?.emailAddress === process.env.ADMIN_EMAIL

  // --- NUEVO: Traemos las notificaciones ---
  const notificaciones = userId ? await prisma.notificacion.findMany({
    where: { clerk_user_id: userId, read_at: null },
    orderBy: { id: 'desc' }
  }) : []

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
    <div className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* CABECERA */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black italic">WeShuttle</h1>
            <p className="text-gray-500 text-sm mt-1">Plataforma de reservas y logística</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Si está logueado mostramos el botón de admin, sino el de ingresar */}
            {userId ? (
              <>
                {/* CAMPANITA DE NOTIFICACIONES */}
                <div className="relative group">
                  <div className="bg-white border border-gray-200 p-2.5 rounded-full shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                    🔔 {notificaciones.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-bounce">{notificaciones.length}</span>}
                  </div>
                  {/* Menú desplegable con puente invisible (pt-2) para arreglar el hover */}
                  <div className="absolute right-0 top-full pt-2 w-72 z-50 hidden group-hover:block">
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-sm">Notificaciones</h3>
                        {notificaciones.length > 0 && (
                          <form action={limpiarNotificaciones}>
                            <button type="submit" className="text-[10px] text-blue-600 font-bold uppercase tracking-widest hover:underline">Marcar leídas</button>
                          </form>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2">
                        {notificaciones.length === 0 ? (
                          <p className="p-4 text-center text-xs text-gray-500">No hay avisos nuevos.</p>
                        ) : (
                          notificaciones.map(notif => (
                            <div key={notif.id} className="p-3 mb-1 bg-blue-50 text-blue-800 text-xs rounded-xl">
                              {notif.tipo === 'REVIEW_SUBMITTED' ? '¡Gracias por tu reseña! ⭐ Hemos enviado el feedback al conductor.' : notif.tipo}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <Link href="/admin" className="text-[10px] font-bold uppercase text-blue-600 hover:underline">
                    Panel Admin
                  </Link>
                )}
                <UserButton />
              </>
            ) : (
              <Link href="/sign-in" className="bg-black text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-colors shadow-sm">
                Soy Conductor / Admin
              </Link>
            )}
          </div>
        </header>

        {/* BOTÓN DE ACCIÓN (Solo para usuarios logueados) */}
        {userId && (
          <div className="mb-10 flex flex-col md:flex-row gap-4">
            <Link href="/reservar" className="flex-1 block bg-blue-600 text-white text-center py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all hover:-translate-y-1">
              Reservar Asiento
            </Link>
            <Link href="/mis-viajes" className="flex-1 block bg-white border border-gray-200 text-black text-center py-5 rounded-2xl font-black uppercase tracking-widest shadow-sm hover:bg-gray-50 hover:shadow-md transition-all hover:-translate-y-1">
              Mis Viajes
            </Link>
          </div>
        )}

        {/* TABLA DE VIAJES PÚBLICA */}
        <div className="mb-4 flex items-center gap-2 px-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Estado de las combis en tiempo real</h2>
          <div className="relative group cursor-help flex items-center">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold hover:bg-gray-300 transition-colors">?</span>
            <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-3 bg-gray-800 text-white text-xs rounded-xl shadow-lg z-10 leading-relaxed">
              Monitor de partidas para pasajeros. Permite identificar tu vehículo asignado y conocer el estado de la flota en tiempo real.
              <div className="absolute left-1.5 bottom-full border-4 border-transparent border-b-gray-800"></div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Conductor</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Patente</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Horario</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Estado Actual</th>
              </tr>
            </thead>
            <tbody>
              {viajes.map((viaje) => (
                <tr key={viaje.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="p-6 font-bold text-sm">{viaje.conductor_nombre}</td>
                  <td className="p-6 text-xs text-gray-500 font-mono">{viaje.vehiculo_patente}</td>
                  <td className="p-6 text-sm font-medium">{viaje.fecha_viaje ? new Date(viaje.fecha_viaje).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) + 'hs' : 'Pronto'}</td>
                  <td className="p-6 text-right">
                    <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider ${viaje.estado === 'Programado' ? 'bg-blue-50 text-blue-600' : viaje.estado === 'En camino' ? 'bg-yellow-50 text-yellow-600' : 'bg-gray-100 text-gray-500'}`}>
                      {viaje.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {viajes.length === 0 && (
            <div className="p-20 text-center">
              <p className="text-gray-400 font-medium">No hay viajes programados por el momento.</p>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
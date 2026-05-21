import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { auth, currentUser } from '@clerk/nextjs/server'
import { UserButton } from "@clerk/nextjs"

// Esta página NO es estática, se recarga con la base de datos
export const dynamic = 'force-dynamic'

export default async function VistaPublicaViajes() {
  // 1. Traemos los viajes REALES de la base de datos Neon 
  const viajes = await prisma.pool.findMany({
    orderBy: {
      fecha_viaje: 'asc' // 'asc' muestra primero las combis más próximas a salir
    }
  })

  // 2. Verificamos si hay un usuario logueado
  const { userId } = await auth()
  const user = await currentUser()
  
  const isAdmin = user?.emailAddresses[0]?.emailAddress === process.env.ADMIN_EMAIL

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
              🎟️ Reservar Asiento
            </Link>
            <Link href="/mis-viajes" className="flex-1 block bg-white border border-gray-200 text-black text-center py-5 rounded-2xl font-black uppercase tracking-widest shadow-sm hover:bg-gray-50 hover:shadow-md transition-all hover:-translate-y-1">
              🎫 Mis Viajes
            </Link>
          </div>
        )}

        {/* TABLA DE VIAJES PÚBLICA */}
        <div className="mb-4 flex items-center gap-2 px-2">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Estado de las combis en tiempo real</h2>
          <div className="relative group cursor-help flex items-center">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold hover:bg-gray-300 transition-colors">?</span>
            <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-3 bg-gray-800 text-white text-xs rounded-xl shadow-lg z-10 leading-relaxed">
              Este tablero público funciona como el monitor de partidas de un aeropuerto. Permite a los pasajeros identificar rápidamente su vehículo asignado (patente y conductor) y monitorear el estado de la flota en tiempo real sin requerir autenticación.
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
                  <td className="p-6 text-sm font-medium">{new Date(viaje.fecha_viaje).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}hs</td>
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
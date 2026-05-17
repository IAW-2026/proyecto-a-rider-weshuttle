import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { UserButton } from "@clerk/nextjs"

// Esta página NO es estática, se recarga con la base de datos
export const dynamic = 'force-dynamic'

export default async function VistaPublicaViajes() {
  // 1. Traemos los viajes REALES de la base de datos Neon 
  const viajes = await prisma.pool.findMany({
    orderBy: {
      fecha_viaje: 'desc'
    }
  })

  // 2. Verificamos si hay un usuario logueado
  const { userId } = await auth()

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* CABECERA */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black italic">WeShuttle</h1>
            <p className="text-gray-500 text-sm mt-1">Estado de las combis en tiempo real</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Si está logueado mostramos el botón de admin, sino el de ingresar */}
            {userId ? (
              <>
                <Link href="/admin" className="text-[10px] font-bold uppercase text-blue-600 hover:underline">
                  Panel Admin
                </Link>
                <UserButton />
              </>
            ) : (
              <Link href="/sign-in" className="bg-black text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-colors shadow-sm">
                Soy Conductor / Admin
              </Link>
            )}
          </div>
        </header>

        {/* TABLA DE VIAJES PÚBLICA */}
        <div className="bg-white rounded-[2rem] border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Conductor</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Patente</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Estado Actual</th>
              </tr>
            </thead>
            <tbody>
              {viajes.map((viaje) => (
                <tr key={viaje.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="p-6 font-bold text-sm">{viaje.conductor_nombre}</td>
                  <td className="p-6 text-xs text-gray-500 font-mono">{viaje.vehiculo_patente}</td>
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
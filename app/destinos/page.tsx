import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function GestionDestinos() {
  const { userId } = await auth()
  const user = await currentUser()

  // Seguridad: Misma lógica de mail
  const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase()
  if (email !== 'gulinofranco5@gmail.com') redirect('/')

  // Traemos los destinos reales de Neon
  const destinos = await prisma.destino.findMany()

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <Link href="/admin" className="text-[10px] font-bold uppercase text-blue-600 hover:underline">
            ← Volver al Panel
          </Link>
          <h1 className="text-3xl font-black italic mt-2">Gestionar Destinos</h1>
        </header>

        <div className="bg-white rounded-[2rem] border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Nombre del Destino</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Coordenadas</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {destinos.map((destino) => (
                <tr key={destino.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="p-6 font-bold text-sm">{destino.nombre}</td>
                  <td className="p-6 text-xs text-gray-500 font-mono">{destino.ubicacion_lat_long}</td>
                  <td className="p-6 text-right">
                    <button className="text-[10px] font-black uppercase bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-600 hover:text-white transition-all">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {destinos.length === 0 && (
            <div className="p-20 text-center">
              <p className="text-gray-400 font-medium">No hay destinos cargados en Neon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from "@/lib/prisma"
import { UserGreeting } from "@/app/ui/UserGreeting"
import { DestinoCard } from "@/app/ui/tarjetas/DestinoCard"
import { UserButton } from "@clerk/nextjs"
import type { Destino } from '@prisma/client'

export default async function HomePage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  let destinos: Destino[] = []
  try {
    destinos = await prisma.destino.findMany()
  } catch (error) {
    console.error("Error al traer datos de Neon:", error)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <UserGreeting /> {/* Mantiene la lógica del PDF sin romper el diseño */}

      {/* Header con diseño de perfil en burbuja */}
      <header className="p-6 bg-white border-b border-gray-100 flex justify-between items-center sticky top-0 z-50">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black text-black leading-none">
            We<span className="text-blue-600">Shuttle</span>
          </h1>
          <span className="text-[9px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded mt-2 w-fit border border-gray-200">
            ID: {userId.slice(0, 12)}...
          </span>
        </div>
        
        <div className="flex items-center gap-3 bg-blue-50/80 pl-4 pr-1 py-1 rounded-full border border-blue-100 shadow-sm">
          <div className="text-right">
            <p className="text-[11px] font-bold text-blue-900 leading-none">Mi Cuenta</p>
            <p className="text-[9px] text-blue-600 font-medium">Rider</p>
          </div>
          <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-10 h-10 border-2 border-white' } }} />
        </div>
      </header>

      {/* Cuerpo principal con tarjetas más largas (max-w-2xl) */}
      <main className="p-6 flex-1 w-full max-w-2xl mx-auto mb-24">
        <div className="mb-8">
          <div className="bg-white border border-gray-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm focus-within:border-blue-400 transition-colors">
            <span className="text-lg">🔍</span>
            <input 
              className="bg-transparent border-none outline-none w-full text-sm font-medium text-gray-700" 
              placeholder="¿A dónde vamos hoy?" 
            />
          </div>
        </div>

        <section>
          <div className="flex justify-between items-center mb-6 px-1">
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em]">Destinos Sugeridos</h2>
            <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded">
              {destinos.length} ACTIVOS
            </span>
          </div>
          
          <div className="grid gap-4">
            {destinos.length > 0 ? (
              destinos.map((d) => (
                <div key={d.id} className="w-full transform active:scale-[0.98] transition-transform">
                  <DestinoCard 
                    nombre={d.nombre} 
                    ubicacion_lat_long={d.ubicacion_lat_long} 
                  />
                </div>
              ))
            ) : (
              <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-white/50">
                <p className="text-gray-400 text-sm italic">No hay destinos disponibles.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer con el botón de cuenta funcional */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 p-4 pb-6 flex justify-around items-center z-50">
        <div className="flex flex-col items-center text-blue-600 cursor-pointer">
          <span className="text-2xl">🏠</span>
          <span className="text-[10px] font-bold mt-1">Inicio</span>
        </div>
        <div className="flex flex-col items-center text-gray-300 cursor-pointer">
          <span className="text-2xl">📅</span>
          <span className="text-[10px] font-bold mt-1">Viajes</span>
        </div>
        <div className="flex flex-col items-center group cursor-pointer">
          <div className="relative">
            <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-7 h-7' } }} />
          </div>
          <span className="text-[10px] font-bold text-gray-400 mt-1">Cuenta</span>
        </div>
      </footer>
    </div>
  )
}


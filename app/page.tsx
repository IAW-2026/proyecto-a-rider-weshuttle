import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from "@/lib/prisma"
import { UserGreeting } from "@/app/ui/UserGreeting"
import { DestinoCard } from "@/app/ui/tarjetas/DestinoCard"
import { UserButton } from "@clerk/nextjs"
import Link from 'next/link'

export default async function HomePage() {
  const { userId } = await auth()
  const user = await currentUser()

  if (!userId || !user) redirect('/sign-in')

  const email = user.emailAddresses[0]?.emailAddress?.toLowerCase()
  
  // VALIDACIÓN POR VARIABLE DE ENTORNO
  const isAdminEmail = email === process.env.ADMIN_EMAIL

  // Buscamos en Neon (tabla Pasajero)
  const dbUser = await prisma.pasajero.findUnique({
    where: { clerk_user_id: userId }
  })

  // Traemos los destinos
  const destinos = await prisma.destino.findMany()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <UserGreeting />

      <header className="p-6 bg-white border-b border-gray-100 flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-2xl font-black text-black italic tracking-tighter leading-none">
          We<span className="text-blue-600">Shuttle</span>
        </h1>
        
        <div className="flex items-center gap-3 bg-blue-50/50 pl-4 pr-1 py-1 rounded-full border border-blue-100 shadow-sm">
          <div className="text-right">
            <p className="text-[11px] font-bold text-blue-900 leading-none">{dbUser?.nombre || user.firstName}</p>
            {isAdminEmail ? (
              <Link href="/admin" className="text-[9px] text-blue-600 font-black uppercase tracking-widest hover:text-blue-800 transition-colors">
                Panel Admin 🛠️
              </Link>
            ) : (
              <p className="text-[9px] text-blue-400 font-medium uppercase tracking-tighter">Rider</p>
            )}
          </div>
          <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-10 h-10 border-2 border-white' } }} />
        </div>
      </header>

      <main className="p-6 flex-1 w-full max-w-2xl mx-auto mb-24">
        <div className="mb-10">
          <div className="bg-white border border-gray-200 p-4 rounded-3xl flex items-center gap-3 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <span className="text-lg">🔍</span>
            <input 
              className="bg-transparent border-none outline-none w-full text-sm font-semibold text-gray-700" 
              placeholder="¿A dónde vamos hoy?" 
            />
          </div>
        </div>

        <section>
          <div className="flex justify-between items-center mb-6 px-1">
            <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Destinos Sugeridos</h2>
            <span className="text-[10px] font-black text-green-700 bg-green-100 px-2 py-0.5 rounded uppercase">
              {destinos.length} ACTIVOS
            </span>
          </div>
          
          <div className="grid gap-4">
            {destinos.map((d) => (
              <Link key={d.id} href={`/destino/${d.id}`} className="block transform active:scale-95 transition-transform">
                <DestinoCard nombre={d.nombre} ubicacion_lat_long={d.ubicacion_lat_long} />
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 p-4 pb-8 flex justify-around items-center z-50">
        <Link href="/" className="flex flex-col items-center text-blue-600">
          <span className="text-2xl">🏠</span>
          <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">Inicio</span>
        </Link>
        <div className="flex flex-col items-center text-gray-300">
          <span className="text-2xl">📅</span>
          <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">Viajes</span>
        </div>
        <div className="flex flex-col items-center text-gray-300">
          <span className="text-2xl">👤</span>
          <span className="text-[9px] font-black mt-1 uppercase tracking-tighter">Perfil</span>
        </div>
      </footer>
    </div>
  )
}
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserButton } from "@clerk/nextjs"

export default async function AdminPanel() {
  const { userId } = await auth()
  const user = await currentUser()

  if (!userId || !user) redirect('/sign-in')

  const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase()
  const adminEmails = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase())
  if (!email || !adminEmails.includes(email)) redirect('/')

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-black italic">WeShuttle Control</h1>
            <p className="text-gray-500 text-sm mt-1">Panel de Administrador</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs font-bold text-blue-600 hover:underline">Ir a la App</Link>
            <UserButton />
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Tarjeta Viajes */}
          <div className="bg-white p-8 border border-gray-200 rounded-[3rem] shadow-sm hover:shadow-md transition-all group">
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-green-600 transition-colors">
              🚐
            </div>
            <h3 className="text-xl font-black italic">Logística de Viajes</h3>
            <p className="text-gray-400 text-sm mt-2 mb-8 leading-relaxed">Crear, editar y cancelar viajes.</p>
            <Link href="/viajes" className="block w-full text-center bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl group-hover:bg-green-600 transition-colors">
              Gestionar Viajes
            </Link>
          </div>

          {/* Tarjeta Destinos */}
          <div className="bg-white p-8 border border-gray-200 rounded-[3rem] shadow-sm hover:shadow-md transition-all group">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-blue-600 transition-colors">
              📍
            </div>
            <h3 className="text-xl font-black italic">Gestión de Destinos</h3>
            <p className="text-gray-400 text-sm mt-2 mb-8 leading-relaxed">Actualizar nombres y coordenadas de las paradas.</p>
            <Link href="/destinos" className="block w-full text-center bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] py-4 rounded-2xl group-hover:bg-blue-600 transition-colors">
              Gestionar Destinos
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
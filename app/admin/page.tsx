import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'

function getUserEmail(user: Awaited<ReturnType<typeof currentUser>>) {
  return (
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() ??
    user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() ??
    null
  )
}

export default async function Page() {
  const { userId } = await auth()
  const user = await currentUser()

  if (!userId || !user) redirect('/sign-in')

  const email = getUserEmail(user)
  
  // LISTA DE ADMINS DESDE VARIABLE DE ENTORNO
  const adminEmails = (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
  
  const isAdminEmail = email ? adminEmails.includes(email) : false

  let dbUser = await prisma.pasajero.findUnique({ where: { clerk_user_id: userId } })

  if (!dbUser) {
    dbUser = await prisma.pasajero.create({
      data: {
        clerk_user_id: userId,
        email: email ?? undefined,
        nombre: user.firstName || 'Usuario',
        rol: isAdminEmail ? 'ADMIN' : 'RIDER'
      }
    })
  } else if (dbUser.rol !== (isAdminEmail ? 'ADMIN' : 'RIDER')) {
    dbUser = await prisma.pasajero.update({
      where: { clerk_user_id: userId },
      data: { rol: isAdminEmail ? 'ADMIN' : 'RIDER' }
    })
  }

  // BLOQUEO DE SEGURIDAD
  if (dbUser.rol !== 'ADMIN') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col gap-6 mb-12 border-b border-gray-200 pb-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tighter italic">
              WeShuttle <span className="text-blue-600">Control</span>
            </h1>
            <p className="text-gray-500 text-sm">Bienvenido, {dbUser.nombre}</p>
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">
              Rol: {dbUser.rol} · Email: {email ?? 'Sin email'}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="text-xs font-bold bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm">
              ← Volver al inicio
            </Link>
            <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-10 h-10 border-2 border-white' } }} />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 border border-gray-200 rounded-[3rem] shadow-sm hover:shadow-md transition-all group">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:bg-blue-600 transition-colors text-blue-600 group-hover:text-white">
              📍
            </div>
            <h3 className="text-xl font-black italic">Gestionar Destinos</h3>
            <p className="text-gray-400 text-sm mt-2 mb-8 leading-relaxed">
              Panel de administración para la gestión de paradas y destinos.
            </p>
            <Link href="/admin/destinos" className="block w-full text-center bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] py-5 rounded-2xl group-hover:bg-blue-600 transition-colors">
              Abrir CRUD
            </Link>
          </div>

          <div className="bg-white p-8 border border-gray-200 rounded-[3rem] opacity-40 flex flex-col justify-center items-center text-center">
            <span className="text-4xl mb-4">🚐</span>
            <h3 className="text-lg font-bold">Logística de Viajes</h3>
            <p className="text-gray-400 text-[10px] uppercase font-bold tracking-tighter">Próximamente</p>
          </div>
        </div>
      </div>
    </div>
  )
}

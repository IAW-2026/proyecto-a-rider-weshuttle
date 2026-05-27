import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { Button } from '@/app/ui/botones/Button'
import { getDriverAppAssignedDriverMock } from '@/lib/api'

  // --- SERVER ACTIONS PARA EL CRUD --- //

  // CREATE (Crear consumiendo API)
  async function crearViajeAPI() {
    'use server'
    
    // SEGURIDAD: Verificamos que sea Admin
    const { userId: actionUserId } = await auth()
    const actionUser = await currentUser()
    const actionEmail = actionUser?.emailAddresses[0]?.emailAddress?.toLowerCase()
    const adminEmailsList = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase())
    if (!actionUserId || !actionEmail || !adminEmailsList.includes(actionEmail)) {
      throw new Error("Acceso denegado. Solo administradores.")
    }

    const data = await getDriverAppAssignedDriverMock("pool_mock_123");

    await prisma.pool.create({
      data: {
        conductor_nombre: data.driver.full_name,
        vehiculo_patente: `${data.vehicle.model} - ${data.vehicle.license_plate}`,
        estado: 'Programado'
      }
    })
    revalidatePath('/viajes') 
  }

  // UPDATE (Actualizar estado)
  async function actualizarEstado(formData: FormData) {
    'use server'
    
    // SEGURIDAD: Verificamos que sea Admin
    const { userId: actionUserId } = await auth()
    const actionUser = await currentUser()
    const actionEmail = actionUser?.emailAddresses[0]?.emailAddress?.toLowerCase()
    const adminEmailsList = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase())
    if (!actionUserId || !actionEmail || !adminEmailsList.includes(actionEmail)) {
      throw new Error("Acceso denegado. Solo administradores.")
    }

    const id = formData.get('id') as string
    const estado = formData.get('estado') as string
    
    await prisma.pool.update({
      where: { id },
      data: { estado }
    })
    revalidatePath('/viajes')
  }

  // DELETE LÓGICO (Cancelar)
  async function cancelarViaje(formData: FormData) {
    'use server'
    
    // SEGURIDAD: Verificamos que sea Admin
    const { userId: actionUserId } = await auth()
    const actionUser = await currentUser()
    const actionEmail = actionUser?.emailAddresses[0]?.emailAddress?.toLowerCase()
    const adminEmailsList = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase())
    if (!actionUserId || !actionEmail || !adminEmailsList.includes(actionEmail)) {
      throw new Error("Acceso denegado. Solo administradores.")
    }

    const id = formData.get('id') as string
    
    await prisma.pool.update({
      where: { id },
      data: { estado: 'Cancelado' }
    })
    revalidatePath('/viajes')
  }

export default async function GestionViajes({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { userId } = await auth()
  const user = await currentUser()

  // Seguridad
  const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase()
  const adminEmails = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase())
  if (!email || !adminEmails.includes(email)) redirect('/')

  // Leemos el buscador de URL
  const params = await searchParams;
  const query = typeof params?.query === 'string' ? params.query : '';

  // READ (Leer listado con filtro)
  const viajes = await prisma.pool.findMany({
    where: {
      estado: {
        contains: query,
        mode: 'insensitive'
      }
    },
    orderBy: {
      fecha_viaje: 'desc'
    }
  })

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <Link href="/admin" className="text-[10px] font-bold uppercase text-green-600 hover:underline">
            ← Volver al Panel
          </Link>
          <h1 className="text-3xl font-black italic mt-2">Logística de Viajes (CRUD)</h1>
          <p className="text-gray-500 text-sm mt-1">Administrá las combis y los estados.</p>
        </header>

        {/* FORMULARIO CREATE CON API */}
        <div className="bg-white p-6 rounded-[2rem] border border-gray-200 mb-8 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-800 mb-2">Asignar Viaje (API Mock)</h2>
            <p className="text-xs text-gray-500 max-w-lg leading-relaxed">
              Crea un viaje y simula la asignación de un conductor consumiendo la API de la <b>Driver App</b>.
            </p>
          </div>
          <form action={crearViajeAPI}>
            <Button type="submit" variant="violet" size="lg" className="py-4 w-full sm:w-auto">
              Sincronizar Viaje
            </Button>
          </form>
        </div>

        {/* BUSCADOR (Filtro por URL) */}
        <form method="GET" className="mb-6 flex gap-2">
          <input 
            type="text" 
            name="query" 
            defaultValue={query}
            placeholder="Filtrar por estado (Programado, En camino, Finalizado)..." 
            className="flex-1 p-4 rounded-xl border border-gray-200 text-sm font-bold outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all shadow-sm"
          />
          <Button type="submit" variant="primary" size="lg" className="hover:bg-green-600">
            Buscar
          </Button>
          {query && (
            <Link href="/viajes" className="bg-red-50 text-red-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shadow-sm">
              Limpiar
            </Link>
          )}
        </form>

        {/* TABLA (Read, Update, Delete) */}
        <div className="bg-white rounded-[2rem] border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Conductor / Patente</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest">Estado (Update)</th>
                <th className="p-6 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Acción (Cancelar)</th>
              </tr>
            </thead>
            <tbody>
              {viajes.map((viaje) => (
                <tr key={viaje.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="p-6">
                    <p className="font-bold text-sm">{viaje.conductor_nombre}</p>
                    <p className="text-xs text-gray-500 font-mono mt-1">{viaje.vehiculo_patente}</p>
                  </td>
                  <td className="p-6">
                    <form action={actualizarEstado} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={viaje.id} />
                      <select name="estado" defaultValue={viaje.estado} className="p-2 rounded-lg border border-gray-200 text-xs font-bold bg-gray-50 outline-none focus:border-green-500">
                        <option value="Programado">Programado</option>
                        <option value="En camino">En camino</option>
                        <option value="Finalizado">Finalizado</option>
                      </select>
                      <Button type="submit" variant="primary" size="sm">
                        Guardar
                      </Button>
                    </form>
                  </td>
                  <td className="p-6 text-right">
                    <form action={cancelarViaje}>
                      <input type="hidden" name="id" value={viaje.id} />
                      <Button type="submit" variant="red" size="md" disabled={viaje.estado === 'Cancelado'}>
                        Cancelar
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {viajes.length === 0 && (
            <div className="p-20 text-center">
              <p className="text-gray-400 font-medium">No hay viajes cargados. ¡Creá el primero arriba!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

// --- SERVER ACTIONS --- //
async function actualizarDestino(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const nombre = formData.get('nombre') as string
  const ubicacion_lat_long = formData.get('ubicacion') as string

  await prisma.destino.update({
    where: { id },
    data: { nombre, ubicacion_lat_long }
  })
  revalidatePath('/destinos')
}

export default async function GestionDestinos({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>
}) {
  const { userId } = await auth()
  const user = await currentUser()

  // Seguridad: Misma lógica de mail
  const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase()
  
  // Leemos el mail desde la variable de entorno
  const adminEmails = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase())
  if (!email || !adminEmails.includes(email)) redirect('/')

  // Leemos lo que dice la URL (ej: ?query=facultad)
  const params = await searchParams;
  const query = params.query || '';

  // Traemos los destinos reales de Neon
  const destinos = await prisma.destino.findMany({
    where: {
      nombre: {
        contains: query,
        mode: 'insensitive' // Para que no le importe mayúsculas/minúsculas
      }
    }
  })

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <Link href="/admin" className="text-[10px] font-bold uppercase text-blue-600 hover:underline">
            ← Volver al Panel
          </Link>
          <h1 className="text-3xl font-black italic mt-2">Gestionar Destinos</h1>
        </header>

        {/* Buscador por URL */}
        <form method="GET" className="mb-6 flex gap-2">
          <input 
            type="text" 
            name="query" 
            defaultValue={query}
            placeholder="Buscar destino por nombre..." 
            className="flex-1 p-4 rounded-xl border border-gray-200 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          />
          <button type="submit" className="bg-black text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-sm">
            Buscar
          </button>
          {query && (
            <Link href="/destinos" className="bg-red-50 text-red-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center shadow-sm">
              Limpiar
            </Link>
          )}
        </form>

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
                  <td className="p-4">
                    <form id={`form-${destino.id}`} action={actualizarDestino} className="hidden">
                      <input type="hidden" name="id" value={destino.id} />
                    </form>
                    <input form={`form-${destino.id}`} name="nombre" defaultValue={destino.nombre} className="w-full p-3 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500" required />
                  </td>
                  <td className="p-4">
                    <input form={`form-${destino.id}`} name="ubicacion" defaultValue={destino.ubicacion_lat_long} className="w-full p-3 border border-gray-200 rounded-xl text-xs font-mono outline-none focus:border-blue-500" required />
                  </td>
                  <td className="p-4 text-right">
                    <button form={`form-${destino.id}`} type="submit" className="text-[10px] font-black uppercase bg-blue-50 text-blue-600 px-4 py-3 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                      Guardar
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
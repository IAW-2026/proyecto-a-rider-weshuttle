import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { UserButton } from "@clerk/nextjs"

export const dynamic = 'force-dynamic'

// --- SERVER ACTIONS PARA EL CRUD --- //

async function actualizarDestino(formData: FormData) {
  'use server'

  const { userId } = await auth()
  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase() ?? '';
  const adminEmails = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase());

  if (!email || !adminEmails.includes(email)) {
    throw new Error("Acceso denegado. Solo los administradores pueden modificar destinos.")
  }

  const id = formData.get('id') as string
  const nombre = formData.get('nombre') as string
  const ubicacion_lat_long = formData.get('ubicacion') as string

  if (!id || !nombre || !ubicacion_lat_long || nombre.trim().length < 3) {
    throw new Error("Datos inválidos. El nombre del destino y su ubicación son obligatorios.")
  }

  await prisma.destination.update({
    where: { id },
    data: { name: nombre, address: ubicacion_lat_long, lat: 0, lng: 0 }
  })
  revalidatePath('/admin')
}

export default async function GestionViajes({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { userId } = await auth()
  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase() ?? '';
  const adminEmails = (process.env.ADMIN_EMAIL ?? '').split(',').map(item => item.trim().toLowerCase());
  
  if (!email || !adminEmails.includes(email)) redirect('/')

  const params = await searchParams;
  const query = typeof params?.query === 'string' ? params.query : '';

  const destinos = await prisma.destination.findMany({
    where: { name: { contains: query, mode: 'insensitive' } },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="flex h-screen bg-[#F7F9FB] text-[#0A192F] overflow-hidden">
      
      <aside className="w-[260px] bg-[#FFFFFF] border-r border-[#D8DADC] hidden lg:flex flex-col justify-between shrink-0 h-full">
        <div>
          <div className="h-20 flex items-center px-6 border-b border-[#D8DADC]">
            <span className="text-[24px] font-extrabold italic text-[#0A192F] tracking-tight">WeShuttle</span>
            <span className="ml-2 px-2 py-0.5 bg-[#3B82F6]/10 text-[#2563EB] text-[10px] font-bold uppercase tracking-widest rounded border border-[#3B82F6]/20">Admin</span>
          </div>
          <nav className="p-4 flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#475569] mb-2 px-2 mt-2">Menú Principal</p>
            <Link href="/admin" className={`flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-bold transition-all bg-[#0A192F] text-[#FFFFFF] shadow-sm`}>
              <span className="material-symbols-outlined text-[20px]">map</span> Gestión Destinos
            </Link>
          </nav>
        </div>
        <div className="p-4 border-t border-[#D8DADC] bg-[#F7F9FB]/50">
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 text-[#475569] hover:text-[#0A192F] hover:bg-[#E2E8F0] rounded-[8px] text-[13px] font-bold transition-all mb-4 border border-[#D8DADC] bg-white shadow-sm">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span> Volver a la App
          </Link>
          <div className="flex items-center gap-3 px-3">
            <div className="w-[32px] h-[32px] rounded-full border border-[#D8DADC] bg-white flex items-center justify-center overflow-hidden shrink-0">
              <UserButton />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[12px] font-bold text-[#0A192F] leading-tight truncate">Administrador</span>
              <span className="text-[10px] text-[#475569] truncate">WeShuttle Operaciones</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-10 lg:p-12">
        
        <div className="lg:hidden flex justify-between items-center mb-8 border-b border-[#D8DADC] pb-4">
          <h1 className="text-[20px] font-extrabold italic text-[#0A192F]">WeShuttle <span className="text-[#3B82F6] text-[14px]">Admin</span></h1>
          <Link href="/" className="text-[#475569] hover:text-[#0A192F] text-[12px] font-bold uppercase tracking-widest">Volver</Link>
        </div>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-[32px] font-bold text-[#0A192F] tracking-tight">Gestión de Destinos</h2>
            <p className="text-[#475569] text-[16px] mt-1">Busque y edite las locaciones disponibles para los usuarios.</p>
          </div>
        </header>

        <form method="GET" className="mb-8 flex gap-2 w-full max-w-xl">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] text-[20px]">search</span>
            <input type="text" name="query" defaultValue={query} placeholder="Buscar destino por nombre..." className="w-full pl-10 pr-3 py-3 border border-[#D8DADC] rounded-[8px] text-[14px] focus:outline-none focus:border-[#0A192F] text-[#0A192F] bg-[#FFFFFF] shadow-sm" />
          </div>
          <button type="submit" className="bg-[#0A192F] text-white px-6 py-3 rounded-[8px] text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-all shadow-sm">
            Buscar
          </button>
          {query && (
            <Link href="/admin" className="bg-[#EF4444]/10 text-[#DC2626] border border-[#EF4444]/20 px-4 py-3 rounded-[8px] text-[12px] font-bold uppercase tracking-widest hover:bg-[#EF4444]/20 transition-colors flex items-center justify-center">
              Limpiar
            </Link>
          )}
        </form>
          
        <div className="bg-[#FFFFFF] rounded-[12px] border border-[#D8DADC] shadow-sm flex flex-col overflow-hidden mb-12">
          <div className="p-6 border-b border-[#D8DADC] bg-[#F7F9FB]">
            <h3 className="text-[16px] font-bold text-[#0A192F]">Base de Datos de Locaciones</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-[#FFFFFF] border-b border-[#D8DADC]">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#475569]">Nombre del Destino</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#475569]">Coordenadas / URL</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#475569] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DADC]">
                {destinos.map((destino) => (
                  <tr key={destino.id} className="hover:bg-[#F7F9FB] transition-colors">
                    <td className="px-6 py-4">
                      <form id={`form-${destino.id}`} action={actualizarDestino} className="hidden">
                        <input type="hidden" name="id" value={destino.id} />
                      </form>
                      <input form={`form-${destino.id}`} name="nombre" defaultValue={destino.name} className="w-full px-3 py-2 border border-[#D8DADC] rounded-[6px] text-[13px] font-semibold text-[#0A192F] focus:outline-none focus:border-[#0A192F]" required />
                    </td>
                    <td className="px-6 py-4">
                      <input form={`form-${destino.id}`} name="ubicacion" defaultValue={destino.address} className="w-full px-3 py-2 border border-[#D8DADC] rounded-[6px] text-[12px] font-mono text-[#475569] focus:outline-none focus:border-[#0A192F]" required />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button form={`form-${destino.id}`} type="submit" className="text-[#3B82F6] hover:text-[#2563EB] bg-[#3B82F6]/10 px-4 py-2 rounded-[6px] text-[11px] font-bold uppercase tracking-widest hover:bg-[#3B82F6]/20 transition-colors shadow-sm">
                        Guardar
                      </button>
                    </td>
                  </tr>
                ))}
                {destinos.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-12 text-center">
                      <span className="material-symbols-outlined text-4xl text-[#D8DADC] mb-2 block">wrong_location</span>
                      <p className="text-[#475569] text-[14px]">No se encontraron destinos cargados en la base de datos.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
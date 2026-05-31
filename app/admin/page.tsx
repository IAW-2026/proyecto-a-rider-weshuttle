import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { getDriverAppAssignedDriverMock } from '@/lib/api'
import { UserButton } from "@clerk/nextjs"

export const dynamic = 'force-dynamic'

// --- SERVER ACTIONS PARA EL CRUD --- //

async function actualizarDestino(formData: FormData) {
  'use server'

  const { userId } = await auth()
  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase()
  const adminEmails = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase())
  if (!userId || !email || !adminEmails.includes(email)) {
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

async function crearViajeAPI() {
  'use server'
  
  const { userId: actionUserId } = await auth()
  const actionUser = await currentUser()
  const actionEmail = actionUser?.emailAddresses[0]?.emailAddress?.toLowerCase()
  const adminEmailsList = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase())
  if (!actionUserId || !actionEmail || !adminEmailsList.includes(actionEmail)) return

  const data = await getDriverAppAssignedDriverMock("pool_mock_123");

  await prisma.pool.create({
    data: {
      conductor_nombre: data.driver.full_name,
      vehiculo_patente: `${data.vehicle.model} - ${data.vehicle.license_plate}`,
      estado: 'Programado'
    }
  })
  revalidatePath('/admin') 
}

async function actualizarEstado(formData: FormData) {
  'use server'
  
  const { userId: actionUserId } = await auth()
  const actionUser = await currentUser()
  const actionEmail = actionUser?.emailAddresses[0]?.emailAddress?.toLowerCase()
  const adminEmailsList = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase())
  if (!actionUserId || !actionEmail || !adminEmailsList.includes(actionEmail)) return

  const id = formData.get('id') as string
  const estado = formData.get('estado') as string
  
  await prisma.pool.update({
    where: { id },
    data: { estado }
  })
  revalidatePath('/admin')
}

async function cancelarViaje(formData: FormData) {
  'use server'
  
  const { userId: actionUserId } = await auth()
  const actionUser = await currentUser()
  const actionEmail = actionUser?.emailAddresses[0]?.emailAddress?.toLowerCase()
  const adminEmailsList = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase())
  if (!actionUserId || !actionEmail || !adminEmailsList.includes(actionEmail)) return

  const id = formData.get('id') as string
  
  await prisma.pool.update({
    where: { id },
    data: { estado: 'Cancelado' }
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

  const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase()
  const adminEmails = (process.env.ADMIN_EMAIL ?? '').split(',').map(item => item.trim().toLowerCase())
  if (!email || !adminEmails.includes(email)) redirect('/')

  const params = await searchParams;
  const query = typeof params?.query === 'string' ? params.query : '';
  const tab = typeof params?.tab === 'string' ? params.tab : 'logistica'; // Leemos la pestaña

  // TRAEMOS SOLO LA DATA DE LA PESTAÑA ACTIVA PARA QUE SEA RÁPIDO
  const destinos = tab === 'destinos' ? await prisma.destination.findMany({
    where: { name: { contains: query, mode: 'insensitive' } },
    orderBy: { name: 'asc' }
  }) : [];

  const viajes = tab !== 'destinos' ? await prisma.pool.findMany({
    where: { estado: { contains: query, mode: 'insensitive' } },
    orderBy: { fecha_viaje: 'desc' }
  }) : [];

  let statTotal = 0, statEnRuta = 0, statPendientes = 0, statCancelados = 0;
  if (tab !== 'destinos') {
    const todosLosViajes = await prisma.pool.findMany();
    statTotal = todosLosViajes.length;
    statEnRuta = todosLosViajes.filter(v => v.estado === 'En camino').length;
    statPendientes = todosLosViajes.filter(v => v.estado === 'Programado').length;
    statCancelados = todosLosViajes.filter(v => v.estado === 'Cancelado').length;
  }

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
            <Link href="/admin?tab=logistica" className={`flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-bold transition-all ${tab !== 'destinos' ? 'bg-[#0A192F] text-[#FFFFFF] shadow-sm' : 'text-[#475569] hover:text-[#0A192F] hover:bg-[#F7F9FB]'}`}>
              <span className="material-symbols-outlined text-[20px]">local_shipping</span> Logística (CRUD)
            </Link>
            <Link href="/admin?tab=destinos" className={`flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13px] font-bold transition-all ${tab === 'destinos' ? 'bg-[#0A192F] text-[#FFFFFF] shadow-sm' : 'text-[#475569] hover:text-[#0A192F] hover:bg-[#F7F9FB]'}`}>
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

        {/* MENÚ MÓVIL (Pestañas) - Solo visible en pantallas pequeñas */}
        <div className="lg:hidden flex gap-2 mb-8 bg-[#FFFFFF] p-1.5 rounded-[10px] border border-[#D8DADC] shadow-sm">
          <Link href="/admin?tab=logistica" className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[12px] font-bold rounded-[6px] transition-all ${tab !== 'destinos' ? 'bg-[#0A192F] text-white shadow-sm' : 'text-[#475569] hover:text-[#0A192F] hover:bg-[#F7F9FB]'}`}>
            <span className="material-symbols-outlined text-[16px]">local_shipping</span> Logística
          </Link>
          <Link href="/admin?tab=destinos" className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[12px] font-bold rounded-[6px] transition-all ${tab === 'destinos' ? 'bg-[#0A192F] text-white shadow-sm' : 'text-[#475569] hover:text-[#0A192F] hover:bg-[#F7F9FB]'}`}>
            <span className="material-symbols-outlined text-[16px]">map</span> Destinos
          </Link>
        </div>

        {tab === 'destinos' ? (
          <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h2 className="text-[32px] font-bold text-[#0A192F] tracking-tight">Gestión de Destinos</h2>
                <p className="text-[#475569] text-[16px] mt-1">Busque y edite las locaciones disponibles para los usuarios.</p>
              </div>
            </header>

            <form method="GET" className="mb-8 flex gap-2 w-full max-w-xl">
              <input type="hidden" name="tab" value="destinos" />
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] text-[20px]">search</span>
                <input type="text" name="query" defaultValue={query} placeholder="Buscar destino por nombre..." className="w-full pl-10 pr-3 py-3 border border-[#D8DADC] rounded-[8px] text-[14px] focus:outline-none focus:border-[#0A192F] text-[#0A192F] bg-[#FFFFFF] shadow-sm" />
              </div>
              <button type="submit" className="bg-[#0A192F] text-white px-6 py-3 rounded-[8px] text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-all shadow-sm">
                Buscar
              </button>
              {query && (
                <Link href="/admin?tab=destinos" className="bg-[#EF4444]/10 text-[#DC2626] border border-[#EF4444]/20 px-4 py-3 rounded-[8px] text-[12px] font-bold uppercase tracking-widest hover:bg-[#EF4444]/20 transition-colors flex items-center justify-center">
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
          </>
        ) : (
          <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[32px] font-bold text-[#0A192F] tracking-tight">Monitoreo de Flota</h2>
                  <div className="relative group cursor-help flex items-center mt-2" tabIndex={0}>
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#D8DADC] text-[#0A192F] text-[11px] font-bold hover:bg-[#D8DADC]/80 transition-colors">?</span>
                    <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 sm:absolute sm:top-full sm:left-1/2 sm:-translate-x-1/2 sm:translate-y-0 sm:mt-2 hidden group-hover:block group-focus-within:block w-auto sm:w-72 p-4 bg-[#0A192F] text-[#D8DADC] text-[12px] font-normal rounded-lg shadow-2xl z-[100] leading-relaxed">
                      <p className="mb-2"><strong className="text-white tracking-wide">TOTAL:</strong> Suma absoluta de todos los viajes en el sistema.</p>
                      <p className="mb-2"><strong className="text-white tracking-wide">EN RUTA:</strong> Unidades despachadas ("En camino").</p>
                      <p className="mb-2"><strong className="text-white tracking-wide">PENDIENTES:</strong> Viajes programados esperando salida.</p>
                      <p><strong className="text-white tracking-wide">CANCELADOS:</strong> Viajes anulados por el usuario o el sistema.</p>
                      <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 bottom-full border-4 border-transparent border-b-[#0A192F]"></div>
                    </div>
                  </div>
                </div>
                <p className="text-[#475569] text-[16px] mt-1">Gestión operativa y asignación de viajes en tiempo real.</p>
              </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-[#FFFFFF] p-5 rounded-[12px] border border-[#D8DADC] shadow-sm relative overflow-hidden group hover:border-[#0A192F]/30 transition-colors">
                <span className="material-symbols-outlined absolute top-5 right-5 text-[#475569] opacity-10 text-[48px] group-hover:scale-110 transition-transform">dataset</span>
                <p className="text-[11px] font-bold text-[#475569] uppercase tracking-widest mb-2">Total Registrados</p>
                <h3 className="text-[32px] font-black text-[#0A192F] leading-none mb-2">{statTotal.toString().padStart(2, '0')}</h3>
              </div>
              <div className="bg-[#FFFFFF] p-5 rounded-[12px] border border-[#D8DADC] shadow-sm relative overflow-hidden group hover:border-[#0A192F]/30 transition-colors">
                <span className="material-symbols-outlined absolute top-5 right-5 text-[#475569] opacity-10 text-[48px] group-hover:scale-110 transition-transform">route</span>
                <p className="text-[11px] font-bold text-[#475569] uppercase tracking-widest mb-2">En Ruta</p>
                <h3 className="text-[32px] font-black text-[#0A192F] leading-none mb-2">{statEnRuta.toString().padStart(2, '0')}</h3>
              </div>
              <div className="bg-[#FFFFFF] p-5 rounded-[12px] border border-[#D8DADC] shadow-sm relative overflow-hidden group hover:border-[#0A192F]/30 transition-colors">
                <span className="material-symbols-outlined absolute top-5 right-5 text-[#475569] opacity-10 text-[48px] group-hover:scale-110 transition-transform">event_available</span>
                <p className="text-[11px] font-bold text-[#475569] uppercase tracking-widest mb-2">Pendientes</p>
                <h3 className="text-[32px] font-black text-[#0A192F] leading-none mb-2">{statPendientes.toString().padStart(2, '0')}</h3>
              </div>
              <div className="bg-[#FFFFFF] p-5 rounded-[12px] border border-[#D8DADC] shadow-sm relative overflow-hidden group hover:border-[#0A192F]/30 transition-colors">
                <span className="material-symbols-outlined absolute top-5 right-5 text-[#475569] opacity-10 text-[48px] group-hover:scale-110 transition-transform">cancel</span>
                <p className="text-[11px] font-bold text-[#475569] uppercase tracking-widest mb-2">Cancelados</p>
                <h3 className="text-[32px] font-black text-[#0A192F] leading-none mb-2">{statCancelados.toString().padStart(2, '0')}</h3>
              </div>
            </div>

            <div className="bg-[#FFFFFF] rounded-[12px] border border-[#D8DADC] shadow-sm p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[#0A192F]">assignment_add</span>
                  <h3 className="text-[18px] font-bold text-[#0A192F]">Asignar Nuevo Viaje (API Mock)</h3>
                </div>
                <p className="text-[14px] text-[#475569]">
                  Este panel simula la creación y asignación automática consumiendo la API de la <b>Driver App</b>.
                </p>
              </div>
              <form action={crearViajeAPI} className="w-full md:w-auto shrink-0">
                <button type="submit" className="w-full bg-[#0A192F] text-white px-8 py-3.5 rounded-[8px] text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-all shadow-sm flex items-center justify-center gap-2">
                  Confirmar y Notificar <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </form>
            </div>
              
           <div className="bg-[#FFFFFF] rounded-[12px] border border-[#D8DADC] shadow-sm flex flex-col overflow-hidden mb-12">
              <div className="p-6 border-b border-[#D8DADC] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#F7F9FB]">
                <h3 className="text-[16px] font-bold text-[#0A192F]">Viajes Activos</h3>
                <form method="GET" className="flex gap-2 w-full sm:w-auto">
                  <input type="hidden" name="tab" value="logistica" />
                  <div className="relative flex-1 sm:w-56">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] text-[18px]">search</span>
                    <input type="text" name="query" defaultValue={query} placeholder="Buscar estado..." className="w-full pl-9 pr-3 py-2 border border-[#D8DADC] rounded-[6px] text-[12px] focus:outline-none focus:border-[#0A192F] text-[#0A192F]" />
                  </div>
                  <button type="submit" className="bg-[#0A192F] text-white px-4 py-2 rounded-[6px] text-[12px] font-bold uppercase tracking-widest hover:bg-[#0A192F]/90 transition-colors">Filtrar</button>
                  {query && (
                    <Link href="/admin?tab=logistica" className="bg-[#EF4444]/10 text-[#DC2626] border border-[#EF4444]/20 px-3 py-2 rounded-[6px] text-[12px] font-bold uppercase tracking-widest hover:bg-[#EF4444]/20 transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </Link>
                  )}
                </form>
             </div>

             <div className="overflow-x-auto">
               <table className="w-full text-left min-w-[700px]">
                 <thead>
                   <tr className="bg-[#FFFFFF] border-b border-[#D8DADC]">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#475569]">Viaje / Conductor</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#475569]">Horario</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#475569]">Estado</th>
                     <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#475569] text-right">Acciones</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-[#D8DADC]">
                    {viajes.map((viaje) => {
                      const iniciales = viaje.conductor_nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'DR';
                      return (
                        <tr key={viaje.id} className="hover:bg-[#F7F9FB] transition-colors">
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-[#F7F9FB] border border-[#D8DADC] flex items-center justify-center text-[12px] font-bold text-[#0A192F] shrink-0">
                                {iniciales}
                              </div>
                              <div>
                                <p className="font-bold text-[14px] text-[#0A192F] leading-tight">{viaje.conductor_nombre}</p>
                                <p className="text-[11px] text-[#475569] font-mono mt-0.5">{viaje.vehiculo_patente}</p>
                              </div>
                            </div>
                         </td>
                         <td className="px-6 py-4">
                            <span className="text-[13px] font-medium text-[#475569]">
                              {viaje.fecha_viaje ? new Date(viaje.fecha_viaje).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' hs' : 'En breve'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <form action={actualizarEstado} className="flex items-center gap-2">
                              <input type="hidden" name="id" value={viaje.id} />
                              <select 
                                name="estado" 
                                defaultValue={viaje.estado} 
                                className={`p-1.5 rounded-[6px] border text-[11px] font-bold uppercase tracking-widest outline-none cursor-pointer ${
                                  viaje.estado === 'En camino' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20' : 
                                  viaje.estado === 'Programado' ? 'bg-[#0A192F]/5 text-[#0A192F] border-[#0A192F]/10' : 
                                  viaje.estado === 'Cancelado' ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20' :
                                  'bg-[#F7F9FB] text-[#475569] border-[#D8DADC]'
                                }`}
                              >
                                <option value="Programado">Programado</option>
                                <option value="En camino">En camino</option>
                                <option value="Finalizado">Finalizado</option>
                              </select>
                              <button type="submit" className="text-[#3B82F6] hover:text-[#2563EB] p-1 rounded hover:bg-[#EFF6FF] transition-colors" title="Actualizar Estado">
                                <span className="material-symbols-outlined text-[18px]">sync</span>
                              </button>
                            </form>
                         </td>
                         <td className="px-6 py-4 text-right">
                            <form action={cancelarViaje}>
                              <input type="hidden" name="id" value={viaje.id} />
                              <button type="submit" disabled={viaje.estado === 'Cancelado'} className="text-[#EF4444] hover:text-[#DC2626] disabled:opacity-30 disabled:cursor-not-allowed p-2 rounded-full hover:bg-[#FEF2F2] transition-colors" title="Cancelar Viaje">
                                <span className="material-symbols-outlined text-[20px]">cancel</span>
                              </button>
                            </form>
                         </td>
                       </tr>
                      )
                    })}
                    {viajes.length === 0 && (
                     <tr>
                        <td colSpan={4} className="p-12 text-center">
                          <span className="material-symbols-outlined text-4xl text-[#D8DADC] mb-2 block">folder_open</span>
                          <p className="text-[#475569] text-[14px]">No hay viajes registrados en el sistema.</p>
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
           </div>
        </>
        )}
      </main>
    </div>
  )
}
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { Button } from '@/app/ui/botones/Button'

export const dynamic = 'force-dynamic'

export default async function MisViajesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const ahora = new Date()
  const ITEMS_PER_PAGE = 5 // Mostramos 5 viajes por página en el historial
  
  // Leer el número de página desde la URL (ej: ?page=2)
  const params = await searchParams;
  const pageParam = params?.page;
  const currentPage = Number(Array.isArray(pageParam) ? pageParam[0] : pageParam) || 1
  const skip = (currentPage - 1) * ITEMS_PER_PAGE

  // 1. VIAJES ACTIVOS (Buscamos directo en la BD solo los futuros y no cancelados)
  const viajesActivos = await prisma.reserva.findMany({
    where: { clerk_user_id: userId, estado_reserva: { not: 'CANCELED' }, horario: { gte: ahora } },
    include: { destino: true },
    orderBy: { horario: 'asc' }
  })
  
  // 2. HISTORIAL PAGINADO (Buscamos directo en la BD los pasados o cancelados)

  // Ejecutamos la búsqueda y el conteo total al mismo tiempo para que sea más rápido
  const [historial, totalHistorial] = await Promise.all([
    prisma.reserva.findMany({ 
      where: {
        clerk_user_id: userId,
        OR: [{ horario: { lt: ahora } }, { estado_reserva: 'CANCELED' }]
      }, 
      include: { destino: true }, 
      orderBy: { horario: 'desc' }, 
      take: ITEMS_PER_PAGE, 
      skip: skip 
    }),
    prisma.reserva.count({ 
      where: {
        clerk_user_id: userId,
        OR: [{ horario: { lt: ahora } }, { estado_reserva: 'CANCELED' }]
      } 
    })
  ])

  const totalPages = Math.ceil(totalHistorial / ITEMS_PER_PAGE)

  // --- SERVER ACTION: Cancelar Reserva ---
  async function cancelarReserva(formData: FormData) {
    'use server'
    // Buscamos el usuario ADENTRO de la acción para que Next.js no se confunda y explote
    const { userId: actionUserId } = await auth()
    const id = formData.get('reserva_id') as string
    // SEGURIDAD: Usamos updateMany para exigir que el id de la reserva coincida con tu usuario
    await prisma.reserva.updateMany({
      where: { id: id, clerk_user_id: actionUserId || '' },
      data: { estado_reserva: 'CANCELED' }
    })
    revalidatePath('/mis-viajes')
  }

  // --- SERVER ACTIONS DE SIMULACIÓN (Dev Mode) --- //
  async function simularConfirmacion(formData: FormData) {
    'use server'
    const id = formData.get('reserva_id') as string

    // Simulamos los datos que nos devolvería la Driver App al asignar una combi
    const mockDriverSnapshot = {
      nombre: "Carlos Gómez",
      patente: "AF 123 CD",
      vehiculo: "Mercedes Benz Sprinter"
    }

    await prisma.reserva.update({
      where: { id },
      data: { 
        estado_reserva: 'CONFIRMED',
        assigned_driver_snapshot: mockDriverSnapshot
      }
    })
    revalidatePath('/mis-viajes')
  }

  async function simularPago(formData: FormData) {
    'use server'
    const id = formData.get('reserva_id') as string
    await prisma.reserva.update({
      where: { id },
      // Simulamos que la Payments App nos cobró 4200 (el precio estimado)
      data: { estado_reserva: 'PAID', precio_efectivo: 4200 } 
    })
    revalidatePath('/mis-viajes')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <Link href="/" className="text-[10px] font-bold uppercase text-blue-600 hover:underline">
            ← Volver al inicio
          </Link>
          <h1 className="text-3xl font-black italic mt-2">Mis Viajes</h1>
          <p className="text-gray-500 text-sm mt-1">Acá podés ver el estado de tus reservas.</p>
        </header>

        <div className="flex flex-col lg:flex-row gap-12 items-start">
          {/* --- SECCIÓN 1: VIAJES ACTIVOS --- */}
          <section className="flex-1 w-full">
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Próximos Viajes
            </h2>
            <div className="grid gap-6">
          {viajesActivos.map((reserva) => (
            <div key={reserva.id} className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                {reserva.estado_reserva === 'CANCELED' && (
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-3 bg-red-50 text-red-600">Cancelado ❌</span>
                )}
                {reserva.estado_reserva === 'PENDING_DRIVER' && (
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-3 bg-yellow-50 text-yellow-600">Buscando Conductor 🔍</span>
                )}
                {reserva.estado_reserva === 'CONFIRMED' && (
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-3 bg-green-50 text-green-600">Conductor Asignado 🚐</span>
                )}
                {reserva.estado_reserva === 'PAID' && (
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-3 bg-blue-50 text-blue-600">Viaje Pagado 💳</span>
                )}
                <h3 className="text-lg font-bold">{reserva.destino.nombre}</h3>
                <p className="text-sm text-gray-500 mt-1">📅 {new Date(reserva.horario).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} hs</p>
                <p className="text-xs text-gray-400 mt-1">📍 Salida: {reserva.punto_de_partida}</p>
                
                {reserva.precio_maximo && (
                  <p className="text-sm font-black text-green-600 mt-3 bg-green-50 inline-block px-3 py-1 rounded-lg">
                    💰 Total estimado: ${reserva.precio_maximo.toLocaleString('es-AR')}
                  </p>
                )}

                {reserva.assigned_driver_snapshot && (
                  <div className="mt-3 bg-gray-50 border border-gray-200 p-3 rounded-xl text-xs">
                    <p className="font-bold text-gray-700">🚐 Conductor Asignado:</p>
                    <p className="text-gray-600">{(reserva.assigned_driver_snapshot as any).nombre} - {(reserva.assigned_driver_snapshot as any).vehiculo} ({(reserva.assigned_driver_snapshot as any).patente})</p>
                  </div>
                )}

                {reserva.pool_id && (
                  <p className="text-[10px] text-gray-400 font-mono mt-2 uppercase tracking-widest">
                    ID Viaje: {reserva.pool_id}
                  </p>
                )}
              </div>
              
              <div className="w-full md:w-auto flex flex-col gap-2">
                {/* BOTONES DE SIMULACIÓN (Solo para probar el flujo visualmente) */}
                {reserva.estado_reserva === 'PENDING_DRIVER' && (
                  <form action={simularConfirmacion}>
                    <input type="hidden" name="reserva_id" value={reserva.id} />
                    <Button type="submit" variant="purple" size="md" className="w-full text-[9px]">
                      🛠️ Simular Asignación
                    </Button>
                  </form>
                )}
                {reserva.estado_reserva === 'CONFIRMED' && (
                  <div className="flex flex-col gap-2 w-full">
                    <form action={simularPago}>
                      <input type="hidden" name="reserva_id" value={reserva.id} />
                      <Button type="submit" variant="blue" size="md" className="w-full text-[9px]">
                        🛠️ Simular Pago
                      </Button>
                    </form>
                  </div>
                )}

                {/* Solo permitimos cancelar si el viaje todavía no se pagó */}
                {['PENDING_DRIVER', 'CONFIRMED'].includes(reserva.estado_reserva) && (
                  <form action={cancelarReserva}>
                    <input type="hidden" name="reserva_id" value={reserva.id} />
                    <Button type="submit" variant="red" size="lg" className="w-full md:w-auto">
                      Cancelar Viaje
                    </Button>
                  </form>
                )}
              </div>
            </div>
          ))}

          {viajesActivos.length === 0 && (
            <div className="bg-white p-12 rounded-[3rem] border border-gray-200 text-center">
              <span className="text-4xl mb-4 block">🎫</span>
              <h3 className="text-lg font-bold mb-2">No tenés viajes activos</h3>
              <p className="text-gray-500 text-sm mb-6">Todavía no hiciste ninguna reserva.</p>
              <Link href="/reservar" className="inline-block bg-black text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-colors">
                Hacer mi primera reserva
              </Link>
            </div>
          )}
            </div>
          </section>

          {/* --- SECCIÓN 2: HISTORIAL --- */}
          {totalHistorial > 0 && (
            <section className="flex-1 w-full">
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Historial de Viajes</h2>
              <div className="grid gap-6 opacity-60 hover:opacity-100 transition-opacity">
                {historial.map((reserva) => (
                  <div key={reserva.id} className="bg-gray-100 p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      {reserva.estado_reserva === 'CANCELED' && (
                        <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-3 bg-red-100 text-red-700">Cancelado ❌</span>
                      )}
                      {reserva.estado_reserva === 'PAID' && (
                        <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-3 bg-blue-100 text-blue-700">Viaje Finalizado ✅</span>
                      )}
                      <h3 className="text-lg font-bold text-gray-700">{reserva.destino.nombre}</h3>
                      <p className="text-sm text-gray-500 mt-1">📅 {new Date(reserva.horario).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} hs</p>
                      <p className="text-xs text-gray-400 mt-1">📍 Salida: {reserva.punto_de_partida}</p>
                      
                      {reserva.precio_maximo && (
                        <p className="text-sm font-black text-gray-600 mt-3 bg-white inline-block px-3 py-1 rounded-lg border border-gray-200">
                          💰 Total: ${reserva.precio_maximo.toLocaleString('es-AR')}
                        </p>
                      )}

                      {reserva.assigned_driver_snapshot && (
                        <div className="mt-3 bg-white/50 border border-gray-200 p-3 rounded-xl text-xs">
                          <p className="font-bold text-gray-700">🚐 Viajaste con:</p>
                          <p className="text-gray-600">{(reserva.assigned_driver_snapshot as any).nombre} - {(reserva.assigned_driver_snapshot as any).vehiculo} ({(reserva.assigned_driver_snapshot as any).patente})</p>
                        </div>
                      )}
                    </div>
                    <div className="w-full md:w-auto">
                      {reserva.estado_reserva === 'PAID' ? (
                        <Button type="button" variant="yellow" size="lg" className="py-3 px-4 w-full md:w-auto whitespace-nowrap" title="Próximamente: Sistema de Reseñas">
                          ⭐ Calificar Viaje
                        </Button>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          Archivado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* CONTROLES DE PAGINACIÓN */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                  <span className="text-xs text-gray-500 font-bold">
                    Página {currentPage} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    {currentPage > 1 ? (
                      <Link href={`/mis-viajes?page=${currentPage - 1}`} className="bg-white border border-gray-200 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors shadow-sm">
                        ⬅️ Anterior
                      </Link>
                    ) : (
                      <Button variant="disabled" size="md" disabled>
                        ⬅️ Anterior
                      </Button>
                    )}
                    {currentPage < totalPages ? (
                      <Link href={`/mis-viajes?page=${currentPage + 1}`} className="bg-white border border-gray-200 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-colors shadow-sm">
                        Siguiente ➡️
                      </Link>
                    ) : (
                      <Button variant="disabled" size="md" disabled>
                        Siguiente ➡️
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

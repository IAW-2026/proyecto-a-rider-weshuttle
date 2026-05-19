import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function MisViajesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Traer reservas del usuario actual, incluyendo el nombre del destino
  const reservas = await prisma.reserva.findMany({
    where: { clerk_user_id: userId },
    include: { destino: true },
    orderBy: { horario: 'asc' } // 'asc' ordena desde el más cercano al más lejano en el tiempo
  })

  const ahora = new Date()
  // 1. VIAJES ACTIVOS: Futuros y no cancelados
  const viajesActivos = reservas.filter(r => r.horario >= ahora && r.estado_reserva !== 'CANCELED')
  
  // 2. HISTORIAL: Pasados o cancelados (Los damos vuelta para que el más reciente quede arriba)
  const historial = reservas
    .filter(r => r.horario < ahora || r.estado_reserva === 'CANCELED')
    .sort((a, b) => b.horario.getTime() - a.horario.getTime())

  // --- SERVER ACTION: Cancelar Reserva ---
  async function cancelarReserva(formData: FormData) {
    'use server'
    const id = formData.get('reserva_id') as string
    await prisma.reserva.update({
      where: { id },
      data: { estado_reserva: 'CANCELED' }
    })
    revalidatePath('/mis-viajes')
  }

  // --- SERVER ACTIONS DE SIMULACIÓN (Dev Mode) --- //
  async function simularConfirmacion(formData: FormData) {
    'use server'
    const id = formData.get('reserva_id') as string
    await prisma.reserva.update({
      where: { id },
      data: { estado_reserva: 'CONFIRMED' }
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
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <Link href="/" className="text-[10px] font-bold uppercase text-blue-600 hover:underline">
            ← Volver al inicio
          </Link>
          <h1 className="text-3xl font-black italic mt-2">Mis Viajes</h1>
          <p className="text-gray-500 text-sm mt-1">Acá podés ver el estado de tus reservas.</p>
        </header>

        <div className="space-y-12">
          {/* --- SECCIÓN 1: VIAJES ACTIVOS --- */}
          <section>
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
                {reserva.estado_reserva === 'DENIED' && (
                  <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-3 bg-red-50 text-red-600">Pago Rechazado ⚠️</span>
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
                <p className="text-sm text-gray-500 mt-1">📅 {new Date(reserva.horario).toLocaleString('es-AR')}</p>
                <p className="text-xs text-gray-400 mt-1">📍 Salida: {reserva.punto_de_partida}</p>
                
                {reserva.precio_maximo && (
                  <p className="text-sm font-black text-green-600 mt-3 bg-green-50 inline-block px-3 py-1 rounded-lg">
                    💰 Total estimado: ${reserva.precio_maximo.toLocaleString('es-AR')}
                  </p>
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
                    <button type="submit" className="w-full bg-purple-50 text-purple-600 text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-lg hover:bg-purple-600 hover:text-white transition-colors shadow-sm">
                      🛠️ Simular Asignación
                    </button>
                  </form>
                )}
                {reserva.estado_reserva === 'CONFIRMED' && (
                  <form action={simularPago}>
                    <input type="hidden" name="reserva_id" value={reserva.id} />
                    <button type="submit" className="w-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-lg hover:bg-blue-600 hover:text-white transition-colors shadow-sm">
                      🛠️ Simular Pago
                    </button>
                  </form>
                )}

                {/* Solo permitimos cancelar si el viaje todavía no se pagó */}
                {['PENDING_DRIVER', 'CONFIRMED'].includes(reserva.estado_reserva) && (
                  <form action={cancelarReserva}>
                    <input type="hidden" name="reserva_id" value={reserva.id} />
                    <button type="submit" className="w-full md:w-auto bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-red-600 hover:text-white transition-colors shadow-sm">
                      Cancelar Viaje
                    </button>
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
          {historial.length > 0 && (
            <section>
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
                      <p className="text-sm text-gray-500 mt-1">📅 {new Date(reserva.horario).toLocaleString('es-AR')}</p>
                      <p className="text-xs text-gray-400 mt-1">📍 Salida: {reserva.punto_de_partida}</p>
                      
                      {reserva.precio_maximo && (
                        <p className="text-sm font-black text-gray-600 mt-3 bg-white inline-block px-3 py-1 rounded-lg border border-gray-200">
                          💰 Total: ${reserva.precio_maximo.toLocaleString('es-AR')}
                        </p>
                      )}
                    </div>
                    <div className="w-full md:w-auto">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Archivado
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // 1. Obtener parámetros de filtrado por fecha
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const dateFilter: any = {}
    if (startDate || endDate) {
      dateFilter.departure_time = {}
      if (startDate) {
        dateFilter.departure_time.gte = new Date(`${startDate}T00:00:00.000Z`)
      }
      if (endDate) {
        dateFilter.departure_time.lte = new Date(`${endDate}T23:59:59.999Z`)
      }
    }

    // 2. Recopilar métricas de Pasajeros
    const totalPassengers = await prisma.passenger.count()
    const activePassengers = await prisma.passenger.count({
      where: { status: 'ACTIVE' }
    })

    // 3. Recopilar métricas de Reservas
    const totalReservations = await prisma.reservation.count({
      where: dateFilter
    })
    
    // Reservas agrupadas por estado de reserva
    const reservationsGrouped = await prisma.reservation.groupBy({
      by: ['reservation_status'],
      where: dateFilter,
      _count: {
        id: true
      }
    })

    const byStatus: Record<string, number> = {}
    for (const group of reservationsGrouped) {
      byStatus[group.reservation_status] = group._count.id
    }

    // Reservas agrupadas por nombre de destino
    const reservationsWithDestinations = await prisma.reservation.findMany({
      where: dateFilter,
      select: {
        destination: {
          select: {
            name: true
          }
        }
      }
    })

    const byDestination: Record<string, number> = {}
    for (const res of reservationsWithDestinations) {
      if (res.destination && res.destination.name) {
        const destName = res.destination.name
        byDestination[destName] = (byDestination[destName] || 0) + 1
      }
    }

    // 4. Recopilar métricas Financieras
    const financials = await prisma.reservation.aggregate({
      where: dateFilter,
      _sum: {
        max_price: true,
        amount_charged: true,
        credit_applied: true
      }
    })

    // 5. Retornar el JSON consolidado
    return NextResponse.json({
      passengers: {
        total: totalPassengers,
        active: activePassengers
      },
      reservations: {
        total: totalReservations,
        by_status: byStatus,
        by_destination: byDestination
      },
      financials: {
        total_max_price: financials._sum.max_price || 0,
        total_amount_charged: financials._sum.amount_charged || 0,
        total_credit_applied: financials._sum.credit_applied || 0
      }
    })
  } catch (error) {
    console.error('Error al generar resumen analítico:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor. Detalle: ' + msg },
      { status: 500 }
    )
  }
}

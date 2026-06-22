import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    // 1. Validación de la API Key compartida
    const authHeader = request.headers.get('Authorization')
    const expectedKey = process.env.ANALYTICS_API_KEY

    if (!expectedKey) {
      console.warn('ANALYTICS_API_KEY no está configurada en las variables de entorno.')
      return NextResponse.json(
        { error: 'INTERNAL_SERVER_ERROR', message: 'Configuración de seguridad incompleta en el servidor.' },
        { status: 500 }
      )
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Se requiere autenticación Bearer Token.' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    if (token !== expectedKey) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'API Key inválida.' },
        { status: 401 }
      )
    }

    // 2. Recopilar métricas de Pasajeros
    const totalPassengers = await prisma.passenger.count()
    const activePassengers = await prisma.passenger.count({
      where: { status: 'ACTIVE' }
    })

    // 3. Recopilar métricas de Reservas
    const totalReservations = await prisma.reservation.count()
    
    // Reservas agrupadas por estado de reserva
    const reservationsGrouped = await prisma.reservation.groupBy({
      by: ['reservation_status'],
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

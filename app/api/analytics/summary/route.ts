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

    // 5. Calcular insights avanzados de negocio
    const reservationsForInsights = await prisma.reservation.findMany({
      where: dateFilter,
      select: {
        id: true,
        departure_time: true,
        reservation_status: true,
        payment_status: true,
        max_price: true,
        amount_charged: true,
        passenger: {
          select: {
            full_name: true,
            clerk_user_id: true,
          }
        }
      }
    })

    // a. Distribución por Día de la Semana
    const daysName = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const daysMap: Record<string, number> = {
      'Lunes': 0,
      'Martes': 0,
      'Miércoles': 0,
      'Jueves': 0,
      'Viernes': 0,
      'Sábado': 0,
      'Domingo': 0
    }

    for (const res of reservationsForInsights) {
      // Ajustar a zona horaria de Argentina (UTC-3) para agrupar por el día local de negocio correcto
      const utcTime = new Date(res.departure_time).getTime()
      const argTime = new Date(utcTime - (3 * 60 * 60 * 1000))
      const dayName = daysName[argTime.getUTCDay()]
      if (dayName) {
        daysMap[dayName] = (daysMap[dayName] || 0) + 1
      }
    }

    // b. Clasificación de pasajeros (VIP vs. Alto Riesgo)
    const passengerStats: Record<string, { name: string; completedCount: number; spentAmount: number; totalCount: number; canceledCount: number }> = {}

    for (const res of reservationsForInsights) {
      if (!res.passenger) continue
      const passengerId = res.passenger.clerk_user_id || 'unknown'
      const passengerName = res.passenger.full_name || 'Pasajero Anónimo'

      if (!passengerStats[passengerId]) {
        passengerStats[passengerId] = {
          name: passengerName,
          completedCount: 0,
          spentAmount: 0,
          totalCount: 0,
          canceledCount: 0
        }
      }

      const stats = passengerStats[passengerId]
      stats.totalCount++

      if (res.payment_status === 'PAID' && res.reservation_status !== 'CANCELED') {
        stats.completedCount++
        stats.spentAmount += res.amount_charged || 0
      }

      if (res.reservation_status === 'CANCELED') {
        stats.canceledCount++
      }
    }

    // Filtrar y ordenar para obtener VIP
    const vipPassengers = Object.values(passengerStats)
      .filter(p => p.completedCount > 0)
      .map(p => ({
        name: p.name,
        count: p.completedCount,
        extraDetail: `Gasto: ARS ${Math.round(p.spentAmount).toLocaleString('es-AR')}`
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    // Filtrar y ordenar para obtener pasajeros de alto riesgo
    const atRiskPassengers = Object.values(passengerStats)
      .filter(p => p.canceledCount > 0)
      .map(p => {
        const ratio = p.totalCount > 0 ? Math.round((p.canceledCount / p.totalCount) * 100) : 0
        return {
          name: p.name,
          count: p.canceledCount,
          extraDetail: `Tasa Cancelación: ${ratio}%`
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)

    // c. Calcular hora pico
    const hourCounts: Record<number, number> = {}
    for (const res of reservationsForInsights) {
      // Ajustar a zona horaria de Argentina (UTC-3) para calcular la hora pico local de negocio
      const utcTime = new Date(res.departure_time).getTime()
      const argTime = new Date(utcTime - (3 * 60 * 60 * 1000))
      const hour = argTime.getUTCHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    }

    let peakHourStr = '—'
    let maxHourCount = 0
    let peakHourVal = -1
    for (const [hour, count] of Object.entries(hourCounts)) {
      const c = Number(count)
      if (c > maxHourCount) {
        maxHourCount = c
        peakHourVal = Number(hour)
        peakHourStr = `${String(hour).padStart(2, '0')}:00 hs`
      }
    }

    // d. Generación de Alertas Analíticas
    const warnings: string[] = []

    if (totalReservations >= 5) {
      // Alertas de baja demanda por día (menos del 10% del total)
      for (const dayName of daysName) {
        const count = daysMap[dayName] || 0
        const pct = (count / totalReservations) * 100
        if (pct < 10) {
          const dayLower = dayName.toLowerCase()
          const pluralDay = (dayLower === 'sábado' || dayLower === 'domingo') ? `${dayLower}s` : dayLower
          warnings.push(
            `💡 Alerta de Negocio: Los ${pluralDay} registran baja demanda (${Math.round(pct)}% de reservas). Se sugiere promocionar pools con tarifas reducidas.`
          )
        }
      }
    }

    if (maxHourCount > 0 && peakHourVal !== -1) {
      warnings.push(
        `🔥 Pico de Demanda: La hora con mayor frecuencia de salidas es a las ${peakHourStr} (${maxHourCount} reservas).`
      )
    }

    const totalCanceled = reservationsForInsights.filter(r => r.reservation_status === 'CANCELED').length
    if (totalReservations >= 5 && (totalCanceled / totalReservations) > 0.25) {
      warnings.push(
        `⚠️ Alerta de Retención: La tasa de cancelación general en este periodo es del ${Math.round((totalCanceled / totalReservations) * 100)}%. Sugerencia: Ofrecer mayor flexibilidad o incentivos.`
      )
    }

    // 6. Retornar el JSON consolidado con insights
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
      },
      insights: {
        dayOfWeekDistribution: daysMap,
        vipPassengers,
        atRiskPassengers,
        peakHour: peakHourStr,
        warnings
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

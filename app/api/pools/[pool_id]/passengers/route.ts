import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pool_id: string }> }
) {
  try {
    const { pool_id } = await params;

    // Leemos si nos pasaron query params (ej: ?payment_status=PAID)
    const { searchParams } = new URL(request.url)
    const paymentStatusFilter = searchParams.get('payment_status')
    const reservationStatusFilter = searchParams.get('reservation_status')

    // Validamos que los filtros sean valores válidos del contrato (400 Bad Request)
    const validPaymentStatuses = ['UNPAID', 'PENDING', 'PAID', 'DENIED', 'CANCELED', 'EXPIRED'];
    if (paymentStatusFilter && !validPaymentStatuses.includes(paymentStatusFilter)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Filtro payment_status inválido." }, { status: 400 });
    }
    const validReservationStatuses = ['PENDING_PAYMENT', 'PENDING_DRIVER', 'CONFIRMED', 'CANCELED'];
    if (reservationStatusFilter && !validReservationStatuses.includes(reservationStatusFilter)) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Filtro reservation_status inválido." }, { status: 400 });
    }

    // Primero verificamos si el pool existe realmente (404 Not Found)
    const poolExiste = await prisma.reservation.findFirst({ where: { pool_id: pool_id } });
    if (!poolExiste) {
      return NextResponse.json({ error: "NOT_FOUND", message: "El pool no tiene reservas asociadas o no existe." }, { status: 404 });
    }

    // Armamos el filtro dinámico para Prisma
    const whereClause: any = { pool_id: pool_id };
    if (paymentStatusFilter) whereClause.payment_status = paymentStatusFilter;
    if (reservationStatusFilter) {
      whereClause.reservation_status = reservationStatusFilter;
    } else {
      whereClause.reservation_status = { not: 'CANCELED' };
    }

    const reservas = await prisma.reservation.findMany({
      where: whereClause,
      include: {
        passenger: true
      }
    });

    const pasajerosFormateados = reservas.map(res => ({
      reservation_id: res.id,
      passenger_user_id: res.passenger_user_id,
      passenger_name: res.passenger?.full_name || 'Pasajero',
      reservation_status: res.reservation_status,
      payment_status: res.payment_status,
      pickup_point: {
        address: res.pickup_address,
        lat: res.pickup_lat,
        lng: res.pickup_lng
      },
      destination_id: res.destination_id,
      departure_time: res.departure_time.toISOString(),
      max_price: res.max_price,
      amount_charged: res.amount_charged,
      credit_applied: res.credit_applied || 0,
      final_trip_price: res.final_trip_price,
      credit_granted: res.credit_granted || 0,
      currency: res.currency
    }));

    return NextResponse.json({ 
      pool_id: pool_id, 
      passengers: pasajerosFormateados 
    });
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: "Error al obtener pasajeros del pool." }, { status: 500 });
  }
}
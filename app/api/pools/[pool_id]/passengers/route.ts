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

    // Armamos el filtro dinámico para Prisma
    const whereClause: any = { pool_id: pool_id };
    if (paymentStatusFilter) whereClause.payment_status = paymentStatusFilter;
    if (reservationStatusFilter) whereClause.reservation_status = reservationStatusFilter;

    const reservas = await prisma.reservation.findMany({
      where: whereClause,
      include: {
        passenger: true
      }
    });

    // Formateamos la respuesta EXACTAMENTE como lo pide el contrato de la API
    const pasajerosFormateados = reservas.map(res => ({
      reservation_id: res.id,
      passenger_user_id: res.passenger_user_id,
      passenger_name: res.passenger.full_name || 'Pasajero',
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
      credit_applied: res.credit_applied,
      final_trip_price: res.final_trip_price,
      credit_granted: res.credit_granted,
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
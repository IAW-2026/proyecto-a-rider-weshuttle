import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pool_id: string }> }
) {
  try {
    const { pool_id } = await params;

    // Leemos si nos pasaron un query param "?status=PAID"
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Buscamos las reservas para este pool
    const reservas = await prisma.reservation.findMany({
      where: {
        pool_id: pool_id,
        // Si nos pasan status, filtramos por ese. Si no, traemos todas las no canceladas/denegadas.
        status: statusFilter ? (statusFilter as any) : { in: ['CONFIRMED', 'PAID', 'PENDING_DRIVER'] }
      },
      include: {
        passenger: true,
        destination: true
      }
    });

    // Formateamos la respuesta EXACTAMENTE como lo pide el contrato de la API
    const pasajerosFormateados = reservas.map(res => ({
      reservation_id: res.id,
      passenger_user_id: res.passenger_user_id,
      passenger_name: res.passenger.full_name || 'Pasajero',
      reservation_status: res.status,
      pickup_point: {
        address: res.pickup_address,
        lat: res.pickup_lat || -38.718, // Extraemos real o enviamos mock
        lng: res.pickup_lng || -62.266  
      },
      destination_id: res.destination.id,
      departure_time: res.departure_time.toISOString(),
      max_price: res.max_price,
      effective_price: res.effective_price
    }));

    return NextResponse.json({ 
      pool_id: pool_id, 
      passengers: pasajerosFormateados 
    });
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: "Error al obtener pasajeros del pool." }, { status: 500 });
  }
}
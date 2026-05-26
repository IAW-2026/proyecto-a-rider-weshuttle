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
    const reservas = await prisma.reserva.findMany({
      where: {
        pool_id: pool_id,
        // Si nos pasan status, filtramos por ese. Si no, traemos todas las no canceladas/denegadas.
        estado_reserva: statusFilter ? (statusFilter as any) : { in: ['CONFIRMED', 'PAID', 'PENDING_DRIVER'] }
      },
      include: {
        pasajero: true,
        destino: true
      }
    });

    // Formateamos la respuesta EXACTAMENTE como lo pide el contrato de la API
    const pasajerosFormateados = reservas.map(res => ({
      reservation_id: res.id,
      passenger_user_id: res.clerk_user_id,
      passenger_name: res.pasajero.nombre || 'Pasajero',
      reservation_status: res.estado_reserva,
      pickup_point: {
        address: res.punto_de_partida,
        lat: -38.718, // Mock (en tu BD tenés solo el string de partida)
        lng: -62.266  // Mock
      },
      destination_id: res.destino.id,
      departure_time: res.horario.toISOString(),
      max_price: res.precio_maximo,
      effective_price: res.precio_efectivo
    }));

    return NextResponse.json({ 
      pool_id: pool_id, 
      passengers: pasajerosFormateados 
    });
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: "Error al obtener pasajeros del pool." }, { status: 500 });
  }
}
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ pool_id: string }> }
) {
  try {
    const { pool_id } = await params;
    
    // Leemos el body que nos manda la Driver App
    const body = await request.json();

    if (!body.reason) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Falta el motivo de cancelación." }, { status: 400 });
    }

    // Buscamos todas las reservas activas asociadas a esta combi
    const reservas = await prisma.reservation.findMany({
      where: { pool_id: pool_id, status: { in: ['PENDING_DRIVER', 'CONFIRMED'] } }
    });

    if (reservas.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "No existen reservas asociadas al pool o ya estaban canceladas." }, { status: 404 });
    }

    // Pasamos todas esas reservas a estado CANCELED en bloque
    const actualizadas = await prisma.reservation.updateMany({
      where: { pool_id: pool_id, status: { in: ['PENDING_DRIVER', 'CONFIRMED'] } },
      data: { status: 'CANCELED' }
    });

    // Notificamos a los pasajeros afectados (Extraemos los IDs de usuario sin repetir)
    const usuariosUnicos = [...new Set(reservas.map(r => r.passenger_user_id))];
    const notificaciones = usuariosUnicos.map(userId => ({
      passenger_user_id: userId,
      type: 'POOL_CANCELED',
      message: body.message || 'Tu viaje fue cancelado por la logística.'
    }));
    await prisma.passengerNotification.createMany({ data: notificaciones });

    return NextResponse.json({
      pool_id: pool_id,
      updated_reservations: actualizadas.count,
      new_reservation_status: "CANCELED",
      notifications_sent: true
    });
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: "Error interno al cancelar reservas." }, { status: 500 });
  }
}
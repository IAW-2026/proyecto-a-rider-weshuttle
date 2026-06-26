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

    // Buscamos TODAS las reservas asociadas a este pool para ver si el pool existe en nuestra DB
    const todasLasReservas = await prisma.reservation.findMany({
      where: { pool_id: pool_id }
    });

    if (todasLasReservas.length === 0) {
      return NextResponse.json({ error: "NOT_FOUND", message: "No existen reservas asociadas al pool." }, { status: 404 });
    }

    // Filtramos solo las que están en un estado cancelable
    const reservasActivas = todasLasReservas.filter(r => ['PENDING_PAYMENT', 'PENDING_DRIVER', 'CONFIRMED'].includes(r.reservation_status));
    if (reservasActivas.length === 0) {
      return NextResponse.json({ error: "CONFLICT", message: "Las reservas ya estaban canceladas o en un estado final incompatible." }, { status: 409 });
    }

    // Pasamos todas esas reservas a estado CANCELED en bloque
    const actualizadas = await prisma.reservation.updateMany({
      where: { pool_id: pool_id, reservation_status: { in: ['PENDING_PAYMENT', 'PENDING_DRIVER', 'CONFIRMED'] } },
      data: { reservation_status: 'CANCELED' }
    });

    // Notificamos a los pasajeros afectados (Extraemos los IDs de usuario sin repetir)
    const usuariosUnicos = [...new Set(reservasActivas.map(r => r.passenger_user_id))];
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
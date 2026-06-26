import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.pool_id || !body.passenger_user_id || !body.message) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Faltan datos obligatorios." },
        { status: 400 }
      );
    }

    // Verificamos que el pasajero exista y realmente haya estado en ese pool
    const reserva = await prisma.reservation.findFirst({
      where: { pool_id: body.pool_id, passenger_user_id: body.passenger_user_id }
    });

    if (!reserva) {
      return NextResponse.json({ error: "NOT_FOUND", message: "No existe el pasajero o el pool indicado." }, { status: 404 });
    }

    // Evitamos notificaciones duplicadas de calificación para el mismo pool y usuario
    const existente = await prisma.passengerNotification.findFirst({
      where: {
        passenger_user_id: body.passenger_user_id,
        pool_id: body.pool_id,
        type: 'FEEDBACK_AVAILABLE'
      }
    });

    if (existente) {
      return NextResponse.json({ notification_sent: true, status: "ALREADY_EXISTS" });
    }

    // Registramos la notificación para el pasajero
    await prisma.passengerNotification.create({
      data: {
        passenger_user_id: body.passenger_user_id,
        pool_id: body.pool_id,
        type: 'FEEDBACK_AVAILABLE',
        message: body.message
      }
    });

    return NextResponse.json({ notification_sent: true });
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: "Error interno al procesar la notificación." }, { status: 500 });
  }
}

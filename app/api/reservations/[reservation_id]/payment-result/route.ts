import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reservation_id: string }> }
) {
  try {
    const { reservation_id } = await params;
    const body = await request.json();

    if (!body.payment_status) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Falta el payment_status." }, { status: 400 });
    }

    // Buscamos la reserva
    const reserva = await prisma.reservation.findUnique({
      where: { id: reservation_id }
    });

    if (!reserva) {
      return NextResponse.json({ error: "NOT_FOUND", message: "La reserva no existe." }, { status: 404 });
    }

    // Evitamos pisar estados si ya estaba cancelada o procesada
    if (reserva.status === 'CANCELED' || reserva.status === 'DENIED') {
      return NextResponse.json({ error: "CONFLICT", message: "La reserva ya está en un estado final incompatible." }, { status: 409 });
    }

    let newStatus: any = reserva.status;

    if (body.payment_status === 'PAID') {
      newStatus = 'PAID';
    } else if (body.payment_status === 'DENIED') {
      newStatus = 'DENIED';
    } else {
      return NextResponse.json({ error: "BAD_REQUEST", message: "payment_status inválido." }, { status: 400 });
    }

    // Actualizamos la reserva en la base de datos
    await prisma.reservation.update({
      where: { id: reservation_id },
      data: { status: newStatus as any }
    });

    // Le enviamos una notificación al pasajero
    await prisma.passengerNotification.create({
      data: {
        passenger_user_id: reserva.passenger_user_id,
        type: body.payment_status === 'PAID' ? 'PAYMENT_SUCCESS' : 'PAYMENT_DENIED',
        message: body.payment_status === 'PAID' ? 'Tu pago fue procesado con éxito.' : 'Tu pago fue rechazado.'
      }
    });

    return NextResponse.json({
      reservation_id: reservation_id,
      reservation_status: newStatus
    });
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: "Error interno al procesar el pago." }, { status: 500 });
  }
}
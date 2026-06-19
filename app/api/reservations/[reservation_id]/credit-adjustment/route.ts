import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reservation_id: string }> }
) {
  try {
    const { reservation_id } = await params;
    const body = await request.json();

    const { credit_granted, final_trip_price } = body;

    if (credit_granted === undefined) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Falta el valor de credit_granted." }, { status: 400 });
    }

    // Buscamos la reserva
    const reserva = await prisma.reservation.findUnique({
      where: { id: reservation_id },
      include: { destination: true }
    });

    if (!reserva) {
      return NextResponse.json({ error: "NOT_FOUND", message: "La reserva no existe." }, { status: 404 });
    }

    // Actualizamos la reserva
    const updated = await prisma.reservation.update({
      where: { id: reservation_id },
      data: {
        credit_granted: Number(credit_granted),
        final_trip_price: final_trip_price !== undefined ? Number(final_trip_price) : null
      }
    });

    // Creamos una notificación para el pasajero (campanita)
    await prisma.passengerNotification.create({
      data: {
        passenger_user_id: reserva.passenger_user_id,
        reservation_id: reserva.id,
        pool_id: reserva.pool_id,
        type: 'CREDIT_GRANTED',
        message: `¡Ahorraste $${credit_granted} en tu viaje a ${reserva.destination.name} por la ocupación del pool!`
      }
    });

    return NextResponse.json({
      success: true,
      reservation_id,
      credit_granted: updated.credit_granted,
      final_trip_price: updated.final_trip_price
    });
  } catch (error) {
    console.error("Error al procesar ajuste de credito:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: "Error interno al procesar el ajuste de crédito." }, { status: 500 });
  }
}

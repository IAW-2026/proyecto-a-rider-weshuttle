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
    const reserva = await prisma.reserva.findUnique({
      where: { id: reservation_id }
    });

    if (!reserva) {
      return NextResponse.json({ error: "NOT_FOUND", message: "La reserva no existe." }, { status: 404 });
    }

    // Evitamos pisar estados si ya estaba cancelada o procesada
    if (reserva.estado_reserva === 'CANCELED' || reserva.estado_reserva === 'DENIED') {
      return NextResponse.json({ error: "CONFLICT", message: "La reserva ya está en un estado final incompatible." }, { status: 409 });
    }

    let newStatus: any = reserva.estado_reserva;

    if (body.payment_status === 'PAID') {
      newStatus = 'PAID';
    } else if (body.payment_status === 'DENIED') {
      newStatus = 'DENIED';
    } else {
      return NextResponse.json({ error: "BAD_REQUEST", message: "payment_status inválido." }, { status: 400 });
    }

    // Actualizamos la reserva en la base de datos
    await prisma.reserva.update({
      where: { id: reservation_id },
      data: { estado_reserva: newStatus as any }
    });

    // Le enviamos una notificación al pasajero
    await prisma.notificacion.create({
      data: {
        clerk_user_id: reserva.clerk_user_id,
        tipo: body.payment_status === 'PAID' ? 'PAYMENT_SUCCESS: Tu pago fue procesado con éxito.' : 'PAYMENT_DENIED: Tu pago fue rechazado.'
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
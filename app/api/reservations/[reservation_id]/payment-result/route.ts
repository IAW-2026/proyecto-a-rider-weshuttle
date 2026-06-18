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
    if (reserva.reservation_status === 'CANCELED' || reserva.payment_status === 'PAID') {
      return NextResponse.json({ error: "CONFLICT", message: "La reserva ya está en un estado final incompatible." }, { status: 409 });
    }

    let newPaymentStatus: any = reserva.payment_status;
    let newReservationStatus: any = reserva.reservation_status;

    if (body.payment_status === 'PAID') {
      newPaymentStatus = 'PAID';
      // Si se pagó con éxito, pasa a PENDING_DRIVER
      newReservationStatus = 'PENDING_DRIVER';
    } else if (body.payment_status === 'DENIED') {
      newPaymentStatus = 'DENIED';
      // Si se denegó, queda pendiente de pago para que reintente
      newReservationStatus = 'PENDING_PAYMENT';
    } else if (body.payment_status === 'CANCELED' || body.payment_status === 'EXPIRED') {
      newPaymentStatus = body.payment_status;
      // Si cerró la ventana o expiró el link, cancelamos la reserva
      newReservationStatus = 'CANCELED';
    } else {
      return NextResponse.json({ error: "BAD_REQUEST", message: "payment_status inválido." }, { status: 400 });
    }

    const updateData: any = { 
      payment_status: newPaymentStatus,
      reservation_status: newReservationStatus
    };

    if (body.transaction_id) {
      updateData.payment_transaction_id = body.transaction_id;
    }
    
    if (body.payment_status === 'PAID') {
      updateData.max_price = body.max_price;
      updateData.credit_applied = body.credit_applied;
      updateData.amount_charged = body.amount_charged;
    } else if (body.payment_status === 'DENIED' && body.rejection_reason) {
      updateData.payment_rejection_reason = body.rejection_reason;
    }

    // Actualizamos la reserva en la base de datos
    await prisma.reservation.update({
      where: { id: reservation_id },
      data: updateData
    });

    // Armamos la respuesta estricta según el contrato
    const responsePayload: any = {
      reservation_id: reservation_id,
      payment_status: newPaymentStatus,
      reservation_status: newReservationStatus
    };

    if (newPaymentStatus === 'PAID') {
      responsePayload.max_price = body.max_price;
      responsePayload.credit_applied = body.credit_applied;
      responsePayload.amount_charged = body.amount_charged;
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: "Error interno al procesar el pago." }, { status: 500 });
  }
}
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reservation_id: string }> }
) {
  try {
    const { reservation_id } = await params;
    const body = await request.json();

    // 1. Validamos que nos manden el rating (estrellas)
    if (!body.rating || typeof body.rating !== 'number') {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Falta el rating (debe ser un número)." },
        { status: 400 }
      );
    }

    // 2. Buscamos la reserva para asegurarnos de que existe
    const reserva = await prisma.reserva.findUnique({
      where: { id: reservation_id }
    });

    if (!reserva) {
      return NextResponse.json({ error: "NOT_FOUND", message: "La reserva no existe." }, { status: 404 });
    }

    // 3. Registramos el feedback (usamos la tabla de notificaciones como registro seguro)
    await prisma.notificacion.create({
      data: {
        clerk_user_id: reserva.clerk_user_id,
        tipo: `FEEDBACK_SENT: Calificaste tu viaje con ${body.rating} estrellas.`
      }
    });

    return NextResponse.json({
      reservation_id: reservation_id,
      rating_saved: body.rating,
      feedback_registered: true
    });
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: "Error interno al guardar el feedback." }, { status: 500 });
  }
}

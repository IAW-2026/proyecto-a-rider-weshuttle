-- CreateTable
CREATE TABLE "Pasajero" (
    "clerk_user_id" TEXT NOT NULL,
    "company_code" TEXT,

    CONSTRAINT "Pasajero_pkey" PRIMARY KEY ("clerk_user_id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "estado_reserva" TEXT NOT NULL,
    "punto_de_partida" TEXT NOT NULL,
    "destino_id" TEXT NOT NULL,
    "horario" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destino" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ubicacion_lat_long" TEXT NOT NULL,

    CONSTRAINT "Destino_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_clerk_user_id_fkey" FOREIGN KEY ("clerk_user_id") REFERENCES "Pasajero"("clerk_user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_destino_id_fkey" FOREIGN KEY ("destino_id") REFERENCES "Destino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

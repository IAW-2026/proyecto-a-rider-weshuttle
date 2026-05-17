# 🗺️ WeShuttle Context: Rider App 

Este archivo define la lógica, el stack y los contratos de API de la **Rider App**. Es la fuente de verdad para la gestión de pasajeros y reservas.

## 🛠️ Stack & Infra
- **Framework:** Next.js (App Router) + Turbopack.
- **Auth:** Clerk (Admin: `gulinofranco5@gmail.com`).
- **DB:** PostgreSQL (Neon) + Prisma ORM.

## 🔌 Contratos de API (Endpoints que YO expongo)
Mi app es el servidor para otros servicios. Estos son los contratos que debo respetar:

### 1. Manifiesto de Pasajeros (`GET /api/pools/:pool_id/passengers`)
- **Uso:** Lo llama la Driver App (Marketplace/Viaje), Payments (Cobro) y Feedback (Ratings).
- **Filtro Clave:** `?status=PAID` para el manifiesto final del chofer.
- **Regla:** Si no hay nadie, devuelvo `[]`.

### 2. Cancelación por falta de Chofer (`POST /api/pools/:pool_id/cancellations`)
- **Origen:** Driver App me avisa que nadie aceptó el viaje.
- **Acción:** Debo pasar mis reservas a `CANCELED` y notificar al usuario.

### 3. Resultado de Pago (`PATCH /api/reservations/:reservation_id/payment-result`)
- **Origen:** Payments App me confirma si hubo plata o no.
- **Acción:** Si es `PAID`, guardo el `effective_price`. Si es `DENIED`, queda en null.

### 4. Aviso de Reseña (`POST /api/notifications/feedback`)
- **Origen:** Feedback App me avisa que el viaje terminó.
- **Acción:** Debo mostrarle al pasajero que ya puede calificar al chofer.

## 📊 Modelo de Datos (Prisma)
- **Pasajeros:** - `clerk_user_id` (PK), `company_code` (Validación industrial).

- **Destinos:** - `id`, `nombre` (Polo, Puerto, etc.), `ubicacion_lat_long`.

- **Reservas (Inmutable):** - `id`, `clerk_user_id` (FK), `pool_id` (ID externo).
  - `punto_de_partida`: Dirección de origen del rider.
  - `destino_id`: Relación actual con la tabla Destinos.
  - `horario`: Fecha/Hora del viaje.
  - **Snapshots Comerciales:** `destino_snapshot` y `horario_snapshot` (Para que la reserva no cambie si el destino se edita a futuro).
  - **Precios:** `max_price` (Snapshot al crear) y `effective_price` (Post-cobro).
  - **Estados:** `INICIADA`, `CONFIRMADA`, `PAGADA`, `CANCELADA`.

## 🛡️ Reglas de Negocio Críticas
1. **Inmutabilidad:** Una vez creada la reserva, el `max_price` no se toca.
2. **Seguridad:** Solo el mail admin puede acceder a `/admin` para gestionar destinos.
3. **Filtro de Seguridad:** En el `.gitignore` DEBEN estar `.env`, `.env.local` y `.clerk/`.
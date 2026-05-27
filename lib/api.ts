// --- MOCKS DE APIs EXTERNAS --- //
// Acá centralizamos las llamadas a otros microservicios (Driver App, Payments App).
// Cuando tengas las APIs reales, simplemente cambiamos el contenido de estas funciones
// por fetch('URL_REAL') y el resto de la app seguirá funcionando intacta.

// --- PAYMENTS APP ---
// Simula: GET /api/payments/pricing-estimate?origin_lat=...&destination_id=...
export async function fetchPaymentsAppPricingMock() {
  return {
    "currency": "ARS",
    "max_price": 5000,
    "estimated_price": 4200,
    "current_passengers": 5,
    "pricing_detail": {
      "base_price": 5000,
      "estimated_discount": 800,
      "discount_reason": "OCCUPANCY_DISCOUNT"
    }
  }
}

// --- DRIVER APP ---
// Simula: POST /api/pools (Crear nuevo pool)
export async function createDriverAppPoolMock() {
  return {
    "pool_id": `pool_mock_${Math.floor(Math.random() * 1000)}`, // Genera un ID falso aleatorio
    "status": "AVAILABLE",
    "current_passengers": 1,
    "max_capacity": 15
  }
}

// Simula: GET /api/pools/:pool_id/assigned-driver
export async function getDriverAppAssignedDriverMock(pool_id: string) {
  return {
    "pool_id": pool_id,
    "pool_status": "ASSIGNED",
    "driver": {
      "driver_user_id": "user_driver_01",
      "full_name": "Juliana Pagani" // Dato del contrato oficial
    },
    "vehicle": {
      "vehicle_id": "veh_123",
      "brand": "Mercedes-Benz",
      "model": "Sprinter",
      "license_plate": "AF123JK"
    }
  };
}

// Simula: GET /api/pools/:pool_id/status
export async function getDriverAppPoolStatusMock(pool_id: string) {
  return {
    "pool_id": pool_id,
    "status": "IN_PROGRESS",
    "destination_id": "dest_polo_petroquimico",
    "departure_time": "2026-06-10T08:00:00Z",
    "current_passengers": 8,
    "max_capacity": 15,
    "target_user_id": "user_def456",
    "hito": "El conductor está en camino a tu ubicación",
    "updated_at": "2026-06-10T07:15:00Z"
  }
}

// Simula: DELETE /api/pools/:pool_id/reservations/:reservation_id
export async function cancelReservationMock(pool_id: string, reservation_id: string) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log(`[MOCK API] DELETE /api/pools/${pool_id}/reservations/${reservation_id} -> Asiento liberado.`);
  return {
    "pool_id": pool_id,
    "reservation_id": reservation_id,
    "current_passengers": 4, // Simulamos que quedaban 4
    "pool_status": "AVAILABLE"
  };
}

// --- FEEDBACK APP ---
// Simula: GET /api/ratings/:user_id
export async function getFeedbackAppRatingMock(user_id: string) {
  return {
    "user_id": user_id,
    "role": "driver",
    "average_rating": 4.8,
    "total_reviews": 25
  }
}

// Simula: POST /api/reviews/precreate o flujo de calificar
export async function submitFeedbackMock(reserva_id: string, pasajero_id: string) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  console.log(`[MOCK API] POST /api/feedback -> Calificación de 5 estrellas enviada para reserva ${reserva_id} por pasajero ${pasajero_id}.`);
  
  return {
    success: true,
    message: "Feedback recibido correctamente por la Feedback App."
  };
}

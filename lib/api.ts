// --- MOCKS DE APIs EXTERNAS --- //
// Acá centralizamos las llamadas a otros microservicios (Driver App, Payments App).
// Cuando tengas las APIs reales, simplemente cambiamos el contenido de estas funciones
// por fetch('URL_REAL') y el resto de la app seguirá funcionando intacta.

export async function fetchPaymentsAppMock() {
  // Simula la respuesta de: GET /api/payments/pricing-estimate
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

export async function fetchDriverAppPoolMock() {
  // Simula la respuesta de: POST /api/pools
  return {
    "pool_id": `pool_mock_${Math.floor(Math.random() * 1000)}`, // Genera un ID falso aleatorio
    "status": "AVAILABLE",
    "current_passengers": 1,
    "max_capacity": 15
  }
}

export async function fetchDriverAppMock() {
  // Simulamos la respuesta oficial del contrato: GET /api/pools/:pool_id/assigned-driver
  return {
    "pool_id": "pool_abc123",
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

// --- MOCK: Driver App (Cancelación de reserva) ---
export async function cancelReservationMock(pool_id: string, reservation_id: string) {
  // Simula la respuesta exacta de: DELETE /api/pools/:pool_id/reservations/:reservation_id
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.log(`[MOCK API] DELETE /api/pools/${pool_id}/reservations/${reservation_id} -> Asiento liberado.`);
  return {
    "pool_id": pool_id,
    "reservation_id": reservation_id,
    "current_passengers": 4, // Simulamos que quedaban 4
    "pool_status": "AVAILABLE"
  };
}

// --- MOCK: Feedback App ---
export async function submitFeedbackMock(reserva_id: string, pasajero_id: string) {
  // Simulamos una demora de red de 500ms
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  console.log(`[MOCK API] POST /api/feedback -> Calificación de 5 estrellas enviada para reserva ${reserva_id} por pasajero ${pasajero_id}.`);
  
  return {
    success: true,
    message: "Feedback recibido correctamente por la Feedback App."
  };
}


// Simulación API: Payments App - Cotización de viaje
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

// Simulación API: Driver App - Crear nuevo pool (unidad de viaje)
export async function createDriverAppPoolMock() {
  return {
    "pool_id": `pool_mock_${Math.floor(Math.random() * 1000)}`,
    "status": "AVAILABLE",
    "current_passengers": 1,
    "max_capacity": 15
  }
}

// Simulación API: Driver App - Obtener datos del conductor asignado
export async function getDriverAppAssignedDriverMock(pool_id: string) {
  return {
    "pool_id": pool_id,
    "pool_status": "ASSIGNED",
    "driver": {
      "driver_user_id": "user_driver_01",
      "full_name": "Juliana Pagani" 
    },
    "vehicle": {
      "vehicle_id": "veh_123",
      "brand": "Mercedes-Benz",
      "model": "Sprinter",
      "license_plate": "AF123JK"
    }
  };
}

// Simulación API: Driver App - Consultar estado de la unidad en tiempo real
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

// Simulación API: Driver App - Cancelar reserva y liberar asiento
export async function cancelReservationMock(pool_id: string, reservation_id: string) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    "pool_id": pool_id,
    "reservation_id": reservation_id,
    "current_passengers": 4,
    "pool_status": "AVAILABLE"
  };
}

// Simulación API: Feedback App - Obtener calificación de un conductor
export async function getFeedbackAppRatingMock(user_id: string) {
  return {
    "user_id": user_id,
    "role": "driver",
    "average_rating": 4.8,
    "total_reviews": 25
  }
}

// Simulación API: Feedback App - Enviar calificación de un viaje
export async function submitFeedbackMock(reserva_id: string, pasajero_id: string) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  return {
    success: true,
    message: "Feedback recibido correctamente por la Feedback App."
  };
}

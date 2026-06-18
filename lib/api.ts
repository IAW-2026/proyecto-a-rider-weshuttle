/* =========================================================================
   CONSUMO HACIA DRIVER APP (Logística)
   ========================================================================= */

// 1. GET /api/pools/search
export async function searchDriverAppPoolsMock(destination_id: string, departure_time: string) {
  // Nota: Para probar el caso donde NO hay combi, podrías cambiar exists a "false" temporalmente.
  return {
    exists: true,
    pool: {
      pool_id: "pool_abc123",
      destination_id: destination_id,
      departure_time: departure_time,
      status: "AVAILABLE",
      current_passengers: 5,
      max_capacity: 15
    }
  };
}

// 2. POST /api/pools
export async function createDriverAppPoolMock(destination_id: string, departure_time: string, reservation_id: string, passenger_user_id: string, pickup_point: any) {
  return {
    pool_id: "pool_abc123",
    status: "AVAILABLE",
    current_passengers: 1,
    max_capacity: 15
  };
}

// 3. POST /api/pools/:pool_id/reservations
export async function addReservationToPoolMock(pool_id: string, reservation_id: string, passenger_user_id: string, pickup_point: any) {
  return {
    pool_id: pool_id,
    reservation_id: reservation_id,
    pool_status: "AVAILABLE",
    current_passengers: 6,
    max_capacity: 15
  };
}

// 4. DELETE /api/pools/:pool_id/reservations/:reservation_id
export async function cancelReservationMock(pool_id: string, reservation_id: string) {
  return {
    pool_id: pool_id,
    reservation_id: reservation_id,
    current_passengers: 5,
    pool_status: "AVAILABLE"
  };
}

// 5. GET /api/pools/:pool_id/status
export async function getDriverAppPoolStatusMock(pool_id: string) {
  return {
    pool_id: pool_id,
    status: "IN_PROGRESS",
    destination_id: "dest_polo_petroquimico",
    departure_time: "2026-06-10T08:00:00Z",
    current_passengers: 8,
    max_capacity: 15,
    target_user_id: "user_def456",
    hito: "El conductor está en camino a tu ubicación",
    updated_at: "2026-06-10T07:15:00Z"
  };
}

// 6. GET /api/pools/:pool_id/assigned-driver
export async function getDriverAppAssignedDriverMock(pool_id: string) {
  return {
    pool_id: pool_id,
    pool_status: "ASSIGNED",
    driver: {
      driver_user_id: "user_driver_01",
      full_name: "Juliana Pagani"
    },
    vehicle: {
      vehicle_id: "veh_123",
      brand: "Mercedes-Benz",
      model: "Sprinter",
      license_plate: "AF123JK"
    }
  };
}

/* =========================================================================
   CONSUMO HACIA PAYMENTS APP (Cobros)
   ========================================================================= */

// 1. GET /api/payments/pricing-estimate
export async function fetchPaymentsAppPricingMock(origin_lat: number, origin_lng: number, destination_id: string, current_passengers: number) {
  return {
    currency: "ARS",
    max_price: 5000,
    estimated_price: 4200,
    current_passengers: current_passengers || 5,
    pricing_detail: {
      base_price: 5000,
      estimated_discount: 800,
      discount_reason: "OCCUPANCY_DISCOUNT"
    }
  };
}

// 2. POST /api/payments/reservations/:reservation_id/checkout
export async function createPaymentsCheckoutMock(reservation_id: string, passenger_user_id: string, max_price: number) {
  return {
    checkout_id: "checkout_123",
    reservation_id: reservation_id,
    pool_id: "pool_abc123",
    passenger_user_id: passenger_user_id,
    payment_url: "https://payments-app.com/checkout/checkout_123", // Simulación del link de MP
    max_price: max_price,
    available_credit: 1200,
    credit_applied: 1200,
    amount_to_charge: Math.max(0, max_price - 1200),
    currency: "ARS",
    checkout_status: "CREATED"
  };
}

// 4. GET /api/payments/users/:user_id/credit-balance
export async function getUserCreditBalanceMock(user_id: string) {
  return {
    user_id: user_id,
    available_credit: 1800,
    currency: "ARS"
  };
}

/* =========================================================================
   CONSUMO HACIA FEEDBACK APP (Reseñas)
   ========================================================================= */

// 1. GET /api/ratings/:user_id
export async function getFeedbackAppRating(user_id: string, role: string = 'driver') {
  // Usamos la misma variable de entorno que ya pusiste para el botón de la campanita
  const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_APP_URL;
  
  if (!feedbackUrl) {
    console.warn("Aviso: Falta configurar NEXT_PUBLIC_FEEDBACK_APP_URL en Vercel");
    return { average_rating: null, total_reviews: 0 };
  }

  try {
    // Hacemos el fetch de verdad a la app de Juan
    const res = await fetch(`${feedbackUrl}/api/ratings/${user_id}?role=${role}`);
    if (!res.ok) throw new Error(`Error de Feedback App: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Error al obtener rating del conductor:", error);
    return { average_rating: null, total_reviews: 0 }; // Si Juan se cae, tu app no explota
  }
}

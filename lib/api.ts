import { auth } from '@clerk/nextjs/server'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  try {
    const { getToken } = await auth();
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (e) {
    // Catch auth context errors during build/static generation
  }
  return headers;
}

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
      driver_user_id: "user_3EYQtdZpi4fPlmXGq4EKEa1onL0",
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
export async function fetchPaymentsAppPricing(origin_lat: number, origin_lng: number, destination_id: string, current_passengers: number) {
  const paymentsUrl = process.env.NEXT_PUBLIC_PAYMENTS_APP_URL || 'https://proyecto-a-payments-weshuttle.vercel.app';
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${paymentsUrl}/api/payments/pricing-estimate?origin_lat=${origin_lat}&origin_lng=${origin_lng}&destination_id=${destination_id}&current_passengers=${current_passengers}`, {
      headers
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Payments pricing API error response (status ${res.status}):`, errText);
      throw new Error(`Payments pricing API returned status ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Error fetching pricing from Payments App:", error);
    // Fallback mock to prevent app crash if Payments App is down
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
}

// 2. POST /api/payments/reservations/:reservation_id/checkout
export async function createPaymentsCheckout(reservation_id: string, pool_id: string, passenger_user_id: string, max_price: number, currency: string = "ARS") {
  const paymentsUrl = process.env.NEXT_PUBLIC_PAYMENTS_APP_URL || 'https://proyecto-a-payments-weshuttle.vercel.app';
  const riderUrl = process.env.NEXT_PUBLIC_RIDER_APP_URL || 'https://proyecto-a-rider-weshuttle.vercel.app';
  
  const body = {
    pool_id,
    passenger_user_id,
    max_price,
    currency,
    success_url: `${riderUrl}/mis-viajes?toast=Pago%20procesado%20correctamente#viaje-${reservation_id}`,
    failure_url: `${riderUrl}/mis-viajes?toast=Error:%20Pago%20rechazado&toastType=error#viaje-${reservation_id}`,
    pending_url: `${riderUrl}/mis-viajes?toast=Pago%20pendiente&toastType=warning#viaje-${reservation_id}`
  };

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${paymentsUrl}/api/payments/reservations/${reservation_id}/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Payments checkout API error response (status ${res.status}):`, errText);
      throw new Error(`Payments checkout API returned status ${res.status}: ${errText}`);
    }
    const data = await res.json();
    console.log("Payments checkout API response payload:", JSON.stringify(data));
    return data;
  } catch (error) {
    console.error("Error creating checkout in Payments App:", error);
    // Fallback mock for testing in case Payments App is down
    return {
      checkout_id: "checkout_123",
      reservation_id: reservation_id,
      pool_id: pool_id,
      passenger_user_id: passenger_user_id,
      payment_url: `${riderUrl}/mis-viajes?toast=Pago%20procesado%20correctamente#viaje-${reservation_id}`,
      checkout_url: `${riderUrl}/mis-viajes?toast=Pago%20procesado%20correctamente#viaje-${reservation_id}`,
      max_price: max_price,
      available_credit: 0,
      credit_applied: 0,
      amount_to_charge: max_price,
      currency: currency,
      checkout_status: "CREATED"
    };
  }
}

// 4. GET /api/payments/users/:user_id/credit-balance
export async function getUserCreditBalance(user_id: string) {
  const paymentsUrl = process.env.NEXT_PUBLIC_PAYMENTS_APP_URL || 'https://proyecto-a-payments-weshuttle.vercel.app';
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${paymentsUrl}/api/payments/users/${user_id}/credit-balance`, {
      headers
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Payments credit-balance API error response (status ${res.status}):`, errText);
      throw new Error(`Payments credit-balance API returned status ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Error fetching user credit balance from Payments App:", error);
    return {
      user_id: user_id,
      available_credit: 0,
      currency: "ARS"
    };
  }
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
    const headers = await getAuthHeaders();
    const res = await fetch(`${feedbackUrl}/api/ratings/${user_id}?role=${role}`, {
      headers
    });
    if (!res.ok) throw new Error(`Error de Feedback App: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Error al obtener rating del conductor:", error);
    return { average_rating: null, total_reviews: 0 }; // Si Juan se cae, tu app no explota
  }
}

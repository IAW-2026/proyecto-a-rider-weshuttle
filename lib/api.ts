import { auth } from '@clerk/nextjs/server'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  // Si existe la clave interna para comunicación inter-servicios, la usamos prioritariamente
  const internalKey = process.env.WESHUTTLE_INTERNAL_KEY;
  if (internalKey) {
    headers['Authorization'] = `Bearer ${internalKey}`;
    return headers;
  }

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
export async function searchDriverAppPools(destination_id: string, departure_time: string) {
  const driverUrl = process.env.NEXT_PUBLIC_DRIVER_APP_URL || '';
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${driverUrl}/api/pools/search?destination_id=${destination_id}&departure_time=${departure_time}`, {
      headers
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Driver App search pools API error response (status ${res.status}):`, errText);
      throw new Error(`Driver App search pools API returned status ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Error searching pools in Driver App:", error);
    throw error;
  }
}

// 2. POST /api/pools
export async function createDriverAppPool(destination_id: string, departure_time: string, reservation_id: string, passenger_user_id: string, pickup_point: any) {
  const driverUrl = process.env.NEXT_PUBLIC_DRIVER_APP_URL || '';
  const body = {
    destination_id,
    departure_time,
    reservation_id,
    passenger_user_id,
    pickup_point
  };
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${driverUrl}/api/pools`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Driver App create pool API error response (status ${res.status}):`, errText);
      throw new Error(`Driver App create pool API returned status ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Error creating pool in Driver App:", error);
    throw error;
  }
}

// 3. POST /api/pools/:pool_id/reservations
export async function addReservationToPool(pool_id: string, reservation_id: string, passenger_user_id: string, pickup_point: any) {
  const driverUrl = process.env.NEXT_PUBLIC_DRIVER_APP_URL || '';
  const body = {
    reservation_id,
    passenger_user_id,
    pickup_point
  };
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${driverUrl}/api/pools/${pool_id}/reservations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Driver App add reservation API error response (status ${res.status}):`, errText);
      throw new Error(`Driver App add reservation API returned status ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Error adding reservation to pool in Driver App:", error);
    throw error;
  }
}

// 4. DELETE /api/pools/:pool_id/reservations/:reservation_id
export async function cancelReservation(pool_id: string, reservation_id: string) {
  const driverUrl = process.env.NEXT_PUBLIC_DRIVER_APP_URL || '';
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${driverUrl}/api/pools/${pool_id}/reservations/${reservation_id}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Driver App cancel reservation API error response (status ${res.status}):`, errText);
      throw new Error(`Driver App cancel reservation API returned status ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Error canceling reservation in Driver App:", error);
    throw error;
  }
}

// 5. GET /api/pools/:pool_id/status
export async function getDriverAppPoolStatus(pool_id: string) {
  const driverUrl = process.env.NEXT_PUBLIC_DRIVER_APP_URL || '';
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${driverUrl}/api/pools/${pool_id}/status`, {
      headers
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Driver App pool status API error response (status ${res.status}):`, errText);
      throw new Error(`Driver App pool status API returned status ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Error getting pool status in Driver App:", error);
    throw error;
  }
}

// 6. GET /api/pools/:pool_id/assigned-driver
export async function getDriverAppAssignedDriver(pool_id: string) {
  const driverUrl = process.env.NEXT_PUBLIC_DRIVER_APP_URL || '';
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${driverUrl}/api/pools/${pool_id}/assigned-driver`, {
      headers
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Driver App assigned driver API error response (status ${res.status}):`, errText);
      throw new Error(`Driver App assigned driver API returned status ${res.status}: ${errText}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Error getting assigned driver in Driver App:", error);
    throw error;
  }
}

/* =========================================================================
   CONSUMO HACIA PAYMENTS APP (Cobros)
   ========================================================================= */

// 1. GET /api/payments/pricing-estimate
export async function fetchPaymentsAppPricing(origin_lat: number, origin_lng: number, destination_id: string, current_passengers: number) {
  const paymentsUrl = process.env.NEXT_PUBLIC_PAYMENTS_APP_URL || '';
  const url = `${paymentsUrl}/api/payments/pricing-estimate?origin_lat=${origin_lat}&origin_lng=${origin_lng}&destination_id=${destination_id}&current_passengers=${current_passengers}`;
  console.log("Fetching pricing estimate URL:", url);
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(url, {
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
    throw error;
  }
}

// 2. POST /api/payments/reservations/:reservation_id/checkout
export async function createPaymentsCheckout(reservation_id: string, pool_id: string, passenger_user_id: string, max_price: number, currency: string = "ARS") {
  const paymentsUrl = process.env.NEXT_PUBLIC_PAYMENTS_APP_URL || '';
  const riderUrl = process.env.NEXT_PUBLIC_RIDER_APP_URL || '';

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
    throw error;
  }
}

// 4. GET /api/payments/users/:user_id/credit-balance
export async function getUserCreditBalance(user_id: string) {
  const paymentsUrl = process.env.NEXT_PUBLIC_PAYMENTS_APP_URL || '';
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

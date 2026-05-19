# 🛸 WeShuttle: Documentación Técnica de Rider App

## 📝 Descripción General
La **Rider App** es el componente central para la experiencia del pasajero en el ecosistema WeShuttle. Su responsabilidad principal es la gestión del ciclo de vida de las **Reservas**, el mantenimiento de la inmutabilidad de los datos comerciales y la sincronización en tiempo real con el resto de los microservicios.

---

## 🏗️ Arquitectura del Sistema
WeShuttle funciona bajo una arquitectura de microservicios distribuidos:

| Aplicación | Responsabilidad Principal |
| :--- | :--- |
| **Rider App** | Usuarios finales, Gestión de Reservas e Historial. |
| **Driver App** | Gestión de Pools, Marketplace de conductores y Vehículos. |
| **Payments App** | Cotizaciones, Cobro automático y Liquidación. |
| **Feedback App** | Sistema de reseñas y reputación (estrellas). |

---

## 🔄 Flujo de Trabajo (Workflow)

### 1. Reserva y Cotización
* El pasajero selecciona **Destino** y **Horario**.
* La Rider App consulta a la Driver App por pools existentes para optimizar la ocupación.
* La Payments App devuelve el **Precio Máximo** (Snapshot inmutable) y el **Precio Estimado**.
* Si el pool ya tiene conductor, se integra su información y calificaciones desde Feedback App.

### 2. Estados de la Reserva (`status`)
La entidad `reservation` transiciona por los siguientes estados clave:

* `PENDING_DRIVER`: Reserva creada, a la espera de un conductor en la Driver App.
* `CONFIRMED`: El pool ya cuenta con un conductor asignado.
* `PAID`: El cobro automático fue exitoso (se ejecuta en T-1h).
* `DENIED`: El pago fue rechazado por la pasarela; el pasajero pierde su lugar.
* `CANCELED`: Cancelación por parte del usuario o del sistema (ej. falta de conductor).

### 3. Cierre y Cobro Automático (T-1h)
Una hora antes de la partida, la Driver App bloquea el pool (`LOCKED`). La Payments App solicita el **Manifiesto de Pasajeros** a la Rider App. El precio final real (`effective_price`) se registra tras la confirmación del pago.

---

## 📊 Modelo de Datos (Prisma Schema)

### 👥 Pasajeros (`passengers`)
* `id`: UUID interno único.
* `clerk_user_id`: Identificador de autenticación (Clerk).
* `status`: Estado del usuario (`ACTIVE`, `INACTIVE`, `BLOCKED`).

### 📍 Destinos (`destinations`)
* `id`: UUID.
* `name`: Nombre del destino industrial (ej. Polo Petroquímico).
* `lat / lng`: Coordenadas precisas para el punto de llegada.
* `active`: Booleano para disponibilidad de reservas.

### 🎟️ Reservas (`reservations`)
Entidad crítica que garantiza la integridad de la transacción.
* **Snapshots de Inmutabilidad:**
    * `max_price`: Límite superior de cobro informado al usuario.
    * `assigned_driver_snapshot`: JSON con datos de conductor y vehículo en el momento de la asignación.
* **Datos Financieros:**
    * `effective_price`: Monto real debitado de la cuenta del pasajero.
    * `payment_transaction_id`: ID único de la transacción en la Payments App.
* **Atributos Operativos:**
    * `pool_id`: Referencia externa al pool en la Driver App.
    * `pickup_address`: Dirección exacta de recogida.

### 🔔 Notificaciones (`passenger_notifications`)
Sistema de persistencia para el historial de eventos del usuario.
* `type`: Categoría del evento (`TRIP_STARTED`, `DRIVER_ARRIVED`, `PAYMENT_DENIED`).
* `read_at`: Control de visualización para el frontend.

---

## 🛡️ Reglas de Negocio Críticas
1. **Inmutabilidad Absoluta:** No se permiten ediciones sobre reservas confirmadas. Cualquier cambio de destino o fecha requiere la **cancelación y creación de una nueva reserva**.
2. **Propiedad del Manifiesto:** La Rider App es la fuente de verdad de la lista de pasajeros. Driver App consume esta información para el recorrido del chofer.
3. **Polling y Sincronización:** La Rider App debe consultar activamente el estado del pool para informar \"Hitos\" (ej: *\"El conductor llegó a tu ubicación\"*).
4. **Habilitación de Reseñas:** El flujo de feedback solo se activa para reservas en estado `PAID` una vez que el pool llega a `COMPLETED`."""

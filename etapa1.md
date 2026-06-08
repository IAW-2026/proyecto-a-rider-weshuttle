# 1.1 — Descripción del Sistema

> **Tipo A — Plataforma de Transporte (WeShuttle)**

## ¿Qué problema resuelve?
**WeShuttle** optimiza el traslado de personal inicialmente hacia los nodos industriales de Bahía Blanca (Polo Petroquímico, Puerto de Ingeniero White y Parque Industrial) y escalable a futuro para otras empresas con lejanía considerable.  Resuelve la falta de transporte flexible y el alto costo del viaje individual mediante un modelo de **Pool Programado** en combis de hasta 15 pasajeros. El sistema ofrecerá una interfaz mediante la cual los trabajadores puedan solicitar y unirse a viajes con mismo destino y horario. De esta manera a medida que va aumentando el numero de pasajeros de un viaje, el precio individual va a ir bajando, reduciendo los altos costos de transporte. 

## Actores del sistema
| Actor | Descripción | Apps donde interactúa |
|-------|-------------|----------------------|
| **Pasajero (Rider)** | Reserva su lugar en pools, visualiza precios estimados, paga el precio máximo al momento de reservar y recibe saldo a favor si el precio final del viaje resulta menor por la ocupación del pool. Al finalizar su viaje puede realizar una reseña al conductor. | Rider, Payments, Feedback |
| **Conductor (Driver)** | Acepta viajes del marketplace, actualiza el estado del recorrido, recibe su liquidación y puede realizar una reseña a cada pasajero. | Driver, Payments, Feedback |
| **Administrador** | Gestiona los datos principales de cada app y visualiza listados y reportes | Rider, Driver, Payments, Feedback y posteriormente Control Plane|

## Flujo principal de uso

### Estados principales

#### Estados de la reserva en Rider App

- `PENDING_PAYMENT`: la reserva fue creada, pero todavía no tiene pago exitoso.
- `PENDING_DRIVER`: la reserva ya fue pagada, pero el pool todavía no tiene conductor asignado.
- `CONFIRMED`: la reserva ya fue pagada y el pool tiene conductor asignado.
- `CANCELED`: la reserva fue cancelada.

#### Estados de pago de la reserva

- `UNPAID`: la reserva todavía no fue pagada.
- `PENDING`: el pago fue iniciado pero todavía no fue confirmado.
- `PAID`: el pago fue exitoso.
- `DENIED`: el pago fue rechazado.

#### Estados del pool en Driver App

- `AVAILABLE`: el pool está creado y disponible en el marketplace para que un conductor lo acepte.
- `ASSIGNED`: un conductor aceptó el pool.
- `LOCKED`: el pool fue cerrado 1 hora antes de la partida y ya no permite nuevas reservas ni cancelaciones voluntarias.
- `IN_PROGRESS`: el conductor inició el recorrido.
- `COMPLETED`: el viaje finalizó.
- `CANCELED`: el pool fue cancelado.

#### Estados de las reseñas en Feedback App

- `PRECREATED`: la reseña fue creada internamente, pero todavía no está visible para el usuario.
- `PENDING`: la reseña está disponible para que el usuario la complete.
- `COMPLETED`: la reseña fue completada por el usuario.

---

## 1. Solicitud de viaje y cotización

El pasajero solicita un viaje desde la **Rider App**. La brecha horaria permitida para reservar un viaje es desde 24 horas hasta 1 hora antes de la partida.

El usuario selecciona el destino y el horario del viaje. Luego, la **Rider App** consulta a la **Driver App** si ya existe un pool creado para ese destino y horario.

- Si existe un pool, la **Driver App** devuelve la cantidad de pasajeros actuales y el `pool_id` correspondiente.
- Si no existe un pool, la **Driver App** devuelve ocupación `0` y `pool_id = NULL`.

Con esta información, la **Rider App** consulta a la **Payments App** el precio máximo que el usuario va a pagar y el precio estimado del viaje(la diferencia a favor del usuario luego sera devuelta en forma de credito para proximos viajes), enviando el destino, el origen y la ocupación actual del pool.

La **Payments App** devuelve:

- el precio máximo que el pasajero va a pagar;
- el precio estimado según la ocupación actual del pool.

Con estos datos, el pasajero puede visualizar los posibles costos del viaje antes de confirmar la reserva.

Si al momento de solicitar el viaje ya existe un pool para ese destino y horario, y dicho pool ya tiene un conductor asignado, la **Rider App** también puede mostrar el nombre del conductor y su promedio de calificaciones.

Para esto, la **Rider App** obtiene la información del conductor desde la **Driver App** y su promedio de estrellas desde la **Feedback App**.

Antes de confirmar definitivamente la reserva, el pasajero será redirigido a la **Payments App** para realizar el pago del viaje.

La **Payments App** cobrará el precio máximo informado para la reserva. Si el pasajero tiene saldo a favor disponible, este se aplicará primero. Si el saldo no alcanza para cubrir el precio máximo, se cobrará la diferencia mediante Mercado Pago.

---

## 2. Reserva e inmutabilidad

Cuando el pasajero decide reservar, la **Rider App** crea una reserva en estado `PENDING_PAYMENT` y con `payment_status = UNPAID`.

Esta reserva todavía no incrementa la ocupación del pool.

Luego, la **Rider App** redirige al pasajero a la **Payments App** para realizar el pago del precio máximo.

Cuando la **Payments App** confirma el pago exitoso, notifica a la **Rider App**. En ese momento:

- la reserva actualiza `payment_status = PAID`;
- la reserva pasa a `PENDING_DRIVER` o `CONFIRMED`, según si el pool tiene conductor asignado o no;
- la **Rider App** notifica a la **Driver App** que debe sumar esa reserva al pool.

La **Rider App** guarda un snapshot comercial e inmutable de la reserva, que incluye:

- destino;
- horario;
- precio máximo que el pasajero termino pagando.

El precio máximo guardado representa el límite superior del cobro que termina pagando el usuario. El precio final del viaje nunca puede superar ese valor; a lo sumo, puede ser igual.

Si el usuario requiere un cambio posterior en el destino, horario u otra información relevante de la reserva, debe cancelar la reserva actual y crear una nueva.

Una vez creada la reserva:

- si el pool ya existía, la **Rider App** notifica a la **Driver App** que debe incrementar en 1 la ocupación del pool;
- si el pool no existía, la **Rider App** le solicita a la **Driver App** la creación de un nuevo pool y recibe el `pool_id` correspondiente.

Cuando un pasajero cancela su reserva, la **Rider App** actualiza la reserva al estado `CANCELED` y notifica a la **Driver App**. El viaje pagado queda como saldo a favor para la persona en futuros viajes. 

La **Driver App** decrementa la ocupación del pool. Si el pool queda vacío, lo elimina o lo marca como `CANCELED`, según corresponda.

---

## 3. Marketplace y asignación de conductor

Una vez creado, el pool se publica en el marketplace de la **Driver App** con estado `AVAILABLE`.

Al visualizar un pool en el marketplace, el conductor puede ver los pasajeros que ya se sumaron al pool. Junto a cada pasajero, la **Driver App** puede mostrar su promedio de calificaciones, obtenido desde la **Feedback App**.

Los conductores pueden aceptar viajes con antelación para organizar su agenda. Antes de poder aceptar un viaje, el conductor debe haber sido redirigido a la **Payments App** para configurar dónde quiere recibir sus pagos.

Cuando un conductor acepta el viaje:

- el estado del pool cambia a `ASSIGNED`;
- el pool desaparece del marketplace;
- las reservas asociadas al pool pasan de `PENDING_DRIVER` a `CONFIRMED`;
- la **Rider App** consulta a la **Driver App** la información básica del conductor asignado, la patente y modelo del vehiculo, y consulta a la **Feedback App** su promedio de calificaciones, para mostrar ambos datos a los pasajeros. 

Una vez que el conductor acepta un viaje, no puede cancelarlo. Esta funcionalidad se modelará en futuras etapas.

---

## 4. Caso sin conductor asignado

Si llega el momento de cierre del pool y ningún conductor aceptó el viaje, el pool se marca como `CANCELED`.

En ese caso:

- las reservas pagadas asociadas al pool pasan a estado `CANCELED`;
- la **Rider App** notifica a los pasajeros que el viaje fue cancelado por falta de conductor;
- la **Driver App** solicita a la **Payments App** que genere el ajuste de crédito correspondiente;
- la **Payments App** acredita a cada pasajero el monto pagado como saldo a favor para próximos viajes.

---

## 5. Cierre del pool y cálculo de saldo a favor (T-1h)

Una hora antes de la partida, la **Driver App** cierra el pool cambiando su estado a `LOCKED`.

El estado `LOCKED` bloquea nuevas reservas y cancelaciones voluntarias por parte de los usuarios.

En este momento ya no se realizan cobros automáticos, porque las reservas fueron pagadas al momento de crearse.

Al bloquear el pool, la **Driver App** solicita a la **Payments App** que calcule los ajustes de crédito correspondientes al pool.

La **Payments App** utiliza el `pool_id` para solicitarle a la **Rider App** el manifiesto de pasajeros pagados asociado al pool.

El precio final real se define en este momento y depende de la ocupación del pool al momento T-1h.

La **Payments App** compara, para cada reserva pagada:

- el precio máximo pagado al momento de reservar;
- el precio final calculado según la ocupación del pool.

Si el precio final es menor que el precio máximo pagado, la diferencia se acredita como saldo a favor para próximos viajes.

Luego, la **Payments App** notifica a la **Rider App** el resultado del ajuste para que pueda actualizar la reserva y mostrar una notificación al pasajero indicando que tiene saldo a favor.

## 6. Ejecución y seguimiento del viaje

Cuando el conductor consulta su recorrido final, la **Driver App** consume el manifiesto de la **Rider App**, filtrando únicamente las reservas en estado `PAID`.

Luego, la **Driver App** guarda una copia local del manifiesto final. Este snapshot operativo incluye los pasajeros y sus puntos de recogida.

Este snapshot permite que el conductor tenga toda la información necesaria para realizar el viaje, incluso si ocurren fallos de red o problemas de comunicación entre servicios.

Cuando el conductor inicia el recorrido, la **Driver App** cambia el estado del pool a `IN_PROGRESS`.

Al mismo tiempo, la **Driver App** notifica a la **Feedback App** para que pre-cree las reseñas de las reservas pagadas. Estas reseñas se crean inicialmente en estado `PRECREATED`, por lo que todavía no son visibles para los usuarios.

Durante el recorrido, el conductor selecciona al siguiente pasajero que debe retirar.

La **Driver App** actualiza en el estado granular del pool:

- el `target_user_id`, con el id del pasajero correspondiente;
- el `hito`, con el mensaje que debe visualizar ese pasajero.

Cuando el conductor se dirige hacia un pasajero, el `hito` se actualiza a:

> "El conductor está en camino a tu ubicación"

Cuando el conductor llega al punto de recogida, el `hito` se actualiza a:

> "El conductor llegó a tu ubicación"

Luego, cuando el conductor cambia el `target_user_id` para indicar el próximo pasajero a retirar, el pasajero anterior deja de ser el objetivo activo del recorrido y visualiza el mensaje:

> "Recorrido en progreso"

---

## 7. Sincronización de estado entre aplicaciones

La **Rider App** y la **Feedback App** realizan polling a la **Driver App** para obtener el estado actualizado del pool y del recorrido.

La **Rider App** utiliza esta información para:

- detectar cuando un pool pasa a `ASSIGNED`;
- actualizar las reservas de `PENDING_DRIVER` a `CONFIRMED`;
- mostrar la información del conductor;
- informar a los pasajeros cuando el conductor inicia el recorrido;
- mostrar los hitos correspondientes durante la búsqueda de cada pasajero;
- mostrar el resumen del viaje cuando el pool pasa a `COMPLETED`.

La **Feedback App** utiliza esta información para:

- monitorear el avance del viaje;
- detectar cuando el viaje finaliza;
- habilitar las reseñas correspondientes al finalizar el recorrido.

---

## 8. Finalización y liquidación

Al llegar a destino, el conductor marca el viaje como finalizado. La **Driver App** cambia el estado del pool a `COMPLETED`.

Cuando el pool pasa a `COMPLETED`, la **Driver App** notifica a la **Payments App** para que proceda con la liquidación de fondos al conductor.

Al detectar el estado `COMPLETED`, la **Rider App** muestra un resumen del viaje finalizado a cada uno de los pasajeros.

El resumen del viaje muestra los datos principales de la reserva, incluyendo destino, horario, conductor, vehículo, estado final del viaje y `effective_price`, es decir, el precio efectivamente pagado por el pasajero (este mismo valor también queda disponible para el historial de viajes del usuario dentro de la **Rider App**).

La **Feedback App** cambia el estado de las reseñas asociadas al pool de `PRECREATED` a `PENDING`. A partir de este momento, las reseñas quedan visibles y disponibles para los usuarios.

Luego, la **Feedback App** envía notificaciones a la **Rider App** y a la **Driver App** para informar que ya es posible reseñar el viaje, habilitando la redirección hacia la **Feedback App**.

---

## 9. Feedback mutuo

Dentro de la **Feedback App**, el usuario puede visualizar y completar todas sus reseñas pendientes, ordenadas desde la más reciente hasta la más antigua.

Cuando un usuario completa una reseña pendiente, esta cambia al estado `COMPLETED`.

Además, el usuario puede:

- generar reportes sobre sus viajes;
- visualizar sus reseñas completadas;
- consultar su promedio de estrellas;
- visualizar los reportes recibidos según su rol: pasajero o conductor.

# 1.2 — Asignación de Responsabilidades

> **Tipo A — Plataforma de Transporte (WeShuttle)**

## Distribución de webapps

| App | Responsable | Repositorio |
|-----|-------------|-------------|
| Driver App | Juliana Pagani | `proyecto-a-driver-[nombre]` |
| Rider App | Franco Gulino | `proyecto-a-rider-[nombre]` |
| Payments App | Juan Ignacio Ibarra | `proyecto-a-payments-[nombre]` |
| Feedback App | Juan Bassi | `proyecto-a-feedback-[nombre]` |

---

## Criterio general de separación

Cada webapp es responsable de sus propios datos y los persiste en su propia base de datos.

Ninguna aplicación accede directamente a la base de datos de otra. Cuando una app necesita consultar o modificar información que pertenece a otra, debe hacerlo a través de una API inter-servicio.

La definición detallada de cada endpoint, incluyendo request y response, se documenta en el archivo **1.3 — Diseño de APIs inter-servicios**.

---

## Datos propios de cada app (Persistencia)

### Driver App

La **Driver App** es responsable de la operación del viaje, la administración de conductores, vehículos y pools.

Datos propios:

- Conductores.
- Vehículos.
- Pools de viaje.
- Estado operativo del pool.
- Ocupación actual del pool.
- Marketplace de pools disponibles.
- Estado granular del recorrido, incluyendo:
  - pasajero objetivo actual;
  - hito o mensaje operativo del viaje.
- Snapshot operativo del manifiesto final del viaje.

Responsabilidades principales:

- Crear y administrar pools.
- Publicar pools en el marketplace.
- Permitir que un conductor acepte un pool.
- Administrar los cambios de estado del pool:
  - `AVAILABLE`
  - `ASSIGNED`
  - `LOCKED`
  - `IN_PROGRESS`
  - `COMPLETED`
  - `CANCELED`
- Mantener la ocupación del pool.
- Cancelar pools cuando corresponda.
- Informar a otras apps los cambios relevantes del viaje.
- Guardar la información operativa necesaria para que el conductor pueda realizar el recorrido.

---

### Rider App

La **Rider App** es responsable de la experiencia del pasajero, las reservas y el historial de viajes.

Datos propios:

- Pasajeros.
- Destinos disponibles.
- Reservas.
- Estado de cada reserva.
- Snapshot comercial de la reserva.
- Precio máximo informado al momento de reservar.
- Precio efectivo pagado por el pasajero.
- Historial de viajes del pasajero.

Responsabilidades principales:

- Permitir que un pasajero solicite un viaje.
- Crear reservas asociadas a pools.
- Mantener los estados de reserva:
 - `PENDING_PAYMENT`: la reserva fue creada, pero todavía no tiene pago exitoso.
 - `PENDING_DRIVER`: la reserva ya fue pagada, pero el pool todavía no tiene conductor asignado.
 - `CONFIRMED`: la reserva ya fue pagada y el pool tiene conductor asignado.
 - `CANCELED`: la reserva fue cancelada.
- Mantener el estado de pago de la reserva
  - `UNPAID`: la reserva todavía no fue pagada.
  - `PENDING`: el pago fue iniciado pero todavía no fue confirmado.
  - `PAID`: el pago fue exitoso.
  - `DENIED`: el pago fue rechazado
- Guardar los datos principales de la reserva para mantener su inmutabilidad.
- Crear reservas inicialmente en estado `PENDING_PAYMENT`.
- Redirigir al pasajero a Payments App para pagar la reserva.
- Confirmar la reserva solo cuando Payments App informa pago exitoso.
- Notificar a Driver App que una reserva se suma al pool solo después de que el pago fue exitoso.
- Guardar el estado de pago de la reserva.
- Guardar el precio máximo pagado, saldo aplicado, monto cobrado, precio final y saldo a favor generado.
- Mostrar al pasajero notificaciones cuando se genere saldo a favor.
- Informar a la Driver App cuando una reserva se suma a un pool.
- Informar a la Driver App cuando una reserva se cancela.
- Proveer el listado de pasajeros de un pool cuando otra app lo requiera.
- Actualizar la reserva con el resultado del pago informado por Payments App.
- Guardar el precio efectivo pagado para mostrarlo en el resumen e historial de viajes.
- Mostrar al pasajero el estado del viaje y la información disponible del conductor asignado.

---

### Payments App

La **Payments App** es responsable de precios, cobros, medios de pago, transacciones y liquidaciones.

Datos propios:

- Métodos de pago de pasajeros.
- Cuentas de cobro de conductores.
- Reglas de precios.
- Descuentos o ajustes aplicables.
- Cobros.
- Transacciones.
- Liquidaciones a conductores.
- Detalle de pagos realizados o rechazados.

Responsabilidades principales:

- Calcular el precio máximo de un viaje.
- Calcular el precio estimado según origen, destino y ocupación.
- Crear instancias de pago para reservas.
- Aplicar saldo a favor disponible antes de cobrar.
- Procesar el pago directo del pasajero al momento de reservar.
- Registrar cobros y transacciones.
- Informar a la Rider App el resultado del pago.
- Calcular el precio final del viaje al cierre T-1h según ocupación real.
- Generar saldo a favor cuando el precio final sea menor al precio máximo pagado.
- Mantener el saldo a favor de cada usuario.
- Notificar a la Rider App cuando se genere saldo a favor para una reserva.
- Procesar la liquidación al conductor cuando el viaje finaliza.
---

### Feedback App

La **Feedback App** es responsable de reseñas, calificaciones y reportes.

Datos propios:

- Reseñas.
- Estado de las reseñas.
- Promedios de calificación.
- Reportes.

Responsabilidades principales:

- Pre-crear reseñas cuando inicia un viaje.
- Mantener los estados de reseña:
  - `PRECREATED`
  - `PENDING`
  - `COMPLETED`
- Habilitar las reseñas cuando finaliza el viaje.
- Permitir que pasajeros califiquen conductores.
- Permitir que conductores califiquen pasajeros.
- Calcular y exponer el promedio de calificaciones de un usuario.
- Permitir consultar calificaciones individuales o en lote.
- Gestionar reportes.
- Notificar a Rider App y Driver App cuando las reseñas están disponibles.

---

## Datos o acciones que requieren comunicación entre apps (Interconectividad)

| App origen | Acción / dato necesario | App destino | API involucrada |
|------------|------------------------|-------------|-----------------|
| **Rider App** | Consultar si existe un pool para un destino y horario determinado | **Driver App** | `GET /api/pools/search?destination_id=:destination_id&departure_time=:departure_time` |
| **Rider App** | Solicitar la creación de un nuevo pool cuando no existe uno compatible | **Driver App** | `POST /api/pools` |
| **Rider App** | Notificar que una reserva se sumó a un pool existente | **Driver App** | `POST /api/pools/:pool_id/reservations` |
| **Rider App** | Notificar que una reserva fue cancelada para decrementar la ocupación del pool | **Driver App** | `DELETE /api/pools/:pool_id/reservations/:reservation_id` |
| **Rider App** | Consultar el estado actual del pool y sus datos operativos | **Driver App** | `GET /api/pools/:pool_id/status` |
| **Rider App** | Consultar la información del conductor y vehículo asignados a un pool | **Driver App** | `GET /api/pools/:pool_id/assigned-driver` |
| **Rider App**  | Consultar el promedio de calificaciones del usuario solicitado | **Feedback App** | `GET /api/ratings/:user_id` |
| **Rider App** | Solicitar precio máximo y precio estimado del viaje | **Payments App** | `GET /api/payments/pricing-estimate` |      
| **Driver App** | Consultar los pasajeros que ya se sumaron a un pool para mostrarlos en el marketplace | **Rider App** | `GET /api/pools/:pool_id/passengers` |
| **Driver App** | Consultar el promedio de calificaciones de los pasajeros de un pool | **Feedback App** | `GET /api/ratings/pools/:pool_id/passengers` |
| **Feedback App** | Consultar los pasajeros asociados a un pool para calcular sus calificaciones | **Rider App** | `GET /api/pools/:pool_id/passengers` |
| **Driver App** | Notificar que un pool fue cancelado por falta de conductor asignado | **Rider App** | `POST /api/pools/:pool_id/cancellations` |
| **Rider App** | Solicitar a Payments App la creación de un checkout para pagar una reserva | **Payments App** | `POST /api/payments/reservations/:reservation_id/checkout` |
| **Driver App** | Solicitar el cálculo de ajustes de crédito al cerrar o cancelar un pool | **Payments App** | `POST /api/payments/pools/:pool_id/credit-adjustments` |
| **Payments App** | Consultar el manifiesto de pasajeros pagados de un pool para calcular ajustes de crédito | **Rider App** | `GET /api/pools/:pool_id/passengers?status=PAID` |
| **Payments App** | Notificar a Rider App el saldo a favor generado para una reserva | **Rider App** | `PATCH /api/reservations/:reservation_id/credit-adjustment` |
| **Rider App** | Consultar el saldo a favor disponible de un usuario | **Payments App** | `GET /api/payments/users/:user_id/credit-balance` |
| **Payments App** | Notificar pago exitoso de una reserva, incluyendo el precio efectivo cobrado | **Rider App** | `PATCH /api/reservations/:reservation_id/payment-result` |
| **Payments App** | Notificar pago rechazado de una reserva | **Rider App** | `PATCH /api/reservations/:reservation_id/payment-result` |
| **Driver App** | Solicitar el manifiesto final de pasajeros pagados para iniciar el recorrido | **Rider App** | `GET /api/pools/:pool_id/passengers?status=PAID` |
| **Driver App** | Notificar inicio del recorrido para pre-crear reseñas | **Feedback App** | `POST /api/reviews/precreate` |
| **Rider App** | Consultar hitos y estado granular del recorrido | **Driver App** | `GET /api/pools/:pool_id/status` |
| **Feedback App** | Consultar estado del pool para monitorear avance y finalización del viaje | **Driver App** | `GET /api/pools/:pool_id/status` |
| **Driver App** | Informar fin del viaje para liquidar fondos al conductor | **Payments App** | `POST /api/payments/pools/:pool_id/settle` |
| **Feedback App** | Avisar al pasajero que ya puede reseñar el viaje | **Rider App** | `POST /api/notifications/feedback` |
| **Feedback App** | Avisar al conductor que ya puede reseñar a los pasajeros | **Driver App** | `POST /api/notifications/feedback` |

# 1.3 — Diseño de APIs Inter-Servicios

> **Tipo A — Plataforma de Transporte (WeShuttle)**

Este documento define los contratos de APIs entre las aplicaciones del sistema.  
Cada endpoint listado corresponde a una integración entre dos webapps y debe respetarse para que cada integrante pueda desarrollar y mockear su aplicación de forma aislada.

---

## Convenciones generales

### Formato de fechas

Todas las fechas y horarios se envían en formato ISO 8601.

Ejemplo:

```json
"2026-06-10T08:00:00Z"
```

---

### Identificadores de usuario

Los campos `user_id`, `passenger_user_id` y `driver_user_id` representan el identificador compartido del usuario autenticado en Clerk.

---

### Formato de errores

Todos los endpoints deben responder errores con el siguiente formato:

```json
{
  "error": "ERROR_CODE",
  "message": "Descripción del error"
}
```

Códigos HTTP comunes:

| Código | Uso |
|--------|-----|
| `400 Bad Request` | El request tiene datos inválidos o incompletos. |
| `401 Unauthorized` | No se envió un token válido. |
| `403 Forbidden` | El usuario o servicio no tiene permisos para realizar la acción. |
| `404 Not Found` | El recurso solicitado no existe. |
| `409 Conflict` | La acción no puede realizarse por el estado actual del recurso. |
| `500 Internal Server Error` | Error interno no controlado. |

---

## Estados utilizados

### Estados del pool

```text
AVAILABLE
ASSIGNED
LOCKED
IN_PROGRESS
COMPLETED
CANCELED
```

### Estados de reserva

```text
PENDING_DRIVER
CONFIRMED
PAID
DENIED
CANCELED
```

### Estados de reseña

```text
PRECREATED
PENDING
COMPLETED
```

---

# Driver App — Endpoints expuestos

La **Driver App** expone endpoints relacionados con pools, marketplace, conductor asignado, estado operativo del viaje y notificaciones para conductores.

---

## 1. GET `/api/pools/search`

### Descripción

Permite a la **Rider App** consultar si existe un pool para un destino y horario determinados.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Rider App | Driver App |

### Request

#### Query params

| Campo | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `destination_id` | string | Sí | Identificador del destino seleccionado. |
| `departure_time` | string | Sí | Fecha y hora de salida solicitada. |

### Ejemplo

```http
GET /api/pools/search?destination_id=dest_polo_petroquimico&departure_time=2026-06-10T08:00:00Z
```

### Response `200 OK`

Si existe un pool compatible:

```json
{
  "exists": true,
  "pool": {
    "pool_id": "pool_abc123",
    "destination_id": "dest_polo_petroquimico",
    "departure_time": "2026-06-10T08:00:00Z",
    "status": "AVAILABLE",
    "current_passengers": 5,
    "max_capacity": 15
  }
}
```

Si no existe un pool compatible:

```json
{
  "exists": false,
  "pool": null
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | `destination_id` o `departure_time` ausente o inválido. |
| `401 Unauthorized` | Token inválido o ausente. |
| `500 Internal Server Error` | Error interno al buscar pools. |

---

## 2. POST `/api/pools`

### Descripción

Permite a la **Rider App** solicitar la creación de un nuevo pool cuando no existe uno compatible.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Rider App | Driver App |

### Request body

```json
{
  "destination_id": "dest_polo_petroquimico",
  "departure_time": "2026-06-10T08:00:00Z",
  "reservation_id": "res_123",
  "passenger_user_id": "user_abc123",
  "pickup_point": {
    "address": "Av. Alem 1250, Bahía Blanca",
    "lat": -38.718,
    "lng": -62.266
  }
}
```

### Campos

| Campo | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `destination_id` | string | Sí | Identificador del destino. |
| `departure_time` | string | Sí | Fecha y hora de salida. |
| `reservation_id` | string | Sí | Identificador de la reserva creada en Rider App. |
| `passenger_user_id` | string | Sí | Identificador del pasajero. |
| `pickup_point.address` | string | Sí | Dirección del punto de recogida. |
| `pickup_point.lat` | number | Sí | Latitud del punto de recogida. |
| `pickup_point.lng` | number | Sí | Longitud del punto de recogida. |

### Response `201 Created`

```json
{
  "pool_id": "pool_abc123",
  "status": "AVAILABLE",
  "current_passengers": 1,
  "max_capacity": 15
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | Faltan datos obligatorios o tienen formato inválido. |
| `401 Unauthorized` | Token inválido o ausente. |
| `409 Conflict` | Ya existe un pool compatible o no se puede crear por reglas de negocio. |
| `500 Internal Server Error` | Error interno al crear el pool. |

---

## 3. POST `/api/pools/:pool_id/reservations`

### Descripción

Permite a la **Rider App** notificar que una reserva se sumó a un pool existente.

La **Driver App** incrementa la ocupación del pool.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Rider App | Driver App |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `pool_id` | string | Identificador del pool existente. |

### Request body

```json
{
  "reservation_id": "res_456",
  "passenger_user_id": "user_def456",
  "pickup_point": {
    "address": "Sarmiento 850, Bahía Blanca",
    "lat": -38.713,
    "lng": -62.261
  }
}
```

### Response `200 OK`

```json
{
  "pool_id": "pool_abc123",
  "reservation_id": "res_456",
  "pool_status": "AVAILABLE",
  "current_passengers": 6,
  "max_capacity": 15
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | Faltan datos obligatorios. |
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | El pool no existe. |
| `409 Conflict` | El pool está `LOCKED`, `COMPLETED`, `CANCELED` o alcanzó su capacidad máxima. |
| `500 Internal Server Error` | Error interno al asociar la reserva al pool. |

---

## 4. DELETE `/api/pools/:pool_id/reservations/:reservation_id`

### Descripción

Permite a la **Rider App** notificar que una reserva fue cancelada por el pasajero.

La **Driver App** decrementa la ocupación del pool.  
Si el pool queda vacío, lo elimina o lo marca como `CANCELED`.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Rider App | Driver App |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `pool_id` | string | Identificador del pool. |
| `reservation_id` | string | Identificador de la reserva cancelada. |

### Response `200 OK`

Si el pool sigue activo:

```json
{
  "pool_id": "pool_abc123",
  "reservation_id": "res_456",
  "current_passengers": 5,
  "pool_status": "AVAILABLE"
}
```

Si el pool queda vacío:

```json
{
  "pool_id": "pool_abc123",
  "reservation_id": "res_456",
  "current_passengers": 0,
  "pool_status": "CANCELED"
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | El pool o la reserva no existen. |
| `409 Conflict` | El pool está `LOCKED` y no permite cancelaciones voluntarias. |
| `500 Internal Server Error` | Error interno al cancelar la reserva en el pool. |

---

## 5. GET `/api/pools/:pool_id/status`

### Descripción

Devuelve el estado actual del pool y sus datos operativos.

Este endpoint puede ser consumido por:

- la **Rider App**, para mostrar el estado del viaje al pasajero;
- la **Feedback App**, para monitorear el avance y finalización del viaje.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Rider App | Driver App |
| Feedback App | Driver App |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `pool_id` | string | Identificador del pool. |

### Response `200 OK`

```json
{
  "pool_id": "pool_abc123",
  "status": "IN_PROGRESS",
  "destination_id": "dest_polo_petroquimico",
  "departure_time": "2026-06-10T08:00:00Z",
  "current_passengers": 8,
  "max_capacity": 15,
  "target_user_id": "user_def456",
  "hito": "El conductor está en camino a tu ubicación",
  "updated_at": "2026-06-10T07:15:00Z"
}
```

### Notas

- `target_user_id` puede ser `null` si no hay pasajero objetivo activo.
- `hito` puede ser `null` si el viaje todavía no inició o no hay mensaje granular vigente.

### Errores

| Código | Motivo |
|--------|--------|
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | El pool no existe. |
| `500 Internal Server Error` | Error interno al consultar el estado del pool. |

---

## 6. GET `/api/pools/:pool_id/assigned-driver`

### Descripción

Permite a la **Rider App** consultar la información del conductor y vehículo asignados a un pool.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Rider App | Driver App |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `pool_id` | string | Identificador del pool. |

### Response `200 OK`

Si el pool tiene conductor asignado:

```json
{
  "pool_id": "pool_abc123",
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
}
```

Si el pool todavía no tiene conductor asignado:

```json
{
  "pool_id": "pool_abc123",
  "pool_status": "AVAILABLE",
  "driver": null,
  "vehicle": null
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | El pool no existe. |
| `500 Internal Server Error` | Error interno al consultar conductor asignado. |

---



## 8. POST `/api/notifications/feedback`

### Descripción

Permite a la **Feedback App** avisar a la **Driver App** que el conductor ya puede reseñar a los pasajeros.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Feedback App | Driver App |

### Request body

```json
{
  "pool_id": "pool_abc123",
  "driver_user_id": "user_driver_01",
  "message": "Ya podés calificar a los pasajeros del viaje."
}
```

### Response `200 OK`

```json
{
  "notification_sent": true
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | Faltan datos obligatorios. |
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | No existe el conductor o el pool indicado. |
| `500 Internal Server Error` | Error interno al procesar la notificación. |

---

# Rider App — Endpoints expuestos

La **Rider App** expone endpoints relacionados con pasajeros, reservas, manifiestos, resultados de pago y notificaciones al pasajero.

---

## 1. GET `/api/pools/:pool_id/passengers`

### Descripción

Devuelve la lista de pasajeros asociados a un pool.

Este endpoint es central para el sistema y puede ser utilizado por:

- la **Driver App**, para mostrar los pasajeros que ya se sumaron a un pool en el marketplace;
- la **Payments App**, para obtener el manifiesto de pasajeros pagados y calcular ajustes de crédito;
- la **Driver App**, para obtener el manifiesto final de pasajeros pagados antes de iniciar el recorrido;
- la **Feedback App**, para obtener los pasajeros del pool y calcular sus promedios de calificación.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Driver App | Rider App |
| Payments App | Rider App |
| Feedback App | Rider App |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `pool_id` | string | Identificador del pool. |

### Query params opcionales

| Campo | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `reservation_status` | string | No | Permite filtrar reservas por estado operativo. Ejemplo: `CONFIRMED`. |
| `payment_status` | string | No | Permite filtrar reservas por estado de pago. Ejemplo: `PAID`. |

### Ejemplos

```http
GET /api/pools/pool_abc123/passengers
```

```http
GET /api/pools/pool_abc123/passengers?payment_status=PAID
```

```http
GET /api/pools/pool_abc123/passengers?reservation_status=CONFIRMED&payment_status=PAID
```

### Response `200 OK`

```json
{
  "pool_id": "pool_abc123",
  "passengers": [
    {
      "reservation_id": "res_101",
      "passenger_user_id": "user_abc123",
      "passenger_name": "Franco Gulino",
      "reservation_status": "CONFIRMED",
      "payment_status": "PAID",
      "pickup_point": {
        "address": "Av. Alem 1250, Bahía Blanca",
        "lat": -38.718,
        "lng": -62.266
      },
      "destination_id": "dest_polo_petroquimico",
      "departure_time": "2026-06-10T08:00:00Z",
      "max_price": 5000,
      "amount_charged": 3800,
      "credit_applied": 1200,
      "final_trip_price": null,
      "credit_granted": 0,
      "currency": "ARS"
    },
    {
      "reservation_id": "res_102",
      "passenger_user_id": "user_def456",
      "passenger_name": "Juan Ignacio Ibarra",
      "reservation_status": "PENDING_DRIVER",
      "payment_status": "PAID",
      "pickup_point": {
        "address": "Sarmiento 850, Bahía Blanca",
        "lat": -38.713,
        "lng": -62.261
      },
      "destination_id": "dest_polo_petroquimico",
      "departure_time": "2026-06-10T08:00:00Z",
      "max_price": 5000,
      "amount_charged": 5000,
      "credit_applied": 0,
      "final_trip_price": null,
      "credit_granted": 0,
      "currency": "ARS"
    }
  ]
}
```

### Response `200 OK` después del cálculo de crédito

```json
{
  "pool_id": "pool_abc123",
  "passengers": [
    {
      "reservation_id": "res_101",
      "passenger_user_id": "user_abc123",
      "passenger_name": "Franco Gulino",
      "reservation_status": "CONFIRMED",
      "payment_status": "PAID",
      "pickup_point": {
        "address": "Av. Alem 1250, Bahía Blanca",
        "lat": -38.718,
        "lng": -62.266
      },
      "destination_id": "dest_polo_petroquimico",
      "departure_time": "2026-06-10T08:00:00Z",
      "max_price": 5000,
      "amount_charged": 3800,
      "credit_applied": 1200,
      "final_trip_price": 3800,
      "credit_granted": 1200,
      "currency": "ARS"
    }
  ]
}
```

### Response `200 OK` sin resultados

```json
{
  "pool_id": "pool_abc123",
  "passengers": []
}
```

### Reglas del contrato

- `passengers` siempre debe ser un array.
- Si no hay pasajeros para el filtro solicitado, debe responder `passengers: []`.
- `reservation_status` representa el estado operativo de la reserva.
- `payment_status` representa el estado del pago asociado a la reserva.
- El filtro `payment_status=PAID` debe devolver únicamente reservas pagadas.
- Las reservas con `payment_status = DENIED` no forman parte efectiva del pool.
- La **Rider App** solo debe notificar a la **Driver App** que una reserva se suma al pool cuando el pago fue exitoso.
- La **Payments App** utiliza este endpoint con `payment_status=PAID` para calcular ajustes de crédito.
- La **Driver App** utiliza este endpoint con `payment_status=PAID` como manifiesto final operativo.
- La **Feedback App** utiliza este endpoint para obtener los pasajeros del pool y calcular sus promedios de calificación.
- `final_trip_price` puede ser `null` antes del cálculo de ajustes de crédito.
- `credit_granted` puede ser `0` si todavía no se generó saldo a favor o si no correspondía generarlo.

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | Alguno de los filtros enviados tiene un valor inválido. |
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | El pool no tiene reservas asociadas o no existe para Rider App. |
| `500 Internal Server Error` | Error interno al obtener pasajeros del pool. |

---

## 2. POST `/api/pools/:pool_id/cancellations`

### Descripción

Permite a la **Driver App** notificar a la **Rider App** que un pool fue cancelado por falta de conductor asignado.

La **Rider App** debe actualizar las reservas asociadas al pool a estado `CANCELED` y notificar a los pasajeros.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Driver App | Rider App |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `pool_id` | string | Identificador del pool cancelado. |

### Request body

```json
{
  "reason": "NO_DRIVER_ASSIGNED",
  "message": "El viaje fue cancelado porque no se asignó un conductor antes del horario límite."
}
```

### Response `200 OK`

```json
{
  "pool_id": "pool_abc123",
  "updated_reservations": 8,
  "new_reservation_status": "CANCELED",
  "notifications_sent": true
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | Falta el motivo de cancelación. |
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | No existen reservas asociadas al pool. |
| `409 Conflict` | Las reservas ya estaban canceladas o en un estado final incompatible. |
| `500 Internal Server Error` | Error interno al cancelar reservas. |

---

## 3. PATCH `/api/reservations/:reservation_id/payment-result`

### Descripción

Permite a la **Payments App** notificar a la **Rider App** el resultado del cobro de una reserva.

Si el pago fue exitoso:

- la reserva pasa a `PAID`;
- se guarda el `effective_price`.

Si el pago fue rechazado:

- la reserva pasa a `DENIED`;
- `effective_price` queda en `null`.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Payments App | Rider App |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `reservation_id` | string | Identificador de la reserva. |

### Request body para pago exitoso

```json
{
  "payment_status": "PAID",
  "transaction_id": "txn_123456",
  "max_price": 5000,
  "credit_applied": 1200,
  "amount_charged": 3800,
  "currency": "ARS",
  "processed_at": "2026-06-10T07:00:00Z"
}
```

### Request body para pago rechazado

```json
{
  "payment_status": "DENIED",
  "transaction_id": "txn_789012",
  "currency": "ARS",
  "rejection_reason": "INSUFFICIENT_FUNDS",
  "processed_at": "2026-06-10T07:00:00Z"
}
```

### Response `200 OK` para pago exitoso

```json
{
  "reservation_id": "res_101",
  "payment_status": "PAID",
  "reservation_status": "PENDING_DRIVER",
  "max_price": 5000,
  "credit_applied": 1200,
  "amount_charged": 3800
}
```

### Response `200 OK` para pago rechazado

```json
{
  "reservation_id": "res_101",
  "payment_status": "DENIED",
  "reservation_status": "PENDING_PAYMENT"
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | `payment_status` inválido o faltan datos requeridos. |
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | La reserva no existe. |
| `409 Conflict` | La reserva ya está en un estado final incompatible. |
| `500 Internal Server Error` | Error interno al actualizar el resultado del pago. |

---

## 4. POST `/api/notifications/feedback`

### Descripción

Permite a la **Feedback App** avisar a la **Rider App** que el pasajero ya puede reseñar el viaje.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Feedback App | Rider App |

### Request body

```json
{
  "pool_id": "pool_abc123",
  "passenger_user_id": "user_abc123",
  "message": "Ya podés calificar tu viaje."
}
```

### Response `200 OK`

```json
{
  "notification_sent": true
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | Faltan datos obligatorios. |
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | No existe el pasajero o el pool indicado. |
| `500 Internal Server Error` | Error interno al procesar la notificación. |

---

# Payments App — Endpoints expuestos

La **Payments App** expone endpoints relacionados con estimación de precios, cobros automáticos y liquidaciones.

---

## 1. GET `/api/payments/pricing-estimate`

### Descripción

Permite a la **Rider App** solicitar el precio máximo y el precio estimado del viaje antes de confirmar una reserva.

El cálculo se realiza según origen, destino y ocupación actual del pool.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Rider App | Payments App |

### Query params

| Campo | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `origin_lat` | number | Sí | Latitud del punto de origen. |
| `origin_lng` | number | Sí | Longitud del punto de origen. |
| `destination_id` | string | Sí | Identificador del destino. |
| `current_passengers` | number | Sí | Ocupación actual del pool. |

### Ejemplo

```http
GET /api/payments/pricing-estimate?origin_lat=-38.718&origin_lng=-62.266&destination_id=dest_polo_petroquimico&current_passengers=5
```

### Response `200 OK`

```json
{
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
```

### Reglas del contrato

- `max_price` representa el máximo que el usuario podría pagar.
- `estimated_price` puede variar hasta el cierre del pool.
- El precio final nunca puede superar `max_price`.

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | Faltan parámetros o tienen formato inválido. |
| `401 Unauthorized` | Token inválido o ausente. |
| `500 Internal Server Error` | Error interno al calcular el precio. |

---

## 2. POST `/api/payments/reservations/:reservation_id/checkout`

### Descripción

Permite a la **Rider App** solicitar a la **Payments App** la creación de una instancia de pago para una reserva.

Este endpoint se utiliza cuando el pasajero confirma que quiere reservar un viaje. La **Rider App** crea previamente una reserva en estado `PENDING_PAYMENT` y con `payment_status = UNPAID`. Luego llama a este endpoint para que la **Payments App** prepare el checkout correspondiente.

La **Payments App** calcula el saldo a favor disponible del pasajero, aplica ese saldo sobre el precio máximo de la reserva y determina cuánto debe cobrarse mediante Mercado Pago.

Luego, la **Payments App** devuelve una URL de pago para que la **Rider App** redirija al pasajero.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Rider App | Payments App |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `reservation_id` | string | Identificador de la reserva creada en Rider App. |

### Request body

```json
{
  "pool_id": "pool_abc123",
  "passenger_user_id": "user_abc123",
  "max_price": 5000,
  "currency": "ARS",
  "success_url": "https://rider-app.com/reservations/res_123/success",
  "failure_url": "https://rider-app.com/reservations/res_123/failure"
}
```

### Campos

| Campo | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `pool_id` | string | Sí | Identificador del pool asociado a la reserva. |
| `passenger_user_id` | string | Sí | Identificador del pasajero en Clerk. |
| `max_price` | number | Sí | Precio máximo que debe pagar el pasajero por la reserva. |
| `currency` | string | Sí | Moneda del pago. Ejemplo: `ARS`. |
| `success_url` | string | Sí | URL a la que se redirige al usuario si el pago fue exitoso. |
| `failure_url` | string | Sí | URL a la que se redirige al usuario si el pago fue rechazado o cancelado. |

### Response `201 Created`

```json
{
  "checkout_id": "checkout_123",
  "reservation_id": "res_123",
  "pool_id": "pool_abc123",
  "passenger_user_id": "user_abc123",
  "payment_url": "https://payments-app.com/checkout/checkout_123",
  "max_price": 5000,
  "available_credit": 1200,
  "credit_applied": 1200,
  "amount_to_charge": 3800,
  "currency": "ARS",
  "checkout_status": "CREATED"
}
```

### Reglas del contrato

- La **Rider App** no debe enviar al usuario directamente a Payments App con datos sensibles en la URL.
- La **Rider App** debe llamar primero a este endpoint para crear una instancia de checkout.
- La **Payments App** calcula el saldo disponible del usuario.
- Si el usuario tiene saldo a favor, este se aplica primero.
- Si el saldo a favor cubre todo el precio máximo, `amount_to_charge` puede ser `0`.
- Si `amount_to_charge = 0`, la **Payments App** puede marcar el pago como exitoso sin redirigir a Mercado Pago.
- Si `amount_to_charge > 0`, la **Payments App** genera una instancia de pago y devuelve `payment_url`.
- La reserva recién se considera pagada cuando la **Payments App** notifica a la **Rider App** mediante `PATCH /api/reservations/:reservation_id/payment-result`.

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | Faltan datos obligatorios o tienen formato inválido. |
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | No se encontró información suficiente para crear el checkout. |
| `409 Conflict` | Ya existe un checkout activo o pagado para esa reserva. |
| `500 Internal Server Error` | Error interno al crear el checkout. |

---

## 3. POST `/api/payments/pools/:pool_id/credit-adjustments`

### Descripción

Permite a la **Driver App** solicitar a la **Payments App** el cálculo de ajustes de crédito asociados a un pool.

Este endpoint reemplaza al cobro automático en T-1h. En este nuevo flujo, los pasajeros ya pagaron el precio máximo al momento de reservar. Por lo tanto, al cierre del pool ya no se cobran pagos automáticos.

En T-1h, o ante una cancelación del pool por falta de conductor, la **Payments App** calcula si corresponde generar saldo a favor para los pasajeros.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Driver App | Payments App |

### Comunicación interna requerida

La **Payments App** consulta a la **Rider App** el manifiesto de pasajeros pagados del pool mediante:

```http
GET /api/pools/:pool_id/passengers?payment_status=PAID
```

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `pool_id` | string | Identificador del pool sobre el cual se calculan los ajustes. |

### Request body para cierre normal del pool

```json
{
  "reason": "POOL_LOCKED",
  "departure_time": "2026-06-10T08:00:00Z",
  "current_passengers": 8
}
```

### Request body para cancelación por falta de conductor

```json
{
  "reason": "NO_DRIVER_ASSIGNED",
  "departure_time": "2026-06-10T08:00:00Z",
  "current_passengers": 0
}
```

### Campos

| Campo | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `reason` | string | Sí | Motivo del ajuste. Valores posibles: `POOL_LOCKED`, `NO_DRIVER_ASSIGNED`. |
| `departure_time` | string | Sí | Fecha y hora de salida del pool. |
| `current_passengers` | number | Sí | Ocupación del pool al momento del ajuste. |

### Response `200 OK` para cierre normal del pool

```json
{
  "pool_id": "pool_abc123",
  "reason": "POOL_LOCKED",
  "final_price": 3800,
  "processed_reservations": 8,
  "currency": "ARS",
  "credits_generated": [
    {
      "reservation_id": "res_101",
      "passenger_user_id": "user_abc123",
      "max_price_paid": 5000,
      "final_price": 3800,
      "credit_granted": 1200,
      "credit_balance_after": 1800
    },
    {
      "reservation_id": "res_102",
      "passenger_user_id": "user_def456",
      "max_price_paid": 5000,
      "final_price": 3800,
      "credit_granted": 1200,
      "credit_balance_after": 1200
    }
  ]
}
```

### Response `200 OK` para cancelación por falta de conductor

```json
{
  "pool_id": "pool_abc123",
  "reason": "NO_DRIVER_ASSIGNED",
  "final_price": 0,
  "processed_reservations": 2,
  "currency": "ARS",
  "credits_generated": [
    {
      "reservation_id": "res_101",
      "passenger_user_id": "user_abc123",
      "max_price_paid": 5000,
      "final_price": 0,
      "credit_granted": 5000,
      "credit_balance_after": 6200
    },
    {
      "reservation_id": "res_102",
      "passenger_user_id": "user_def456",
      "max_price_paid": 5000,
      "final_price": 0,
      "credit_granted": 5000,
      "credit_balance_after": 5000
    }
  ]
}
```

### Response `200 OK` si no se genera crédito

```json
{
  "pool_id": "pool_abc123",
  "reason": "POOL_LOCKED",
  "final_price": 5000,
  "processed_reservations": 4,
  "currency": "ARS",
  "credits_generated": []
}
```

### Reglas del contrato

- Este endpoint no realiza cobros.
- Este endpoint reemplaza al antiguo endpoint de cobro automático.
- Si `reason = POOL_LOCKED`, la **Payments App** calcula el precio final del viaje según la ocupación del pool.
- Si `reason = NO_DRIVER_ASSIGNED`, la **Payments App** acredita como saldo a favor el total pagado por cada reserva.
- La **Payments App** solo debe procesar reservas con `payment_status = PAID`.
- Para obtener esas reservas, la **Payments App** consulta a la **Rider App** mediante `GET /api/pools/:pool_id/passengers?payment_status=PAID`.
- Si el precio final es menor al precio máximo pagado, la diferencia se acredita como saldo a favor.
- El saldo a favor generado se guarda en **Payments App**.
- Por cada crédito generado, la **Payments App** debe notificar a la **Rider App** mediante `PATCH /api/reservations/:reservation_id/credit-adjustment`.
- La **Rider App** utiliza esa notificación para actualizar la reserva y mostrar una notificación o toast al pasajero.

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | Faltan datos obligatorios o `reason` tiene un valor inválido. |
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | No existen reservas pagadas asociadas al pool. |
| `409 Conflict` | Los ajustes de crédito para ese pool ya fueron procesados. |
| `502 Bad Gateway` | La Payments App no pudo obtener el manifiesto desde Rider App. |
| `500 Internal Server Error` | Error interno al calcular los ajustes de crédito. |

---

## 4. GET `/api/payments/users/:user_id/credit-balance`

### Descripción

Permite consultar el saldo a favor disponible de un usuario.

Este endpoint puede ser utilizado por la **Rider App** para mostrarle al pasajero cuánto saldo tiene disponible antes de iniciar un nuevo pago.

También puede ser utilizado por la propia **Payments App** para mostrar el saldo dentro de sus pantallas de usuario.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Rider App | Payments App |
| Payments App Frontend | Payments App Backend |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `user_id` | string | Identificador del usuario en Clerk. |

### Response `200 OK`

```json
{
  "user_id": "user_abc123",
  "available_credit": 1800,
  "currency": "ARS"
}
```

### Response `200 OK` si el usuario no tiene saldo a favor

```json
{
  "user_id": "user_abc123",
  "available_credit": 0,
  "currency": "ARS"
}
```

### Reglas del contrato

- La **Payments App** es la fuente de verdad del saldo a favor.
- La **Rider App** no calcula ni modifica el saldo a favor.
- Si el usuario no tiene cuenta de crédito creada, la **Payments App** puede responder `available_credit = 0`.
- El saldo a favor se aplica automáticamente al crear un checkout mediante `POST /api/payments/reservations/:reservation_id/checkout`.

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | El `user_id` tiene formato inválido. |
| `401 Unauthorized` | Token inválido o ausente. |
| `403 Forbidden` | El usuario no tiene permisos para consultar ese saldo. |
| `500 Internal Server Error` | Error interno al consultar el saldo a favor. |

---

## 5. POST `/api/payments/pools/:pool_id/settle`

### Descripción

Permite a la **Driver App** informar que el viaje finalizó y que corresponde liquidar los fondos al conductor.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Driver App | Payments App |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `pool_id` | string | Identificador del pool finalizado. |

### Request body

```json
{
  "driver_user_id": "user_driver_01",
  "completed_at": "2026-06-10T09:00:00Z"
}
```

### Response `200 OK`

```json
{
  "pool_id": "pool_abc123",
  "settlement_id": "settlement_123",
  "settlement_status": "COMPLETED",
  "driver_user_id": "user_driver_01",
  "amount": 30400,
  "currency": "ARS"
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | Faltan datos obligatorios. |
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | No existen cobros asociados al pool. |
| `409 Conflict` | El viaje no está completado o la liquidación ya fue realizada. |
| `500 Internal Server Error` | Error interno al liquidar fondos. |

---

# Feedback App — Endpoints expuestos

La **Feedback App** expone endpoints relacionados con calificaciones, promedios de reputación y pre-creación de reseñas.

---

## 1. GET `/api/ratings/:user_id`

### Descripción

Permite consultar el promedio de calificaciones de un usuario.

Este endpoint puede ser utilizado por la **Rider App** para mostrar el promedio del conductor asignado a un pool.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Rider App | Feedback App |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `user_id` | string | Identificador del usuario consultado. |

### Query params opcionales

| Campo | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `role` | string | No | Rol sobre el que se consulta el promedio. Ejemplo: `driver` o `rider`. |

### Response `200 OK`

Si el usuario tiene reseñas:

```json
{
  "user_id": "user_driver_01",
  "role": "driver",
  "average_rating": 4.8,
  "total_reviews": 25
}
```

Si el usuario todavía no tiene reseñas:

```json
{
  "user_id": "user_driver_01",
  "role": "driver",
  "average_rating": null,
  "total_reviews": 0
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | El rol enviado no es válido. |
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | El usuario no existe para Feedback App. |
| `500 Internal Server Error` | Error interno al consultar el promedio. |

---

## 2. GET `/api/ratings/pools/:pool_id/passengers`

### Descripción

Permite a la **Driver App** consultar el promedio de calificaciones de los pasajeros asociados a un pool.

La **Driver App** envía únicamente el `pool_id`. Luego, la **Feedback App** consulta a la **Rider App** la lista de pasajeros asociados a ese pool mediante:

```http
GET /api/pools/:pool_id/passengers
```

Con esa lista, la **Feedback App** calcula y devuelve el promedio de calificaciones de cada pasajero.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Driver App | Feedback App |

### Comunicación interna requerida

| App origen | App destino | API involucrada |
|------------|-------------|-----------------|
| Feedback App | Rider App | `GET /api/pools/:pool_id/passengers` |

### Path params

| Campo | Tipo | Descripción |
|------|------|-------------|
| `pool_id` | string | Identificador del pool cuyos pasajeros se quieren consultar. |

### Ejemplo

```http
GET /api/ratings/pools/pool_abc123/passengers
```

### Response `200 OK`

```json
{
  "pool_id": "pool_abc123",
  "ratings": [
    {
      "passenger_user_id": "user_abc123",
      "passenger_name": "Franco Gulino",
      "average_rating": 4.6,
      "total_reviews": 12
    },
    {
      "passenger_user_id": "user_def456",
      "passenger_name": "Juan Ignacio Ibarra",
      "average_rating": 4.9,
      "total_reviews": 8
    }
  ]
}
```

### Response `200 OK` cuando un pasajero no tiene reseñas

```json
{
  "pool_id": "pool_abc123",
  "ratings": [
    {
      "passenger_user_id": "user_abc123",
      "passenger_name": "Franco Gulino",
      "average_rating": null,
      "total_reviews": 0
    }
  ]
}
```

### Response `200 OK` cuando el pool no tiene pasajeros

```json
{
  "pool_id": "pool_abc123",
  "ratings": []
}
```

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | El `pool_id` tiene formato inválido. |
| `401 Unauthorized` | Token inválido o ausente. |
| `404 Not Found` | No se encontró el pool o no existen pasajeros asociados. |
| `502 Bad Gateway` | La Feedback App no pudo obtener los pasajeros desde la Rider App. |
| `500 Internal Server Error` | Error interno al consultar las calificaciones. |

## 3. POST `/api/reviews/precreate`

### Descripción

Permite a la **Driver App** notificar a la **Feedback App** que el viaje inició.

La **Driver App** envía el `pool_id` y el `driver_user_id`. Luego, la **Feedback App** consulta a la **Rider App** el listado de pasajeros asociados a ese pool que tengan reserva en estado `PAID`, mediante:

```http
GET /api/pools/:pool_id/passengers?status=PAID
```

Con esa lista, la **Feedback App** pre-crea las reseñas asociadas al viaje en estado `PRECREATED`.

Mientras las reseñas están en estado `PRECREATED`, no son visibles para los usuarios.

### Quién llama a quién

| App origen | App destino |
|------------|-------------|
| Driver App | Feedback App |

### Comunicación interna requerida

| App origen | App destino | API involucrada |
|------------|-------------|-----------------|
| Feedback App | Rider App | `GET /api/pools/:pool_id/passengers?status=PAID` |

### Request body

```json
{
  "pool_id": "pool_abc123",
  "driver_user_id": "user_driver_01",
  "started_at": "2026-06-10T08:00:00Z"
}
```

### Campos

| Campo | Tipo | Obligatorio | Descripción |
|------|------|-------------|-------------|
| `pool_id` | string | Sí | Identificador del pool cuyo viaje inició. |
| `driver_user_id` | string | Sí | Identificador del conductor asignado al pool. |
| `started_at` | string | Sí | Fecha y hora en la que inició el recorrido. |

### Response `201 Created`

```json
{
  "pool_id": "pool_abc123",
  "review_status": "PRECREATED",
  "paid_passengers_count": 2,
  "created_reviews": 4
}
```

### Response `200 OK` si no hay pasajeros pagados

```json
{
  "pool_id": "pool_abc123",
  "review_status": "PRECREATED",
  "paid_passengers_count": 0,
  "created_reviews": 0
}
```

### Reglas del contrato

Para cada viaje se generan reseñas en ambos sentidos:

- pasajeros hacia conductor;
- conductor hacia pasajeros.

La **Feedback App** solo debe pre-crear reseñas para pasajeros con reservas en estado `PAID`.

La cantidad final de reseñas creadas depende de la cantidad de pasajeros pagados obtenidos desde la **Rider App**.

Por cada pasajero pagado se crean:

- una reseña del pasajero hacia el conductor;
- una reseña del conductor hacia ese pasajero.

Por eso, en condiciones normales, `created_reviews` debería ser igual a:

```text
paid_passengers_count * 2
```

Si no hay pasajeros en estado `PAID`, no se crean reseñas.

### Errores

| Código | Motivo |
|--------|--------|
| `400 Bad Request` | Faltan datos obligatorios o tienen formato inválido. |
| `401 Unauthorized` | Token inválido o ausente. |
| `409 Conflict` | Las reseñas para ese pool ya fueron pre-creadas. |
| `502 Bad Gateway` | La Feedback App no pudo obtener los pasajeros pagados desde la Rider App. |
| `500 Internal Server Error` | Error interno al pre-crear reseñas. |

# 1.4 — Modelo de Datos por Aplicación

> **Tipo A — Plataforma de Transporte (WeShuttle)**

Cada webapp persiste sus propios datos en una base de datos independiente.

Ninguna aplicación accede directamente a la base de datos de otra app. Cuando una aplicación necesita información que pertenece a otra, debe obtenerla mediante las APIs inter-servicio definidas en el documento **1.3 — Diseño de APIs Inter-Servicios**.

El modelo de datos se define respetando las fuentes de verdad de cada dominio:

- **Clerk** es la fuente de verdad de identidad de usuarios.
- **Driver App** es la fuente de verdad de conductores, vehículos, pools y estado operativo del viaje.
- **Rider App** es la fuente de verdad de pasajeros, destinos, reservas e historial de viajes.
- **Payments App** es la fuente de verdad de precios, cobros, transacciones y liquidaciones.
- **Feedback App** es la fuente de verdad de reseñas, reportes y promedios de calificación.

Identificadores compartidos entre aplicaciones:

- `clerk_user_id`: identifica usuarios de forma transversal entre todas las apps.
- `pool_id`: identifica un pool creado por la **Driver App**.
- `reservation_id`: identifica una reserva creada por la **Rider App**.
- `transaction_id`: identifica una transacción creada por la **Payments App**.
- `review_id`: identifica una reseña creada por la **Feedback App**.

---

## Driver App

La **Driver App** administra la operación del viaje. Es responsable de los conductores, vehículos, pools, marketplace y estado operativo del recorrido.

La **Driver App** no almacena las reservas como entidad propia. Las reservas son responsabilidad de la **Rider App**. Cuando la Driver App necesita conocer los pasajeros asociados a un pool, debe consultar a la Rider App mediante:

```http
GET /api/pools/:pool_id/passengers
```

La única información de pasajeros que la Driver App puede persistir es el snapshot operativo final del manifiesto, generado al momento de iniciar el recorrido, con las reservas que se encuentren en estado `PAID`.

---

### Entidades principales

### `drivers`

Representa a los conductores registrados en la aplicación.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador interno del conductor en Driver App. |
| `clerk_user_id` | string | Identificador compartido del usuario en Clerk. |
| `full_name` | string | Nombre completo del conductor. |
| `phone` | string | Teléfono de contacto. |
| `status` | string | Estado del conductor. Ejemplo: `ACTIVE`, `INACTIVE`, `BLOCKED`. |
| `verification_status` | string | Estado de verificación del conductor. |

Relaciones:

- Un conductor puede tener uno o más vehículos registrados.
- Un conductor puede aceptar varios pools a lo largo del tiempo.
- Un pool asignado referencia al conductor que lo aceptó.

---

### `vehicles`

Representa los vehículos utilizados por los conductores.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador interno del vehículo. |
| `driver_id` | string | Referencia interna al conductor propietario o responsable. |
| `brand` | string | Marca del vehículo. |
| `model` | string | Modelo del vehículo. |
| `license_plate` | string | Patente del vehículo. |
| `capacity` | number | Capacidad máxima del vehículo. En esta etapa, hasta 15 pasajeros. |
| `status` | string | Estado del vehículo. Ejemplo: `ACTIVE`, `INACTIVE`, `BLOCKED`. |

Relaciones:

- Un vehículo pertenece a un conductor.
- Un pool asignado puede referenciar el vehículo utilizado.

---

### `pools`

Representa los viajes programados administrados por la Driver App.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador del pool. Se comparte con otras apps como `pool_id`. |
| `destination_id` | string | Identificador del destino seleccionado. La información completa del destino pertenece a Rider App. |
| `departure_time` | datetime | Fecha y hora de salida del viaje. Es necesario para poder buscar pools por destino y horario. |
| `status` | string | Estado actual del pool. |
| `driver_id` | string, nullable | Conductor asignado al pool. Es `null` mientras el pool está disponible. |
| `vehicle_id` | string, nullable | Vehículo asignado al pool. Es `null` mientras el pool no tiene conductor. |
| `current_passengers` | number | Cantidad actual de pasajeros asociados al pool. |
| `max_capacity` | number | Capacidad máxima del pool. |
| `target_user_id` | string, nullable | Pasajero objetivo actual durante el recorrido. |
| `hito` | string, nullable | Mensaje operativo actual del recorrido. |
| `cancellation_reason` | string, nullable | Motivo de cancelación del pool, si corresponde. |

Estados posibles de `status`:

```text
AVAILABLE
ASSIGNED
LOCKED
IN_PROGRESS
COMPLETED
CANCELED
```

Relaciones:

- Un pool puede tener un conductor asignado.
- Un pool puede tener un vehículo asignado.
- Un pool puede tener múltiples pasajeros, pero esa relación no se persiste como reservas dentro de la Driver App.
- Los pasajeros del pool se obtienen desde la Rider App cuando se necesitan.
- El manifiesto final de pasajeros pagados puede persistirse como snapshot operativo.

Notas:

- La Driver App mantiene `current_passengers` como contador operativo del pool.
- La Driver App no guarda las reservas individuales del pool como entidad propia.
- Si se requiere conocer la lista actual de pasajeros, debe consultarse a Rider App.
- Si se requiere ejecutar el recorrido con resiliencia ante fallos inter-servicio, se utiliza el snapshot operativo final.

---

### `operational_manifest_snapshot_passengers`

Representa la copia local del manifiesto final de pasajeros que efectivamente viajan.

Esta entidad se genera cuando el conductor consulta su recorrido final o cuando la Driver App necesita fijar el manifiesto operativo del viaje. Para generarla, la Driver App consulta a Rider App:

```http
GET /api/pools/:pool_id/passengers?status=PAID
```

Solo se incluyen pasajeros con reservas en estado `PAID`.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador interno del registro. |
| `pool_id` | string | Pool asociado al snapshot operativo. |
| `reservation_id` | string | Reserva externa de Rider App. |
| `passenger_user_id` | string | Identificador del pasajero en Clerk. |
| `passenger_name` | string | Nombre del pasajero al momento de generar el snapshot. |
| `pickup_address` | string | Dirección del punto de recogida. |
| `pickup_lat` | number | Latitud del punto de recogida. |
| `pickup_lng` | number | Longitud del punto de recogida. |
| `pickup_order` | number, nullable | Orden sugerido o definido para retirar pasajeros. |

Relaciones:

- Cada registro pertenece a un `pool_id`.
- Cada registro referencia una reserva externa de Rider App.
- La combinación `pool_id` + `reservation_id` debería ser única.

Justificación:

- Esta entidad no representa reservas propias de Driver App.
- Es una copia operativa del manifiesto final.
- Permite que el conductor pueda realizar el recorrido aunque luego falle la comunicación con Rider App.
- Conviene modelarla como entidad separada y no como atributo dentro de `pools`, porque un pool puede tener muchos pasajeros.

---

## Rider App

La **Rider App** es la fuente de verdad de los pasajeros, destinos, reservas e historial de viajes del pasajero.

---

### Entidades principales

### `passengers`

Representa a los pasajeros registrados en la aplicación.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador interno del pasajero en Rider App. |
| `clerk_user_id` | string | Identificador compartido del usuario en Clerk. |
| `full_name` | string | Nombre completo del pasajero. |
| `phone` | string | Teléfono del pasajero. |
| `company_code` | string, nullable | Código o identificador de empresa, si aplica. |
| `status` | string | Estado del pasajero. Ejemplo: `ACTIVE`, `INACTIVE`, `BLOCKED`. |

Relaciones:

- Un pasajero puede tener múltiples reservas.

---

### `destinations`

Representa los destinos industriales disponibles para solicitar viajes.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador del destino. |
| `name` | string | Nombre del destino. Ejemplo: Polo Petroquímico. |
| `description` | string, nullable | Descripción del destino. |
| `address` | string | Dirección o referencia del destino. |
| `lat` | number | Latitud del destino. |
| `lng` | number | Longitud del destino. |
| `active` | boolean | Indica si el destino está disponible para reservas. |

Relaciones:

- Un destino puede estar asociado a muchas reservas.

---

### `reservations`

Representa la reserva individual de un pasajero.

La reserva es la unidad principal de la Rider App. Cada reserva pertenece a un pasajero y puede estar asociada a un pool creado en la Driver App.

En el nuevo flujo, el estado operativo de la reserva y el estado del pago se modelan por separado:

- `reservation_status`: indica el estado operativo de la reserva dentro del flujo del viaje.
- `payment_status`: indica el estado del pago asociado a la reserva.

Esto evita mezclar conceptos distintos. Una reserva puede estar pagada, pero todavía no tener conductor asignado.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador de la reserva. Se comparte con otras apps como `reservation_id`. |
| `passenger_id` | string | Referencia interna al pasajero. |
| `passenger_user_id` | string | Identificador del pasajero en Clerk. |
| `pool_id` | string | Identificador externo del pool creado en Driver App. |
| `destination_id` | string | Referencia al destino seleccionado. |
| `departure_time` | datetime | Fecha y hora reservada. |
| `pickup_address` | string | Dirección del punto de recogida. |
| `pickup_lat` | number | Latitud del punto de recogida. |
| `pickup_lng` | number | Longitud del punto de recogida. |
| `reservation_status` | string | Estado operativo de la reserva. |
| `payment_status` | string | Estado del pago asociado a la reserva. |
| `max_price` | number | Precio máximo que el pasajero debe pagar por la reserva. |
| `amount_charged` | number, nullable | Monto efectivamente cobrado mediante Mercado Pago luego de aplicar saldo a favor. |
| `credit_applied` | number | Saldo a favor utilizado para pagar esta reserva. |
| `final_trip_price` | number, nullable | Precio final calculado al cierre T-1h según la ocupación real del pool. |
| `credit_granted` | number | Saldo a favor generado para próximos viajes. |
| `currency` | string | Moneda de los importes. Ejemplo: `ARS`. |
| `payment_transaction_id` | string, nullable | Identificador de la transacción informada por Payments App. |
| `payment_rejection_reason` | string, nullable | Motivo de rechazo del pago, si corresponde. |
| `assigned_driver_snapshot` | json, nullable | Datos del conductor y vehículo asignados, guardados como snapshot cuando el pool pasa a estar asignado. |

Estados posibles de `reservation_status`:

```text
PENDING_PAYMENT
PENDING_DRIVER
CONFIRMED
CANCELED
```

Estados posibles de `payment_status`:

```text
UNPAID
PENDING
PAID
DENIED
```

Estructura sugerida para `assigned_driver_snapshot`:

```json
{
  "driver_user_id": "user_driver_01",
  "driver_name": "Juliana Pagani",
  "vehicle": {
    "vehicle_id": "veh_123",
    "brand": "Mercedes-Benz",
    "model": "Sprinter",
    "license_plate": "AF123JK"
  }
}
```

Relaciones:

- Una reserva pertenece a un pasajero.
- Una reserva referencia un destino.
- Una reserva referencia un pool externo de Driver App.
- Una reserva puede recibir un resultado de pago informado por Payments App.
- Una reserva puede recibir un ajuste de crédito informado por Payments App.
- Una reserva puede generar reseñas en Feedback App si fue pagada y el viaje finalizó.

Notas:

- Con `destination_id` alcanza para relacionar la reserva con el destino seleccionado.
- No se guarda snapshot del nombre del destino. Si el destino cambia de nombre en el futuro, el historial mostrará el dato actual del catálogo de destinos.
- La Rider App guarda un snapshot del conductor y vehículo asignados dentro de la reserva, en el campo `assigned_driver_snapshot`, cuando el pool pasa a estado `ASSIGNED`.
- Driver App sigue siendo la fuente de verdad de conductores y vehículos. El snapshot en Rider App se utiliza únicamente para mostrar el resumen e historial del viaje.
- `max_price` representa el precio máximo que el usuario acepta pagar al reservar.
- `amount_charged` representa cuánto dinero se cobró efectivamente mediante Mercado Pago, luego de aplicar saldo a favor.
- `credit_applied` representa cuánto saldo a favor se utilizó para pagar esta reserva.
- `final_trip_price` se completa cuando Payments App calcula el precio final del viaje al cierre T-1h.
- `credit_granted` se completa cuando Payments App informa que se generó saldo a favor para próximos viajes.
- La Rider App no calcula saldo a favor. Solo guarda el resultado informado por Payments App para mostrarlo en el resumen, historial y notificaciones al usuario.
```

---

### Historial de viajes

No se define una tabla separada para historial de viajes.

El historial puede obtenerse consultando las reservas del pasajero en la tabla `reservations`.

Cada reserva contiene los datos principales necesarios para el historial:

- pasajero;
- pool asociado;
- destino;
- horario;
- punto de recogida;
- estado operativo de la reserva;
- estado del pago;
- precio máximo pagado;
- saldo a favor aplicado;
- monto efectivamente cobrado;
- precio final del viaje, si ya fue calculado;
- saldo a favor generado para próximos viajes;
- transacción de pago asociada, si corresponde;
- conductor y vehículo asignados, si fueron guardados como snapshot.

Si en etapas futuras se requiere optimizar la lectura del historial, puede agregarse una vista o una tabla derivada, pero no es necesaria para el modelo inicial.
```


---

## Payments App

La **Payments App** es la fuente de verdad de precios, checkout de reservas, cobros, transacciones, saldo a favor, ajustes de crédito y liquidaciones.

En el nuevo flujo, la Payments App ya no realiza cobros automáticos al cierre T-1h. El pasajero paga el precio máximo al momento de reservar.

Luego, al cierre del pool en T-1h, la Payments App calcula el precio final del viaje según la ocupación real del pool y genera saldo a favor para el pasajero cuando corresponda.

También genera saldo a favor cuando un pool se cancela por falta de conductor, acreditando al pasajero el monto pagado.

En esta etapa, el descuento por ocupación no se modela como una entidad independiente. El descuento se calcula a nivel de pool durante el proceso `pool_price_finalization_jobs`, utilizando las reglas definidas en `pricing_rules`. El resultado de ese cálculo se refleja en cada `charge` mediante `final_trip_price` y `credit_granted`, y el saldo a favor se registra en `credit_movements`.

---

### Entidades principales

### `payment_methods` *(opcional futura)*

En esta etapa no se requiere almacenar métodos de pago de pasajeros como entidad principal, porque el pasajero paga directamente cada reserva mediante Mercado Pago al momento de reservar.

La Payments App puede operar mediante sesiones de checkout y transacciones de pago sin conservar un método de pago reutilizable para cobros automáticos.

Esta entidad podría incorporarse en futuras etapas si se decide volver a implementar cobros automáticos o pagos con medios guardados.

Por este motivo, `payment_methods` no forma parte del modelo principal de datos de esta etapa.

---

### `pricing_rules`

Representa las reglas utilizadas para calcular el precio máximo, el precio estimado y el precio final del viaje.

En esta etapa, las reglas de precio también permiten calcular el descuento por ocupación del pool. Ese descuento no se descuenta directamente del pago inicial, sino que se usa al cierre T-1h para determinar el precio final y generar saldo a favor.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador de la regla. |
| `destination_id` | string, nullable | Destino al que aplica la regla. Puede ser `null` si es general. |
| `base_price` | number | Precio base o precio máximo de referencia del viaje. |
| `min_passengers` | number | Cantidad mínima de pasajeros para aplicar la regla. |
| `max_passengers` | number | Cantidad máxima de pasajeros para aplicar la regla. |
| `discount_type` | string | Tipo de descuento. Ejemplo: `PERCENTAGE`, `FIXED_AMOUNT`. |
| `discount_value` | number | Valor del descuento. |
| `active` | boolean | Indica si la regla está activa. |

Relaciones:

- Una regla puede ser utilizada para calcular el precio máximo, estimado o final de un viaje.
- Una regla puede ser referenciada por un proceso `pool_price_finalization_jobs` cuando se calcula el precio final del pool.

Notas:

- `pricing_rules` define cómo se calculan precios y descuentos.
- La Payments App utiliza estas reglas para calcular el precio máximo y el precio estimado antes de la reserva.
- Al cierre T-1h, la Payments App utiliza la ocupación real del pool para seleccionar la regla correspondiente y calcular el precio final.
- El descuento por ocupación se registra en `pool_price_finalization_jobs`, no en una entidad separada.
- El saldo a favor generado por ese descuento se registra en `credit_movements`.

---

### `pool_price_finalization_jobs`

Representa el proceso de cálculo de precio final y generación de saldo a favor para un pool.

Este proceso se ejecuta cuando la Driver App solicita a Payments App el cálculo de ajustes de crédito mediante:

```http
POST /api/payments/pools/:pool_id/credit-adjustments
```

Este proceso puede iniciarse por dos motivos:

- `POOL_LOCKED`: el pool llegó a T-1h y se calcula el precio final según la ocupación real.
- `NO_DRIVER_ASSIGNED`: el pool fue cancelado por falta de conductor y se acredita a cada pasajero el monto pagado.

En esta etapa, el descuento por ocupación se registra directamente en esta entidad, porque el cálculo ocurre a nivel del pool completo y no como una lista de descuentos independientes por cobro.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador del proceso. |
| `pool_id` | string | Identificador externo del pool. |
| `reason` | string | Motivo del ajuste. Ejemplo: `POOL_LOCKED`, `NO_DRIVER_ASSIGNED`. |
| `current_passengers` | number | Ocupación utilizada para calcular el precio final. |
| `pricing_rule_id` | string, nullable | Regla de precio utilizada para calcular el precio final. |
| `base_price` | number | Precio base o precio máximo de referencia antes del descuento. |
| `final_price` | number, nullable | Precio final calculado para el pool. |
| `discount_type` | string, nullable | Tipo de descuento aplicado. Ejemplo: `OCCUPANCY_DISCOUNT`. |
| `discount_value` | number, nullable | Valor del descuento aplicado por pasajero. |
| `currency` | string | Moneda del cálculo. Ejemplo: `ARS`. |
| `status` | string | Estado del proceso. |
| `started_at` | datetime | Fecha de inicio del proceso. |
| `finished_at` | datetime, nullable | Fecha de finalización del proceso. |

Estados sugeridos de `status`:

```text
STARTED
COMPLETED
FAILED
```

Tipos sugeridos de `discount_type`:

```text
OCCUPANCY_DISCOUNT
NO_DRIVER_CREDIT
```

Relaciones:

- Un proceso de finalización pertenece a un pool externo de Driver App.
- Un proceso puede referenciar una regla de precio en `pricing_rules`.
- Un proceso puede actualizar múltiples cobros en `charges`.
- Un proceso puede generar múltiples movimientos de crédito en `credit_movements`.

Notas:

- Este proceso no realiza cobros.
- Este proceso reemplaza al antiguo proceso de cobro automático.
- La Payments App consulta a Rider App el manifiesto de reservas pagadas usando `GET /api/pools/:pool_id/passengers?payment_status=PAID`.
- La Payments App utiliza `pricing_rules` para calcular el precio final del viaje según la ocupación real del pool.
- Si `reason = POOL_LOCKED`, `discount_value` representa la diferencia entre `base_price` y `final_price`.
- Si `reason = NO_DRIVER_ASSIGNED`, `final_price = 0` y el crédito generado para cada pasajero equivale al monto pagado.
- Si el cálculo genera saldo a favor, se registra un movimiento en `credit_movements` con tipo `CREDIT_GRANTED`.

---

### `checkout_sessions`

Representa una sesión de pago creada para una reserva.

La sesión de checkout se crea cuando la Rider App solicita a Payments App preparar el pago de una reserva mediante:

```http
POST /api/payments/reservations/:reservation_id/checkout
```

Esta entidad permite registrar el saldo a favor disponible al momento de iniciar el pago, el saldo aplicado y el monto que finalmente debe cobrarse mediante Mercado Pago.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador interno del checkout. |
| `reservation_id` | string | Identificador externo de la reserva en Rider App. |
| `pool_id` | string | Identificador externo del pool creado en Driver App. |
| `passenger_user_id` | string | Identificador del pasajero en Clerk. |
| `max_price` | number | Precio máximo de la reserva. |
| `available_credit_at_creation` | number | Saldo disponible del usuario al momento de crear el checkout. |
| `credit_applied` | number | Saldo a favor aplicado al pago de esta reserva. |
| `amount_to_charge` | number | Monto que debe cobrarse por Mercado Pago luego de aplicar saldo a favor. |
| `currency` | string | Moneda del pago. Ejemplo: `ARS`. |
| `status` | string | Estado del checkout. |
| `payment_url` | string, nullable | URL a la pantalla de pago generada por Payments App o Mercado Pago. |
| `created_at` | datetime | Fecha de creación del checkout. |

Estados sugeridos de `status`:

```text
CREATED
PAID
DENIED
CANCELED
```

Relaciones:

- Un checkout pertenece a una reserva externa de Rider App.
- Un checkout pertenece a un pool externo de Driver App.
- Un checkout puede generar un cobro en `charges`.
- Un checkout puede aplicar saldo a favor desde `credit_accounts`.

Notas:

- Si `amount_to_charge = 0`, el pago puede completarse usando únicamente saldo a favor.
- Si `amount_to_charge > 0`, la Payments App genera una instancia de pago mediante Mercado Pago.
- El checkout no reemplaza al cobro; solo representa la preparación del pago.


---

### `charges`

Representa el cobro de una reserva individual.

En el nuevo flujo, el cobro se realiza al momento de reservar, no al cierre T-1h.

El pasajero paga el precio máximo de la reserva. Antes de cobrar por Mercado Pago, la Payments App aplica el saldo a favor disponible del usuario.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador interno del cobro. |
| `transaction_id` | string | Identificador de transacción informado a otras apps. |
| `checkout_session_id` | string, nullable | Checkout que originó el cobro. |
| `pool_price_finalization_job_id` | string, nullable | Proceso de finalización de precio que calculó el precio final y el crédito generado. |
| `pool_id` | string | Identificador externo del pool. |
| `reservation_id` | string | Identificador externo de la reserva en Rider App. |
| `passenger_user_id` | string | Identificador del pasajero en Clerk. |
| `max_price` | number | Precio máximo de la reserva. |
| `credit_applied` | number | Saldo a favor utilizado para pagar esta reserva. |
| `amount_charged` | number | Monto efectivamente cobrado mediante Mercado Pago. |
| `final_trip_price` | number, nullable | Precio final calculado al cierre T-1h. |
| `credit_granted` | number | Saldo a favor generado para próximos viajes. |
| `currency` | string | Moneda del cobro. Ejemplo: `ARS`. |
| `status` | string | Estado del cobro. |
| `rejection_reason` | string, nullable | Motivo de rechazo si el pago fue denegado. |
| `processed_at` | datetime, nullable | Fecha de procesamiento del pago. |

Estados sugeridos de `status`:

```text
PENDING
PAID
DENIED
FAILED
```

Relaciones:

- Un cobro pertenece a una reserva externa de Rider App.
- Un cobro pertenece a un pool externo de Driver App.
- Un cobro puede originarse en una sesión de checkout.
- Un cobro puede ser actualizado por un proceso `pool_price_finalization_jobs`.
- Un cobro puede aplicar saldo a favor mediante un movimiento `CREDIT_APPLIED`.
- Un cobro puede generar saldo a favor mediante un movimiento `CREDIT_GRANTED`.

Notas:

- `max_price` es el precio máximo aceptado por el pasajero al reservar.
- `credit_applied` es el saldo a favor usado para reducir el monto a cobrar.
- `amount_charged` es el monto cobrado por Mercado Pago.
- `final_trip_price` se completa cuando se calculan los ajustes de crédito del pool.
- `credit_granted` se completa cuando el precio final resulta menor que el precio máximo pagado.
- El detalle de qué regla de descuento se usó se registra a nivel del proceso `pool_price_finalization_jobs`.
- Si el pago falla, la Payments App notifica a Rider App mediante `PATCH /api/reservations/:reservation_id/payment-result`.
- Si el pago falla, la reserva no debe formar parte efectiva del pool.
---


### `settlements`

Representa las liquidaciones de fondos a conductores.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador de la liquidación. |
| `pool_id` | string | Pool asociado a la liquidación. |
| `driver_user_id` | string | Conductor que recibe la liquidación. |
| `payout_account_id` | string, nullable | Cuenta de cobro utilizada. |
| `amount` | number | Monto liquidado. |
| `currency` | string | Moneda de la liquidación. |
| `status` | string | Estado de la liquidación. |
| `settled_at` | datetime, nullable | Fecha en la que se realizó la liquidación. |

Estados sugeridos de `status`:

```text
PENDING
COMPLETED
FAILED
```

Relaciones:

- Una liquidación pertenece a un pool externo.
- Una liquidación corresponde a un conductor identificado por `driver_user_id`.
- Una liquidación puede agrupar los cobros exitosos de un pool.

---

### `credit_accounts`

Representa el saldo a favor acumulado de un usuario.

La Payments App es la fuente de verdad del saldo a favor.

Cada usuario que tenga saldo a favor puede tener una cuenta de crédito asociada. Si un usuario todavía no tiene cuenta de crédito, se considera que su saldo disponible es `0`.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador de la cuenta de crédito. |
| `user_id` | string | Identificador del usuario en Clerk. |
| `balance` | number | Saldo disponible. |
| `currency` | string | Moneda del saldo. Ejemplo: `ARS`. |
| `updated_at` | datetime | Fecha de última actualización. |

Relaciones:

- Una cuenta de crédito pertenece a un usuario identificado por Clerk.
- Una cuenta de crédito puede tener múltiples movimientos en `credit_movements`.

Notas:

- La Rider App puede consultar este saldo mediante `GET /api/payments/users/:user_id/credit-balance`.
- La Rider App no modifica este saldo.
- La Payments App aplica automáticamente el saldo disponible al crear un checkout.

### `credit_movements`

Representa cada movimiento de saldo a favor.

Esta entidad permite auditar de dónde salió el saldo del usuario y cuándo fue utilizado.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador del movimiento. |
| `credit_account_id` | string | Cuenta de crédito asociada. |
| `user_id` | string | Identificador del usuario en Clerk. |
| `type` | string | Tipo de movimiento. |
| `amount` | number | Monto del movimiento. |
| `currency` | string | Moneda del movimiento. |
| `reservation_id` | string, nullable | Reserva asociada al movimiento. |
| `pool_id` | string, nullable | Pool asociado al movimiento. |
| `charge_id` | string, nullable | Cobro asociado al movimiento. |
| `pool_price_finalization_job_id` | string, nullable | Proceso de finalización de precio que originó el movimiento, si corresponde. |
| `description` | string, nullable | Descripción del movimiento. |
| `created_at` | datetime | Fecha en la que se generó el movimiento. |

Tipos posibles de `type`:

```text
CREDIT_GRANTED
CREDIT_APPLIED
MANUAL_ADJUSTMENT
```

Relaciones:

- Un movimiento pertenece a una cuenta de crédito.
- Un movimiento puede estar asociado a una reserva.
- Un movimiento puede estar asociado a un pool.
- Un movimiento puede estar asociado a un cobro.
- Un movimiento puede estar asociado a un proceso `pool_price_finalization_jobs`.

Notas:

- `CREDIT_GRANTED` se utiliza cuando Payments App genera saldo a favor para el usuario.
- `CREDIT_APPLIED` se utiliza cuando Payments App aplica saldo a favor en un checkout.
- `MANUAL_ADJUSTMENT` se reserva para correcciones administrativas.
- Cuando el saldo a favor se genera por descuento de ocupación, el movimiento puede estar relacionado con un proceso `pool_price_finalization_jobs`.
- En esta etapa no se modela expiración de crédito.

### Relación entre precio, descuento y saldo a favor

El flujo de precios queda definido de la siguiente manera:

1. Al reservar, el pasajero paga el precio máximo.
2. Si tiene saldo a favor, Payments App lo aplica antes de cobrar por Mercado Pago.
3. Al cierre T-1h, Payments App calcula el precio final usando `pricing_rules` y la ocupación real del pool.
4. Si el precio final es menor al precio máximo pagado, la diferencia queda registrada dentro del proceso `pool_price_finalization_jobs` como descuento por ocupación.
5. Esa diferencia se acredita al pasajero como saldo a favor mediante un movimiento `CREDIT_GRANTED` en `credit_movements`.
6. Cada cobro individual se actualiza con `final_trip_price` y `credit_granted`.

De esta manera:

- `pricing_rules` define cómo se calculan los precios y descuentos.
- `pool_price_finalization_jobs` registra qué regla se aplicó y cuál fue el descuento por ocupación del pool.
- `charges` registra el resultado individual aplicado a cada reserva.
- `credit_movements` registra el movimiento de saldo a favor generado por ese descuento.

---

## Feedback App

La **Feedback App** es la fuente de verdad de reseñas, calificaciones promedio y reportes.

---

### Entidades principales

### `reviews`

Representa una reseña entre usuarios luego de un viaje.

Las reseñas se pre-crean al iniciar el viaje, pero permanecen invisibles hasta que el viaje finaliza.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador de la reseña. |
| `pool_id` | string | Identificador externo del pool. |
| `reservation_id` | string, nullable | Identificador externo de la reserva asociada. |
| `author_user_id` | string | Usuario que debe completar la reseña. |
| `author_role` | string | Rol del autor. Ejemplo: `rider`, `driver`. |
| `target_user_id` | string | Usuario que será calificado. |
| `target_role` | string | Rol del usuario calificado. Ejemplo: `rider`, `driver`. |
| `status` | string | Estado de la reseña. |
| `rating` | number, nullable | Calificación en estrellas. Valor esperado: 1 a 5. |
| `comment` | string, nullable | Comentario opcional. |
| `enabled_at` | datetime, nullable | Fecha en la que la reseña pasó a estar visible. |
| `completed_at` | datetime, nullable | Fecha en la que el usuario completó la reseña. |

Estados posibles de `status`:

```text
PRECREATED
PENDING
COMPLETED
```

Relaciones:

- Una reseña pertenece a un pool externo.
- Una reseña puede estar asociada a una reserva externa.
- Un usuario puede ser autor de muchas reseñas.
- Un usuario puede ser destinatario de muchas reseñas.

---

### `rating_averages`

Representa el promedio de calificaciones de un usuario.

Puede implementarse como tabla cacheada para evitar recalcular el promedio en cada consulta.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador interno del registro. |
| `user_id` | string | Identificador del usuario en Clerk. |
| `role` | string | Rol sobre el que se calcula el promedio. Ejemplo: `rider`, `driver`. |
| `average_rating` | number, nullable | Promedio de estrellas. Puede ser `null` si todavía no tiene reseñas. |
| `total_reviews` | number | Cantidad de reseñas completadas utilizadas para el cálculo. |
| `updated_at` | datetime | Fecha de última actualización del promedio. |

Relaciones:

- Se calcula a partir de reseñas en estado `COMPLETED`.
- Puede existir un promedio distinto por rol para un mismo usuario.

---

### `reports`

Representa reportes de moderación realizados por usuarios.

| Campo | Tipo | Descripción |
|------|------|-------------|
| `id` | string | Identificador del reporte. |
| `pool_id` | string, nullable | Pool asociado al reporte, si corresponde. |
| `reservation_id` | string, nullable | Reserva asociada al reporte, si corresponde. |
| `reporter_user_id` | string | Usuario que realiza el reporte. |
| `reporter_role` | string | Rol del usuario que realiza el reporte. |
| `reported_user_id` | string | Usuario reportado. |
| `reported_role` | string | Rol del usuario reportado. |
| `reason` | string | Motivo del reporte. |
| `description` | string, nullable | Descripción adicional. |
| `status` | string | Estado de moderación del reporte. |
| `reviewed_at` | datetime, nullable | Fecha de revisión. |

Estados sugeridos de `status`:

```text
PENDING
REVIEWED
REJECTED
```

Relaciones:

- Un reporte tiene un usuario autor y un usuario reportado.
- Puede asociarse a un pool o reserva externa para dar contexto.

---

### `users`

Representa una referencia local mínima de usuarios dentro de la Feedback App.

La entidad se utiliza únicamente para facilitar relaciones internas, consultas y cálculos asociados a reseñas y reportes.

La identidad global del usuario sigue perteneciendo a Clerk.

| Campo        | Tipo             | Descripción                                                      |
| ------------ | ---------------- | ---------------------------------------------------------------- |
| `id`         | string           | Identificador compartido del usuario en Clerk (`clerk_user_id`). |
| `name`       | string, nullable | Nombre visible del usuario.                                      |
| `role`       | string           | Rol operativo principal del usuario dentro de Feedback App.      |
| `created_at` | datetime         | Fecha de creación del registro local.                            |

Relaciones:

* Un usuario puede ser autor de muchas reseñas.
* Un usuario puede recibir muchas reseñas.
* Un usuario puede realizar muchos reportes.
* Un usuario puede ser reportado muchas veces.

Notas:

* Esta entidad no reemplaza a Clerk como fuente de verdad.
* Los roles efectivos del contexto del viaje se determinan mediante campos contextualizados como `author_role`, `target_role`, `reporter_role` y `reported_role`.
* En esta etapa del sistema, cada usuario opera con un único rol principal dentro de la plataforma (PASSENGER o DRIVER).

---



## Datos duplicados y estrategia de consistencia

| Dato duplicado o referenciado | Apps que lo tienen | Fuente de verdad | Estrategia de consistencia |
|-------------------------------|--------------------|------------------|----------------------------|
| `clerk_user_id` | Todas | Clerk | Todas las apps usan el mismo identificador de Clerk. Cada app puede crear su perfil local al primer login o al recibir una operación relacionada con ese usuario. |
| Datos básicos de usuario | Rider, Driver, Payments, Feedback | Clerk y cada app según el rol | Cada app guarda solo los datos necesarios para su dominio. Si se necesita identidad compartida, se usa `clerk_user_id`. |
| `pool_id` | Driver, Rider, Payments, Feedback | Driver App | Driver App genera el `pool_id`. Las demás apps lo guardan como referencia externa y consultan a Driver App cuando necesitan estado operativo del pool. |
| `reservation_id` | Rider, Driver, Payments, Feedback | Rider App | Rider App genera la reserva. Driver, Payments y Feedback la guardan como referencia externa cuando necesitan asociar datos al pasajero o al viaje. |
| Estado del pool | Driver, visible en Rider y Feedback | Driver App | Rider App y Feedback App consultan el estado del pool mediante `GET /api/pools/:pool_id/status`. No deben modificarlo directamente. |
| Estado operativo de la reserva | Rider | Rider App | Rider App mantiene `reservation_status`. Las demás apps no deben modificarlo directamente. |
| Estado del pago | Payments, Rider | Payments App | Payments App informa el resultado del pago a Rider App mediante `PATCH /api/reservations/:reservation_id/payment-result`. Rider App guarda el estado para mostrarlo al usuario y controlar el flujo de reserva. |
| Pasajeros de un pool | Rider, consultado por Driver, Payments y Feedback | Rider App | Rider App expone `GET /api/pools/:pool_id/passengers`. Driver, Payments y Feedback consumen este endpoint según su necesidad. |
| Manifiesto operativo final | Driver, originado desde Rider | Driver App como snapshot operativo | Driver App obtiene pasajeros con `payment_status = PAID` desde Rider App y guarda una copia local para ejecutar el recorrido aun si luego hay fallos de comunicación. |
| Precio máximo de reserva | Rider, Payments | Payments App para cálculo, Rider App para snapshot comercial | Payments calcula el precio máximo. Rider App lo guarda en la reserva como valor inmutable. |
| Reglas de precio y descuentos | Payments | Payments App | Payments App utiliza `pricing_rules` para calcular precio máximo, precio estimado, precio final y descuento por ocupación. |
| Descuento por ocupación aplicado al pool | Payments | Payments App | Payments App registra el descuento aplicado a nivel del proceso `pool_price_finalization_jobs`, porque el cálculo depende de la ocupación final del pool. |
| Monto cobrado | Payments, Rider | Payments App | Payments App calcula y persiste `amount_charged`. Rider App guarda el valor informado para mostrarlo en resumen e historial. |
| Saldo a favor aplicado | Payments, Rider | Payments App | Payments App aplica el saldo a favor al crear el checkout. Rider App guarda `credit_applied` informado por Payments. |
| Precio final del viaje | Payments, Rider | Payments App | Payments App calcula `final_trip_price` al cierre T-1h. Rider App guarda el valor informado para mostrarlo en el historial. |
| Saldo a favor generado | Payments, Rider | Payments App | Payments App genera y persiste el saldo a favor. Rider App guarda `credit_granted` para mostrar notificaciones, resumen e historial. |
| Saldo a favor disponible | Payments, visible en Rider | Payments App | Rider App puede consultar el saldo mediante `GET /api/payments/users/:user_id/credit-balance`, pero no lo calcula ni modifica. |
| Detalle de pagos y transacciones | Payments, referenciado en Rider | Payments App | Rider App solo guarda datos mínimos del resultado de pago. Payments App mantiene el detalle financiero completo. |
| Información de conductor y vehículo asignados | Driver, Rider | Driver App | Driver App es la fuente de verdad. Rider App guarda un snapshot mínimo dentro de la reserva cuando el pool pasa a `ASSIGNED`, para mostrar resumen e historial del viaje. |
| Promedio de calificaciones | Feedback, visible en Rider y Driver | Feedback App | Rider App y Driver App consultan a Feedback App cuando necesitan mostrar reputación. No calculan promedios localmente. |
| Reseñas | Feedback | Feedback App | Feedback App crea, habilita y completa reseñas. Otras apps solo reciben notificaciones o redirigen al usuario. |
| Reportes | Feedback | Feedback App | Feedback App persiste reportes y estados de moderación. |
---

## Estrategias generales ante inconsistencias

### 1. No compartir bases de datos

Las apps no deben leer ni escribir directamente en bases de datos ajenas.

Toda sincronización debe realizarse mediante APIs inter-servicio.

---

### 2. Usar fuentes de verdad claras

Cada dato integrado debe tener una app dueña:

- pools y operación del viaje: **Driver App**;
- reservas y pasajeros del pool: **Rider App**;
- pagos y precios: **Payments App**;
- reseñas y calificaciones: **Feedback App**;
- identidad de usuario: **Clerk**.

---

### 3. Guardar snapshots solo cuando sean necesarios

Los snapshots son copias controladas y no reemplazan a la fuente de verdad.

En esta etapa se define un snapshot operativo en la **Driver App** para el manifiesto final de pasajeros pagados.

La **Rider App** no guarda snapshot del destino, porque con `destination_id` alcanza para referenciar el destino del viaje.

La **Rider App** sí guarda un snapshot mínimo del conductor y vehículo asignados dentro de la reserva, una vez que el pool pasa a `ASSIGNED`. Esto permite mostrar la información del conductor y vehículo en el resumen e historial del viaje, aunque Driver App siga siendo la fuente de verdad.

---

### 4. Evitar recalcular información externa

Una app no debe recalcular datos que pertenecen a otra.

Ejemplos:

- Rider App no calcula precios: los solicita a Payments App.
- Rider App no calcula saldo a favor: lo consulta o recibe desde Payments App.
- Driver App no calcula calificaciones: las solicita a Feedback App.
- Feedback App no asume pasajeros de un pool: los solicita a Rider App.
- Payments App no asume pasajeros pagados de un pool: los solicita a Rider App.
- Rider App no modifica el saldo a favor: Payments App es la fuente de verdad.

---

### 5. Tolerar consistencia eventual

Algunas actualizaciones entre apps ocurren mediante notificaciones o polling.

Por eso, el sistema puede tener breves períodos de consistencia eventual.

Ejemplos:

- Payments App procesa un pago y luego notifica a Rider App.
- Payments App genera saldo a favor y luego notifica a Rider App para que muestre la notificación al pasajero.
- Driver App cambia el estado del pool y Rider App lo detecta mediante polling.
- Driver App solicita a Payments App calcular ajustes de crédito al cierre T-1h.
- Feedback App consulta el estado del pool para detectar avance o finalización.

---

### 6. Diseñar operaciones críticas como idempotentes

Las operaciones inter-servicio importantes deberían poder recibirse más de una vez sin generar inconsistencias.

Ejemplos:

- creación de checkout para una reserva;
- notificación de pago exitoso;
- notificación de pago rechazado;
- cancelación de pool por falta de conductor;
- cálculo de ajustes de crédito del pool;
- notificación de crédito generado;
- pre-creación de reseñas;
- notificación de reseñas disponibles.

Para esto, las apps pueden usar identificadores como:

- `reservation_id`;
- `pool_id`;
- `transaction_id`;
- `checkout_session_id`;
- `pool_price_finalization_job_id`;
- `credit_movement_id`;
- `review_id`.

---

## Resumen de fuentes de verdad

| Dominio | Fuente de verdad |
|--------|------------------|
| Identidad de usuarios | Clerk |
| Pasajeros | Rider App |
| Conductores | Driver App |
| Vehículos | Driver App |
| Destinos | Rider App |
| Reservas | Rider App |
| Estado operativo de la reserva | Rider App |
| Estado del pago | Payments App |
| Pools | Driver App |
| Estado operativo del viaje | Driver App |
| Pasajeros de un pool | Rider App |
| Manifiesto operativo final | Driver App |
| Precios | Payments App |
| Reglas de descuento | Payments App |
| Descuento por ocupación aplicado al pool | Payments App |
| Checkout de reservas | Payments App |
| Cobros y transacciones | Payments App |
| Saldo a favor | Payments App |
| Movimientos de saldo a favor | Payments App |
| Ajustes de crédito del pool | Payments App |
| Liquidaciones | Payments App |
| Reseñas | Feedback App |
| Promedios de calificación | Feedback App |
| Reportes | Feedback App |

# 1.5 — Usuarios Compartidos

> **Tipo A — Plataforma de Transporte (WeShuttle)**

El sistema utiliza **Clerk** como servicio centralizado de autenticación.

Los usuarios se autentican a través de Clerk independientemente de qué aplicación estén usando, y la identidad se propaga entre servicios mediante el token JWT emitido por Clerk.

Cada webapp mantiene sus propios datos de dominio en su base de datos, pero utiliza el identificador de Clerk como referencia común para reconocer al mismo usuario entre aplicaciones.

El identificador compartido entre todas las apps es:

```text
clerk_user_id
```

Este identificador corresponde al claim estándar:

```text
sub
```

---

## ¿Qué apps comparten usuarios?

| Usuario | Apps donde puede autenticarse | Descripción |
|---------|------------------------------|-------------|
| **Empleado / Pasajero (`rider`)** | Rider App, Payments App, Feedback App | Puede solicitar viajes, reservar lugares en pools, pagar reservas desde Payments App, utilizar saldo a favor disponible, consultar pagos asociados a sus viajes y calificar al conductor al finalizar el viaje. |
| **Conductor (`driver`)** | Driver App, Payments App, Feedback App | Puede aceptar pools desde el marketplace, gestionar el recorrido, configurar o consultar su cuenta de cobro, recibir liquidaciones y calificar pasajeros. |
| **Administrador (`admin`)** | Rider App, Driver App, Payments App, Feedback App y posteriormente Control Plane | Puede gestionar datos principales, consultar listados, revisar reportes y administrar operaciones del sistema. |

---

## Roles del sistema

Los roles principales del sistema son:

```text
rider
driver
admin
```

### `rider`

Representa a un empleado industrial que utiliza la plataforma como pasajero.

Permisos principales:

- acceder a Rider App;
- solicitar viajes;
- crear reservas;
- pagar reservas desde Payments App;
- utilizar saldo a favor disponible en próximos viajes;
- consultar pagos asociados a sus viajes;
- consultar su saldo a favor disponible;
- visualizar estado del viaje;
- recibir notificaciones cuando se genere saldo a favor;
- completar reseñas desde Feedback App;
- visualizar su promedio de calificaciones y reportes recibidos según corresponda.
---

### `driver`

Representa a un conductor habilitado para realizar viajes.

Permisos principales:

- acceder a Driver App;
- visualizar pools disponibles en el marketplace;
- aceptar viajes;
- actualizar el estado operativo del viaje;
- consultar información de liquidaciones desde Payments App;
- configurar o consultar su cuenta de cobro desde Payments App, si corresponde;
- recibir liquidaciones;
- completar reseñas a pasajeros desde Feedback App;
- visualizar su promedio de calificaciones y reportes recibidos según corresponda.

---

### `admin`

Representa a un usuario con permisos administrativos.

Permisos principales:

- acceder a las aplicaciones para tareas de gestión;
- gestionar datos maestros;
- consultar listados y reportes;
- revisar reportes de moderación;
- administrar conductores, pasajeros, destinos y otros datos operativos según corresponda.

---

## Claims del JWT relevantes

Los siguientes claims deben estar disponibles en el JWT utilizado por las aplicaciones.

| Claim | Tipo | Descripción |
|------|------|-------------|
| `sub` | string | Identificador único del usuario en Clerk. Se utiliza como `clerk_user_id` en las bases de datos locales. |
| `role` | string | Rol principal del usuario dentro del sistema. Valores posibles: `rider`, `driver`, `admin`. |
| `company_code` | string, nullable | Código de empresa o pertenencia industrial del usuario. Aplica principalmente a usuarios con rol `rider`. |
| `email` | string | Email del usuario. Puede utilizarse para mostrar información básica o tareas administrativas. |
| `name` | string | Nombre del usuario. Puede utilizarse para mostrar información básica en la interfaz. |

---

## Claims utilizados por cada app

| App | Claims utilizados | Para qué se utilizan |
|-----|------------------|----------------------|
| **Rider App** | `sub`, `role`, `company_code` | Identificar al pasajero, verificar que tenga rol `rider` o `admin`, validar pertenencia a una empresa industrial y asociar reservas al usuario. |
| **Driver App** | `sub`, `role` | Identificar al conductor, verificar que tenga rol `driver` o `admin`, y asociar pools o acciones operativas al conductor autenticado. |
| **Payments App** | `sub`, `role` | Identificar al usuario que paga una reserva, consulta saldo a favor, utiliza crédito disponible, consulta pagos o recibe liquidaciones. El rol permite distinguir si el usuario opera como pasajero, conductor o administrador. |
| **Feedback App** | `sub`, `role` | Identificar al autor de una reseña o reporte y validar si está actuando como pasajero, conductor o administrador. |
| **Control Plane** *(futuro)* | `sub`, `role` | Permitir acceso únicamente a usuarios con rol `admin`. |

---

## Configuración de Clerk

Los roles y datos compartidos se gestionan mediante metadata de Clerk.

Se propone utilizar `publicMetadata` para almacenar los datos que deben ser accesibles por las aplicaciones frontend y backend:

```json
{
  "role": "rider",
  "company_code": "empresa_001"
}
```

Ejemplo para un conductor:

```json
{
  "role": "driver"
}
```

Ejemplo para un administrador:

```json
{
  "role": "admin"
}
```

---

## Configuración del JWT Template / Session Claims

El campo `company_code` es un claim custom necesario para validar la pertenencia industrial de los empleados que utilizan la Rider App.

Este claim debe configurarse explícitamente en el JWT Template o en la configuración de Session Claims de Clerk.

No alcanza con guardar `company_code` en `publicMetadata`; debe incluirse explícitamente como claim del token para que esté disponible en las aplicaciones mediante el JWT.

Claims custom esperados en el token:

```json
{
  "role": "{{user.public_metadata.role}}",
  "company_code": "{{user.public_metadata.company_code}}"
}
```

Notas:

- `sub` es el identificador estándar del usuario en Clerk.
- `role` debe estar disponible para que cada app pueda proteger rutas y validar permisos.
- `company_code` debe estar disponible especialmente para Rider App.
- No se debe incluir todo `publicMetadata` dentro del JWT. Solo deben agregarse los campos necesarios, para evitar tokens innecesariamente grandes.

---

## Estrategia de asignación de roles

### Registro de empleados / pasajeros

Cuando un empleado se registra, debe ingresar un código corporativo o industrial válido.

Si el código es válido:

1. Se crea el usuario en Clerk.
2. Se asigna `role = "rider"`.
3. Se guarda el `company_code` correspondiente.
4. La Rider App puede crear o completar el perfil local del pasajero utilizando el `sub` del JWT como `clerk_user_id`.

---

### Registro de conductores

El conductor debe atravesar un proceso de validación antes de poder operar como driver.

Proceso esperado:

1. Se crea el usuario en Clerk.
2. Inicialmente puede quedar pendiente de validación.
3. Un administrador verifica la documentación del conductor.
4. Cuando el conductor queda aprobado, se asigna `role = "driver"`.
5. La Driver App crea o actualiza el perfil local del conductor usando `sub` como `clerk_user_id`.

La información operativa del conductor, como estado de verificación, vehículos y disponibilidad, no se guarda como claim del JWT. Esa información pertenece a la base de datos de la Driver App.

---

### Registro de administradores

Los administradores son asignados manualmente por el equipo responsable del sistema.

Proceso esperado:

1. Se crea el usuario en Clerk.
2. Se asigna `role = "admin"` desde la configuración administrativa.
3. El usuario puede acceder a las aplicaciones necesarias para tareas de gestión.

---

## Validación de acceso por app

Cada app debe validar el JWT en sus rutas protegidas.

| App | Roles permitidos |
|-----|------------------|
| **Rider App** | `rider`, `admin` |
| **Driver App** | `driver`, `admin` |
| **Payments App** | `rider`, `driver`, `admin` |
| **Feedback App** | `rider`, `driver`, `admin` |
| **Control Plane** *(futuro)* | `admin` |

---

## Uso de Payments App por rol

La Payments App puede ser utilizada por distintos tipos de usuario, pero cada rol accede a funcionalidades diferentes.

| Rol | Uso dentro de Payments App |
|-----|-----------------------------|
| `rider` | Pagar reservas, consultar pagos realizados, consultar saldo a favor disponible y utilizar crédito en próximos viajes. |
| `driver` | Consultar liquidaciones y configurar o consultar su cuenta de cobro, si corresponde. |
| `admin` | Gestionar reglas de precio, revisar cobros, consultar saldos a favor, auditar movimientos de crédito y administrar liquidaciones. |

Notas:

- El pasajero ya no necesita dejar cargado un método de pago para cobros automáticos.
- El pago se realiza al momento de confirmar la reserva, mediante una sesión de checkout en Payments App.
- El saldo a favor es administrado exclusivamente por Payments App.
- Rider App puede mostrar el saldo a favor o notificaciones relacionadas, pero no calcula ni modifica ese saldo.

## Consideración sobre métodos de pago

En esta etapa, el sistema no requiere que el pasajero guarde previamente un método de pago para cobros automáticos.

El pasajero paga directamente cada reserva desde Payments App mediante una sesión de checkout.

Por lo tanto:

- no es obligatorio almacenar un método de pago reutilizable del pasajero;
- no se ejecutan cobros automáticos al cierre T-1h;
- el cierre T-1h solo se utiliza para calcular el precio final y generar saldo a favor si corresponde.

En futuras etapas, si se decide volver a implementar cobros automáticos, se podrá incorporar nuevamente la vinculación de métodos de pago guardados.

---

## Identidad compartida entre servicios

Cada app utiliza el claim `sub` como identificador compartido del usuario.

Ejemplos:

- En Rider App, `sub` se guarda como `clerk_user_id` del pasajero.
- En Driver App, `sub` se guarda como `clerk_user_id` del conductor.
- En Payments App, `sub` se usa para asociar checkouts, cobros, saldo a favor, movimientos de crédito, cuentas de cobro y liquidaciones.
- En Feedback App, `sub` se usa para identificar autores y destinatarios de reseñas o reportes.

Las apps pueden tener perfiles locales propios, pero todos deben estar relacionados mediante `clerk_user_id`.

---
## Saldo a favor y usuario compartido

El saldo a favor pertenece al usuario identificado por Clerk.

La Payments App utiliza el claim `sub` del JWT como identificador del usuario y lo asocia internamente a su cuenta de crédito.

Ejemplo:

```text
sub = user_abc123
credit_account.user_id = user_abc123
```

Reglas:

- La Payments App es la fuente de verdad del saldo a favor.
- La Rider App puede consultar el saldo disponible mediante `GET /api/payments/users/:user_id/credit-balance`.
- La Rider App puede recibir notificaciones de crédito generado mediante `PATCH /api/reservations/:reservation_id/credit-adjustment`.
- La Rider App puede mostrar una notificación o toast al pasajero cuando se genera saldo a favor.
- La Rider App no debe calcular ni modificar el saldo a favor.
- El saldo a favor se aplica automáticamente en Payments App al crear un checkout para una nueva reserva.

Ejemplo de notificación al usuario:

```text
Tenés $1200 de saldo a favor para tu próximo viaje.
```


---


## Usuarios y datos locales por app

Aunque Clerk es la fuente de verdad de identidad, cada app puede guardar información local del usuario cuando esa información pertenece a su dominio.

| App | Datos locales asociados al usuario |
|-----|------------------------------------|
| **Rider App** | Perfil de pasajero, reservas, historial de viajes, notificaciones. |
| **Driver App** | Perfil de conductor, vehículos, pools aceptados, estado operativo. |
| **Payments App** | Checkouts de reserva, cobros, transacciones, saldo a favor, movimientos de crédito, reglas de precio, procesos de finalización de precio del pool, cuentas de cobro y liquidaciones. |
| **Feedback App** | Reseñas, promedios de calificación, reportes. |

---

## Consistencia entre Clerk y bases locales

Clerk es la fuente de verdad de identidad y roles globales.

Las apps mantienen datos propios asociados a `clerk_user_id`.

Estrategia:

- Cada app crea o actualiza el perfil local del usuario al primer login o cuando recibe una operación relacionada con ese usuario.
- Si cambia el rol de un usuario en Clerk, las apps deben respetar el nuevo rol al validar el JWT.
- Si se modifica un claim relevante como `role` o `company_code`, el usuario debe obtener un token actualizado para que las apps vean el cambio.
- Las apps no deben asumir permisos únicamente por datos locales; siempre deben validar el JWT.

---

## Consideraciones sobre múltiples roles

En esta etapa, se define un único rol principal por usuario:

```text
role
```

Por simplicidad, un usuario opera como `rider`, `driver` o `admin`.

Si en etapas futuras se permite que un mismo usuario sea pasajero y conductor al mismo tiempo, se podrá reemplazar `role` por un arreglo de roles:

```json
{
  "roles": ["rider", "driver"]
}
```

En esta primera etapa no se modela esa complejidad.

---

## Autenticación en APIs inter-servicio

## Autenticación en APIs inter-servicio

Las APIs inter-servicio deben validar autenticación.

Cuando la acción se realiza en nombre de un usuario autenticado, se debe propagar el JWT emitido por Clerk para identificarlo mediante `sub` y validar su `role`.

Ejemplos:

- Rider App solicita un checkout a Payments App en nombre de un pasajero autenticado.
- Rider App consulta el saldo a favor disponible de un pasajero.
- Feedback App registra una reseña realizada por un usuario autenticado.

Cuando la acción es ejecutada por un proceso interno o automático, puede utilizarse un mecanismo de autenticación inter-servicio acordado por el equipo.

Ejemplos:

- Payments App notifica a Rider App el resultado de un pago.
- Payments App notifica a Rider App que se generó saldo a favor.
- Driver App solicita a Payments App el cálculo de ajustes de crédito al cierre T-1h.
- Driver App notifica a Feedback App el inicio o fin de un recorrido.

En ambos casos, cada app debe verificar que la aplicación llamadora tenga permisos para ejecutar la acción solicitada.

---

## Resumen

| Concepto | Definición |
|----------|------------|
| Servicio de autenticación | Clerk |
| Identificador compartido | `sub`, usado localmente como `clerk_user_id` |
| Roles principales | `rider`, `driver`, `admin` |
| Claim industrial | `company_code` |
| Fuente de verdad de identidad | Clerk |
| Fuente de verdad de datos operativos | Cada app según su dominio |
| Fuente de verdad del saldo a favor | Payments App |
| Estrategia de autorización | Validar JWT y rol en cada app |
| Configuración importante | `company_code` debe incluirse explícitamente en el JWT Template o Session Claims |
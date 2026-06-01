# 🛸 WeShuttle - Rider App

## 1. Link al deploy de producción
**🔗 https://proyecto-a-rider-weshuttle.vercel.app**

---

## 2. Listado de usuarios disponibles

| Perfil | Email | Contraseña | Vistas Accesibles |
| :--- | :--- | :--- | :--- |
| **Administrador** | admin+clerk_test@iaw.com | iawuser# | Vista Pública, Mis Viajes, Panel Logístico (Admin) |
| **Pasajero** | rider+clerk_test@iaw.com | iawuser# | Vista Pública, Mis Viajes |

---

## 3. Instrucciones para utilizar la aplicación

1. Ingrese al enlace de producción en Vercel.
2. Haga clic en el botón **"Ingresar"** en la barra superior.
3. Inicie sesión (autenticación vía Clerk) utilizando alguna de las credenciales provistas en la tabla anterior.
4. Dependiendo de la cuenta con la que ingrese, la experiencia y los permisos serán distintos:
   * 🎒 **Como Pasajero:** Podrá visualizar la flota pública en tiempo real, crear nuevas reservas de viaje y gestionar su historial personal en la pestaña "Mis Viajes".
   * 🛡️ **Como Administrador:** Tendrá acceso a todo lo anterior, más un botón exclusivo en la barra superior llamado **"Panel Admin"**. Desde allí podrá acceder al CRUD logístico para gestionar el catálogo de Destinos y simular el estado de la flota.

---

## 4. Breve descripción del proyecto

Aplicación orientada a usuarios finales (pasajeros) para la plataforma B2B de movilidad corporativa WeShuttle. El sistema general busca optimizar el traslado de personal hacia nodos industriales (como el Polo Petroquímico de Bahía Blanca) mediante un modelo de combis (Pools).

En este ecosistema, la **Rider App** actúa como la fuente de la verdad para el registro de pasajeros, el catálogo de destinos disponibles y el historial inmutable de las reservas de viaje de los empleados. A su vez, es el origen del manifiesto de pasajeros que consumen las aplicaciones logísticas y de cobro del resto de los microservicios.

---

## 5. Notas y comentarios para la corrección

* **Microservicios y APIs Externas:** Al ser parte de un ecosistema distribuido, la comunicación con la *Driver App*, *Payments App* y *Feedback App* se encuentra **mockeada** (`lib/api.ts`). Se simulan las interacciones asíncronas y los Webhooks mediante Server Actions para validar el ciclo de vida de la reserva, quedando pendiente la integración de las URLs productivas definitivas.
* **Diseño del CRUD:** El CRUD está distribuido lógicamente. El Administrador gestiona el catálogo de Destinos (U/R). El Pasajero gestiona sus reservas (C/R/D). No se permite al usuario editar una reserva confirmada o al administrador crear reservas a mano para proteger el flujo B2B de cotización y cobro.
* **Borrado Lógico (Soft Delete):** La cancelación de viajes no elimina físicamente la reserva de la base de datos, sino que actualiza su estado a `CANCELED` para no perder la trazabilidad financiera, las métricas del negocio y el historial visible del usuario.
* **Inmutabilidad y Snapshots:** La tabla `Reservation` guarda "fotos" (snapshots) del `max_price` de la cotización y de los datos de la unidad asignada, asegurando que el comprobante de viaje del pasajero quede inalterable ante futuros cambios en el sistema.
* **Seguridad de APIs Propias:** Los endpoints REST internos expuestos se encuentran funcionales para consumo, quedando programado para una próxima iteración la implementación de seguridad mediante API Keys.

# 🛸 WeShuttle - Rider App

Aplicación orientada a usuarios finales (pasajeros) para la plataforma B2B de movilidad corporativa WeShuttle. Permite la reserva de asientos, visualización de flota en tiempo real y gestión del ciclo de vida de los viajes.

## 🚀 Enlace de Producción (Deploy)
**🔗 https://proyecto-a-rider-weshuttle.vercel.app**

---

## 🔑 Credenciales de Acceso

Para evaluar la plataforma con datos precargados, utilizar las siguientes credenciales (Autenticación gestionada mediante Clerk):

| Perfil | Email | Contraseña | Vistas Accesibles |
| :--- | :--- | :--- | :--- |
| **Administrador** | admin@weshuttle.com | Weshuttle2024! | Vista Pública, Mis Viajes, Panel Logístico (Admin) |
| **Pasajero** | pasajero@weshuttle.com | Weshuttle2024! | Vista Pública, Mis Viajes |

---

## ⚙️ Notas de Arquitectura e Integración

* **Microservicios y APIs Externas:** Al ser parte de un ecosistema distribuido, la comunicación con la *Driver App*, *Payments App* y *Feedback App* se encuentra **mockeada** (`lib/api.ts`). Se simulan las interacciones asíncronas y los Webhooks mediante Server Actions para validar el ciclo de vida de la reserva, quedando pendiente la integración de las URLs productivas definitivas.
* **Seguridad de APIs Propias:** Los endpoints REST internos expuestos se encuentran funcionales para consumo, quedando programado para una próxima iteración la implementación de Rate Limiting y validación estricta de Tokens/API Keys.

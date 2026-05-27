# 🛸 WeShuttle - Rider App

Plataforma de reservas y logística para pasajeros. Esta aplicación forma parte del ecosistema distribuido WeShuttle, permitiendo a los usuarios finales reservar asientos en combis, gestionar su historial de viajes y simular la interacción con el resto de los microservicios.

## 🚀 Enlace de Producción (Deploy)
**🔗 https://proyecto-a-rider-weshuttle.vercel.app**

---

## 🔑 Credenciales de Acceso

Para evaluar la aplicación con los datos pre-cargados (reservas creadas, canceladas, completadas), por favor utilizar las siguientes credenciales:

**1. Usuario Administrador (Acceso al Panel Logístico y Vista Pública):**
* **Email:** [TU_EMAIL_ADMINISTRADOR_AQUI@gmail.com]
* **Contraseña:** [TU_CONTRASEÑA_AQUI]
*(O ingresar directamente mediante el botón de OAuth de Google si corresponde a esta cuenta).*

**2. Usuario Pasajero (Solo Vista Pública y Mis Viajes):**
* **Email:** [OTRO_EMAIL_PASAJERO_AQUI@gmail.com]
* **Contraseña:** [TU_CONTRASEÑA_AQUI]

---

## 🛠️ Tecnologías Utilizadas
* **Framework:** Next.js 14 (App Router)
* **Base de Datos:** PostgreSQL (Neon DB) + Prisma ORM
* **Autenticación:** Clerk Auth
* **Estilos:** Tailwind CSS

## ✨ Requisitos Cumplidos (Checklist)
- [x] **Páginas Next.js:** UI responsiva y componentes reutilizables.
- [x] **API Propia REST:** Endpoints expuestos (`/passengers`, `/cancellations`, `/feedback`, etc.).
- [x] **PostgreSQL propia:** Esquema independiente con Prisma.
- [x] **Autenticación:** Login/Logout obligatorio mediante Clerk.
- [x] **Panel de Administración:** Gestión CRUD de viajes y combis.
- [x] **Búsqueda y Paginación:** Filtrado por estado de viaje en URL (`?query=`).
- [x] **Manejo de Errores:** Archivos `error.tsx` implementados.
- [x] **API Externa:** Consumo de mocks simulando la Driver App, Payments App y Feedback App.
- [x] **Datos Cargados:** Base de datos productiva sembrada (Seed) y con historial de uso real.

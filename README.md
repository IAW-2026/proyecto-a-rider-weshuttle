#  WeShuttle - Rider App

## 1. Link al deploy de producción
**🔗 https://proyecto-a-rider-weshuttle.vercel.app**

---

## 2. Listado de usuarios disponibles

| Perfil | Email | Contraseña | Vistas Accesibles |
| :--- | :--- | :--- | :--- |
| **Administrador** | admin+clerk_test@iaw.com | iawuser# | Vista Pública, Mis Viajes, Panel Admin (Destinos, Pasajeros, Reservas) |
| **Pasajero** | rider+clerk_test@iaw.com | iawuser# | Vista Pública, Mis Viajes |

---

## 3. Instrucciones para utilizar la aplicación

1. Ingrese al enlace de producción en Vercel.
2. Haga clic en el botón **"Ingresar"** en la barra superior.
3. Inicie sesión (autenticación vía Clerk) utilizando alguna de las credenciales provistas en la tabla anterior.
4. Dependiendo de la cuenta con la que ingrese, la experiencia y los permisos serán distintos:
   * **Como Pasajero:** Podrá visualizar su ahorro a favor, crear nuevas reservas de viaje y gestionar su historial personal en la pestaña "Mis Viajes".
   * **Como Administrador:** Tendrá acceso a todo lo anterior, más un botón exclusivo en la barra superior llamado **"Panel Admin"**. Desde allí podrá gestionar el catálogo de Destinos y acceder a los monitores de auditoría (Directorio de Pasajeros y Trazabilidad Global de Reservas).

---

## 4. Breve descripción del proyecto

Aplicación orientada a usuarios finales (pasajeros) para la plataforma B2B de movilidad corporativa WeShuttle. El sistema general busca optimizar el traslado de personal hacia nodos industriales (como el Polo Petroquímico de Bahía Blanca) mediante un modelo de combis (Pools).

En este ecosistema, la **Rider App** actúa como la fuente de la verdad para el registro de pasajeros, el catálogo de destinos disponibles y el historial inmutable de las reservas de viaje de los empleados. A su vez, es el origen del manifiesto de pasajeros que consumen las aplicaciones logísticas y de cobro del resto de los microservicios.

---

## 5. Notas y comentarios para la corrección

* **Microservicios y APIs Externas:** Al ser parte de un ecosistema distribuido, la comunicación con la *Driver App*, *Payments App* y *Feedback App* se encuentra **completamente integrada y operativa en tiempo real** con los servidores de producción provistos por los otros equipos (`lib/api.ts`). Se realizan peticiones HTTP reales utilizando tokens de autorización de Clerk y se reciben resultados de pagos y notificaciones de logística a través de Webhooks funcionales en la nube.
* **Diseño del CRUD y Arquitectura:** El CRUD está distribuido lógicamente. El Administrador de la Rider App gestiona el catálogo de Destinos (U/R) y audita Pasajeros y Reservas, dejando la logística 100% a cargo de la *Driver App*. El Pasajero gestiona sus reservas (C/R/D). No se permite editar una reserva confirmada o crear reservas a mano para proteger el flujo B2B.
* **Borrado Lógico (Soft Delete):** La cancelación de viajes no elimina físicamente la reserva de la base de datos, sino que actualiza su estado a `CANCELED` para no perder la trazabilidad financiera, las métricas del negocio y el historial visible del usuario.
* **Inmutabilidad y Snapshots:** La tabla `Reservation` guarda "fotos" (snapshots) del `max_price` de la cotización y de los datos de la unidad asignada, asegurando que el comprobante de viaje del pasajero quede inalterable ante futuros cambios en el sistema.
* **Seguridad de APIs Propias:** Los endpoints REST internos expuestos se encuentran funcionales para consumo, y han sido validados para responder de acuerdo a los contratos acordados.

---

## 6. Mejoras e Implementaciones - Etapa 2

En esta etapa hemos robustecido la Rider App, optimizado la experiencia de usuario (UX) mediante micro-animaciones fluidas y asegurado la consistencia operativa en entornos locales y en la nube (Vercel).

### 6.1 Autocompletado de Direcciones (Nominatim API)
* Implementamos autocompletado en el formulario de reservas utilizando la API pública y abierta de **OpenStreetMap (Nominatim)**.
* Esto nos permite obtener coordenadas geográficas reales (`lat`, `lng`) y nombres de direcciones normalizados dinámicamente sin depender de APIs de pago como Google Maps.

### 6.2 Notificaciones y Toasts (Robustez y UX)
* **Soporte de Advertencias (Warning)**: Se incorporó soporte completo para el estado `warning` (avisos como *"Aún sin conductor asignado"*), que anteriormente generaba una caída crítica del renderizado.
* **Estética y Animación Snappy**: Rediseñamos los tiempos de animación. El Toast entra de forma elástica en **0.45s** (eliminando los 2.5s laggosos de la versión anterior) y se desvanece con escala descendente en **300ms** al cerrarse.
* **Manejo de Encoding (Mojibake)**: Creamos un decodificador dinámico UTF-8 en el cliente para corregir caracteres mal codificados en redirecciones del servidor, asegurando que las palabras con tildes (`Aún`, `Consultá`) se muestren perfectamente legibles.
* **Limpieza de URL**: El componente elimina inmediatamente los query parameters `toast` y `toastType` de la barra de direcciones tras capturarlos, previniendo que la notificación se vuelva a mostrar al recargar la página.

### 6.3 Resolución de Destellos e Hidratación (Navbar)
* **Hydration Safety**: Solucionamos de forma definitiva las discrepancias de hidratación en React introduciendo un estado `mounted` en el `Navbar`.
* **Flicker de Login**: El botón "Ingresar" no se renderiza bajo ningún concepto durante el montaje inicial en el cliente. En su lugar se muestra un esqueleto animado (`pulse`) hasta que Clerk confirma si hay una sesión activa, eliminando los molestos saltos visuales.
* **URLs de Retorno Dinámicas**: Calculamos dinámicamente el host activo en el cliente (`window.location.origin`) al interactuar con aplicaciones externas (como la Feedback App). Esto evita redirecciones de dominio incorrectas que invalidaban la sesión y forzaban al usuario a iniciar sesión nuevamente.

### 6.4 Nuevo Panel de Administración (`/admin`)
Diseñado con una interfaz B2B limpia y profesional, contiene:
* **Destinos**: Visualización y gestión en tiempo real del catálogo de destinos corporativos (alta y desactivación lógica).
* **Pasajeros**: Directorio integral de usuarios registrados, auditoría de estados de actividad y mapeo con IDs de Clerk.
* **Reservas**: Monitor global de trazabilidad operativa y financiera que muestra snapshots de cotización y chofer asignado de todos los empleados.

### 6.5 Limitación Técnica de Sesión (Clerk en Ecosistema)
* **Aclaración sobre el traspaso entre Apps**: Debido a que los microservicios de este ecosistema (Rider App, Feedback App, Payments App) están desplegados en dominios o subdominios de Vercel distintos y separados, existen restricciones de seguridad del navegador (**SameSite cookies**) que impiden compartir la sesión de Clerk de forma nativa y automática al navegar entre aplicaciones.
* Sin embargo, todas las aplicaciones se encuentran interconectadas de manera segura mediante tokens de autorización y redirecciones dinámicas con URLs de retorno, garantizando que el usuario regrese a su sesión original sin fricciones.

---

## 7. Base de Datos y Datos Semilla (Seed)
* **Datos Históricos Extendidos**: Para dar soporte a las métricas del negocio y cumplir con los requisitos de evaluación, ampliamos nuestro script de seed para que genere registros distribuidos de forma realista a lo largo de **tres meses de actividad**, logrando un conjunto robusto de más de 500 reservas con patrones de uso real (VIPs, días de alta demanda y cancelaciones).


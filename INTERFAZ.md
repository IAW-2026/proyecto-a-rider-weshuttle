web application/stitch/projects/18305270878125694891/screens/13c3fbbbcff64f01ac1032d2b4f63a9d
# Especificaciones Técnicas: Gestión de Logística (Admin) - WeShuttle

Este documento detalla la estructura, componentes y lógica visual del panel administrativo de WeShuttle, basado en el sistema **Professional Corporate Identity**.

---

## 1. Arquitectura de la Página
La pantalla de administración utiliza un layout de escritorio con navegación lateral persistente y un área de contenido principal organizada en una cuadrícula de dashboard.

- **Fondo de Pantalla:** `Surface (#F7F9FB)`.
- **Navegación Lateral (SideBar):** Ancho fijo de `260px`, fondo blanco con borde derecho `1px solid #D8DADC`.

---

## 2. Indicadores Clave de Desempeño (KPI Cards)
Ubicados en la parte superior para una lectura rápida del estado operativo.
- **Estructura:** Fila de 4 tarjetas iguales.
- **Elementos por Tarjeta:**
  - **Título:** `Label Small`, Bold, Slate Gray.
  - **Valor Numérico:** `Display Large` (e.g., 24, 08), Midnight Blue.
  - **Icono:** Iconos lineales (`local_shipping`, `analytics`, etc.) en el extremo superior derecho.
  - **Metadato/Tendencia:** Texto pequeño inferior (e.g., "+12% vs ayer" en verde o "Capacidad al 82%").

---

## 3. Tabla de Viajes en Tiempo Real (Main View)
El componente central para el monitoreo de la flota.
- **Contenedor:** Card blanca con radio de `12px` y sombra suave.
- **Header de Tabla:** Filtros rápidos ("Todos", "En ruta", "Pendientes") con estilo de botones segmentados.
- **Columnas:**
  - **Viaje / Ruta:** ID del viaje (`#WS-8902`) en bold y descripción de ruta (Origen → Destino).
  - **Conductor / Placa:** Avatar circular, nombre del conductor y patente del vehículo.
  - **Estado:** Badges con colores semánticos:
    - `EN RUTA`: Fondo verde suave, texto verde fuerte, punto indicador.
    - `RETRASADO`: Fondo ámbar suave, texto ámbar fuerte.
    - `PENDIENTE`: Fondo gris/azul suave.
  - **Acciones:** Botón "Actualizar" (Outlined) y botón circular de cancelación (Icono X en rojo).

---

## 4. Panel de Asignación de Viajes (Sidebar Derecha)
Formulario lateral para la creación rápida de nuevos trayectos.
- **Título:** "Asignar Nuevo Viaje" con icono de portapapeles.
- **Campos del Formulario:**
  - **Ruta de Destino:** Input con icono de ubicación.
  - **Selector de Conductor:** Menú desplegable con búsqueda integrada.
  - **Grid de Tiempo:** Selectores de Fecha y Hora en una sola fila.
- **Resumen de Carga:** Bloque informativo azul tenue que detalla el peso estimado y tipo de carga.
- **CTA Principal:** Botón "Confirmar y Notificar" en `Midnight Blue (#0A192F)` con icono de cohete/envío.

---

## 5. Navegación Lateral (SideNavBar)
- **Marca:** "WeShuttle Admin" en Itálica Extra-Bold.
- **Items de Menú:** "Logística", "Conductores", "Destinos", "Reportes", "Ajustes".
- **Estado Activo:** Fondo negro/azul oscuro con texto blanco para el item seleccionado.
- **Footer:** Botón de "Cerrar Sesión" con icono de salida en la parte inferior.

---

## 6. Estilos y Tokens
- **Primario:** Midnight Blue (`#0A192F`).
- **Bordes:** Outline (`#D8DADC`).
- **Radio de Borde:** `12px` para tarjetas grandes, `8px` para inputs y botones.
- **Tipografía:** `Inter` en toda la interfaz.

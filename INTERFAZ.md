web application/stitch/projects/18305270878125694891/screens/b084b13d1fcc47068b0c6771e615ec5a
# Especificaciones Técnicas: Pantalla Reservar Asiento - WeShuttle

Este documento detalla la estructura, campos y lógica visual del flujo de reserva de WeShuttle, basado en el sistema **Professional Corporate Identity**.

---

## 1. Estructura de la Página
La pantalla está diseñada como un formulario enfocado, centrado en el viewport para eliminar distracciones y maximizar la tasa de conversión.

- **Contenedor Externo:** Fondo `Surface (#F7F9FB)`.
- **Card del Formulario:** 
  - Ancho máximo: `800px`.
  - Margen: Auto-centrado.
  - Padding interno: `40px` (Superior/Inferior) y `48px` (Lateral).
  - Estilo: Fondo blanco, borde `1px` en `Outline (#D8DADC)` y radio de `12px`.

---

## 2. Encabezado de Acción
- **Enlace de Retorno:** "VOLVER AL DASHBOARD" con icono de flecha hacia la izquierda.
  - Estilo: `Label Small`, Peso Bold, Color `Slate Gray (#4B5563)`.
- **Título:** "Reservar Asiento" (`Display Large`, 32px, Bold).
- **Subtítulo:** "Complete los detalles para asegurar su lugar en el próximo servicio de WeShuttle." (`Body Medium`, Slate Gray).

---

## 3. Campos del Formulario (Input Fields)
Cada campo sigue una estructura de etiqueta superior (`Label Small`, Bold) y contenedor de entrada con altura de `56px`.

### A. Destino Final
- **Selector:** Menú desplegable con icono de mapa (`map`).
- **Placeholder:** "Seleccione su destino".
- **Estilo:** Borde `1px` sólido, radio `8px`, icono de flecha hacia abajo.

### B. Grid de Tiempo (Fecha y Horario)
Distribuido en dos columnas de igual ancho (`flex-1`).
- **Fecha:** Selector con icono de calendario. Valor por defecto: Fecha actual.
- **Horario:** Selector con icono de reloj. Intervalos sugeridos cada 30 min.

### C. Punto de Recogida
- **Input de Texto:** Campo amplio para direcciones manuales con icono de ubicación (`location_on`).
- **Ayuda Visual:** Texto de apoyo inferior ("Ej: Entrada principal Edificio Titanium") en gris tenue.

---

## 4. Bloque de Información y Garantía
- **Banner de Info:** Contenedor azul muy suave (`bg-blue-50`) con borde sutil.
  - **Contenido:** Icono de información y texto detallando el tiempo estimado de viaje (45 mins) y la confirmación del conductor (30 mins antes).
- **Garantía:** Texto centrado debajo del botón principal: "GARANTÍA DE PUNTUALIDAD WESHUTTLE" en `Label Small`, espaciado (`tracking-widest`).

---

## 5. Acción Principal (CTA)
- **Botón "Confirmar Reserva":**
  - Estilo: Relleno total (Solid), Color `Midnight Blue (#0A192F)`.
  - Icono: Checkmark al final del texto.
  - Comportamiento: Ancho completo (`w-full`), altura `56px`, tipografía Bold.

---

## 6. Footer Informativo
- **Soporte:** Enlace centrado "¿Necesita asistencia especial? Contacte a Logística".
- **Legales:** Barra inferior con copyright y enlaces a Términos, Privacidad y Ayuda en gris claro.

'use client'

import { useState, useEffect } from 'react'

// Generar slots de tiempo cada 30 minutos
const timeSlots: string[] = []
for (let h = 0; h < 24; h++) {
  const hStr = h.toString().padStart(2, '0')
  timeSlots.push(`${hStr}:00`)
  timeSlots.push(`${hStr}:30`)
}

export default function DateTimeInputs({ minDate, maxDate, minTime, maxTime }: { minDate: string, maxDate: string, minTime: string, maxTime: string }) {
  const [fecha, setFecha] = useState(minDate)
  const [isOpen, setIsOpen] = useState(false)
  
  // Filtrar los slots según el día seleccionado
  const filteredTimeSlots = timeSlots.filter(time => {
    if (fecha === minDate) {
      return time >= minTime;
    }
    if (fecha === maxDate) {
      return time <= maxTime;
    }
    return true;
  });

  const [hora, setHora] = useState(filteredTimeSlots[0] || minTime)

  // Asegurar que al cambiar de día, si la hora seleccionada ya no es válida, se escoja la primera válida
  useEffect(() => {
    if (filteredTimeSlots.length > 0 && !filteredTimeSlots.includes(hora)) {
      setHora(filteredTimeSlots[0])
    }
  }, [fecha, filteredTimeSlots, hora])

  // Helper para formatear hora
  const formatAMPM = (time24: string) => {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${mStr} ${ampm}`;
  };

  // Helper para separar los datos y mostrarlos con mejor diseño (badges)
  const getSelectedParts = (time24: string) => {
    if (!time24) return { h: '12', m: '00', ampm: 'AM' };
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return { h: h.toString(), m: mStr, ampm };
  };

  const selectedParts = getSelectedParts(hora);

  return (
    <div className="flex flex-col gap-4 w-full">
      
      {/* SELECCIÓN DE DÍA */}
      <div className="w-full">
        <label htmlFor="fecha" className="block text-[12px] font-bold uppercase tracking-widest text-[#0A192F] mb-1.5">Día</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] z-10 pointer-events-none">calendar_today</span>
          <input 
            type="date" id="fecha" name="fecha" required 
            min={minDate} max={maxDate} value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="w-full appearance-none min-w-0 max-w-full h-[50px] pl-10 pr-10 rounded-[8px] border border-[#D8DADC] text-[16px] md:text-[14px] font-semibold bg-[#FFFFFF] outline-none focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] transition-all text-[#0A192F] cursor-pointer" 
          />
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-[#475569] z-10 pointer-events-none">expand_more</span>
        </div>
      </div>
      
      {/* SELECCIÓN DE HORA */}
      <div className="w-full relative">
        <label htmlFor="hora" className="block text-[12px] font-bold uppercase tracking-widest text-[#0A192F] mb-1.5">Hora</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] z-10 pointer-events-none">schedule</span>
          
          {/* Input oculto para que el Server Action reciba el valor correcto */}
          <input type="hidden" id="hora" name="hora" value={hora} />
          
          {/* Botón premium de trigger */}
          <button 
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full relative flex items-center justify-between h-[50px] pl-10 pr-4 rounded-[8px] border border-[#D8DADC] text-[16px] md:text-[14px] font-semibold bg-[#FFFFFF] outline-none focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] transition-all text-[#0A192F] text-left cursor-pointer"
          >
            <div className="flex items-center">
              <span>{selectedParts.h}:{selectedParts.m}</span>
              <span className="text-[10px] font-extrabold bg-[#E2E8F0] text-[#475569] px-1.5 py-0.5 rounded ml-2.5 tracking-wider">
                {selectedParts.ampm}
              </span>
            </div>
            <span className="material-symbols-outlined text-[#475569] transition-transform duration-200 z-10 pointer-events-none" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
          </button>

          {/* Menú desplegable flotante personalizado */}
          {isOpen && (
            <>
              {/* Overlay invisible para cerrar al hacer click afuera */}
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              
              <div className="absolute left-0 right-0 mt-2 bg-white border border-[#D8DADC] rounded-[8px] shadow-lg z-50 max-h-[220px] overflow-y-auto p-1">
                {filteredTimeSlots.map((slot) => {
                  const isSelected = slot === hora;
                  const parts = getSelectedParts(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setHora(slot);
                        setIsOpen(false);
                      }}
                      className={`w-full h-[44px] px-3.5 rounded-[6px] text-[14px] font-semibold transition-all text-left flex items-center justify-between ${
                        isSelected 
                          ? 'bg-[#0A192F] text-white font-bold' 
                          : 'text-[#0A192F] hover:bg-[#F7F9FB]'
                      }`}
                    >
                      <div className="flex items-center">
                        <span className={isSelected ? 'text-white' : 'text-[#0A192F]'}>
                          {parts.h}:{parts.m}
                        </span>
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ml-2.5 tracking-wider ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#E2E8F0] text-[#475569]'
                        }`}>
                          {parts.ampm}
                        </span>
                      </div>
                      {isSelected && <span className="material-symbols-outlined text-[18px] text-white">check</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        
        {/* MENSAJES EN VIVO */}
        <p className="text-[10px] text-[#10B981] font-bold mt-1.5 leading-tight">
          {fecha === minDate ? `Permitido desde las ${formatAMPM(minTime)} en adelante.` : `Permitido hasta las ${formatAMPM(maxTime)}.`}
        </p>
      </div>
      
      <p className="text-[11px] text-[#475569] mt-1 mb-2">Las reservas corporativas se realizan con 2 a 24 horas de anticipación.</p>
    </div>
  )
}
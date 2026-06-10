'use client'

import { useState } from 'react'

export default function DateTimeInputs({ minDate, maxDate, minTime, maxTime }: { minDate: string, maxDate: string, minTime: string, maxTime: string }) {
  const [fecha, setFecha] = useState(minDate)
  const [hora, setHora] = useState(minTime)

  // Validaciones en vivo
  const isTooEarly = fecha === minDate && hora < minTime;
  const isTooLate = fecha === maxDate && hora > maxTime;
  const isError = isTooEarly || isTooLate;

  return (
    <div className="grid grid-cols-2 gap-4 md:gap-6">
      <div className="w-full overflow-hidden">
        <label htmlFor="fecha" className="block text-[12px] font-bold uppercase tracking-widest text-[#0A192F] mb-2">Día</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]">calendar_today</span>
          <input 
            type="date" id="fecha" name="fecha" required 
            min={minDate} max={maxDate} value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="w-full appearance-none min-w-0 max-w-full h-[56px] pl-10 pr-2 md:pr-4 rounded-[8px] border border-[#D8DADC] text-[16px] md:text-[14px] font-semibold bg-[#FFFFFF] outline-none focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] transition-all text-[#0A192F]" 
          />
        </div>
      </div>
      <div className="w-full overflow-hidden">
        <label htmlFor="hora" className="block text-[12px] font-bold uppercase tracking-widest text-[#0A192F] mb-2">Hora</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]">schedule</span>
          <input 
            type="time" id="hora" name="hora" required 
            // Bloqueo dinámico: Depende del día que hayas seleccionado
            min={fecha === minDate ? minTime : undefined}
            max={fecha === maxDate ? maxTime : undefined}
            value={hora} onChange={(e) => setHora(e.target.value)}
            className={`w-full appearance-none min-w-0 max-w-full h-[56px] pl-10 pr-2 md:pr-4 rounded-[8px] border text-[16px] md:text-[14px] font-semibold outline-none focus:ring-1 transition-all text-[#0A192F] ${
              isError ? 'border-[#EF4444] bg-[#FEF2F2] focus:border-[#EF4444] focus:ring-[#EF4444]' : 'border-[#D8DADC] bg-[#FFFFFF] focus:border-[#0A192F] focus:ring-[#0A192F]'
            }`} 
          />
        </div>
        
        {/* MENSAJES EN VIVO */}
        {isTooEarly && <p className="text-[10px] text-[#DC2626] font-bold mt-1.5 leading-tight">Para hoy, debe ser después de las {minTime} hs.</p>}
        {isTooLate && <p className="text-[10px] text-[#DC2626] font-bold mt-1.5 leading-tight">Para mañana, debe ser antes de las {maxTime} hs.</p>}
        {!isError && (
          <p className="text-[10px] text-[#10B981] font-bold mt-1.5 leading-tight">
            {fecha === minDate ? `Permitido desde las ${minTime} hs en adelante.` : `Permitido hasta las ${maxTime} hs.`}
          </p>
        )}
      </div>
      <p className="text-[11px] text-[#475569] col-span-2 mt-1 mb-2">Las reservas corporativas se realizan con 1 a 24 horas de anticipación.</p>
    </div>
  )
}
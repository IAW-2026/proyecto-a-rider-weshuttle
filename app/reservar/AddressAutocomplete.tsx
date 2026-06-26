'use client'

import { useState, useEffect, useRef } from 'react'

export default function AddressAutocomplete() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Efecto para buscar direcciones mientras el usuario tipea
  useEffect(() => {
    // Solo buscamos si escribió al menos 4 letras
    if (query.length < 4) {
      setSuggestions([])
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)

    // Esperamos 500ms desde que deja de tipear para no bombardear la API (Debounce)
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Bahía Blanca')}&limit=4&addressdetails=1`, {
          headers: { 'Accept-Language': 'es' }
        })
        if (!res.ok) throw new Error("Error en la API")
        const data = await res.json()
        
        if (Array.isArray(data)) setSuggestions(data)
        else setSuggestions([])
      } catch (error) {
        console.error("Error buscando direcciones:", error)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  // Efecto para cerrar la lista si hace clic en otra parte de la pantalla
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [])

  return (
    <div className="relative" ref={wrapperRef}>
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]">location_on</span>
      <input 
        type="text" 
        id="punto_partida" 
        name="punto_partida" /* ¡Importante! Mantiene el mismo nombre para que tu Server Action lo reconozca */
        placeholder="Ej: Sarmiento 850" 
        required 
        minLength={5} 
        maxLength={100} 
        pattern=".*[a-zA-ZáéíóúÁÉÍÓÚñÑ].*" 
        title="Debe incluir al menos una letra (Ej: Calle 123)" 
        className="w-full min-w-0 h-[56px] pl-10 pr-2 md:pr-4 rounded-[8px] border border-[#D8DADC] text-[16px] md:text-[14px] font-semibold bg-[#FFFFFF] outline-none focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] transition-all text-[#0A192F]" 
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
        }}
        onFocus={() => query.length > 3 && setIsOpen(true)}
        autoComplete="off"
      />
      
      {/* Lista flotante de sugerencias */}
      {isOpen && query.length > 3 && (
        <ul className="absolute z-50 w-full bg-white border border-[#D8DADC] rounded-[8px] mt-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)] max-h-60 overflow-auto">
          {isLoading ? (
            <li className="px-4 py-3 text-[14px] text-[#475569] italic flex items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-[16px]">sync</span> Buscando...
            </li>
          ) : suggestions.length > 0 ? (
            suggestions.map((item, index) => {
            const street = item.address?.road || item.name || ''
            const houseNumber = item.address?.house_number || ''
            const displayName = `${street} ${houseNumber}`.trim()
            
            return (
              <li 
                key={item.place_id || index} 
                className="px-4 py-3 hover:bg-[#F7F9FB] cursor-pointer text-[14px] text-[#0A192F] border-b last:border-b-0 border-[#D8DADC] transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault() // Súper importante: evita que el input pierda foco antes del clic
                  setQuery(displayName || item.display_name.split(',')[0])
                  setIsOpen(false)
                }}
              >
                <div className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-[#475569]">map</span>
                  {displayName || item.display_name.split(',')[0]}
                </div>
                <div className="text-[11px] text-[#475569] mt-0.5 ml-6 truncate">{item.display_name}</div>
              </li>
            )
            })
          ) : (
            <li className="px-4 py-3 text-[14px] text-[#475569] italic">
              No encontramos sugerencias exactas. Podes dejar tu calle así.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
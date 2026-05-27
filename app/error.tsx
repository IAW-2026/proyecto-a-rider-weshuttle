'use client' // Los componentes de error DEBEN ser 'use client'
// Este archivo atrapa cualquier error para que no se rompa la aplicación
 
import { useEffect } from 'react'
import Link from 'next/link'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Opcional: Acá podríamos mandar el error a un servicio como Sentry
    console.error("Error capturado por la App:", error)
  }, [error])
 
  return (
    <div className="min-h-screen bg-[#F7F9FB] flex flex-col items-center justify-center p-8 text-[#0A192F]">
      <div className="bg-[#FFFFFF] p-10 md:p-12 rounded-[12px] border border-[#D8DADC] shadow-sm text-center max-w-md w-full">
        <span className="material-symbols-outlined text-[64px] text-[#EF4444] mb-6 block">warning</span>
        <h1 className="text-[24px] font-bold tracking-tight mb-2">¡Ups! Algo salió mal</h1>
        <p className="text-[#475569] text-[14px] mb-8 leading-relaxed">
          {error.message || "Tuvimos un problema procesando tu solicitud en WeShuttle. Por favor, intentá de nuevo."}
        </p>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 w-full bg-[#0A192F] text-white text-[12px] font-bold uppercase tracking-widest py-3.5 rounded-[8px] hover:bg-[#0A192F]/90 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span> Intentar de nuevo
          </button>
          <Link href="/" className="flex items-center justify-center gap-2 w-full bg-[#F7F9FB] border border-[#D8DADC] text-[#475569] text-[12px] font-bold uppercase tracking-widest py-3.5 rounded-[8px] hover:bg-[#E2E8F0] hover:text-[#0A192F] transition-all">
            <span className="material-symbols-outlined text-[18px]">home</span> Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
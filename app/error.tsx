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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 text-black font-sans">
      <div className="bg-white p-12 rounded-[3rem] border border-gray-200 shadow-sm text-center max-w-md w-full">
        <div className="text-6xl mb-6">🚨</div>
        <h1 className="text-2xl font-black italic mb-2">¡Ups! Algo salió mal</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          {error.message || "Tuvimos un problema procesando tu solicitud. Por favor, intentá de nuevo."}
        </p>
        
        <div className="flex flex-col gap-4">
          <button
            onClick={() => reset()}
            className="w-full bg-blue-600 text-white text-xs font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-blue-700 transition-colors shadow-md"
          >
            Intentar de nuevo
          </button>
          <Link href="/" className="w-full bg-gray-100 text-gray-600 text-xs font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-gray-200 transition-colors">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
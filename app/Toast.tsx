'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

// Función robusta para decodificar caracteres UTF-8 mal interpretados (mojibake)
function decodeUTF8String(str: string): string {
  try {
    // Si la cadena está doblemente codificada (ej: "AÃºn"), reconstruimos y decodificamos los bytes UTF-8 correctos
    return decodeURIComponent(escape(str));
  } catch (e) {
    // Si ya viene decodificada de forma correcta o contiene caracteres válidos, retornamos la original
    return str;
  }
}

export default function Toast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [message, setMessage] = useState<string | null>(null)
  const [type, setType] = useState<'success' | 'error' | 'info' | 'warning'>('success')
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const toastMsg = searchParams.get('toast')
    const toastType = (searchParams.get('toastType') as 'success' | 'error' | 'info' | 'warning') || 'success'
    
    if (toastMsg) {
      setMessage(decodeUTF8String(toastMsg))
      setType(toastType)
      setIsExiting(false)
      
      // Limpiamos la URL usando el router de Next.js para evitar bugs visuales
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.delete('toast')
      newParams.delete('toastType')
      router.replace(`${pathname}?${newParams.toString()}`, { scroll: false })
    }
  }, [searchParams, pathname, router])

  useEffect(() => {
    if (message && !isExiting) {
      const timer = setTimeout(() => {
        setIsExiting(true)
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [message, isExiting])

  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => {
        setMessage(null)
        setIsExiting(false)
      }, 300) // Coincide con la duración de la transición
      return () => clearTimeout(timer)
    }
  }, [isExiting])

  if (!message) return null

  const onClose = () => setIsExiting(true)

  const icons = {
    success: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    ),
    info: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    ),
    warning: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  }

  const styles = {
    success: { border: 'border-green-100', text: 'text-green-600' },
    error: { border: 'border-red-100', text: 'text-red-600' },
    info: { border: 'border-blue-100', text: 'text-blue-600' },
    warning: { border: 'border-amber-100', text: 'text-amber-600' }
  }

  const currentStyle = styles[type] || styles.info
  const currentIcon = icons[type] || icons.info

  return (
    <div
      className={`
        fixed
        bottom-8
        right-8
        z-[120]
        transition-all
        duration-300
        ease-[cubic-bezier(0.16,1,0.3,1)]
        ${isExiting ? 'opacity-0 translate-y-4 scale-95 pointer-events-none' : 'opacity-100 translate-y-0 scale-100 animate-[toastSlideIn_0.45s_cubic-bezier(0.22,1,0.36,1)]'}
      `}
    >
      <div
        className={`flex items-center gap-4 p-4 rounded-[20px] bg-white border ${currentStyle.border} shadow-2xl min-w-[320px] border-l-4 ${
          type === 'success'
            ? 'border-l-green-500'
            : type === 'error'
            ? 'border-l-red-500'
            : type === 'warning'
            ? 'border-l-amber-500'
            : 'border-l-midnight'
        }`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 ${currentStyle.text} font-black text-lg`}
        >
          {currentIcon}
        </div>

        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--ws-slate)] mb-0.5">
            Notificación
          </p>

          <p className="text-sm font-bold text-[var(--ws-midnight)] leading-tight">
            {message}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-50 rounded-full transition-colors cursor-pointer"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-slate-300"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  )
}
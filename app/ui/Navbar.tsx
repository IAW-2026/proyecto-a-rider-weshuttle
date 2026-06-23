'use client'

import Link from "next/link"
import { useUser, UserButton } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

interface NavbarProps {
  isAdmin?: boolean;
  notificaciones?: any[];
  limpiarNotificaciones?: () => Promise<void>;
}

export default function Navbar({ isAdmin = false, notificaciones = [], limpiarNotificaciones }: NavbarProps) {
  const { user, isSignedIn, isLoaded } = useUser()
  const pathname = usePathname()
  const [origin, setOrigin] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  const returnUrl = origin || process.env.NEXT_PUBLIC_RIDER_APP_URL || '#'

  // Rol del usuario y nombre en Clerk para consistencia de metadatos
  const role = (user?.publicMetadata?.role as string) || "Rider"
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || "Usuario"

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-[var(--ws-outline)] shadow-[0_2px_12px_rgba(10,25,47,0.06)]">
      <div className="w-full max-w-5xl mx-auto h-20 flex items-center justify-between px-4 md:px-8 relative">
        
        {/* LOGO SVG OFICIAL DE WESHUTTLE */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-85 transition-opacity">
          <div className="flex items-center justify-center w-11 h-11 bg-white rounded-xl border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-1.5 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M 22 34 L 35 75 L 50 45 L 65 75 L 78 34"
                fill="none"
                stroke="#0c59cf"
                strokeWidth="13"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="22" cy="30" r="8.5" fill="#e63946" />
              <circle cx="50" cy="40" r="8.5" fill="#f59e0b" />
              <circle cx="78" cy="30" r="8.5" fill="#10b981" />
            </svg>
          </div>
          <span className="ws-brand">
            WeShuttle
          </span>
        </Link>

        {/* ENLACES CENTRALES DE NAVEGACIÓN (Rider App) */}
        {isSignedIn && mounted && (
          <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center h-full gap-8">
            <Link 
              href="/" 
              className={`text-[14px] font-bold h-full flex items-center border-b-2 transition-colors duration-200 ${
                pathname === '/' 
                  ? 'border-[var(--ws-midnight)] text-[var(--ws-midnight)]' 
                  : 'border-transparent text-[var(--ws-slate)] hover:text-[var(--ws-midnight)]'
              }`}
            >
              Inicio
            </Link>
            <Link 
              href="/mis-viajes" 
              className={`text-[14px] font-bold h-full flex items-center border-b-2 transition-colors duration-200 ${
                pathname === '/mis-viajes' 
                  ? 'border-[var(--ws-midnight)] text-[var(--ws-midnight)]' 
                  : 'border-transparent text-[var(--ws-slate)] hover:text-[var(--ws-midnight)]'
              }`}
            >
              Mis Viajes
            </Link>
            <Link 
              href="/reservar" 
              className={`text-[14px] font-bold h-full flex items-center border-b-2 transition-colors duration-200 ${
                pathname === '/reservar' 
                  ? 'border-[var(--ws-midnight)] text-[var(--ws-midnight)]' 
                  : 'border-transparent text-[var(--ws-slate)] hover:text-[var(--ws-midnight)]'
              }`}
            >
              Reservar
            </Link>
          </div>
        )}

        {/* ACCIONES Y PERFIL DE USUARIO */}
        <div className="flex items-center gap-4 h-full min-w-[80px] justify-end">
          {!mounted || !isLoaded ? (
            /* Esqueleto de carga sutil para evitar saltos y destellos del botón Ingresar */
            <div className="h-9 w-9 rounded-full bg-slate-100 animate-pulse shrink-0" />
          ) : isSignedIn ? (
            <>
              {/* CAMPANITA DE NOTIFICACIONES */}
              <div className="relative group flex items-center h-full" tabIndex={0}>
                <div className="cursor-pointer text-[var(--ws-slate)] hover:text-[var(--ws-midnight)] transition-colors duration-200 relative flex items-center justify-center p-2 rounded-full hover:bg-[#F7F9FB]">
                  <span className="material-symbols-outlined text-[24px]">notifications</span>
                  {notificaciones.length > 0 && (
                    <span className="absolute top-1 right-1 bg-[#DC2626] text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-bounce">
                      {notificaciones.length}
                    </span>
                  )}
                </div>
                
                {/* Menú desplegable flotante de notificaciones */}
                <div className="fixed left-4 right-4 top-[72px] sm:absolute sm:top-[100%] sm:left-auto sm:right-0 sm:w-72 z-50 hidden group-hover:block group-focus-within:block sm:pt-1">
                  <div className="bg-white border border-[var(--ws-outline)] rounded-lg shadow-lg overflow-hidden">
                    <div className="p-4 border-b border-[var(--ws-outline)] flex justify-between items-center bg-[#F7F9FB]">
                      <h3 className="text-[16px] font-semibold text-[var(--ws-midnight)]">Notificaciones</h3>
                      {notificaciones.length > 0 && limpiarNotificaciones && (
                        <form action={limpiarNotificaciones}>
                          <button type="submit" className="text-[12px] text-[var(--ws-midnight)] font-bold uppercase tracking-widest hover:underline">
                            Marcar leídas
                          </button>
                        </form>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2">
                      {notificaciones.length === 0 ? (
                        <p className="p-4 text-center text-[14px] text-[var(--ws-slate)]">No hay avisos nuevos.</p>
                      ) : (
                        notificaciones.map(notif => (
                          <div key={notif.id} className="p-3 mb-1 bg-[#F7F9FB] text-[var(--ws-midnight)] text-[12px] rounded-lg border border-[var(--ws-outline)]">
                            {notif.type === 'FEEDBACK_AVAILABLE' ? (
                              <a 
                                href={`${process.env.NEXT_PUBLIC_FEEDBACK_APP_URL || '#'}/?return_url=${encodeURIComponent(returnUrl)}`} 
                                className="text-[#3B82F6] hover:underline font-bold block"
                              >
                                {notif.message} <span className="material-symbols-outlined text-[10px] align-middle ml-1">open_in_new</span>
                              </a>
                            ) : (
                              notif.message
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ENLACE AL PANEL DE ADMIN (si es admin) */}
              {isAdmin && (
                <Link href="/admin" className="border border-[var(--ws-midnight)] text-[var(--ws-midnight)] px-3 py-1.5 rounded-lg text-[12px] font-bold hover:bg-[#F7F9FB] transition-colors duration-200">
                  Panel Admin
                </Link>
              )}

              {/* METADATA DEL USUARIO (De la Feedback App) */}
              <div className="flex items-center gap-3">
                <div className="w-[40px] h-[40px] rounded-full border border-[var(--ws-outline)] flex items-center justify-center overflow-hidden bg-white">
                  <UserButton />
                </div>
              </div>
            </>
          ) : (
            <Link href="/sign-in" className="bg-[var(--ws-midnight)] text-white px-5 py-2 rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-[var(--ws-midnight)]/90 transition-colors shadow-sm">
              Ingresar
            </Link>
          )}
        </div>

      </div>
    </header>
  )
}

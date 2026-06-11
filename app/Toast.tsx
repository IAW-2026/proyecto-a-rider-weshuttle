'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

export default function Toast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [message, setMessage] = useState<string | null>(null)
  const [type, setType] = useState<'success' | 'error'>('success')

  useEffect(() => {
    const toastMsg = searchParams.get('toast')
    const toastType = (searchParams.get('toastType') as 'success' | 'error') || 'success'
    
    if (toastMsg) {
      setMessage(toastMsg)
      setType(toastType)
      
      // Limpiamos la URL usando el router de Next.js para evitar bugs visuales
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.delete('toast')
      newParams.delete('toastType')
      router.replace(`${pathname}?${newParams.toString()}`, { scroll: false })
    }
  }, [searchParams, pathname, router])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [message])

  if (!message) return null

  return (
    <div className="fixed bottom-24 md:bottom-10 left-1/2 -translate-x-1/2 z-[9999] animate-bounce">
      <div className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-2xl text-white text-[14px] font-bold tracking-wide ${type === 'success' ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`}>
        <span className="material-symbols-outlined text-[20px]">
          {type === 'success' ? 'check_circle' : 'cancel'}
        </span>
        {message}
      </div>
    </div>
  )
}
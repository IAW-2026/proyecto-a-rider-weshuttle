'use client'

import { useState, useTransition } from 'react'
import { saveProfileAction } from '@/app/mis-viajes/actions'

interface ProfileSetupModalProps {
  isOpen: boolean
  defaultName: string
}

export default function ProfileSetupModal({ isOpen, defaultName }: ProfileSetupModalProps) {
  const [fullName, setFullName] = useState(defaultName)
  const [phone, setPhone] = useState('')
  const [companyCode, setCompanyCode] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (fullName.trim().length < 3) {
      setErrorMsg('El nombre completo debe tener al menos 3 caracteres.')
      return
    }
    const phoneRegex = /^\+?[0-9\s\-()]{6,20}$/;
    if (!phoneRegex.test(phone.trim())) {
      setErrorMsg('El formato del teléfono es inválido. Debe tener entre 6 y 20 caracteres y solo permitir números, espacios, +, - o ().')
      return
    }

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('fullName', fullName)
        formData.append('phone', phone)
        formData.append('companyCode', companyCode)

        await saveProfileAction(formData)
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al guardar el perfil. Intenta nuevamente.')
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-[#0A192F]/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-[#D8DADC] max-w-md w-full overflow-hidden p-6 md:p-8 transform scale-100 transition-all">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#3B82F6]/10 text-[#2563EB] rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[28px]">account_circle</span>
          </div>
          <h2 className="text-[20px] font-bold text-[#0A192F]">Completa tu Perfil</h2>
          <p className="text-[12px] text-[#475569] mt-2 leading-relaxed">
            Para que el chofer y WeShuttle puedan identificarte y coordinar tu viaje, necesitamos que registres tus datos reales.
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-[#B91C1C] rounded-[8px] border border-red-200 text-[12px] flex items-start gap-2 font-medium">
            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1.5">
              Nombre y Apellido *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej: Juan Pérez"
              disabled={isPending}
              required
              className="w-full px-3 py-2.5 border border-[#D8DADC] rounded-[8px] text-[13px] focus:outline-none focus:border-[#0A192F] text-[#0A192F] bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1.5">
              Teléfono de Contacto *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: +54 9 291 123456"
              disabled={isPending}
              required
              className="w-full px-3 py-2.5 border border-[#D8DADC] rounded-[8px] text-[13px] focus:outline-none focus:border-[#0A192F] text-[#0A192F] bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1.5">
              Código de Empresa (Opcional)
            </label>
            <input
              type="text"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
              placeholder="Ej: COCA-COLA-12"
              disabled={isPending}
              className="w-full px-3 py-2.5 border border-[#D8DADC] rounded-[8px] text-[13px] focus:outline-none focus:border-[#0A192F] text-[#0A192F] bg-white transition-colors uppercase"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 py-3 rounded-[8px] bg-[#0A192F] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#0A192F]/90 transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                Guardando datos...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                Completar Registro
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

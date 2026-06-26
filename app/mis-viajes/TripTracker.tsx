'use client'

import { useState, useEffect } from 'react'
import { getPoolStatusAction } from './actions'

interface TripTrackerProps {
  poolId: string
  passengerUserId: string
  reservationId: string
}

export default function TripTracker({ poolId, passengerUserId, reservationId }: TripTrackerProps) {
  const [status, setStatus] = useState<string>('ASSIGNED')
  const [targetUserId, setTargetUserId] = useState<string | null>(null)
  const [hito, setHito] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Ocultar el formulario de cancelación en tiempo real si el viaje se inició o completó
  useEffect(() => {
    const cancelForm = document.getElementById(`cancel-form-${reservationId}`)
    if (cancelForm) {
      if (['IN_PROGRESS', 'COMPLETED', 'CANCELED'].includes(status)) {
        cancelForm.style.display = 'none'
      } else {
        // Restaurar si el estado no está en pleno viaje/finalizado
        cancelForm.style.display = 'block'
      }
    }
  }, [status, reservationId])

  useEffect(() => {
    let intervalId: NodeJS.Timeout

    async function fetchStatus() {
      try {
        const data = await getPoolStatusAction(poolId)
        
        setStatus(data.status || 'ASSIGNED')
        setTargetUserId(data.target_user_id || null)
        setHito(data.hito || null)
        setError(false)
      } catch (err) {
        console.error('Error fetching live pool status:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    // Primera carga
    fetchStatus()

    // Polling cada 5 segundos
    intervalId = setInterval(fetchStatus, 5000)

    return () => clearInterval(intervalId)
  }, [poolId])

  if (loading) {
    return (
      <div className="mt-4 p-4 bg-[#F7F9FB] rounded-[8px] border border-[#D8DADC] flex items-center justify-center gap-2">
        <span className="material-symbols-outlined animate-spin text-[18px] text-[#475569]">sync</span>
        <span className="text-[12px] text-[#475569] font-semibold">Conectando con el GPS de la unidad...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-4 p-3 bg-red-50 text-[#B91C1C] rounded-[8px] border border-red-200 text-[12px] flex items-center gap-1.5 font-medium">
        <span className="material-symbols-outlined text-[16px]">error</span>
        No se pudo establecer conexión de seguimiento con la Driver App.
      </div>
    )
  }

  // Renderizar según el estado real del viaje
  return (
    <div className="mt-4 p-4 bg-[#FFFFFF] rounded-[8px] border border-[#D8DADC] shadow-sm transition-all duration-300">
      
      {/* Header del Tracker */}
      <div className="flex items-center justify-between mb-3 border-b border-[#F7F9FB] pb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#475569]">Seguimiento en Vivo</span>
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${
            status === 'IN_PROGRESS' ? 'bg-[#10B981] animate-ping' : 
            status === 'AVAILABLE' ? 'bg-[#F59E0B] animate-pulse' : 
            'bg-[#475569]'
          }`}></span>
          <span className="text-[11px] font-bold text-[#0A192F]">
            {status === 'IN_PROGRESS' ? 'Recorrido en progreso' : 
             status === 'COMPLETED' ? 'Llegó a destino' : 
             status === 'CANCELED' ? 'Cancelado' : 
             status === 'AVAILABLE' ? 'Buscando conductor' : 'Esperando partida'}
          </span>
        </span>
      </div>

      {/* Contenido según estados */}
      {status === 'IN_PROGRESS' && (
        <div className="space-y-3">
          {targetUserId === passengerUserId ? (
            // ES EL TURNO DE ESTE PASAJERO
            <div className="p-3 bg-[#E0F2FE] border border-[#BAE6FD] rounded-[6px] text-[#0369A1] animate-pulse">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[20px] shrink-0">directions_bus</span>
                <div>
                  <h4 className="text-[13px] font-bold text-[#0369A1]">¡Tu combi se está acercando!</h4>
                  <p className="text-[12px] mt-1 font-semibold text-[#0284C7] italic">
                    "{hito || 'El conductor está en camino a tu ubicación'}"
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // EL CHOFER ESTÁ RETIRANDO A OTRO PASAJERO
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] text-[#475569]">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[20px] shrink-0 text-[#64748B]">group</span>
                <div>
                  <h4 className="text-[13px] font-bold text-[#334155]">Buscando pasajeros</h4>
                  <p className="text-[11px] mt-0.5 text-[#64748B]">
                    El chofer está buscando a otros pasajeros del pool. El estado de tu viaje cambiará cuando sea tu turno de recogida.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {status === 'COMPLETED' && (
        <div className="space-y-3">
          <div className="p-3 bg-green-50 border border-green-200 rounded-[6px] text-[#047857]">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[20px] shrink-0 text-[#10B981]">sports_score</span>
              <div>
                <h4 className="text-[13px] font-bold">¡Llegaste a tu destino!</h4>
                <p className="text-[11px] mt-0.5 text-[#065F46]">
                  El chofer completó el recorrido de forma segura. Ya podés calificar el viaje.
                </p>
              </div>
            </div>
          </div>
          
          <a
            href={`${process.env.NEXT_PUBLIC_FEEDBACK_APP_URL || '#'}/?return_url=${process.env.NEXT_PUBLIC_RIDER_APP_URL || '#'}`}
            className="w-full py-2 px-3 rounded-[6px] bg-[#F59E0B] text-white text-[12px] font-bold uppercase tracking-wider hover:bg-[#D97706] transition-colors flex items-center justify-center gap-1 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px] fill-current">star</span>
            Calificar Viaje
          </a>
        </div>
      )}

      {status === 'CANCELED' && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-[6px] text-[#B91C1C]">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] shrink-0">cancel</span>
            <div>
              <h4 className="text-[13px] font-bold">Viaje Cancelado</h4>
              <p className="text-[11px] mt-0.5 text-[#991B1B]">
                Este viaje fue cancelado por el conductor o la administración.
              </p>
            </div>
          </div>
        </div>
      )}

      {status === 'AVAILABLE' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-[6px] text-[#B45309]">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] shrink-0 text-[#D97706]">hail</span>
            <div>
              <h4 className="text-[13px] font-bold">Buscando Conductor</h4>
              <p className="text-[11px] mt-0.5 text-[#92400E]">
                El viaje está programado. En cuanto la logística asigne una combi y chofer, podrás ver sus detalles y realizar el seguimiento.
              </p>
            </div>
          </div>
        </div>
      )}

      {status === 'ASSIGNED' && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-[6px] text-[#475569]">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] shrink-0 text-[#64748B]">schedule</span>
            <div>
              <h4 className="text-[13px] font-bold text-[#334155]">Preparando Salida</h4>
              <p className="text-[11px] mt-0.5 text-[#64748B]">
                El conductor ya está asignado. El seguimiento en vivo comenzará cuando el chofer inicie el recorrido.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

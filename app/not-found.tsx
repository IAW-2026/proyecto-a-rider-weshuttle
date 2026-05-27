import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F7F9FB] flex flex-col items-center justify-center p-8 text-[#0A192F]">
      <div className="bg-[#FFFFFF] p-10 md:p-12 rounded-[12px] border border-[#D8DADC] shadow-sm text-center max-w-md w-full">
        <span className="material-symbols-outlined text-[64px] text-[#D8DADC] mb-6 block">route</span>
        <h1 className="text-[48px] font-black italic tracking-tight mb-2">404</h1>
        <h2 className="text-[20px] font-bold mb-4">Página no encontrada</h2>
        
        <p className="text-[#475569] text-[14px] mb-8 leading-relaxed">
          La ruta que intentás buscar no existe en WeShuttle o fue movida de lugar.
        </p>
        
        <Link href="/" className="flex items-center justify-center gap-2 w-full bg-[#0A192F] text-white text-[12px] font-bold uppercase tracking-widest py-3.5 rounded-[8px] hover:bg-[#0A192F]/90 transition-all shadow-sm">
          <span className="material-symbols-outlined text-[18px]">home</span> Volver al inicio
        </Link>
      </div>
    </div>
  )
}
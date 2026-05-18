import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8 text-black font-sans">
      <div className="bg-white p-12 rounded-[3rem] border border-gray-200 shadow-sm text-center max-w-md w-full">
        <div className="text-6xl mb-6">🛸</div>
        <h1 className="text-4xl font-black italic mb-2">404</h1>
        <h2 className="text-xl font-bold mb-4">Página no encontrada</h2>
        
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Parece que la combi se perdió en el camino. La ruta que estás buscando no existe.
        </p>
        
        <Link href="/" className="block w-full bg-black text-white text-xs font-black uppercase tracking-[0.2em] py-5 rounded-2xl hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
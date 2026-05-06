import { prisma } from "@/lib/prisma";
import { DestinoCard } from "@/app/ui/tarjetas/DestinoCard";

type Destino = {
  id: string;
  nombre: string;
  ubicacion_lat_long: string;
};

export default async function HomePage() {
  let destinosFinales: Destino[] = [];

  try {
    // Traemos datos reales de Neon
    destinosFinales = await prisma.destino.findMany();
  } catch (error) {
    console.log("Aviso: Falló la conexión a Neon.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header estilo App Móvil */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="p-6 pt-12">
          <h1 className="text-4xl font-black tracking-tight text-black">
            We<span className="text-blue-600">Shuttle</span> <br />
            <span className="text-lg font-semibold text-gray-600">Rider App</span>
          </h1>
        </div>
      </header>

      <main className="px-6 pb-24">
        <div className="mt-6 mb-8">
          <div className="bg-white border-2 border-gray-200 p-4 rounded-xl flex items-center gap-3 shadow-sm hover:border-blue-300 transition-all">
            <span className="text-xl">🔍</span>
            <input 
              className="bg-transparent border-none outline-none w-full text-lg placeholder:text-gray-400 font-medium"
              placeholder="¿A dónde vamos?" 
            />
          </div>
        </div>

        <section>
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">
               Destinos sugeridos
            </p>
            <span className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-full font-semibold">
              {destinosFinales.length} disponibles
            </span>
          </div>
          
          <div className="space-y-3">
            {destinosFinales.map((d: Destino) => (
              <DestinoCard 
                key={d.id} 
                nombre={d.nombre} 
                ubicacion_lat_long={d.ubicacion_lat_long} 
              />
            ))}
          </div>
        </section>

        {/* Footer info */}
        <div className="mt-12 p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
          <p className="text-sm text-gray-600">
            Reserva tu viaje compartido hoy
          </p>
        </div>
      </main>

      {/* Navegación inferior fija */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t p-4 flex justify-around items-center max-w-md mx-auto z-50">
        <div className="flex flex-col items-center text-blue-600">
          <span className="text-2xl">🏠</span>
          <span className="text-[10px] font-bold">Inicio</span>
        </div>
        <div className="flex flex-col items-center text-gray-300">
          <span className="text-2xl">📅</span>
          <span className="text-[10px] font-bold">Viajes</span>
        </div>
        <div className="flex flex-col items-center text-gray-300">
          <span className="text-2xl">👤</span>
          <span className="text-[10px] font-bold">Perfil</span>
        </div>
      </footer>
    </div>
  );
}
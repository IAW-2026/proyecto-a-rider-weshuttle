import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando la siembra (seed) de datos...')
  
  const destinos = [
    { name: 'Polo Petroquímico', address: 'Ruta Nacional 3, Km 578', lat: -38.784, lng: -62.268 },
    { name: 'Planta Industrial Norte', address: 'Parque Industrial, Calle 1', lat: -38.683, lng: -62.267 },
    { name: 'Centro Logístico Portuario', address: 'Puerto Ing. White', lat: -38.789, lng: -62.269 }
  ]

  for (const d of destinos) {
    await prisma.destination.create({ data: d })
  }
  
  console.log('✅ ¡3 Destinos cargados con éxito en la base de datos!')
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); })
import './globals.css' 
import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WeShuttle | Movilidad Corporativa',
  description: 'Plataforma B2B para la gestión de traslados y monitoreo de flota en tiempo real.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="es">
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
        </head>
        <body className="antialiased" style={{ fontFamily: "'Inter', sans-serif" }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
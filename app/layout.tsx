import './globals.css' 
import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import Toast from '@/app/Toast'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import ProfileSetupModal from '@/app/ui/ProfileSetupModal'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'WeShuttle | Movilidad Corporativa',
  description: 'Plataforma B2B para la gestión de traslados y monitoreo de flota en tiempo real.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  let showProfileSetup = false
  let defaultName = ''

  if (userId) {
    const passenger = await prisma.passenger.findUnique({
      where: { clerk_user_id: userId }
    })

    if (!passenger || passenger.full_name.trim() === '' || passenger.full_name === 'Pasajero' || passenger.phone === 'Sin registrar') {
      showProfileSetup = true
      const user = await currentUser()
      defaultName = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
    }
  }

  return (
    <ClerkProvider>
      <html lang="es" className={inter.className}>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" />
        </head>
        <body className="antialiased">
          <Suspense fallback={null}>
            <Toast />
          </Suspense>
          <ProfileSetupModal isOpen={showProfileSetup} defaultName={defaultName} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
'use client'
import { useUser } from '@clerk/nextjs'

export function UserGreeting() {
  const { user, isLoaded, isSignedIn } = useUser()
  
  if (!isLoaded || !isSignedIn) return null

  // No renderizamos nada aquí para que no se mueva el diseño,
  // la lógica la manejamos en la page.tsx directamente.
  return null
}
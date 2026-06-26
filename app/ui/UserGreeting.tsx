'use client'
import { useUser } from '@clerk/nextjs'

export function UserGreeting() {
  const { user, isLoaded, isSignedIn } = useUser()
  
  if (!isLoaded) return <div>Cargando...</div>
  if (!isSignedIn) return <div>No autenticado</div>

  return (
    <div>
      <p>Hola, {user.firstName}!</p>
      <p>Email: {user.primaryEmailAddress?.emailAddress}</p>
    </div>
  )
}
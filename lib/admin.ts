import { auth, currentUser } from '@clerk/nextjs/server'

export async function verificarAdmin() {
  const { userId } = await auth()
  const user = await currentUser()
  
  const email = user?.emailAddresses[0]?.emailAddress?.toLowerCase()
  const adminEmailsList = (process.env.ADMIN_EMAIL ?? '').split(',').map((item) => item.trim().toLowerCase())
  
  if (!userId || !email || !adminEmailsList.includes(email)) {
    throw new Error("Acceso denegado. Solo administradores.")
  }
  
  return { userId, user }
}
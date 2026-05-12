import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserGreeting } from "@/app/ui/UserGreeting"
import { UserButton } from "@clerk/nextjs"

export default async function HomePage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-white p-4 flex flex-col justify-between">
      <UserGreeting />
      <header className="flex justify-between items-center border-b pb-4">
        <h1 className="text-xl font-bold">WeShuttle</h1>
        <p className="text-xs">ID: {userId}</p>
        <UserButton />
      </header>

      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 italic">Contenido en desarrollo...</p>
      </main>

      <footer className="flex justify-around border-t pt-4">
        <span>🏠</span>
        <span>📅</span>
        <UserButton />
      </footer>
    </div>
  )
}
import './globals.css' 
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body className="antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
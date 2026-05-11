import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Definimos las rutas públicas (las que no requieren login) [cite: 196, 198]
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/']);

export default clerkMiddleware(async (auth, request) => {
  // Verificamos si la ruta actual NO es pública [cite: 205]
  if (!isPublicRoute(request)) {
    await auth.protect(); // Agregamos el 'await' y usamos 'auth' directamente [cite: 207]
  }
});

export const config = {
  // El matcher asegura que el middleware intercepte los requests correctos [cite: 214, 216]
  matcher: [
    '/((?!.*\\..*|_next).*)', 
    '/', 
    '/(api|trpc)(.*)'
  ],
};
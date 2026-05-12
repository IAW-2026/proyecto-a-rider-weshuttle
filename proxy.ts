import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Esta es la forma más agresiva de decirle que estas rutas son LIBRES
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

export default clerkMiddleware(async (auth, request) => {
  // Si la ruta NO empieza con /sign-in o /sign-up, entonces pedí login
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!|on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
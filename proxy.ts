
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)', '/api(.*)']);

export default clerkMiddleware(async (auth, request) => {
  const url = new URL(request.url);

  // 1. Validar rutas API
  if (url.pathname.startsWith('/api')) {
    // Omitir validación en rutas de mocks si existieran
    if (url.pathname.startsWith('/api/mocks')) {
      return;
    }

    const internalKey = process.env.WESHUTTLE_INTERNAL_KEY;
    const analyticsKey = process.env.ANALYTICS_API_KEY;

    // Si no están configuradas las claves (ej: desarrollo local offline), omitimos la validación
    if (!internalKey && !analyticsKey) {
      return;
    }

    // Extraer cabecera de Autorización
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Missing or invalid token format in Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Si es un método de escritura (POST, PUT, PATCH, DELETE), exige clave interna
    if (request.method !== 'GET') {
      if (token !== internalKey) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Write access is restricted to internal service keys' },
          { status: 403 }
        );
      }
    } else {
      // Si es GET, acepta clave interna o clave de analíticas
      if (token !== internalKey && token !== analyticsKey) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Invalid API Key for resource retrieval' },
          { status: 403 }
        );
      }
    }

    return; // Continuar al Route Handler
  }

  // 2. Comportamiento normal para páginas con Clerk
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
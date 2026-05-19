import { defineConfig, env } from '@prisma/config';
import dotenv from 'dotenv';

// Carga los secretos de .env.local primero, y usa .env como respaldo (estándar de Next.js)
dotenv.config({ path: ['.env.local', '.env'] });

export default defineConfig({
  datasource: {
    url: env('DATABASE_URL'),
  },
});
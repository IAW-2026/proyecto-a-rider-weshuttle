import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    // Usamos process.env para que sea seguro y dinámico
    url: process.env.DATABASE_URL,
  },
});
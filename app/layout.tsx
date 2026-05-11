import { ClerkProvider } from '@clerk/nextjs'; // Importás la librería [cite: 131]
import "./globals.css";

export const metadata = {
  title: "WeShuttle - Rider App",
  description: "Tu transporte universitario.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50 antialiased font-sans">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
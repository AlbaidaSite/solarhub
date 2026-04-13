import type { Metadata } from "next";
import "../styles/globals.css"
import { Layout } from "@/components/Layout";

export const metadata: Metadata = {
  title: "SolarHub",
  description: "Comunidad solar con cromos coleccionables",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  )
}

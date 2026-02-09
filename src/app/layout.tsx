import '@/styles/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SolarHub',
  description: 'Página oficial del Solar',
}

export default function RootLayout({children,}: {children: React.ReactNode}) {
  return (
    <html lang="es" suppressHydrationWarning >
      <body>
        {children}
      </body>
    </html>
  )
}

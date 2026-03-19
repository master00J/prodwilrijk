import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import AuthProvider from '@/components/AuthProvider'
import NewFeaturePopup from '@/components/NewFeaturePopup'

export const metadata: Metadata = {
  title: 'Prodwilrijk V2',
  description: 'Modern warehouse management system',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body className="min-h-screen overflow-x-hidden">
        <AuthProvider>
          <Navbar />
          <NewFeaturePopup />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}



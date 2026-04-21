import type { Metadata, Viewport } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import AuthProvider from '@/components/AuthProvider'
import NewFeaturePopup from '@/components/NewFeaturePopup'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import { BcMappingProvider } from '@/lib/bc-mapping/client'

export const metadata: Metadata = {
  title: 'Prodwilrijk V2',
  description: 'Modern warehouse management system',
  manifest: '/manifest.json',
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
          <BcMappingProvider>
            <Navbar />
            <NewFeaturePopup />
            <ServiceWorkerRegister />
            {children}
          </BcMappingProvider>
        </AuthProvider>
      </body>
    </html>
  )
}



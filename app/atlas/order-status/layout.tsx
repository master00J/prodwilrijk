import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Orderstatus — Atlas (grote inpak) | Prodwilrijk',
  description: 'PILS-orderstatus en filters voor grote inpak (Atlas Copco).',
}

export default function AtlasOrderStatusLayout({ children }: { children: ReactNode }) {
  return children
}

import type { Metadata } from 'next'
import InstructieVideo from '@/components/grote-inpak/InstructieVideo'

export const metadata: Metadata = {
  title: 'Grote Inpak — Instructievideo',
  description: 'Stap-voor-stap handleiding voor de dagelijkse Grote Inpak-flow (Packed XML, stock, forecast, transport).',
}

export default function GroteInpakInstructiePage() {
  return <InstructieVideo />
}

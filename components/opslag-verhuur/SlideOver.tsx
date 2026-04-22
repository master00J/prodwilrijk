'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'

type Props = {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
  /** Tailwind max-width classe voor het paneel (default `max-w-3xl`). */
  maxWidth?: string
  /** Optionele footer (bv. actie-knoppen). */
  footer?: React.ReactNode
}

/**
 * Rechts-in-schuivend paneel voor formulieren (aanmaken/bewerken).
 * Gebruikt overal op de /opslag-verhuur pagina zodat het hoofdscherm rustig blijft.
 */
export default function SlideOver({
  open,
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'max-w-3xl',
  footer,
}: Props) {
  // Escape toets sluit het paneel.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Verberg body-scroll achter het paneel.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-labelledby="slideover-title">
      <div
        className="flex-1 bg-black/40 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`w-full ${maxWidth} bg-white shadow-2xl flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h2 id="slideover-title" className="text-lg font-semibold text-gray-900 truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        {footer && (
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

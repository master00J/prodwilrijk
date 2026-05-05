'use client'

import { useEffect } from 'react'

export interface LabelScanPhotosModalProps {
  open: boolean
  onClose: () => void
  urls: string[]
  title?: string
}

export default function LabelScanPhotosModal({
  open,
  onClose,
  urls,
  title = 'Labelfoto’s',
}: LabelScanPhotosModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || urls.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[92vh] overflow-auto p-4 sm:p-6"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="label-scan-photos-title"
      >
        <div className="flex justify-between items-start gap-3 mb-4">
          <h3 id="label-scan-photos-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Sluiten"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {urls.length === 1
            ? 'Klik op de afbeelding om ze op volledige grootte in een nieuw tabblad te openen.'
            : `${urls.length} foto’s — klik op een afbeelding om ze in een nieuw tabblad te openen.`}
        </p>
        <div className="flex flex-col gap-6">
          {urls.map((url, i) => (
            <a
              key={`${url}-${i}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-gray-200 overflow-hidden hover:ring-2 hover:ring-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Labelfoto ${i + 1}`}
                className="w-full max-h-[75vh] object-contain bg-gray-50"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

/** URLs uit DB-array; lege waarden worden weggefilterd. */
export function filterLabelPhotoUrls(raw: string[] | null | undefined): string[] {
  return (raw || []).filter((u): u is string => typeof u === 'string' && u.length > 0)
}

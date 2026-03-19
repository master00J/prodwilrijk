'use client'

import type { ConfirmModalState } from '@/app/opslag-verhuur/useStorageRentals'

type Props = {
  modal: ConfirmModalState
  onClose: () => void
  deleting?: boolean
}

export default function ConfirmModal({ modal, onClose, deleting }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title" className="text-lg font-semibold text-gray-900 mb-2">
          {modal.title}
        </h3>
        <p className="text-gray-600 mb-6">{modal.message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-60"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={() => void modal.onConfirm()}
            disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
          >
            {deleting && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  )
}

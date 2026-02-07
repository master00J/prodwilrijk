'use client'

import type { StorageRentalItem } from '@/types/database'

type Props = {
  item: StorageRentalItem | null
  onClose: () => void
  photoUploading: boolean
  photoDragOver: 'bare' | 'verpakt' | null
  setPhotoDragOver: (v: 'bare' | 'verpakt' | null) => void
  onUpload: (itemId: number, category: 'bare' | 'verpakt', files: FileList | null) => Promise<void>
  onDeletePhoto: (item: StorageRentalItem, category: 'bare' | 'verpakt', photoUrl: string) => Promise<void>
  bareInputRef: React.RefObject<HTMLInputElement | null>
  verpaktInputRef: React.RefObject<HTMLInputElement | null>
}

export default function PhotoModal({
  item,
  onClose,
  photoUploading,
  photoDragOver,
  setPhotoDragOver,
  onUpload,
  onDeletePhoto,
  bareInputRef,
  verpaktInputRef,
}: Props) {
  if (!item) return null
  const photosBare = (item.photos_bare || []) as string[]
  const photosVerpakt = (item.photos_verpakt || []) as string[]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => {
        onClose()
        setPhotoDragOver(null)
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-purple-800 text-lg">Foto&apos;s – item #{item.id}</h3>
          <button
            type="button"
            onClick={() => {
              onClose()
              setPhotoDragOver(null)
            }}
            className="text-gray-500 hover:text-gray-700 p-1"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-amber-800 mb-2">Bare (bij lossing)</h4>
            <div className="flex flex-wrap gap-2 mb-2">
              {photosBare.map((url, idx) => (
                <div key={idx} className="relative group">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={url}
                      alt={`Bare ${idx + 1}`}
                      className="h-20 w-20 object-cover rounded border"
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => onDeletePhoto(item, 'bare', url)}
                    disabled={photoUploading}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    aria-label="Foto verwijderen"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => {
                e.preventDefault()
                setPhotoDragOver('bare')
              }}
              onDragLeave={() => setPhotoDragOver(null)}
              onDrop={(e) => {
                e.preventDefault()
                setPhotoDragOver(null)
                const files = e.dataTransfer.files
                if (files?.length) {
                  const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
                  if (imageFiles.length) {
                    const dt = new DataTransfer()
                    imageFiles.forEach((f) => dt.items.add(f))
                    onUpload(item.id, 'bare', dt.files)
                  }
                }
              }}
              onClick={() => bareInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && bareInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                photoDragOver === 'bare'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50/50'
              } ${photoUploading ? 'opacity-60 pointer-events-none' : ''}`}
              aria-label="Upload bare foto's - sleep bestanden hierheen of klik"
            >
              <input
                ref={bareInputRef as React.LegacyRef<HTMLInputElement>}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  onUpload(item.id, 'bare', e.target.files)
                  e.target.value = ''
                }}
                disabled={photoUploading}
                className="hidden"
              />
              <span className="text-sm text-gray-600">
                {photoDragOver === 'bare'
                  ? 'Laat los om te uploaden'
                  : "Sleep foto's hierheen of klik om te selecteren"}
              </span>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-green-800 mb-2">Verpakt (na verpakken)</h4>
            <div className="flex flex-wrap gap-2 mb-2">
              {photosVerpakt.map((url, idx) => (
                <div key={idx} className="relative group">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={url}
                      alt={`Verpakt ${idx + 1}`}
                      className="h-20 w-20 object-cover rounded border"
                    />
                  </a>
                  <button
                    type="button"
                    onClick={() => onDeletePhoto(item, 'verpakt', url)}
                    disabled={photoUploading}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    aria-label="Foto verwijderen"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => {
                e.preventDefault()
                setPhotoDragOver('verpakt')
              }}
              onDragLeave={() => setPhotoDragOver(null)}
              onDrop={(e) => {
                e.preventDefault()
                setPhotoDragOver(null)
                const files = e.dataTransfer.files
                if (files?.length) {
                  const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
                  if (imageFiles.length) {
                    const dt = new DataTransfer()
                    imageFiles.forEach((f) => dt.items.add(f))
                    onUpload(item.id, 'verpakt', dt.files)
                  }
                }
              }}
              onClick={() => verpaktInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && verpaktInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                photoDragOver === 'verpakt'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-green-400 hover:bg-green-50/50'
              } ${photoUploading ? 'opacity-60 pointer-events-none' : ''}`}
              aria-label="Upload verpakt foto's - sleep bestanden hierheen of klik"
            >
              <input
                ref={verpaktInputRef as React.LegacyRef<HTMLInputElement>}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  onUpload(item.id, 'verpakt', e.target.files)
                  e.target.value = ''
                }}
                disabled={photoUploading}
                className="hidden"
              />
              <span className="text-sm text-gray-600">
                {photoDragOver === 'verpakt'
                  ? 'Laat los om te uploaden'
                  : "Sleep foto's hierheen of klik om te selecteren"}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose()
            setPhotoDragOver(null)
          }}
          className="mt-4 px-4 py-2 bg-gray-200 rounded-lg text-sm hover:bg-gray-300"
        >
          Sluiten
        </button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import AdminGuard from '@/components/AdminGuard'

type ImportFile = {
  filename: string
  configuratorCode: string
  lineCount: number
  sizeBytes: number
}

type ImportLine = {
  lineNo: number
  itemCode: string
  description: string
  quantity: number
  length: number
  width: number
  height: number
  configurator: string | null
}

type LumipaperImport = {
  id: string
  order_number: string
  subject: string | null
  source_email: string | null
  source_file: string | null
  total_lines: number
  generated_files: ImportFile[]
  parsed_lines: ImportLine[]
  unmapped_lines: ImportLine[]
  status: string
  error: string | null
  created_at: string
}

export default function LumipaperImportPage() {
  const [imports, setImports] = useState<LumipaperImport[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [scanningMailbox, setScanningMailbox] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadImports = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/lumipaper/import')
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Imports laden mislukt.')
      setImports(data.imports || [])
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Imports laden mislukt.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadImports()
  }, [])

  const uploadFile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setUploading(true)
    setMessage(null)

    const form = event.currentTarget
    const formData = new FormData(form)

    try {
      const response = await fetch('/api/lumipaper/import', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Lumipaper import mislukt.')

      setMessage({
        type: 'success',
        text: `Bestelling ${data.import.order_number} verwerkt: ${data.import.generated_files.length} Excelbestand(en).`,
      })
      form.reset()
      await loadImports()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Lumipaper import mislukt.' })
    } finally {
      setUploading(false)
    }
  }

  const scanMailboxNow = async () => {
    setScanningMailbox(true)
    setMessage(null)

    try {
      const response = await fetch('/api/lumipaper/import/mail-scan', {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Mailbox scan mislukt.')

      const importedCount = data.imported?.length || 0
      const skippedCount = data.skipped?.length || 0
      const errorCount = data.errors?.length || 0

      setMessage({
        type: errorCount > 0 ? 'error' : 'success',
        text: `Mailbox gescand: ${importedCount} nieuwe import(s), ${skippedCount} overgeslagen, ${errorCount} fout(en).`,
      })
      await loadImports()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Mailbox scan mislukt.' })
    } finally {
      setScanningMailbox(false)
    }
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-3xl font-bold mb-3">Lumipaper import</h1>
        <p className="text-gray-600 mb-6">
          Zet Lumipaper bestelbon-mails automatisch om naar Business Central configurator-Excels per DC-template.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <form onSubmit={uploadFile} className="lg:col-span-2 bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-3">Handmatig .eml bestand verwerken</h2>
            <p className="text-sm text-gray-600 mb-4">
              Upload een Lumipaper mailbestand. De website haalt de orderlijnen eruit en maakt downloadbare BC
              configuratorbestanden.
            </p>
            <input
              name="file"
              type="file"
              accept=".eml,message/rfc822,text/plain"
              required
              className="block w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <button
              type="submit"
              disabled={uploading}
              className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {uploading ? 'Verwerken...' : 'Importeer en genereer Excels'}
            </button>
          </form>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-sm text-blue-900">
            <h2 className="text-lg font-semibold mb-2">Mailbox ophalen</h2>
            <button
              type="button"
              onClick={scanMailboxNow}
              disabled={scanningMailbox}
              className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {scanningMailbox ? 'Mailbox scannen...' : 'Haal mail nu op'}
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Laatste Lumipaper imports</h2>
              <p className="text-sm text-gray-500">Handmatig geüpload of automatisch uit de mailbox opgepikt.</p>
            </div>
            <button
              type="button"
              onClick={() => loadImports()}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              Vernieuwen
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-gray-500">Laden...</div>
          ) : imports.length === 0 ? (
            <div className="p-6 text-gray-500">Nog geen Lumipaper imports gevonden.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {imports.map((item) => (
                <div key={item.id} className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{item.order_number}</h3>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {item.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {new Date(item.created_at).toLocaleString('nl-BE')} · {item.total_lines} lijn(en)
                        {item.source_email ? ` · ${item.source_email}` : ''}
                      </p>
                      {item.subject && <p className="text-sm text-gray-600 mt-1">{item.subject}</p>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.generated_files.map((file, index) => (
                        <a
                          key={`${item.id}-${file.filename}`}
                          href={`/api/lumipaper/import/${item.id}/files/${index}`}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          Download {file.configuratorCode}
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="py-2 pr-3">Lijn</th>
                          <th className="py-2 pr-3">Artikel</th>
                          <th className="py-2 pr-3">Omschrijving</th>
                          <th className="py-2 pr-3">Aantal</th>
                          <th className="py-2 pr-3">Afmeting</th>
                          <th className="py-2 pr-3">Configurator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(item.parsed_lines || []).map((line) => (
                          <tr key={`${item.id}-${line.lineNo}`} className="border-b border-gray-50">
                            <td className="py-2 pr-3">{line.lineNo}</td>
                            <td className="py-2 pr-3 font-mono">{line.itemCode}</td>
                            <td className="py-2 pr-3">{line.description}</td>
                            <td className="py-2 pr-3">{line.quantity}</td>
                            <td className="py-2 pr-3">
                              {line.length} x {line.width} x {line.height}
                            </td>
                            <td className="py-2 pr-3">{line.configurator || 'Niet gemapt'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminGuard>
  )
}

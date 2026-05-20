'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Mail, X } from 'lucide-react'

type LinkedMailListItem = {
  id: number
  case_label: string
  original_filename: string
  subject: string
  from_email: string | null
  from_name: string | null
  received_at: string | null
  created_at: string
}

type LinkedMailDetail = LinkedMailListItem & {
  body_html: string | null
  body_text: string | null
  has_original_file: boolean
}

type Props = {
  caseLabel: string | null
  onClose: () => void
  initialMailId?: number | null
}

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })
}

export default function CaseMailViewerModal({ caseLabel, onClose, initialMailId }: Props) {
  const [mails, setMails] = useState<LinkedMailListItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(initialMailId ?? null)
  const [detail, setDetail] = useState<LinkedMailDetail | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDetail = useCallback(async (mailId: number) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const res = await fetch(`/api/grote-inpak/case-mail-drop/${mailId}?view=1`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Mail laden mislukt')
      setDetail(json.mail as LinkedMailDetail)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mail laden mislukt')
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (!caseLabel) return
    setLoadingList(true)
    setError(null)
    fetch(`/api/grote-inpak/case-mail-drop?case_label=${encodeURIComponent(caseLabel)}`)
      .then((res) => res.json().then((json) => ({ res, json })))
      .then(({ res, json }) => {
        if (!res.ok) throw new Error(json.error || 'Mails laden mislukt')
        const list = (json.mails || []) as LinkedMailListItem[]
        setMails(list)
        const pick = initialMailId && list.some((m) => m.id === initialMailId)
          ? initialMailId
          : list[0]?.id ?? null
        setSelectedId(pick)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Mails laden mislukt')
        setMails([])
      })
      .finally(() => setLoadingList(false))
  }, [caseLabel, initialMailId])

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

  if (!caseLabel) return null

  const downloadUrl = selectedId
    ? `/api/grote-inpak/case-mail-drop/${selectedId}?download=1`
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-mail-viewer-title"
    >
      <div className="flex h-[min(90vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" />
            <h2 id="case-mail-viewer-title" className="text-lg font-semibold text-slate-900">
              Mails — {caseLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Sluiten"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="w-full shrink-0 border-b border-slate-200 md:w-72 md:border-b-0 md:border-r">
            {loadingList ? (
              <p className="p-4 text-sm text-slate-500">Laden...</p>
            ) : mails.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                Geen opgeslagen mails voor deze caselabel. Sleep een Outlook-mail op de rij om te koppelen.
              </p>
            ) : (
              <ul className="max-h-48 overflow-y-auto md:max-h-none md:h-full">
                {mails.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={`w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm transition-colors ${
                        selectedId === m.id ? 'bg-sky-50 text-sky-900' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-medium line-clamp-2">{m.subject}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {m.from_email || m.from_name || '—'} · {formatWhen(m.received_at || m.created_at)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            {selectedId && detail && (
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2 text-sm text-slate-600">
                <span>
                  <strong>Van:</strong> {detail.from_email || detail.from_name || '—'}
                </span>
                <span>
                  <strong>Onderwerp:</strong> {detail.subject}
                </span>
                <span>
                  <strong>Datum:</strong> {formatWhen(detail.received_at || detail.created_at)}
                </span>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download origineel (.msg/.eml)
                  </a>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4">
              {loadingDetail && <p className="text-sm text-slate-500">Mailinhoud laden...</p>}
              {!loadingDetail && detail?.body_html && (
                <iframe
                  title="Mailinhoud"
                  sandbox=""
                  srcDoc={detail.body_html}
                  className="h-full min-h-[360px] w-full rounded-lg border border-slate-200 bg-white shadow-sm"
                />
              )}
              {!loadingDetail && !detail?.body_html && detail?.body_text && (
                <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800">
                  {detail.body_text}
                </pre>
              )}
              {!loadingDetail && detail && !detail.body_html && !detail.body_text && (
                <p className="text-sm text-slate-600">
                  Geen leesbare inhoud geëxtraheerd. Gebruik &quot;Download origineel&quot; om de mail in Outlook te openen.
                </p>
              )}
              {!loadingDetail && !detail && selectedId && (
                <p className="text-sm text-slate-500">Selecteer een mail links.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import type { OutboxItem } from '@/lib/offline/woodOfflineDb'
import { getOutbox, isAuthRelatedOutboxError, removeOutbox, updateOutbox } from '@/lib/offline/woodOfflineDb'

interface OfflineStatusBannerProps {
  online: boolean
  pending: number
  syncing: boolean
  lastSync: string | null
  errors: number
  onManualSync: () => void | Promise<void>
  onRetryAuthErrors?: () => void | Promise<void>
}

export default function OfflineStatusBanner({
  online,
  pending,
  syncing,
  lastSync,
  errors,
  onManualSync,
  onRetryAuthErrors,
}: OfflineStatusBannerProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [items, setItems] = useState<OutboxItem[]>([])

  const authErrorCount = items.filter(
    (it) => it.status === 'error' && isAuthRelatedOutboxError(it.last_error)
  ).length

  useEffect(() => {
    let cancelled = false
    void getOutbox().then((ob) => {
      if (!cancelled) setItems(ob)
    })
    return () => {
      cancelled = true
    }
  }, [pending, syncing, errors, showDetails])

  const bgClass = !online
    ? 'bg-red-50 border-red-200 text-red-800'
    : errors > 0
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : pending > 0
    ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
    : 'bg-green-50 border-green-200 text-green-800'

  const statusText = !online
    ? 'Offline — wijzigingen worden lokaal bewaard'
    : syncing
    ? `Synchroniseren (${pending} in wachtrij)...`
    : errors > 0
    ? `${errors} item(s) met fout${authErrorCount > 0 ? ' (sessie verlopen?)' : ''}`
    : pending > 0
    ? `${pending} wijziging(en) in wachtrij`
    : 'Alles gesynchroniseerd'

  return (
    <div className={`rounded-lg border px-4 py-3 mb-4 ${bgClass}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              !online
                ? 'bg-red-500'
                : syncing
                ? 'bg-indigo-500 animate-pulse'
                : errors > 0
                ? 'bg-amber-500'
                : pending > 0
                ? 'bg-indigo-500'
                : 'bg-green-500'
            }`}
          />
          <span className="text-sm font-medium">{statusText}</span>
          {lastSync && (
            <span className="text-xs text-gray-500 hidden md:inline">
              · laatste sync {new Date(lastSync).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(pending > 0 || errors > 0) && (
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-xs font-medium underline"
            >
              {showDetails ? 'Verbergen' : 'Details'}
            </button>
          )}
          {errors > 0 && onRetryAuthErrors && (
            <button
              type="button"
              onClick={() => void onRetryAuthErrors()}
              disabled={!online || syncing}
              className="text-xs px-3 py-1 rounded-full bg-white border border-current disabled:opacity-50"
            >
              Opnieuw proberen
            </button>
          )}
          <button
            type="button"
            onClick={() => void onManualSync()}
            disabled={!online || syncing}
            className="text-xs px-3 py-1 rounded-full bg-white border border-current disabled:opacity-50"
          >
            {syncing ? 'Syncen...' : 'Nu synchroniseren'}
          </button>
        </div>
      </div>

      {showDetails && items.length > 0 && (
        <div className="mt-3 text-xs bg-white/70 rounded border border-current/20 p-2 max-h-48 overflow-y-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1 pr-3">Type</th>
                <th className="py-1 pr-3">Stock ID</th>
                <th className="py-1 pr-3">Waarde</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3">Fout</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.clientId} className="border-t border-gray-200">
                  <td className="py-1 pr-3 font-medium">{it.kind}</td>
                  <td className="py-1 pr-3">{it.stock_id ?? '—'}</td>
                  <td className="py-1 pr-3">
                    {it.kind === 'pick' ? `-${it.aantal}` : `→ ${it.nieuw_aantal}`}
                  </td>
                  <td className="py-1 pr-3">{it.status}</td>
                  <td className="py-1 pr-3 text-red-700">{it.last_error || ''}</td>
                  <td className="py-1">
                    {it.status === 'error' && (
                      <div className="flex flex-col gap-1">
                        {isAuthRelatedOutboxError(it.last_error) && onRetryAuthErrors && (
                          <button
                            type="button"
                            onClick={async () => {
                              await updateOutbox(it.clientId, {
                                status: 'pending',
                                attempts: 0,
                                last_error: null,
                              })
                              await onRetryAuthErrors()
                              const ob = await getOutbox()
                              setItems(ob)
                            }}
                            className="text-indigo-700 underline"
                          >
                            opnieuw
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm('Deze gefaalde wijziging verwijderen uit de wachtrij?')) {
                              await removeOutbox(it.clientId)
                              setItems((prev) => prev.filter((x) => x.clientId !== it.clientId))
                            }
                          }}
                          className="text-red-700 underline"
                        >
                          verwijder
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

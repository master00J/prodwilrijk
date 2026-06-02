'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, PlayCircle, User, Wrench } from 'lucide-react'
import { BcItemCode } from '@/lib/bc-mapping/client'
import { groupActiveByOrder } from './active-production'
import { formatDateTime, formatElapsed, formatHours } from './kpi-formatters'
import type { ActiveSession } from './types'

function SessionTable({ sessions }: { sessions: ActiveSession[] }) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 border-b border-gray-200">
          <th className="py-2 pr-4 font-medium">Medewerker</th>
          <th className="py-2 pr-4 font-medium">Item</th>
          <th className="py-2 pr-4 font-medium">Stap</th>
          <th className="py-2 pr-4 font-medium text-right">Bezig</th>
          <th className="py-2 pr-4 font-medium">Gestart</th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.id} className="border-b border-gray-100 last:border-0">
            <td className="py-2 pr-4">
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-gray-400" />
                {s.employee_name}
              </span>
            </td>
            <td className="py-2 pr-4">
              {s.item_number ? <BcItemCode value={s.item_number} /> : '–'}
            </td>
            <td className="py-2 pr-4 text-blue-700">{s.step || '–'}</td>
            <td className="py-2 pr-4 text-right font-medium">{formatElapsed(s.elapsed_seconds)}</td>
            <td className="py-2 pr-4 whitespace-nowrap text-gray-500">
              {s.start_time ? formatDateTime(s.start_time) : '–'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ActiveProductionSection({
  sessions,
  loading,
  compact = false,
  showAllSites = false,
}: {
  sessions: ActiveSession[]
  loading: boolean
  compact?: boolean
  showAllSites?: boolean
}) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const groups = useMemo(() => groupActiveByOrder(sessions), [sessions])
  const workerCount = useMemo(() => new Set(sessions.map((s) => s.employee_name)).size, [sessions])

  if (loading && sessions.length === 0) {
    return (
      <div className={`rounded-xl border border-gray-200 bg-white ${compact ? 'p-4' : 'p-6'} shadow-sm`}>
        <p className="text-sm text-gray-500 text-center">Actieve productie laden...</p>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div
        className={`rounded-xl border border-dashed border-gray-300 bg-white ${
          compact ? 'p-4' : 'p-8'
        } shadow-sm`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gray-100 p-2">
              <PlayCircle className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-700">Geen actieve productieorders</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Er loopt momenteel geen tijdregistratie voor productieorders.
              </p>
            </div>
          </div>
          <Link
            href="/production-order-time"
            className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline shrink-0"
          >
            Naar werkregistratie
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
          </span>
          <h2 className="font-semibold text-blue-900">
            {groups.length} order{groups.length !== 1 ? 's' : ''} in productie
          </h2>
          <span className="text-sm text-blue-700">
            · {workerCount} medewerker{workerCount !== 1 ? 's' : ''} bezig
          </span>
          <span className="text-xs text-blue-600 ml-auto">ververst elke 15 sec</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {groups.slice(0, 6).map((group) => {
            const key = `${group.site}::${group.order_number}`
            return (
              <div
                key={key}
                className="rounded-lg border border-blue-100 bg-white px-3 py-2.5 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-900">{group.order_number}</div>
                    {showAllSites && group.site ? (
                      <div className="text-xs text-gray-500">{group.site}</div>
                    ) : null}
                  </div>
                  <span className="text-xs font-medium text-blue-700 whitespace-nowrap">
                    {formatElapsed(group.maxElapsed)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                  <span>{group.workers.length} pers.</span>
                  {group.items.slice(0, 2).map((item) => (
                    <BcItemCode key={item} value={item} />
                  ))}
                  {group.items.length > 2 ? <span>+{group.items.length - 2} items</span> : null}
                  <span className="text-blue-700">{group.steps.join(', ') || '–'}</span>
                </div>
              </div>
            )
          })}
        </div>
        {groups.length > 6 ? (
          <p className="text-xs text-blue-700 mt-2">+ {groups.length - 6} andere orders — zie tab Live productie</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-600" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Live productieorders</h2>
            <p className="text-sm text-gray-500">
              {groups.length} order{groups.length !== 1 ? 's' : ''} · {workerCount} medewerker
              {workerCount !== 1 ? 's' : ''} · {sessions.length} actieve registratie
              {sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Link
          href="/production-order-time"
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm text-blue-700 hover:bg-blue-50"
        >
          <Wrench className="h-4 w-4" />
          Werkregistratie openen
        </Link>
      </div>

      <div className="divide-y divide-gray-100">
        {groups.map((group) => {
          const key = `${group.site}::${group.order_number}`
          const isExpanded = expandedOrder === key
          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => setExpandedOrder(isExpanded ? null : key)}
                className="w-full text-left px-5 py-4 hover:bg-gray-50/80 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-gray-400 text-sm">{isExpanded ? '▼' : '▶'}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold text-gray-900">{group.order_number}</span>
                        {showAllSites && group.site ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {group.site}
                          </span>
                        ) : null}
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          {group.sessions.length} actief
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />
                          {group.workers.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm lg:justify-end">
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Items</div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {group.items.map((item) => (
                          <BcItemCode key={item} value={item} className="font-medium" />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Stappen</div>
                      <div className="mt-0.5 text-blue-700">{group.steps.join(' · ') || '–'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 uppercase">Langst bezig</div>
                      <div className="mt-0.5 font-semibold text-gray-900">{formatElapsed(group.maxElapsed)}</div>
                      <div className="text-xs text-gray-500">
                        totaal {formatHours(group.sessions.reduce((s, x) => s + (x.elapsed_seconds || 0) / 3600, 0))}
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              {isExpanded ? (
                <div className="px-5 pb-4 bg-slate-50 border-t border-gray-100">
                  <SessionTable sessions={group.sessions} />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

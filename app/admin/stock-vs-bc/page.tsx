'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import AdminGuard from '@/components/AdminGuard'
import {
  buildSummary,
  compareTotals,
  parseBcSheet,
  parseFirstSheet,
  parseTellingFile,
  parseTellingSheet,
  type CompareRow,
  type CompareSummary,
} from '@/lib/stock-vs-bc/compare'

function columnLetterToIndex(letter: string): number {
  const s = letter.trim().toUpperCase()
  if (!s) return -1
  let n = 0
  for (const ch of s) {
    if (ch < 'A' || ch > 'Z') return -1
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

const STATUS_LABEL: Record<CompareRow['status'], string> = {
  match: 'Gelijk',
  te_versturen: 'Te versturen in BC',
  extra_in_stock: 'Extra in stock',
  enkel_bc: 'Enkel in BC',
  enkel_telling: 'Enkel in telling',
}

const STATUS_COLOR: Record<CompareRow['status'], string> = {
  match: 'bg-green-50 text-green-700',
  te_versturen: 'bg-orange-50 text-orange-700',
  extra_in_stock: 'bg-purple-50 text-purple-700',
  enkel_bc: 'bg-red-50 text-red-700',
  enkel_telling: 'bg-blue-50 text-blue-700',
}

export default function StockVsBcPage() {
  const [bcFile, setBcFile] = useState<File | null>(null)
  const [tellingFile, setTellingFile] = useState<File | null>(null)
  const [bcColLetter, setBcColLetter] = useState('E')
  const [tellingItemColLetter, setTellingItemColLetter] = useState('A')
  const [tellingQtyColLetter, setTellingQtyColLetter] = useState('C')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<CompareRow[] | null>(null)
  const [summary, setSummary] = useState<CompareSummary | null>(null)
  const [filter, setFilter] = useState<'all' | CompareRow['status']>('te_versturen')
  const [search, setSearch] = useState('')

  const runCompare = useCallback(async () => {
    if (!bcFile || !tellingFile) {
      setError('Upload beide bestanden.')
      return
    }
    setBusy(true)
    setError(null)
    setRows(null)
    setSummary(null)
    try {
      const bcIdx = columnLetterToIndex(bcColLetter)
      const tellingItemIdx = columnLetterToIndex(tellingItemColLetter)
      const tellingQtyIdx = columnLetterToIndex(tellingQtyColLetter)
      if (bcIdx < 0 || tellingItemIdx < 0 || tellingQtyIdx < 0) {
        throw new Error('Ongeldige kolomletter.')
      }

      const [bcRows, tellingRows] = await Promise.all([
        parseFirstSheet(bcFile),
        parseTellingFile(tellingFile),
      ])

      const { counts } = parseBcSheet(bcRows, bcIdx)
      const { totals } = parseTellingSheet(tellingRows, tellingItemIdx, tellingQtyIdx)

      if (counts.size === 0) {
        throw new Error(
          `Geen geldige itemnummers (10 cijfers) gevonden in kolom ${bcColLetter} van het BC-bestand.`
        )
      }
      if (totals.size === 0) {
        throw new Error(
          `Geen geldige itemnummers gevonden in kolom ${tellingItemColLetter} van het stock-telling bestand.`
        )
      }

      const result = compareTotals(counts, totals)
      setRows(result)
      setSummary(buildSummary(result))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout bij het inlezen.')
    } finally {
      setBusy(false)
    }
  }, [bcFile, tellingFile, bcColLetter, tellingItemColLetter, tellingQtyColLetter])

  const filteredRows = useMemo(() => {
    if (!rows) return []
    const q = search.trim()
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      if (q && !r.item_number.includes(q)) return false
      return true
    })
  }, [rows, filter, search])

  const exportExcel = useCallback(() => {
    if (!rows || !summary) return
    const wb = XLSX.utils.book_new()

    const summaryAoa: (string | number)[][] = [
      ['Metriek', 'Waarde'],
      ['Unieke items', summary.totalItems],
      ['Totaal stuks volgens BC', summary.bcTotalQty],
      ['Totaal stuks volgens telling', summary.tellingTotalQty],
      ['Verschil (BC - telling)', summary.bcTotalQty - summary.tellingTotalQty],
      [],
      ['Te versturen in BC (BC > telling)', summary.teVersturen],
      ['Enkel in BC (niet geteld)', summary.enkelBc],
      ['Extra in stock (telling > BC)', summary.extraInStock],
      ['Enkel in telling (niet in BC)', summary.enkelTelling],
      ['Gelijk', summary.match],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoa), 'Samenvatting')

    const header = ['Itemnummer', 'BC aantal', 'Telling aantal', 'Verschil (BC - telling)', 'Status']

    const addSheet = (name: string, filterFn: (r: CompareRow) => boolean) => {
      const aoa: (string | number)[][] = [header]
      for (const r of rows) {
        if (!filterFn(r)) continue
        aoa.push([r.item_number, r.bc_qty, r.telling_qty, r.diff, STATUS_LABEL[r.status]])
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name)
    }

    addSheet('Te versturen in BC', (r) => r.status === 'te_versturen' || r.status === 'enkel_bc')
    addSheet('Extra in stock', (r) => r.status === 'extra_in_stock' || r.status === 'enkel_telling')
    addSheet('Gelijk', (r) => r.status === 'match')
    addSheet('Alle items', () => true)

    const today = new Date()
    const dd = String(today.getDate()).padStart(2, '0')
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const yyyy = today.getFullYear()
    XLSX.writeFile(wb, `stock-vs-bc_${dd}-${mm}-${yyyy}.xlsx`)
  }, [rows, summary])

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                Stock telling vs Business Central
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Vergelijk totaal aantal per itemnummer tussen de fysieke telling en Business Central.
              </p>
            </div>
            <Link
              href="/admin"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              ← Terug naar admin
            </Link>
          </div>

          {/* Uitleg */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-900">
            <p className="font-semibold mb-2">Hoe werkt het?</p>
            <ul className="list-disc ml-5 space-y-1">
              <li>
                <strong>BC-bestand</strong>: elke rij = 1 stuk. Itemnummer staat standaard in
                kolom <code className="bg-white px-1 rounded">E</code>.
              </li>
              <li>
                <strong>Stock-telling bestand</strong>: itemnummer in kolom{' '}
                <code className="bg-white px-1 rounded">A</code>, aantal (som) in kolom{' '}
                <code className="bg-white px-1 rounded">C</code>. Eerste tab of tab "Overzicht".
              </li>
              <li>
                Alles wat in BC zit maar niet (of minder) geteld is →{' '}
                <strong>te versturen in BC</strong>.
              </li>
              <li>
                Alles wat geteld is maar meer / niet in BC →{' '}
                <strong>extra in stock</strong> (verder onderzoeken).
              </li>
            </ul>
          </div>

          {/* Upload + kolommen */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <h2 className="font-semibold text-gray-800 mb-3">1. Business Central export</h2>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setBcFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
              {bcFile && (
                <p className="text-xs text-gray-500 mt-2 truncate">{bcFile.name}</p>
              )}
              <label className="block mt-3 text-xs text-gray-600">
                Kolom met itemnummer:
                <input
                  type="text"
                  value={bcColLetter}
                  onChange={(e) => setBcColLetter(e.target.value.toUpperCase())}
                  maxLength={3}
                  className="ml-2 w-14 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </label>
            </div>

            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <h2 className="font-semibold text-gray-800 mb-3">2. Stock-telling export</h2>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setTellingFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
              {tellingFile && (
                <p className="text-xs text-gray-500 mt-2 truncate">{tellingFile.name}</p>
              )}
              <div className="flex gap-3 mt-3 text-xs text-gray-600">
                <label>
                  Itemnr kolom:
                  <input
                    type="text"
                    value={tellingItemColLetter}
                    onChange={(e) => setTellingItemColLetter(e.target.value.toUpperCase())}
                    maxLength={3}
                    className="ml-2 w-14 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </label>
                <label>
                  Aantal kolom:
                  <input
                    type="text"
                    value={tellingQtyColLetter}
                    onChange={(e) => setTellingQtyColLetter(e.target.value.toUpperCase())}
                    maxLength={3}
                    className="ml-2 w-14 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={runCompare}
              disabled={busy || !bcFile || !tellingFile}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
            >
              {busy ? 'Bezig...' : 'Vergelijken'}
            </button>
            {rows && (
              <button
                onClick={exportExcel}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
              >
                Download Excel
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Resultaten */}
          {summary && rows && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <SummaryCard
                  label="Te versturen in BC"
                  value={summary.teVersturen + summary.enkelBc}
                  tone="orange"
                  active={filter === 'te_versturen'}
                  onClick={() => setFilter('te_versturen')}
                />
                <SummaryCard
                  label="Extra in stock"
                  value={summary.extraInStock + summary.enkelTelling}
                  tone="purple"
                  active={filter === 'extra_in_stock'}
                  onClick={() => setFilter('extra_in_stock')}
                />
                <SummaryCard
                  label="Enkel in BC"
                  value={summary.enkelBc}
                  tone="red"
                  active={filter === 'enkel_bc'}
                  onClick={() => setFilter('enkel_bc')}
                />
                <SummaryCard
                  label="Enkel in telling"
                  value={summary.enkelTelling}
                  tone="blue"
                  active={filter === 'enkel_telling'}
                  onClick={() => setFilter('enkel_telling')}
                />
                <SummaryCard
                  label="Gelijk"
                  value={summary.match}
                  tone="green"
                  active={filter === 'match'}
                  onClick={() => setFilter('match')}
                />
              </div>

              <div className="bg-white rounded-lg shadow border border-gray-200 p-3 mb-3 text-xs text-gray-600 flex flex-wrap gap-4">
                <span>
                  BC totaal: <strong>{summary.bcTotalQty}</strong> stuks (
                  {summary.totalItems} unieke items)
                </span>
                <span>
                  Telling totaal: <strong>{summary.tellingTotalQty}</strong> stuks
                </span>
                <span>
                  Netto verschil:{' '}
                  <strong
                    className={
                      summary.bcTotalQty - summary.tellingTotalQty > 0
                        ? 'text-orange-700'
                        : summary.bcTotalQty - summary.tellingTotalQty < 0
                        ? 'text-purple-700'
                        : 'text-green-700'
                    }
                  >
                    {summary.bcTotalQty - summary.tellingTotalQty}
                  </strong>
                </span>
              </div>

              <div className="bg-white rounded-lg shadow border border-gray-200 p-3 mb-3 flex flex-wrap gap-3 items-center">
                <div className="flex gap-1 flex-wrap text-xs">
                  <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
                    Alles
                  </FilterPill>
                  <FilterPill
                    active={filter === 'te_versturen'}
                    onClick={() => setFilter('te_versturen')}
                  >
                    Te versturen
                  </FilterPill>
                  <FilterPill
                    active={filter === 'enkel_bc'}
                    onClick={() => setFilter('enkel_bc')}
                  >
                    Enkel in BC
                  </FilterPill>
                  <FilterPill
                    active={filter === 'extra_in_stock'}
                    onClick={() => setFilter('extra_in_stock')}
                  >
                    Extra in stock
                  </FilterPill>
                  <FilterPill
                    active={filter === 'enkel_telling'}
                    onClick={() => setFilter('enkel_telling')}
                  >
                    Enkel in telling
                  </FilterPill>
                  <FilterPill active={filter === 'match'} onClick={() => setFilter('match')}>
                    Gelijk
                  </FilterPill>
                </div>
                <input
                  type="search"
                  placeholder="Zoek itemnummer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ml-auto px-3 py-1.5 border border-gray-300 rounded text-sm w-full sm:w-64"
                />
              </div>

              <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[65vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                          Itemnummer
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                          BC aantal
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                          Telling
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                          Verschil
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r) => (
                        <tr key={r.item_number} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-mono text-gray-900">{r.item_number}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.bc_qty}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.telling_qty}</td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums font-medium ${
                              r.diff > 0
                                ? 'text-orange-700'
                                : r.diff < 0
                                ? 'text-purple-700'
                                : 'text-gray-500'
                            }`}
                          >
                            {r.diff > 0 ? `+${r.diff}` : r.diff}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_COLOR[r.status]}`}
                            >
                              {STATUS_LABEL[r.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-sm">
                            Geen rijen voor deze filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 text-xs text-gray-500 border-t bg-gray-50">
                  {filteredRows.length} van {rows.length} items
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminGuard>
  )
}

function SummaryCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string
  value: number
  tone: 'orange' | 'purple' | 'red' | 'blue' | 'green'
  active?: boolean
  onClick?: () => void
}) {
  const toneMap: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border p-3 transition ${toneMap[tone]} ${
        active ? 'ring-2 ring-offset-1 ring-gray-400' : 'hover:shadow'
      }`}
    >
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </button>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full border ${
        active
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

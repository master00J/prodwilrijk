'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import AdminGuard from '@/components/AdminGuard'
import {
  compareWmsAndBc,
  extractFromBcSheet,
  extractFromWmsSheet,
  rowsToCsv,
  type ItemPalletRow,
} from '@/lib/wms-bc-status/compare'

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

function parseFirstSheetRows(file: File): Promise<unknown[][]> {
  return readFileAsArrayBuffer(file).then((buf) => {
    const wb = XLSX.read(buf, { type: 'array' })
    const name = wb.SheetNames[0]
    if (!name) throw new Error('Geen werkblad gevonden in het bestand.')
    const sheet = wb.Sheets[name]
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][]
  })
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function dedupeByKey(rows: ItemPalletRow[]): ItemPalletRow[] {
  const seen = new Set<string>()
  const out: ItemPalletRow[] = []
  for (const r of rows) {
    const k = `${r.item}\t${r.pallet}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out
}

export default function WmsBcStatusPage() {
  const [wmsFile, setWmsFile] = useState<File | null>(null)
  const [bcFile, setBcFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wmsMeta, setWmsMeta] = useState<{ name: string; skipped: number } | null>(null)
  const [bcMeta, setBcMeta] = useState<{ name: string; skipped: number } | null>(null)
  const [result, setResult] = useState<ReturnType<typeof compareWmsAndBc> | null>(null)
  const [dedupeView, setDedupeView] = useState(true)

  const runCompare = useCallback(async () => {
    setError(null)
    setResult(null)
    if (!wmsFile || !bcFile) {
      setError('Selecteer beide bestanden (WMS status en BC status).')
      return
    }
    setBusy(true)
    try {
      const [wmsRaw, bcRaw] = await Promise.all([
        parseFirstSheetRows(wmsFile),
        parseFirstSheetRows(bcFile),
      ])
      const wmsParsed = extractFromWmsSheet(wmsRaw)
      const bcParsed = extractFromBcSheet(bcRaw)
      setWmsMeta({ name: wmsFile.name, skipped: wmsParsed.skipped })
      setBcMeta({ name: bcFile.name, skipped: bcParsed.skipped })
      setResult(compareWmsAndBc(wmsParsed.rows, bcParsed.rows))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Onbekende fout bij het lezen van de bestanden.')
    } finally {
      setBusy(false)
    }
  }, [wmsFile, bcFile])

  const onlyBcDisplay = useMemo(() => {
    if (!result) return []
    return dedupeView ? dedupeByKey(result.onlyInBc) : result.onlyInBc
  }, [result, dedupeView])

  const onlyWmsDisplay = useMemo(() => {
    if (!result) return []
    return dedupeView ? dedupeByKey(result.onlyInWms) : result.onlyInWms
  }, [result, dedupeView])

  const downloadOnlyBc = () => {
    if (!onlyBcDisplay.length) return
    const csv = rowsToCsv(
      ['excel_rij', 'itemnummer', 'palletnummer'],
      onlyBcDisplay.map((r) => ({
        excel_rij: r.excelRow,
        itemnummer: r.item,
        palletnummer: r.pallet,
      }))
    )
    triggerDownload('alleen-in-bc-niet-in-wms.csv', `\uFEFF${csv}`, 'text/csv;charset=utf-8')
  }

  const downloadOnlyWms = () => {
    if (!onlyWmsDisplay.length) return
    const csv = rowsToCsv(
      ['excel_rij', 'itemnummer', 'palletnummer'],
      onlyWmsDisplay.map((r) => ({
        excel_rij: r.excelRow,
        itemnummer: r.item,
        palletnummer: r.pallet,
      }))
    )
    triggerDownload('alleen-in-wms-niet-in-bc.csv', `\uFEFF${csv}`, 'text/csv;charset=utf-8')
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <Link href="/admin" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            ← Admin
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">WMS vs BC status</h1>
        <p className="text-gray-600 mb-6 max-w-3xl">
          Vergelijk het Atlas WMS-exportbestand met jullie Business Central-export. Combinaties die{' '}
          <strong>wel in BC</strong> staan maar <strong>niet in WMS</strong> zijn vaak al fysiek vertrokken
          terwijl ze in jullie ERP nog open staan. Bestanden worden <strong>alleen in deze browser</strong>{' '}
          verwerkt (geen upload naar de server).
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-950">
          <p className="font-medium mb-1">Kolomverwachting</p>
          <ul className="list-disc list-inside space-y-1 text-amber-900">
            <li>
              <strong>WMS status:</strong> kolom A = item, kolom B = pallet (eerste werkblad, rij 1 = koppen).
            </li>
            <li>
              <strong>BC status:</strong> kolom E &quot;Description&quot; = item, kolom P &quot;Atlas Pallet No.&quot; =
              pallet.
            </li>
          </ul>
          <p className="mt-2 text-amber-900/90">
            Item- en palletnummers worden exact vergeleken (na trimmen en normaliseren van spaties/getallen). Als
            notaties tussen systemen verschillen, krijg je extra &quot;alleen in één bron&quot;-regels.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">WMS status (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm text-gray-600"
              onChange={(e) => setWmsFile(e.target.files?.[0] ?? null)}
            />
            {wmsFile && <p className="mt-2 text-xs text-gray-500">Geselecteerd: {wmsFile.name}</p>}
          </div>
          <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
            <label className="block text-sm font-medium text-gray-700 mb-2">BC status (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm text-gray-600"
              onChange={(e) => setBcFile(e.target.files?.[0] ?? null)}
            />
            {bcFile && <p className="mt-2 text-xs text-gray-500">Geselecteerd: {bcFile.name}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-8">
          <button
            type="button"
            onClick={() => void runCompare()}
            disabled={busy || !wmsFile || !bcFile}
            className="px-5 py-2.5 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Bezig…' : 'Vergelijken'}
          </button>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dedupeView}
              onChange={(e) => setDedupeView(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Toon afwijkingen gegroepeerd (één rij per item+pallet)
          </label>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {result && wmsMeta && bcMeta && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500">Unieke matches</div>
                <div className="text-2xl font-semibold text-gray-900">{result.matchedUniquePairs}</div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-rose-800">Alleen in BC</div>
                <div className="text-2xl font-semibold text-rose-900">{onlyBcDisplay.length}</div>
                <div className="text-xs text-rose-800/80 mt-1">Niet in WMS → mogelijk al weg</div>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-sky-800">Alleen in WMS</div>
                <div className="text-2xl font-semibold text-sky-900">{onlyWmsDisplay.length}</div>
                <div className="text-xs text-sky-800/80 mt-1">Nog niet in BC-export</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500">Rijen ingelezen</div>
                <div className="text-sm text-gray-800 mt-1">
                  WMS: {result.wmsRowCount}
                  {wmsMeta.skipped ? ` (${wmsMeta.skipped} rij(en) overgeslagen, ontbrekende data)` : ''}
                </div>
                <div className="text-sm text-gray-800">
                  BC: {result.bcRowCount}
                  {bcMeta.skipped ? ` (${bcMeta.skipped} rij(en) overgeslagen)` : ''}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <section className="border border-rose-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2 px-4 py-3 bg-rose-50 border-b border-rose-200">
                  <h2 className="font-semibold text-rose-900">Alleen in BC (niet in WMS)</h2>
                  <button
                    type="button"
                    onClick={downloadOnlyBc}
                    disabled={!onlyBcDisplay.length}
                    className="text-sm px-3 py-1 rounded border border-rose-300 text-rose-900 hover:bg-rose-100 disabled:opacity-40"
                  >
                    CSV
                  </button>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Excel-rij</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Item</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Pallet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onlyBcDisplay.map((r) => (
                        <tr key={`${r.excelRow}-${r.item}-${r.pallet}`} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.excelRow}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.item}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.pallet}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!onlyBcDisplay.length && (
                    <p className="px-4 py-6 text-gray-500 text-sm">Geen afwijkingen: alle BC-combinaties zitten in WMS.</p>
                  )}
                </div>
              </section>

              <section className="border border-sky-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2 px-4 py-3 bg-sky-50 border-b border-sky-200">
                  <h2 className="font-semibold text-sky-900">Alleen in WMS (niet in BC)</h2>
                  <button
                    type="button"
                    onClick={downloadOnlyWms}
                    disabled={!onlyWmsDisplay.length}
                    className="text-sm px-3 py-1 rounded border border-sky-300 text-sky-900 hover:bg-sky-100 disabled:opacity-40"
                  >
                    CSV
                  </button>
                </div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Excel-rij</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Item</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Pallet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onlyWmsDisplay.map((r) => (
                        <tr key={`${r.excelRow}-${r.item}-${r.pallet}`} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.excelRow}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.item}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.pallet}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!onlyWmsDisplay.length && (
                    <p className="px-4 py-6 text-gray-500 text-sm">Geen afwijkingen: alle WMS-combinaties zitten in BC.</p>
                  )}
                </div>
              </section>
            </div>

            <p className="mt-6 text-xs text-gray-500">
              Bronbestanden: {wmsMeta.name} · {bcMeta.name}
            </p>
          </>
        )}
      </div>
    </AdminGuard>
  )
}

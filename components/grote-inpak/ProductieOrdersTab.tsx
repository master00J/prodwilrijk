'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Upload, RefreshCw, AlertCircle, CheckCircle2, Factory, Clock, CalendarDays, Package } from 'lucide-react'
import * as XLSX from 'xlsx'
import { BcItemCode } from '@/lib/bc-mapping/client'
import { normalizeErpCode } from '@/lib/utils/erp-code-normalizer'

interface ProductionOrder {
  id: number
  status: string | null
  prod_order_no: string
  item_no: string
  description: string | null
  location_code: string | null
  productielocatie: 'Genk' | 'Wilrijk' | 'Willebroek' | null
  kistnummer: string | null
  quantity: number | null
  finished_quantity: number | null
  remaining_quantity: number | null
  due_date: string | null
  starting_date: string | null
  ending_date: string | null
  source_file: string | null
  uploaded_at: string
}

interface Stats {
  total: number
  open: number
  te_laat: number
  deze_week: number
  remaining_total: number
  per_locatie: Record<'Genk' | 'Wilrijk' | 'Willebroek', { count: number; remaining: number }>
}

type LocationFilter = 'all' | 'Genk' | 'Wilrijk' | 'Willebroek'

function formatDate(s: string | null): string {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return '-'
  return Number(n).toLocaleString('nl-BE')
}

export default function ProductieOrdersTab() {
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [uploadProgress, setUploadProgress] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/grote-inpak/production-orders', { cache: 'no-store' })
      if (!res.ok) throw new Error('Laden mislukt')
      const json = await res.json()
      setOrders(json.data || [])
      setStats(json.stats || null)
    } catch (err: any) {
      setError(err.message || 'Fout bij laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    setSuccess(null)
    setUploadProgress('Excel wordt ingelezen...')

    try {
      // 1. Parse de Excel in de browser zodat we enkel de relevante rijen
      //    doorsturen. Dit omzeilt de 4.5 MB body-limiet van Vercel.
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as any[][]

      setUploadProgress(`${raw.length.toLocaleString('nl-BE')} rijen ingelezen, ERP LINK wordt opgehaald...`)

      // 2. Haal ERP LINK en BC-mapping parallel op.
      const [erpRes, bcRes] = await Promise.all([
        fetch('/api/grote-inpak/erp-link').then(r => r.json()),
        fetch('/api/bc-mappings').then(r => r.json()),
      ])
      const erpEntries: Array<{ kistnummer: string; erp_code: string | null }> = erpRes.data || []
      const mappings: Array<{ old_code: string; new_code: string }> = bcRes.mappings || []

      // GP-code (oude BC) → kistnummer
      const gpToKist = new Map<string, string>()
      for (const e of erpEntries) {
        const code = normalizeErpCode(e.erp_code)
        if (code && e.kistnummer) gpToKist.set(code, String(e.kistnummer).toUpperCase().trim())
      }
      // FP-code (nieuwe BC) → GP-code
      const newToOld = new Map<string, string>()
      for (const m of mappings) {
        if (m.new_code) newToOld.set(String(m.new_code).toUpperCase().trim(), String(m.old_code || '').trim())
      }

      setUploadProgress('Matches met ERP LINK worden berekend...')

      // 3. Filter + match. Locatie-codes:
      //    - Nieuwe BC: GENK_EIK / Wilrijk / Willebroek
      //    - Oude BC:   PACK-GENK / PACK-WILR / PACK-WILL
      type Locatie = 'Genk' | 'Wilrijk' | 'Willebroek'
      type BcSource = 'legacy' | 'bc36'
      const locMap: Record<string, { productielocatie: Locatie; bc_source: BcSource }> = {
        GENK_EIK:    { productielocatie: 'Genk',       bc_source: 'bc36' },
        WILRIJK:     { productielocatie: 'Wilrijk',    bc_source: 'bc36' },
        WILLEBROEK:  { productielocatie: 'Willebroek', bc_source: 'bc36' },
        'PACK-GENK': { productielocatie: 'Genk',       bc_source: 'legacy' },
        'PACK-WILR': { productielocatie: 'Wilrijk',    bc_source: 'legacy' },
        'PACK-WILL': { productielocatie: 'Willebroek', bc_source: 'legacy' },
      }
      const poPattern = /^P[A-Z]{1,3}\d/i

      const parseDate = (v: any): string | null => {
        if (v === null || v === undefined || v === '') return null
        if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString()
        if (typeof v === 'number') {
          const epoch = new Date(Date.UTC(1899, 11, 30))
          const d = new Date(epoch.getTime() + v * 86400000)
          return isNaN(d.getTime()) ? null : d.toISOString()
        }
        const d = new Date(String(v))
        return isNaN(d.getTime()) ? null : d.toISOString()
      }
      const parseNum = (v: any): number | null => {
        if (v === null || v === undefined || v === '') return null
        const n = Number(v)
        return isNaN(n) ? null : n
      }

      const parsed: any[] = []
      let skippedLocation = 0
      let skippedNoMatch = 0
      const unmatched = new Set<string>()
      const sourcesInFile = new Set<BcSource>()

      for (const row of raw) {
        const rawPoNo = String(row[1] ?? '').trim()
        const rawItem = String(row[2] ?? '').trim()
        const rawLoc = String(row[4] ?? '').trim()

        if (!rawPoNo || !poPattern.test(rawPoNo)) continue
        if (!rawItem) continue

        const locInfo = locMap[rawLoc.toUpperCase()]
        if (!locInfo) { skippedLocation++; continue }

        const norm = normalizeErpCode(rawItem)
        let kist: string | null = null
        if (norm) {
          // FP → GP fallback via bc_item_mapping
          const mapped = newToOld.get(norm)
          const gpCandidate = (mapped && normalizeErpCode(mapped)) || norm
          kist = gpToKist.get(gpCandidate) || gpToKist.get(norm) || null
        }
        if (!kist) {
          skippedNoMatch++
          if (norm) unmatched.add(norm)
          continue
        }

        sourcesInFile.add(locInfo.bc_source)

        parsed.push({
          status: String(row[0] ?? '').trim() || null,
          prod_order_no: rawPoNo,
          item_no: rawItem,
          description: String(row[3] ?? '').trim() || null,
          location_code: rawLoc,
          productielocatie: locInfo.productielocatie,
          kistnummer: kist,
          bc_source: locInfo.bc_source,
          finished_quantity: parseNum(row[10]),
          quantity: parseNum(row[11]),
          remaining_quantity: parseNum(row[12]),
          due_date: parseDate(row[16])?.slice(0, 10) ?? null,
          starting_date: parseDate(row[17]),
          ending_date: parseDate(row[18]),
        })
      }

      setUploadProgress(`${parsed.length.toLocaleString('nl-BE')} matches gevonden — uploaden naar server...`)

      // 4. POST JSON met de (kleine) payload van gematchte rijen.
      const res = await fetch('/api/grote-inpak/production-orders/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed, source_file: file.name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload mislukt')

      const parts: string[] = [
        `${json.ingevoegd.toLocaleString('nl-BE')} productie-orderlijnen geïmporteerd`,
      ]
      if (json.bronnen && json.bronnen.length > 0) {
        const bronLabels = (json.bronnen as string[]).map(b => b === 'legacy' ? 'Oude BC' : 'BC36').join(' + ')
        const detail = json.per_bron
          ? ` (${Object.entries(json.per_bron as Record<string, number>).filter(([, v]) => v > 0).map(([k, v]) => `${k === 'legacy' ? 'Oude BC' : 'BC36'}: ${v}`).join(', ')})`
          : ''
        parts.push(`bron: ${bronLabels}${detail}`)
      }
      if (skippedLocation) parts.push(`${skippedLocation.toLocaleString('nl-BE')} rijen buiten Genk/Wilrijk/Willebroek genegeerd`)
      if (skippedNoMatch) parts.push(`${skippedNoMatch.toLocaleString('nl-BE')} rijen niet in ERP LINK`)
      if (unmatched.size > 0) {
        const preview = Array.from(unmatched).slice(0, 5).join(', ')
        parts.push(`voorbeelden niet-gematcht: ${preview}${unmatched.size > 5 ? '…' : ''}`)
      }
      setSuccess(parts.join(' · '))
      await load()
    } catch (err: any) {
      console.error('Upload fout:', err)
      setError(err.message || 'Upload mislukt')
    } finally {
      setUploading(false)
      setUploadProgress('')
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders.filter(o => {
      if (onlyOpen && Number(o.remaining_quantity ?? 0) <= 0) return false
      if (locationFilter !== 'all' && o.productielocatie !== locationFilter) return false
      if (term) {
        const hay = `${o.prod_order_no} ${o.item_no} ${o.description ?? ''} ${o.kistnummer ?? ''}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [orders, onlyOpen, locationFilter, search])

  const now = Date.now()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Factory className="w-6 h-6 text-blue-600" />
            Productie-orders (BC)
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Upload de <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">Prod. Order Line List</code> export uit Business Central.
            Beide BC-omgevingen worden ondersteund: <strong>BC36</strong> (locaties <em>GENK_EIK / Wilrijk / Willebroek</em>) en de <strong>oude BC</strong> (locaties <em>PACK-GENK / PACK-WILR / PACK-WILL</em>).
            Alleen items met een match in de ERP LINK worden bewaard — alle andere locaties en items worden genegeerd.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors disabled:opacity-50">
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="text-sm font-medium">{uploading ? 'Uploaden...' : 'Upload Excel'}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
                e.target.value = ''
              }}
            />
          </label>
          {uploadProgress && (
            <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1">
              {uploadProgress}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Vernieuwen
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2 text-green-800 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard
            label="Totaal open"
            value={stats.open}
            sub={`${formatNumber(stats.remaining_total)} stuks`}
            color="blue"
            icon={<Package className="w-5 h-5" />}
          />
          <KpiCard
            label="Te laat"
            value={stats.te_laat}
            sub="einddatum voorbij"
            color={stats.te_laat > 0 ? 'red' : 'gray'}
            icon={<Clock className="w-5 h-5" />}
          />
          <KpiCard
            label="Deze week af"
            value={stats.deze_week}
            sub="eindigt < 7 dagen"
            color="amber"
            icon={<CalendarDays className="w-5 h-5" />}
          />
          <KpiCard
            label="Genk"
            value={stats.per_locatie.Genk.count}
            sub={`${formatNumber(stats.per_locatie.Genk.remaining)} stuks`}
            color="purple"
          />
          <KpiCard
            label="Wilrijk + Willebroek"
            value={stats.per_locatie.Wilrijk.count + stats.per_locatie.Willebroek.count}
            sub={`${formatNumber(stats.per_locatie.Wilrijk.remaining + stats.per_locatie.Willebroek.remaining)} stuks`}
            color="indigo"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'Genk', 'Wilrijk', 'Willebroek'] as LocationFilter[]).map(loc => (
            <button
              key={loc}
              onClick={() => setLocationFilter(loc)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                locationFilter === loc ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {loc === 'all' ? 'Alle locaties' : loc}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span>Enkel openstaande (remaining &gt; 0)</span>
        </label>
        <input
          type="text"
          placeholder="Zoek op PO-nr, item, kist, omschrijving..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
        />
        <span className="text-gray-500 text-xs whitespace-nowrap">{filtered.length} / {orders.length} rijen</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-3 py-2 text-left">Kist</th>
              <th className="px-3 py-2 text-left">PO nr.</th>
              <th className="px-3 py-2 text-left">Item (BC)</th>
              <th className="px-3 py-2 text-left">Omschrijving</th>
              <th className="px-3 py-2 text-left">Locatie</th>
              <th className="px-3 py-2 text-right">Aantal</th>
              <th className="px-3 py-2 text-right">Afgewerkt</th>
              <th className="px-3 py-2 text-right">Resterend</th>
              <th className="px-3 py-2 text-left">Einddatum</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">Laden...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                Geen productie-orders. Upload een <em>Prod. Order Line List</em> Excel om te starten.
              </td></tr>
            )}
            {filtered.map(o => {
              const overdue = o.ending_date && Number(o.remaining_quantity ?? 0) > 0 && new Date(o.ending_date).getTime() < now
              return (
                <tr key={o.id} className="hover:bg-blue-50/30">
                  <td className="px-3 py-2 font-mono font-semibold text-gray-900">{o.kistnummer ?? '-'}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">{o.prod_order_no}</td>
                  <td className="px-3 py-2 font-mono text-gray-700">
                    <BcItemCode value={o.item_no} />
                  </td>
                  <td className="px-3 py-2 text-gray-700 max-w-[260px] truncate" title={o.description ?? ''}>{o.description ?? '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      o.productielocatie === 'Genk' ? 'bg-purple-100 text-purple-700'
                      : o.productielocatie === 'Wilrijk' ? 'bg-blue-100 text-blue-700'
                      : 'bg-emerald-100 text-emerald-700'
                    }`}>{o.productielocatie}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(o.quantity)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{formatNumber(o.finished_quantity)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatNumber(o.remaining_quantity)}</td>
                  <td className={`px-3 py-2 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>{formatDate(o.ending_date)}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{o.status ?? '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, color, icon }: {
  label: string
  value: number
  sub?: string
  color: 'blue' | 'red' | 'amber' | 'purple' | 'indigo' | 'gray'
  icon?: React.ReactNode
}) {
  const palette: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  }
  return (
    <div className={`border rounded-lg p-3 ${palette[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold mt-1">{value.toLocaleString('nl-BE')}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  )
}

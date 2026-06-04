'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDown, ArrowUp, Minus, Search, User, X } from 'lucide-react'
import { BcItemCode, useBcMapping } from '@/lib/bc-mapping/client'
import type { RevenueRun } from './types'
import {
  analyzeItemRuns,
  filterRunsByItem,
  getItemsWithVariation,
  getUniqueItems,
  itemMatchesQuery,
} from './item-analysis'
import {
  formatDate,
  formatDelta,
  formatDeltaPct,
  formatHours,
  formatPct,
} from './kpi-formatters'

const chartTooltipStyle = {
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 12,
}

function DeltaBadge({
  value,
  pct,
  unit = ' u/st',
  invert = false,
}: {
  value: number
  pct: number
  unit?: string
  invert?: boolean
}) {
  const isPositive = value > 0.001
  const isNegative = value < -0.001
  const isGood = invert ? isNegative : isNegative
  const isBad = invert ? isPositive : isPositive

  let color = 'text-gray-600 bg-gray-100'
  if (isGood) color = 'text-emerald-700 bg-emerald-50'
  if (isBad) color = 'text-red-700 bg-red-50'

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${color}`}>
      {isGood ? <ArrowDown className="h-3 w-3" /> : isBad ? <ArrowUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {formatDelta(value, unit)} ({formatDeltaPct(pct)})
    </span>
  )
}

function formatOrderPeriod(dateFrom: string, dateTo: string) {
  if (!dateFrom) return '–'
  if (!dateTo || dateFrom === dateTo) return formatDate(dateFrom)
  return `${formatDate(dateFrom)} – ${formatDate(dateTo)}`
}

export function ItemCompareSection({
  runs,
  loading,
  selectedItem,
  onSelectItem,
  id,
}: {
  runs: RevenueRun[]
  loading: boolean
  selectedItem: string
  onSelectItem: (item: string) => void
  id?: string
}) {
  const { toNew, toOld } = useBcMapping()
  const [itemQuery, setItemQuery] = useState(selectedItem)

  useEffect(() => {
    setItemQuery(selectedItem)
  }, [selectedItem])

  const uniqueItems = useMemo(() => getUniqueItems(runs), [runs])
  const variationItems = useMemo(() => getItemsWithVariation(runs), [runs])

  const suggestions = useMemo(() => {
    if (!itemQuery.trim()) return uniqueItems.slice(0, 12)
    return uniqueItems.filter((item) => itemMatchesQuery(item, itemQuery, toNew, toOld)).slice(0, 12)
  }, [uniqueItems, itemQuery, toNew, toOld])

  const resolvedItem = selectedItem.trim()
  const itemRuns = useMemo(
    () => (resolvedItem ? filterRunsByItem(runs, resolvedItem, toNew, toOld) : []),
    [runs, resolvedItem, toNew, toOld]
  )
  const analysis = useMemo(
    () => (resolvedItem ? analyzeItemRuns(resolvedItem, itemRuns) : null),
    [resolvedItem, itemRuns]
  )

  const orderChartData = useMemo(
    () =>
      (analysis?.orderComparisons ?? []).map((o) => ({
        label: o.order_number,
        shortLabel: o.order_number.length > 12 ? `${o.order_number.slice(0, 12)}…` : o.order_number,
        totalHours: Number(o.hours.toFixed(2)),
        isFastest: o.isFastestTotal,
        isSlowest: o.isSlowestTotal,
      })),
    [analysis]
  )

  const runChartData = useMemo(
    () =>
      (analysis?.runComparisons ?? []).map((c) => ({
        label: `${c.run.order_number} · ${formatDate(c.run.date)}`,
        shortLabel: c.run.order_number.length > 10 ? `${c.run.order_number.slice(0, 10)}…` : c.run.order_number,
        hoursPerPiece: Number(c.run.hours_per_piece.toFixed(3)),
        isFastest: c.isFastest,
        isSlowest: c.isSlowest,
      })),
    [analysis]
  )

  const pickItem = (item: string) => {
    onSelectItem(item)
    setItemQuery(item)
  }

  const clearItem = () => {
    onSelectItem('')
    setItemQuery('')
  }

  return (
    <div id={id} className="space-y-4 scroll-mt-24">
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Tijd per item — vergelijk orders</h2>
            <p className="text-sm text-gray-500 mt-1">
              Kies een item om te zien hoeveel tijd er per productieorder aan dat item is besteed, en vergelijk
              verschillende orders met elkaar.
            </p>
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={itemQuery}
                  onChange={(e) => {
                    setItemQuery(e.target.value)
                    if (!e.target.value.trim()) onSelectItem('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && suggestions[0]) pickItem(suggestions[0])
                  }}
                  placeholder="Zoek BC-itemnummer..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-9 text-sm"
                  list="kpi-item-suggestions"
                />
                {resolvedItem ? (
                  <button
                    type="button"
                    onClick={clearItem}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100"
                    title="Filter wissen"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
                <datalist id="kpi-item-suggestions">
                  {uniqueItems.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
            </div>

            {itemQuery.trim() && !resolvedItem && suggestions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => pickItem(item)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm hover:bg-blue-50 hover:border-blue-200"
                  >
                    <BcItemCode value={item} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {variationItems.length > 0 ? (
            <div className="lg:w-80 shrink-0">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                Meeste variatie ({variationItems.length})
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {variationItems.slice(0, 8).map(({ item_number, runCount, spread }) => (
                  <button
                    key={item_number}
                    type="button"
                    onClick={() => pickItem(item_number)}
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-left hover:bg-violet-50 border ${
                      resolvedItem === item_number ? 'border-violet-400 bg-violet-50' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <BcItemCode value={item_number} />
                    <span className="text-xs text-gray-500 shrink-0 ml-2">
                      {runCount}× · Δ {formatHours(spread)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 py-12 text-center">Data laden...</p>
      ) : !resolvedItem ? (
        <div className="rounded-xl bg-white border border-dashed border-gray-200 py-16 text-center text-gray-500">
          Kies een item hierboven om runs te vergelijken.
        </div>
      ) : !analysis ? (
        <div className="rounded-xl bg-white border border-gray-100 py-12 text-center text-gray-500">
          Geen data voor dit item in de geselecteerde periode.
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm text-violet-100">Geselecteerd item</div>
                <div className="text-2xl font-bold mt-0.5">
                  <BcItemCode value={analysis.item_number} className="text-white" />
                </div>
                {analysis.description ? (
                  <div className="text-sm text-violet-100 mt-1">{analysis.description}</div>
                ) : null}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <div className="text-xl font-bold">{analysis.runCount}</div>
                  <div className="text-xs text-violet-100">Runs</div>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <div className="text-xl font-bold">{analysis.orderCount}</div>
                  <div className="text-xs text-violet-100">Orders</div>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <div className="text-xl font-bold">{analysis.employeeCount}</div>
                  <div className="text-xs text-violet-100">Medewerkers</div>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <div className="text-xl font-bold">{formatHours(analysis.totalHoursPerOrder.spread)}</div>
                  <div className="text-xs text-violet-100">Verschil tijd/order</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
              <div className="text-xs text-gray-500 uppercase">Gem. tijd per order</div>
              <div className="text-xl font-bold mt-1">{formatHours(analysis.totalHoursPerOrder.avg)}</div>
              <div className="text-xs text-gray-500 mt-1">
                min {formatHours(analysis.totalHoursPerOrder.min)} · max{' '}
                {formatHours(analysis.totalHoursPerOrder.max)}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
              <div className="text-xs text-gray-500 uppercase">Verschil tussen orders</div>
              <div className="text-xl font-bold mt-1">{formatHours(analysis.totalHoursPerOrder.spread)}</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatPct(analysis.totalHoursPerOrder.spreadPct)} t.o.v. gem.
              </div>
            </div>
            <div className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
              <div className="text-xs text-gray-500 uppercase">Uren/stuk gemiddeld</div>
              <div className="text-xl font-bold mt-1">{formatHours(analysis.hoursPerPiece.avg)}</div>
              <div className="text-xs text-gray-500 mt-1">
                min {formatHours(analysis.hoursPerPiece.min)} · max {formatHours(analysis.hoursPerPiece.max)}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm">
              <div className="text-xs text-gray-500 uppercase">Totaal uren / stuks</div>
              <div className="text-xl font-bold mt-1">{formatHours(analysis.totalHours)}</div>
              <div className="text-xs text-gray-500 mt-1">{analysis.totalQuantity.toLocaleString('nl-BE')} stuks</div>
            </div>
          </div>

          {analysis.orderComparisons.length > 0 ? (
            <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">Tijd per productieorder</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Totale bestede tijd voor dit item, gesorteerd op meeste uren — vergelijk orders onderling
                  </p>
                </div>
                {analysis.orderCount > 1 ? (
                  <span className="text-xs text-violet-700 bg-violet-50 rounded-full px-3 py-1 font-medium shrink-0">
                    {analysis.orderCount} orders · spreiding {formatHours(analysis.totalHoursPerOrder.spread)}
                  </span>
                ) : null}
              </div>
              {orderChartData.length > 1 ? (
                <div className="px-5 pt-4 pb-2 border-b border-gray-50">
                  <ResponsiveContainer width="100%" height={Math.max(160, orderChartData.length * 40)}>
                    <BarChart data={orderChartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => `${v}u`} fontSize={11} />
                      <YAxis type="category" dataKey="shortLabel" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value) => [formatHours(Number(value)), 'Totale tijd']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
                      />
                      <Bar dataKey="totalHours" radius={[0, 4, 4, 0]}>
                        {orderChartData.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={entry.isFastest ? '#10b981' : entry.isSlowest ? '#ef4444' : '#6366f1'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-400 pb-2">Groen = minste totale tijd · rood = meeste totale tijd</p>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-500">
                      <th className="py-2.5 px-4 font-medium">Productieorder</th>
                      <th className="py-2.5 pr-4 font-medium">Periode</th>
                      <th className="py-2.5 pr-4 font-medium text-right">Totale tijd</th>
                      <th className="py-2.5 pr-4 font-medium text-right">Stuks</th>
                      <th className="py-2.5 pr-4 font-medium text-right">Uren/stuk</th>
                      <th className="py-2.5 pr-4 font-medium">vs gem. tijd</th>
                      <th className="py-2.5 pr-4 font-medium">vs gem. uren/stuk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.orderComparisons.map((o) => (
                      <tr
                        key={o.order_number}
                        className={`border-t border-gray-100 ${
                          o.isFastestTotal
                            ? 'bg-emerald-50/50'
                            : o.isSlowestTotal
                              ? 'bg-red-50/50'
                              : 'hover:bg-gray-50/80'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-medium">
                          {o.order_number}
                          {o.runs > 1 ? (
                            <span className="ml-2 text-xs font-normal text-gray-500">{o.runs} runs</span>
                          ) : null}
                          {o.isFastestTotal ? (
                            <span className="ml-2 text-xs text-emerald-600 font-normal">minste tijd</span>
                          ) : o.isSlowestTotal ? (
                            <span className="ml-2 text-xs text-red-600 font-normal">meeste tijd</span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">
                          {formatOrderPeriod(o.dateFrom, o.dateTo)}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-semibold text-indigo-900">
                          {formatHours(o.hours)}
                        </td>
                        <td className="py-2.5 pr-4 text-right">{o.quantity.toLocaleString('nl-BE')}</td>
                        <td className="py-2.5 pr-4 text-right">{formatHours(o.hoursPerPiece)}</td>
                        <td className="py-2.5 pr-4">
                          {analysis.orderCount > 1 ? (
                            <DeltaBadge
                              value={o.totalHoursDelta}
                              pct={o.totalHoursDeltaPct}
                              unit=" u"
                              invert
                            />
                          ) : (
                            <span className="text-gray-400 text-xs">enige order</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4">
                          {analysis.orderCount > 1 ? (
                            <DeltaBadge
                              value={o.hoursPerPieceDelta}
                              pct={o.hoursPerPieceDeltaPct}
                              invert
                            />
                          ) : (
                            <span className="text-gray-400 text-xs">–</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {runChartData.length > 1 && analysis.runCount > analysis.orderCount ? (
            <div className="rounded-xl bg-white border border-gray-100 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Uren per stuk per run</h3>
              <p className="text-xs text-gray-500 mb-4">Detail wanneer hetzelfde item meerdere keren op één order staat</p>
              <ResponsiveContainer width="100%" height={Math.max(200, runChartData.length * 36)}>
                <BarChart data={runChartData} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => `${v}u`} fontSize={11} />
                  <YAxis type="category" dataKey="shortLabel" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => [formatHours(Number(value)), 'Uren/stuk']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
                  />
                  <Bar dataKey="hoursPerPiece" radius={[0, 4, 4, 0]}>
                    {runChartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.isFastest ? '#10b981' : entry.isSlowest ? '#ef4444' : '#8b5cf6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Detail per run</h3>
                <p className="text-xs text-gray-500 mt-0.5">Individuele registraties (order + datum)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-500">
                      <th className="py-2.5 px-4 font-medium">Order</th>
                      <th className="py-2.5 pr-4 font-medium">Datum</th>
                      <th className="py-2.5 pr-4 font-medium">Medewerkers</th>
                      <th className="py-2.5 pr-4 font-medium text-right">Tijd</th>
                      <th className="py-2.5 pr-4 font-medium text-right">Stuks</th>
                      <th className="py-2.5 pr-4 font-medium text-right">Uren/stuk</th>
                      <th className="py-2.5 pr-4 font-medium">vs gemiddelde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.runComparisons.map((c, idx) => (
                      <tr
                        key={`${c.run.order_number}-${c.run.date}-${idx}`}
                        className={`border-t border-gray-100 ${
                          c.isFastest ? 'bg-emerald-50/50' : c.isSlowest ? 'bg-red-50/50' : 'hover:bg-gray-50/80'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-medium">
                          {c.run.order_number}
                          {c.isFastest ? (
                            <span className="ml-2 text-xs text-emerald-600 font-normal">snelst</span>
                          ) : c.isSlowest ? (
                            <span className="ml-2 text-xs text-red-600 font-normal">traagst</span>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">{formatDate(c.run.date)}</td>
                        <td className="py-2.5 pr-4 max-w-[180px]">
                          <span className="flex items-start gap-1 text-gray-700">
                            <User className="h-3.5 w-3.5 mt-0.5 shrink-0 text-gray-400" />
                            <span className="truncate" title={c.employeesLabel}>
                              {c.employeesLabel}
                            </span>
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-700">{formatHours(c.run.hours)}</td>
                        <td className="py-2.5 pr-4 text-right">{c.run.quantity}</td>
                        <td className="py-2.5 pr-4 text-right font-medium">{formatHours(c.run.hours_per_piece)}</td>
                        <td className="py-2.5 pr-4">
                          {analysis.runCount > 1 ? (
                            <DeltaBadge value={c.hoursPerPieceDelta} pct={c.hoursPerPieceDeltaPct} invert />
                          ) : (
                            <span className="text-gray-400 text-xs">enige run</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Per medewerker</h3>
                {analysis.employees.length === 0 ? (
                  <p className="text-sm text-gray-400">Geen medewerkers gekoppeld</p>
                ) : (
                  <div className="space-y-2">
                    {analysis.employees.map((e) => {
                      const avgEmpHours =
                        analysis.employees.reduce((s, x) => s + x.hours, 0) / analysis.employees.length
                      const delta = e.hours - avgEmpHours
                      return (
                        <div
                          key={e.name}
                          className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                        >
                          <div>
                            <div className="font-medium text-sm">{e.name}</div>
                            <div className="text-xs text-gray-500">{e.runCount} run(s)</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-sm">{formatHours(e.hours)}</div>
                            {analysis.employees.length > 1 ? (
                              <div className={`text-xs ${delta > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {formatDelta(delta, ' u')} vs gem.
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {analysis.steps.length > 0 ? (
                <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Stappen (totaal)</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.steps.slice(0, 10).map((s) => (
                      <span
                        key={s.step}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs"
                      >
                        {s.step}
                        <span className="font-medium">{formatHours(s.hours)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

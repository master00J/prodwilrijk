'use client'

import type { PricingResult } from '@/lib/pricing-engine/types'
import { formatEuro } from '@/lib/pricing/client'

export default function PricingResultCard({ result }: { result: PricingResult }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Verkoopprijs per stuk</p>
          <p className="text-3xl font-bold text-emerald-800 tabular-nums">{formatEuro(result.pricePerUnit)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Totale verkoopprijs</p>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{formatEuro(result.salesPrice)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 text-sm">
        {[
          ['Materiaalkost', result.materialCost],
          ['Arbeidskost', result.laborCost],
          ['Extra materiaal', result.extraMaterialCost],
          ['Transport', result.transportCost],
          ['Overhead', result.overheadCost],
          ['Marge', result.marginAmount],
          ['Totale kost', result.totalCost],
        ].map(([label, amount]) => (
          <div key={label as string} className="rounded-lg bg-white/80 border border-gray-100 px-3 py-2">
            <p className="text-[10px] uppercase text-gray-400">{label}</p>
            <p className="font-semibold text-gray-800 tabular-nums">{formatEuro(amount as number)}</p>
          </div>
        ))}
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Prijsopbouw</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="py-2 pr-2">Post</th>
            <th className="py-2 text-right">Bedrag</th>
          </tr>
        </thead>
        <tbody>
          {result.breakdown.map((line) => (
            <tr key={line.label} className="border-b border-gray-50">
              <td className="py-2 text-gray-700">{line.label}</td>
              <td className="py-2 text-right font-medium tabular-nums">{formatEuro(line.amount)}</td>
            </tr>
          ))}
          <tr className="font-bold text-gray-900">
            <td className="py-2">Totaal verkoop</td>
            <td className="py-2 text-right tabular-nums">{formatEuro(result.salesPrice)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

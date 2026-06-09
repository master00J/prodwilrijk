'use client'

import { SPECIAL_PACK_LABEL } from '@/lib/airtec/special-pack-items'

export default function SpecialPackBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center font-semibold text-teal-900 bg-teal-100 border border-teal-300 rounded-full whitespace-nowrap ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
      title={SPECIAL_PACK_LABEL}
    >
      📦 {compact ? 'Speciaal' : SPECIAL_PACK_LABEL}
    </span>
  )
}

'use client'

import { ReactNode } from 'react'

export type SectionKey =
  | 'filters'
  | 'chartOutput'
  | 'chartRevenue'
  | 'chartMaterial'
  | 'chartIncoming'
  | 'productivity'
  | 'people'
  | 'details'
  | 'daily'

type Props = {
  id: SectionKey
  title: string
  subtitle?: string
  children: ReactNode
  isCollapsed: boolean
  onToggle: () => void
}

export default function CollapsibleCard({ id, title, subtitle, children, isCollapsed, onToggle }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-4 text-left"
      >
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
        </div>
        <span className="text-sm text-gray-500 whitespace-nowrap">
          {isCollapsed ? 'Uitklappen' : 'Inklappen'}
        </span>
      </button>
      {!isCollapsed && <div className="mt-4">{children}</div>}
    </div>
  )
}

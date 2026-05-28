'use client'

import { Loader2 } from 'lucide-react'
import { avatarColor, LEVELS, STATUSES } from '@/lib/competentie-matrix/constants'

interface EmployeeLike { id: number; name: string }

export function Avatar({ employee, size = 'md' }: { employee: EmployeeLike; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'sm' ? 'w-6 h-6 text-xs' : size === 'lg' ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm'
  return (
    <span className={`${sz} rounded-full ${avatarColor(employee.id)} text-white font-bold flex items-center justify-center shrink-0 select-none`}>
      {employee.name.charAt(0).toUpperCase()}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find((x) => x.value === status) ?? STATUSES[0]
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  )
}

export function LevelCell({ level, onClick, saving }: { level: number; onClick: () => void; saving?: boolean }) {
  const l = LEVELS[level] ?? LEVELS[0]
  if (saving) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300" />
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={l.desc}
      className={`w-full h-full flex items-center justify-center rounded transition-colors cursor-pointer ${l.cell}`}
    >
      {level === 0
        ? <span className="text-gray-300 text-sm select-none">·</span>
        : <span className={`text-xs font-bold select-none ${l.text}`}>{l.label}</span>
      }
    </button>
  )
}

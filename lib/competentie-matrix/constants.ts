export const LEVELS = [
  { value: 0, label: '—',  desc: 'Geen kennis',   bg: 'bg-gray-100',    text: 'text-gray-400',  ring: '',                  dot: 'bg-gray-200',   cell: 'bg-gray-50 hover:bg-gray-100' },
  { value: 1, label: '1',  desc: 'In opleiding',  bg: 'bg-yellow-100',  text: 'text-yellow-700', ring: 'ring-yellow-300',   dot: 'bg-yellow-400', cell: 'bg-yellow-50 hover:bg-yellow-100' },
  { value: 2, label: '2',  desc: 'Basiskennis',   bg: 'bg-blue-100',    text: 'text-blue-700',  ring: 'ring-blue-300',     dot: 'bg-blue-400',   cell: 'bg-blue-50 hover:bg-blue-100' },
  { value: 3, label: '3',  desc: 'Gevorderd',     bg: 'bg-indigo-100',  text: 'text-indigo-700', ring: 'ring-indigo-300',  dot: 'bg-indigo-500', cell: 'bg-indigo-50 hover:bg-indigo-100' },
  { value: 4, label: '4',  desc: 'Expert',        bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-300', dot: 'bg-emerald-500', cell: 'bg-emerald-50 hover:bg-emerald-100' },
] as const

export const STATUSES = [
  { value: 'aanwezig',  label: 'Aanwezig',  short: 'A',  color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-400', ring: 'ring-emerald-400', border: 'border-l-emerald-500' },
  { value: 'afwezig',   label: 'Afwezig',   short: 'AF', color: 'bg-red-100 text-red-800 border-red-200',             dot: 'bg-red-400',     ring: 'ring-red-400',     border: 'border-l-red-500' },
  { value: 'verlof',    label: 'Verlof',    short: 'V',  color: 'bg-blue-100 text-blue-800 border-blue-200',          dot: 'bg-blue-400',    ring: 'ring-blue-400',    border: 'border-l-blue-500' },
  { value: 'ziek',      label: 'Ziek',      short: 'Z',  color: 'bg-orange-100 text-orange-800 border-orange-200',    dot: 'bg-orange-400',  ring: 'ring-orange-400',  border: 'border-l-orange-500' },
  { value: 'thuiswerk', label: 'Thuiswerk', short: 'TW', color: 'bg-purple-100 text-purple-800 border-purple-200',    dot: 'bg-purple-400',  ring: 'ring-purple-400',  border: 'border-l-purple-500' },
] as const

export const SHIFTS = [
  { value: 'dag',   label: 'Dag',   full: 'Dagdienst',   color: 'bg-blue-50   text-blue-700   border-blue-200'   },
  { value: 'vroeg', label: 'Vroeg', full: 'Vroegdienst', color: 'bg-amber-50  text-amber-700  border-amber-200'  },
  { value: 'laat',  label: 'Laat',  full: 'Laatedienst', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'nacht', label: 'Nacht', full: 'Nachtdienst', color: 'bg-slate-100 text-slate-700  border-slate-200'  },
] as const

export const CATEGORIES = ['machine', 'werkplek', 'overig'] as const

export const AVATAR_COLORS = [
  'bg-blue-500','bg-indigo-500','bg-violet-500','bg-purple-500',
  'bg-pink-500','bg-rose-500','bg-orange-500','bg-amber-500',
  'bg-teal-500','bg-cyan-500','bg-sky-500','bg-emerald-500',
]

export const toDateInput = (d: Date) => d.toISOString().split('T')[0]

export const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length]

export function formatPlanningDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('nl-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function isPresentStatus(status: string): boolean {
  return !status || status === 'aanwezig' || status === 'thuiswerk'
}

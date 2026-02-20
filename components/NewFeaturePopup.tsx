'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, LayoutGrid, CalendarDays, ShieldAlert, ArrowRight } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'

const POPUP_KEY = 'seen_feature_competentie_matrix_v1'
// Gebruikersnamen die de popup te zien krijgen
const TARGET_USERNAMES = ['nvandamme']

/** Haalt de username op uit het interne email-formaat "username@system.local" */
function getUsernameFromEmail(email: string | undefined): string {
  if (!email) return ''
  return email.split('@')[0].toLowerCase()
}

export default function NewFeaturePopup() {
  const { user, loading } = useAuth()
  const [visible, setVisible] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (loading || !user) return
    const username = getUsernameFromEmail(user.email)
    if (!TARGET_USERNAMES.includes(username)) return
    if (typeof window !== 'undefined' && localStorage.getItem(POPUP_KEY)) return
    // Korte vertraging zodat de pagina eerst volledig geladen is
    const t = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(t)
  }, [user, loading])

  const dismiss = () => {
    if (typeof window !== 'undefined') localStorage.setItem(POPUP_KEY, '1')
    setVisible(false)
  }

  const goToFeature = () => {
    dismiss()
    router.push('/admin/competentie-matrix')
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">

        {/* Header gradient */}
        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 px-6 pt-6 pb-10">
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 text-white text-xs font-semibold px-3 py-1 mb-3">
            ✨ Nieuw
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight">
            Competentie Matrix
          </h2>
          <p className="mt-2 text-blue-100 text-sm leading-relaxed">
            Een volledig nieuw onderdeel om de kennis en inzetbaarheid van medewerkers per machine of werkplek bij te houden.
          </p>
        </div>

        {/* Decorative overlap card */}
        <div className="relative -mt-5 mx-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <LayoutGrid className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-sm text-gray-700">
              Beschikbaar via <span className="font-semibold text-gray-900">Admin → Competentie Matrix</span>
            </div>
          </div>
        </div>

        {/* Feature list */}
        <div className="px-6 pt-4 pb-2 space-y-3">
          {[
            {
              icon: <LayoutGrid className="w-4 h-4 text-indigo-600" />,
              bg: 'bg-indigo-50',
              title: 'Competentie Matrix',
              desc: 'Stel per medewerker en machine het niveau in (opleiding → expert). Klik op een cel om aan te passen.',
            },
            {
              icon: <ShieldAlert className="w-4 h-4 text-red-500" />,
              bg: 'bg-red-50',
              title: 'Coverage & risico-analyse',
              desc: 'Automatische waarschuwing als een machine minder dan 2 gekwalificeerde medewerkers heeft.',
            },
            {
              icon: <CalendarDays className="w-4 h-4 text-emerald-600" />,
              bg: 'bg-emerald-50',
              title: 'Dagplanning',
              desc: 'Zet medewerkers per dag op aanwezig/afwezig en wijs ze toe aan een machine of werkplek.',
            },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg ${f.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                {f.icon}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{f.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-4 flex gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Later bekijken
          </button>
          <button
            type="button"
            onClick={goToFeature}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Bekijk nu
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  )
}

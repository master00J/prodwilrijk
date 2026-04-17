'use client'

import { useState } from 'react'
import Link from 'next/link'

const HOUTSOORTEN = ['SXT', 'SCH', 'NHV', 'OSB', 'MEP', 'HDB']

interface AddWoodFormState {
  houtsoort: string
  pakketnummer: string
  dikte: string
  breedte: string
  lengte: string
  locatie: string
  aantal: string
}

const INITIAL_STATE: AddWoodFormState = {
  houtsoort: '',
  pakketnummer: '',
  dikte: '',
  breedte: '',
  lengte: '',
  locatie: '',
  aantal: '',
}

interface RecentAdd {
  id: number
  houtsoort: string
  pakketnummer: string
  dikte: number
  breedte: number
  lengte: number
  locatie: string
  aantal: number
  ontvangen_op: string
}

export default function AddWoodPage() {
  const [form, setForm] = useState<AddWoodFormState>(INITIAL_STATE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [recent, setRecent] = useState<RecentAdd[]>([])

  const handleChange = (field: keyof AddWoodFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setForm((prev) => ({
      ...INITIAL_STATE,
      // Houd houtsoort/locatie aan: meestal staat de gebruiker bij dezelfde stapel
      houtsoort: prev.houtsoort,
      locatie: prev.locatie,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!form.houtsoort) {
      setError('Selecteer een houtsoort')
      return
    }
    if (!form.locatie.trim()) {
      setError('Vul een locatie in')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/wood/add-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          houtsoort: form.houtsoort,
          pakketnummer: form.pakketnummer.trim() || null,
          dikte: form.dikte,
          breedte: form.breedte,
          lengte: form.lengte,
          locatie: form.locatie,
          aantal: form.aantal,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Toevoegen mislukt')
      }

      const row: RecentAdd = payload.data
      setRecent((prev) => [row, ...prev].slice(0, 10))
      setSuccess(
        `Toegevoegd: ${row.aantal}× ${row.houtsoort} ${row.dikte}×${row.breedte}×${row.lengte} @ ${row.locatie}`
      )
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toevoegen mislukt')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Add Wood</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Voeg hier manueel een pakket/plank-stapel rechtstreeks toe aan de voorraad. Gebruik dit enkel
              wanneer het hout bij aankomst niet correct verwerkt is en alsnog moet worden nageboekt. Het
              item verschijnt meteen op de{' '}
              <Link href="/wood/picking" className="text-amber-600 hover:underline font-medium">
                Wood Picking
              </Link>{' '}
              pagina.
            </p>
          </div>
          <Link
            href="/wood/picking"
            className="shrink-0 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 text-sm font-medium"
          >
            → Wood Picking
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Houtsoort *</label>
            <select
              value={form.houtsoort}
              onChange={(e) => handleChange('houtsoort', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-black"
              required
            >
              <option value="">Selecteer houtsoort</option>
              {HOUTSOORTEN.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pakketnummer <span className="text-gray-400 font-normal">(optioneel)</span>
            </label>
            <input
              type="text"
              value={form.pakketnummer}
              onChange={(e) => handleChange('pakketnummer', e.target.value)}
              placeholder="Laat leeg voor MANUAL-YYYYMMDD-HHMMSS"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-black placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dikte (mm) *</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.dikte}
              onChange={(e) => handleChange('dikte', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-black"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Breedte (mm) *</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.breedte}
              onChange={(e) => handleChange('breedte', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-black"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lengte (mm) *</label>
            <input
              type="number"
              step="1"
              min="0"
              value={form.lengte}
              onChange={(e) => handleChange('lengte', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-black"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Locatie *</label>
            <input
              type="text"
              value={form.locatie}
              onChange={(e) => handleChange('locatie', e.target.value)}
              placeholder="bv. A1, B12, magazijn..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-black placeholder:text-gray-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aantal planken *</label>
            <input
              type="number"
              step="1"
              min="1"
              value={form.aantal}
              onChange={(e) => handleChange('aantal', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-black"
              required
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setForm(INITIAL_STATE)
              setError(null)
              setSuccess(null)
            }}
            disabled={submitting}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Leegmaken
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {submitting ? 'Toevoegen...' : 'Toevoegen aan stock'}
          </button>
        </div>
      </form>

      {recent.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Recent toegevoegd (deze sessie)</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Houtsoort</th>
                  <th className="px-3 py-2 text-left">Pakket</th>
                  <th className="px-3 py-2 text-left">Dx B x L</th>
                  <th className="px-3 py-2 text-left">Aantal</th>
                  <th className="px-3 py-2 text-left">Locatie</th>
                  <th className="px-3 py-2 text-left">Tijdstip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-medium text-gray-900">{r.houtsoort}</td>
                    <td className="px-3 py-2 text-gray-700">{r.pakketnummer}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {r.dikte}×{r.breedte}×{r.lengte}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.aantal}</td>
                    <td className="px-3 py-2 text-gray-700">{r.locatie}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {new Date(r.ontvangen_op).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

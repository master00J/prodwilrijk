'use client'

import { useState, useEffect, useCallback } from 'react'

interface CNHMotor {
  id: number
  motor_nr: string
  location?: string
  shipping_note?: string
  state: 'received' | 'packaged' | 'loaded'
  received_at?: string
}

export default function CNHVerifyPage() {
  const [shippingNote, setShippingNote] = useState('')
  const [motors, setMotors] = useState<CNHMotor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const [searchPerformed, setSearchPerformed] = useState(false)

  const searchByShippingNote = useCallback(async () => {
    if (!shippingNote.trim()) {
      setError('Voer een verzendnota in')
      return
    }

    setLoading(true)
    setError(null)
    setSearchPerformed(false)
    setVerified(false)

    try {
      const resp = await fetch(`/api/cnh/motors?shippingNote=${encodeURIComponent(shippingNote.trim())}`)
      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Fout bij ophalen motoren')
      }

      setMotors(data || [])
      setSearchPerformed(true)

      if (data.length === 0) {
        setError('Geen motoren gevonden voor deze verzendnota')
      }
    } catch (e: any) {
      console.error(e)
      setError('Fout bij ophalen motoren: ' + e.message)
      setMotors([])
    } finally {
      setLoading(false)
    }
  }, [shippingNote])

  const handleVerify = useCallback(() => {
    if (motors.length === 0) {
      setError('Geen motoren om te verifiëren')
      return
    }
    setVerified(true)
    setError(null)
  }, [motors])

  const handleReset = useCallback(() => {
    setShippingNote('')
    setMotors([])
    setVerified(false)
    setError(null)
    setSearchPerformed(false)
  }, [])

  // Auto-focus on shipping note input
  useEffect(() => {
    const input = document.getElementById('shippingNoteInput')
    if (input) {
      input.focus()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 text-gray-800">
            CNH Verificatie
          </h1>
          <p className="text-xl text-gray-600">
            Controleer motoren bij lossen camion
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-xl shadow-xl p-8 mb-6 border-2 border-blue-200">
          <h2 className="text-3xl font-semibold mb-6 text-gray-700 text-center">
            Verzendnota Opzoeken
          </h2>
          
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xl font-medium text-gray-700 mb-3">
                Verzendnota Nummer
              </label>
              <input
                id="shippingNoteInput"
                type="text"
                value={shippingNote}
                onChange={(e) => setShippingNote(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    searchByShippingNote()
                  }
                }}
                placeholder="Voer verzendnota in (bijv. 138197)"
                className="w-full px-6 py-5 text-3xl border-3 border-gray-400 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500 focus:border-blue-500 text-center font-semibold"
                disabled={loading}
                autoFocus
              />
            </div>
            <button
              onClick={searchByShippingNote}
              disabled={loading || !shippingNote.trim()}
              className="w-full md:w-auto px-10 py-5 bg-blue-600 text-white text-2xl font-bold rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed min-w-[200px] shadow-lg transform hover:scale-105 transition-transform"
            >
              {loading ? 'Zoeken...' : '🔍 Zoeken'}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* Success/Verified Message */}
        {verified && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded">
            <p className="font-semibold text-xl">✅ Alle motoren geverifieerd!</p>
          </div>
        )}

        {/* Motors List */}
        {searchPerformed && motors.length > 0 && (
          <div className="bg-white rounded-xl shadow-xl p-8 mb-6 border-2 border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <h2 className="text-3xl font-semibold text-gray-700">
                Gevonden Motoren ({motors.length})
              </h2>
              {!verified && (
                <button
                  onClick={handleVerify}
                  className="w-full md:w-auto px-8 py-4 bg-green-600 text-white text-xl font-bold rounded-xl hover:bg-green-700 shadow-lg transform hover:scale-105 transition-transform"
                >
                  ✅ Alles Verifiëren
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {motors.map((motor, index) => (
                <div
                  key={motor.id}
                  className={`p-6 rounded-xl border-3 transition-all ${
                    verified
                      ? 'bg-green-100 border-green-400 shadow-lg'
                      : 'bg-gray-50 border-gray-400 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-1">Motor #{index + 1}</p>
                      <p className={`text-3xl font-bold ${
                        verified ? 'text-green-800' : 'text-gray-800'
                      }`}>
                        {motor.motor_nr}
                      </p>
                      {motor.location && (
                        <p className="text-base text-gray-600 mt-2 font-medium">
                          📍 {motor.location}
                        </p>
                      )}
                    </div>
                    {verified && (
                      <div className="text-4xl ml-4">✅</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reset Button */}
        {searchPerformed && (
          <div className="text-center">
            <button
              onClick={handleReset}
              className="px-10 py-5 bg-gray-600 text-white text-xl font-bold rounded-xl hover:bg-gray-700 shadow-lg transform hover:scale-105 transition-transform"
            >
              🔄 Nieuwe Zoekopdracht
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


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

interface ShippingNote {
  shipping_note: string
  motor_count: number
  received_at: string | null
}

export default function CNHVerifyPage() {
  const [shippingNotes, setShippingNotes] = useState<ShippingNote[]>([])
  const [selectedShippingNote, setSelectedShippingNote] = useState<string | null>(null)
  const [motors, setMotors] = useState<CNHMotor[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)

  // Load all shipping notes on mount
  useEffect(() => {
    const fetchShippingNotes = async () => {
      setLoadingNotes(true)
      try {
        const resp = await fetch('/api/cnh/shipping-notes')
        const data = await resp.json()

        if (!resp.ok) {
          throw new Error(data.error || 'Fout bij ophalen verzendnota\'s')
        }

        setShippingNotes(data || [])
      } catch (e: any) {
        console.error(e)
        setError('Fout bij ophalen verzendnota\'s: ' + e.message)
      } finally {
        setLoadingNotes(false)
      }
    }

    fetchShippingNotes()
  }, [])

  const loadMotorsForShippingNote = useCallback(async (note: string) => {
    setSelectedShippingNote(note)
    setLoading(true)
    setError(null)
    setVerified(false)

    try {
      const resp = await fetch(`/api/cnh/motors?shippingNote=${encodeURIComponent(note)}`)
      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Fout bij ophalen motoren')
      }

      setMotors(data || [])

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
  }, [])

  const handleVerify = useCallback(() => {
    if (motors.length === 0) {
      setError('Geen motoren om te verifiëren')
      return
    }
    setVerified(true)
    setError(null)
  }, [motors])

  const handleReset = useCallback(() => {
    setSelectedShippingNote(null)
    setMotors([])
    setVerified(false)
    setError(null)
  }, [])

  const formatDate = useCallback((dateString: string | null) => {
    if (!dateString) return 'Onbekend'
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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

        {/* Shipping Notes List */}
        {!selectedShippingNote && (
          <div className="bg-white rounded-xl shadow-xl p-8 mb-6 border-2 border-blue-200">
            <h2 className="text-3xl font-semibold mb-6 text-gray-700 text-center">
              Beschikbare Verzendnota's
            </h2>
            
            {loadingNotes ? (
              <div className="text-center py-8">
                <p className="text-xl text-gray-600">Laden...</p>
              </div>
            ) : shippingNotes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xl text-gray-600">Geen verzendnota's gevonden</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shippingNotes.map((note) => (
                  <button
                    key={note.shipping_note}
                    onClick={() => loadMotorsForShippingNote(note.shipping_note)}
                    className="p-6 bg-blue-50 border-2 border-blue-300 rounded-xl hover:bg-blue-100 hover:border-blue-400 hover:shadow-lg transition-all text-left"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-3xl font-bold text-blue-800">
                        {note.shipping_note}
                      </p>
                      <span className="text-lg font-semibold text-blue-600">
                        {note.motor_count} {note.motor_count === 1 ? 'motor' : 'motoren'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Ontvangen: {formatDate(note.received_at)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
        {selectedShippingNote && (
          <div className="bg-white rounded-xl shadow-xl p-8 mb-6 border-2 border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <div>
                <h2 className="text-3xl font-semibold text-gray-700">
                  Verzendnota: {selectedShippingNote}
                </h2>
                <p className="text-lg text-gray-600 mt-1">
                  {loading ? 'Laden...' : `${motors.length} ${motors.length === 1 ? 'motor' : 'motoren'}`}
                </p>
              </div>
              <div className="flex gap-2">
                {!verified && motors.length > 0 && (
                  <button
                    onClick={handleVerify}
                    className="w-full md:w-auto px-8 py-4 bg-green-600 text-white text-xl font-bold rounded-xl hover:bg-green-700 shadow-lg transform hover:scale-105 transition-transform"
                  >
                    ✅ Alles Verifiëren
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="w-full md:w-auto px-8 py-4 bg-gray-600 text-white text-xl font-bold rounded-xl hover:bg-gray-700 shadow-lg transform hover:scale-105 transition-transform"
                >
                  ← Terug
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <p className="text-xl text-gray-600">Motoren laden...</p>
              </div>
            ) : motors.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xl text-gray-600">Geen motoren gevonden</p>
              </div>
            ) : (
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
            )}
          </div>
        )}
      </div>
    </div>
  )
}


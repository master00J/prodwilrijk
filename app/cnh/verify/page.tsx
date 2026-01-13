'use client'

import { useState, useEffect, useCallback } from 'react'

interface CNHMotor {
  id: number
  motor_nr: string
  location?: string
  shipping_note?: string
  state: 'to_check' | 'received' | 'packaged' | 'loaded'
  received_at?: string
}

interface ShippingNote {
  shipping_note: string
  motor_count: number
  to_check_count: number
  received_at: string | null
}

export default function CNHVerifyPage() {
  const [shippingNotes, setShippingNotes] = useState<ShippingNote[]>([])
  const [selectedShippingNote, setSelectedShippingNote] = useState<string | null>(null)
  const [editingShippingNote, setEditingShippingNote] = useState<string>('')
  const [motors, setMotors] = useState<CNHMotor[]>([])
  const [editingMotors, setEditingMotors] = useState<Record<number, { motor_nr: string; location: string }>>({})
  const [loading, setLoading] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)

  // Load all shipping notes on mount
  useEffect(() => {
    const fetchShippingNotes = async () => {
      setLoadingNotes(true)
      try {
        const resp = await fetch('/api/cnh/shipping-notes')
        const data = await resp.json()

        if (!resp.ok) {
          throw new Error(data.error || 'Fout bij ophalen verzendnota&apos;s')
        }

        setShippingNotes(data || [])
      } catch (e: any) {
        console.error(e)
        setError('Fout bij ophalen verzendnota&apos;s: ' + e.message)
      } finally {
        setLoadingNotes(false)
      }
    }

    fetchShippingNotes()
  }, [])

  const loadMotorsForShippingNote = useCallback(async (note: string) => {
    setSelectedShippingNote(note)
    setEditingShippingNote(note)
    setLoading(true)
    setError(null)
    setSuccess(null)
    setVerified(false)
    setEditingMotors({})

    try {
      // Get all motors for this shipping note (including to_check and received)
      const resp = await fetch(`/api/cnh/motors?shippingNote=${encodeURIComponent(note)}`)
      const data = await resp.json()

      if (!resp.ok) {
        throw new Error(data.error || 'Fout bij ophalen motoren')
      }

      // Filter to only show 'to_check' motors (those that need verification)
      const toCheckMotors = (data || []).filter((motor: CNHMotor) => motor.state === 'to_check')
      setMotors(toCheckMotors)
      
      // Initialize editing state with current values
      const editingState: Record<number, { motor_nr: string; location: string }> = {}
      toCheckMotors.forEach((motor: CNHMotor) => {
        editingState[motor.id] = {
          motor_nr: motor.motor_nr,
          location: motor.location || '',
        }
      })
      setEditingMotors(editingState)

      if (toCheckMotors.length === 0) {
        if (data.length > 0) {
          setError('Alle motoren voor deze verzendnota zijn al geverifieerd')
        } else {
          setError('Geen motoren gevonden voor deze verzendnota')
        }
      }
    } catch (e: any) {
      console.error(e)
      setError('Fout bij ophalen motoren: ' + e.message)
      setMotors([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleVerify = useCallback(async () => {
    if (motors.length === 0) {
      setError('Geen motoren om te verifiëren')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Update all motors to 'received' status
      const updatePromises = motors.map((motor) =>
        fetch(`/api/cnh/motors/${motor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: 'received',
          }),
        })
      )

      await Promise.all(updatePromises)

      setVerified(true)
      setSuccess('Motoren succesvol geverifieerd en gemarkeerd als ontvangen!')
      
      // Reload shipping notes list to remove fully verified ones
      const notesResp = await fetch('/api/cnh/shipping-notes')
      const notesData = await notesResp.json()
      if (notesResp.ok) {
        setShippingNotes(notesData || [])
      }

      // If this shipping note is now fully verified, go back to list
      setTimeout(() => {
        handleReset()
      }, 2000)
    } catch (e: any) {
      console.error(e)
      setError('Fout bij verifiëren: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [motors])

  const handleReset = useCallback(async () => {
    setSelectedShippingNote(null)
    setEditingShippingNote('')
    setMotors([])
    setEditingMotors({})
    setVerified(false)
    setError(null)
    setSuccess(null)
    
    // Reload shipping notes to refresh the list (remove fully verified ones)
    try {
      const resp = await fetch('/api/cnh/shipping-notes')
      const data = await resp.json()
      if (resp.ok) {
        setShippingNotes(data || [])
      }
    } catch (e) {
      console.error('Error refreshing shipping notes:', e)
    }
  }, [])

  const updateMotorField = useCallback((motorId: number, field: 'motor_nr' | 'location', value: string) => {
    setEditingMotors((prev) => ({
      ...prev,
      [motorId]: {
        ...prev[motorId],
        [field]: value,
      },
    }))
  }, [])

  const saveChanges = useCallback(async () => {
    if (!selectedShippingNote) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Update shipping note if changed
      if (editingShippingNote !== selectedShippingNote) {
        // Update all motors with the new shipping note
        const updatePromises = motors.map((motor) =>
          fetch(`/api/cnh/motors/${motor.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shipping_note: editingShippingNote.trim(),
            }),
          })
        )
        await Promise.all(updatePromises)
      }

      // Update all motors with their edited values
      const updatePromises = motors.map((motor) => {
        const edited = editingMotors[motor.id]
        if (!edited) return Promise.resolve()

        const updates: any = {}
        if (edited.motor_nr !== motor.motor_nr) {
          updates.motor_nr = edited.motor_nr.trim()
        }
        if (edited.location !== (motor.location || '')) {
          updates.location = edited.location.trim() || null
        }

        if (Object.keys(updates).length === 0) {
          return Promise.resolve()
        }

        return fetch(`/api/cnh/motors/${motor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
      })

      await Promise.all(updatePromises)

      // Reload motors to get updated data
      await loadMotorsForShippingNote(editingShippingNote.trim() || selectedShippingNote)
      
      setSuccess('Wijzigingen succesvol opgeslagen!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (e: any) {
      console.error(e)
      setError('Fout bij opslaan wijzigingen: ' + e.message)
    } finally {
      setSaving(false)
    }
  }, [selectedShippingNote, editingShippingNote, motors, editingMotors, loadMotorsForShippingNote])

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
              Beschikbare Verzendnota&apos;s
            </h2>
            
            {loadingNotes ? (
              <div className="text-center py-8">
                <p className="text-xl text-gray-600">Laden...</p>
              </div>
            ) : shippingNotes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xl text-gray-600">Geen verzendnota&apos;s gevonden</p>
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
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-lg font-semibold text-blue-600">
                          {note.motor_count} {note.motor_count === 1 ? 'motor' : 'motoren'}
                        </span>
                        {note.to_check_count > 0 && (
                          <span className="text-sm font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded">
                            {note.to_check_count} te verifiëren
                          </span>
                        )}
                        {note.to_check_count === 0 && (
                          <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                            ✅ Geverifieerd
                          </span>
                        )}
                      </div>
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

        {/* Success Message */}
        {success && (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded">
            <p className="font-semibold text-xl">✅ {success}</p>
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
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verzendnota
                </label>
                <input
                  type="text"
                  value={editingShippingNote}
                  onChange={(e) => setEditingShippingNote(e.target.value)}
                  className="w-full px-4 py-3 text-2xl font-semibold border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Verzendnota nummer"
                />
                <p className="text-lg text-gray-600 mt-2">
                  {loading ? 'Laden...' : `${motors.length} ${motors.length === 1 ? 'motor' : 'motoren'}`}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="w-full md:w-auto px-8 py-4 bg-blue-600 text-white text-xl font-bold rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 transition-transform"
                >
                  {saving ? 'Opslaan...' : '💾 Opslaan'}
                </button>
                {!verified && motors.length > 0 && (
                  <button
                    onClick={handleVerify}
                    className="w-full md:w-auto px-8 py-4 bg-green-600 text-white text-xl font-bold rounded-xl hover:bg-green-700 shadow-lg transform hover:scale-105 transition-transform"
                  >
                    ✅ Verifiëren
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
                {motors.map((motor, index) => {
                  const edited = editingMotors[motor.id] || { motor_nr: motor.motor_nr, location: motor.location || '' }
                  const hasChanges = edited.motor_nr !== motor.motor_nr || edited.location !== (motor.location || '')
                  
                  return (
                    <div
                      key={motor.id}
                      className={`p-6 rounded-xl border-3 transition-all ${
                        verified
                          ? 'bg-green-100 border-green-400 shadow-lg'
                          : hasChanges
                          ? 'bg-yellow-50 border-yellow-400 shadow-md'
                          : 'bg-gray-50 border-gray-400 hover:shadow-md'
                      }`}
                    >
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600">Motor #{index + 1}</p>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Motornummer
                          </label>
                          <input
                            type="text"
                            value={edited.motor_nr}
                            onChange={(e) => updateMotorField(motor.id, 'motor_nr', e.target.value)}
                            className={`w-full px-3 py-2 text-2xl font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              hasChanges && edited.motor_nr !== motor.motor_nr
                                ? 'border-yellow-500 bg-yellow-50'
                                : 'border-gray-300'
                            }`}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Locatie
                          </label>
                          <select
                            value={edited.location}
                            onChange={(e) => updateMotorField(motor.id, 'location', e.target.value)}
                            className={`w-full px-3 py-2 text-lg font-medium border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              hasChanges && edited.location !== (motor.location || '')
                                ? 'border-yellow-500 bg-yellow-50'
                                : 'border-gray-300'
                            }`}
                          >
                            <option value="">Selecteer locatie...</option>
                            <option value="China">China</option>
                            <option value="Amerika">Amerika</option>
                            <option value="UZB">UZB</option>
                            <option value="Other">Anders</option>
                          </select>
                        </div>
                        
                        {hasChanges && (
                          <p className="text-xs text-yellow-700 font-medium">
                            ⚠️ Gewijzigd
                          </p>
                        )}
                        
                        {verified && (
                          <div className="text-center text-3xl">✅</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


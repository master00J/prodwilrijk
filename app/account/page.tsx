'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

function AccountForm() {
  const searchParams = useSearchParams()
  const isAdminReset = searchParams.get('reason') === 'password-reset'

  const [isRecovery, setIsRecovery] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const skipCurrentPassword = isAdminReset || isRecovery

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setIsRecovery(true)
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (newPassword.length < 8) {
      setError('Nieuw wachtwoord moet minstens 8 tekens bevatten.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Nieuw wachtwoord en bevestiging komen niet overeen.')
      return
    }

    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.user) {
        setError('Geen actieve sessie gevonden. Log opnieuw in via de reset-link in je e-mail.')
        return
      }

      if (!skipCurrentPassword) {
        const email = sessionData.session.user.email
        if (!email) {
          setError('Geen e-mailadres gekoppeld aan dit account.')
          return
        }

        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        })
        if (reauthError) {
          setError('Huidig wachtwoord is onjuist.')
          return
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        setError(updateError.message || 'Wachtwoord wijzigen mislukt.')
        return
      }

      await fetch('/api/auth/clear-password-flag', { method: 'POST' })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Wachtwoord succesvol aangepast!')

      setTimeout(() => {
        window.location.href = '/'
      }, 1500)
    } catch (err: unknown) {
      console.error('Password update error:', err)
      setError(err instanceof Error ? err.message : 'Wachtwoord wijzigen mislukt.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-2xl font-semibold mb-2">Account</h1>

        {isAdminReset ? (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded mb-4">
            <p className="font-medium">Je wachtwoord is gereset door een admin.</p>
            <p className="text-sm mt-1">Kies een nieuw wachtwoord om verder te gaan.</p>
          </div>
        ) : isRecovery ? (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4">
            <p className="font-medium">Wachtwoord reset via e-mail.</p>
            <p className="text-sm mt-1">Kies hier je nieuwe wachtwoord.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-600 mb-6">Wijzig je wachtwoord.</p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!skipCurrentPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Huidig wachtwoord
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nieuw wachtwoord</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bevestig nieuw wachtwoord</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300 font-medium"
          >
            {loading ? 'Bezig...' : 'Wachtwoord wijzigen'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountForm />
    </Suspense>
  )
}

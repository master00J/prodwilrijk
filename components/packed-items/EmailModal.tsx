'use client'

import { useState } from 'react'

interface EmailModalProps {
  isOpen: boolean
  onClose: () => void
  dateFrom: string
  dateTo: string
  onSend: (email: string) => Promise<void>
}

export default function EmailModal({
  isOpen,
  onClose,
  dateFrom,
  dateTo,
  onSend,
}: EmailModalProps) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !email.includes('@')) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' })
      return
    }

    setSending(true)
    setMessage(null)

    try {
      await onSend(email)
      setMessage({ type: 'success', text: 'Email sent successfully!' })
      setTimeout(() => {
        onClose()
        setEmail('')
        setMessage(null)
      }, 2000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to send email' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Send Packed Items Report</h2>
        
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Date Range:</strong> {dateFrom ? new Date(dateFrom).toLocaleDateString() : 'All'} - {dateTo ? new Date(dateTo).toLocaleDateString() : 'All'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={sending}
            />
          </div>

          {message && (
            <div
              className={`mb-4 p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


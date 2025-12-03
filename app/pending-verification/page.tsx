'use client'

import { useAuth } from '@/components/AuthProvider'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PendingVerificationPage() {
  const { user, isVerified } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // If user becomes verified, redirect to home
    if (isVerified) {
      router.push('/')
    }
  }, [isVerified, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg text-center">
        <div className="text-yellow-500 text-6xl mb-4">⏳</div>
        <h2 className="text-2xl font-bold text-gray-900">Account Pending Verification</h2>
        <p className="text-gray-600">
          Your account has been created successfully, but it needs to be verified by an administrator before you can access the system.
        </p>
        <p className="text-gray-600">
          Please contact an administrator to verify your account.
        </p>
        {user && (
          <p className="text-sm text-gray-500 mt-4">
            Account: {user.email}
          </p>
        )}
        <div className="mt-6">
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  )
}


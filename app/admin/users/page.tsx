'use client'

import { useState, useEffect } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { supabase } from '@/lib/supabase/client'

interface User {
  id: string
  username: string
  role: string
  verified: boolean
  created_at: string
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers()
    // Auto-refresh every 30 seconds to catch new users
    const interval = setInterval(() => {
      fetchUsers()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      // Add timestamp to prevent caching
      const response = await fetch(`/api/admin/users?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error('Error fetching users:', error)
      alert('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/verify-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to verify user')
      }

      const result = await response.json()
      console.log('Verify result:', result)

      // Wait a bit to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Force refresh with timestamp
      await fetchUsers()
      
      alert('User verified successfully')
    } catch (error) {
      console.error('Error verifying user:', error)
      alert(`Failed to verify user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleUnverify = async (userId: string) => {
    if (!confirm('Are you sure you want to unverify this user?')) {
      return
    }

    try {
      const response = await fetch('/api/admin/verify-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, verified: false }),
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to unverify user')
      }

      // Wait a bit to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Force refresh with timestamp
      await fetchUsers()
      
      alert('User unverified successfully')
    } catch (error) {
      console.error('Error unverifying user:', error)
      alert(`Failed to unverify user: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch('/api/admin/change-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to change role')
      }

      // Wait a bit to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Force refresh with timestamp
      await fetchUsers()
      
      alert('Role updated successfully')
    } catch (error) {
      console.error('Error changing role:', error)
      alert(`Failed to change role: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  const unverifiedCount = users.filter(u => !u.verified).length

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">User Management</h1>
          {unverifiedCount > 0 && (
            <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg font-medium">
              {unverifiedCount} user{unverifiedCount !== 1 ? 's' : ''} pending verification
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Username</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className={!user.verified ? 'bg-yellow-50' : ''}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.username}</td>
                      <td className="px-4 py-3 text-sm">
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.id, e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.verified
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {user.verified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          {user.verified ? (
                            <button
                              onClick={() => handleUnverify(user.id)}
                              className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm font-medium"
                            >
                              Unverify
                            </button>
                          ) : (
                            <button
                              onClick={() => handleVerify(user.id)}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium"
                            >
                              Verify
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminGuard>
  )
}


'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthProvider'
import type { User } from '@supabase/supabase-js'

function UserInfo({ user, signOut }: { user: User; signOut: () => Promise<void> }) {
  const [username, setUsername] = useState<string>('Loading...')

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const response = await fetch(`/api/auth/current-user?userId=${encodeURIComponent(user.id)}`)
        if (response.ok) {
          const data = await response.json()
          setUsername(data.username || 'Unknown')
        }
      } catch (error) {
        console.error('Error fetching username:', error)
        setUsername('Unknown')
      }
    }
    fetchUsername()
  }, [user.id])

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-600">{username}</span>
      <button
        onClick={signOut}
        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium text-sm"
      >
        Logout
      </button>
    </div>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const { user, signOut, isAdmin } = useAuth()
  const [isPrepackOpen, setIsPrepackOpen] = useState(false)
  const [isAirtecOpen, setIsAirtecOpen] = useState(false)
  const [isAdminOpen, setIsAdminOpen] = useState(false)
  const prepackDropdownRef = useRef<HTMLDivElement>(null)
  const airtecDropdownRef = useRef<HTMLDivElement>(null)
  const adminDropdownRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string) => pathname === path

  const isPrepackPage = 
    pathname.startsWith('/prepack') || 
    pathname.startsWith('/view-prepack') || 
    pathname.startsWith('/confirmed-items') || 
    pathname.startsWith('/wms-import') || 
    pathname.startsWith('/items-to-pack') || 
    pathname.startsWith('/packed-items')

  const isAirtecPage = 
    pathname.startsWith('/airtec') ||
    pathname.startsWith('/view-airtec') || 
    pathname.startsWith('/items-to-pack-airtec') || 
    pathname.startsWith('/packed-items-airtec')

  const isAdminPage = 
    pathname.startsWith('/admin') || 
    pathname.startsWith('/employees')

  const isGroteInpakPage = pathname.startsWith('/grote-inpak')

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (prepackDropdownRef.current && !prepackDropdownRef.current.contains(event.target as Node)) {
        setIsPrepackOpen(false)
      }
      if (airtecDropdownRef.current && !airtecDropdownRef.current.contains(event.target as Node)) {
        setIsAirtecOpen(false)
      }
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setIsAdminOpen(false)
      }
    }

    if (isPrepackOpen || isAirtecOpen || isAdminOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPrepackOpen, isAirtecOpen, isAdminOpen])

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Home */}
          <Link href="/" className="text-2xl font-bold text-gray-800 hover:text-gray-600 transition-colors">
            Prodwilrijk V2
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            {user && (
              <>
                {/* Prepack Dropdown */}
            <div className="relative" ref={prepackDropdownRef}>
              <button
                onClick={() => setIsPrepackOpen(!isPrepackOpen)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                  isPrepackPage
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Prepack
                <svg
                  className={`ml-2 w-4 h-4 transition-transform ${isPrepackOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isPrepackOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
                  <div className="py-2">
                    <Link
                      href="/prepack"
                      onClick={() => setIsPrepackOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/prepack') ? 'bg-blue-50 text-blue-600 font-medium border-l-4 border-blue-500' : 'text-gray-700'
                      }`}
                    >
                      Prepack - Excel Upload (Status 10)
                    </Link>
                    <Link
                      href="/view-prepack"
                      onClick={() => setIsPrepackOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/view-prepack') ? 'bg-blue-50 text-blue-600 font-medium border-l-4 border-blue-500' : 'text-gray-700'
                      }`}
                    >
                      View Prepack - Confirm Items
                    </Link>
                    <Link
                      href="/confirmed-items"
                      onClick={() => setIsPrepackOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/confirmed-items') ? 'bg-blue-50 text-blue-600 font-medium border-l-4 border-blue-500' : 'text-gray-700'
                      }`}
                    >
                      Confirmed Items (WMS reference)
                    </Link>
                    <Link
                      href="/wms-import"
                      onClick={() => setIsPrepackOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/wms-import') ? 'bg-blue-50 text-blue-600 font-medium border-l-4 border-blue-500' : 'text-gray-700'
                      }`}
                    >
                      WMS Import - Status 30
                    </Link>
                    <Link
                      href="/items-to-pack"
                      onClick={() => setIsPrepackOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/items-to-pack') ? 'bg-blue-50 text-blue-600 font-medium border-l-4 border-blue-500' : 'text-gray-700'
                      }`}
                    >
                      Items to Pack
                    </Link>
                    <Link
                      href="/packed-items"
                      onClick={() => setIsPrepackOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/packed-items') ? 'bg-blue-50 text-blue-600 font-medium border-l-4 border-blue-500' : 'text-gray-700'
                      }`}
                    >
                      Packed Items
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Airtec Dropdown */}
            <div className="relative" ref={airtecDropdownRef}>
              <button
                onClick={() => setIsAirtecOpen(!isAirtecOpen)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                  isAirtecPage
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Airtec
                <svg
                  className={`ml-2 w-4 h-4 transition-transform ${isAirtecOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isAirtecOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
                  <div className="py-2">
                    <Link
                      href="/airtec"
                      onClick={() => setIsAirtecOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/airtec') ? 'bg-orange-50 text-orange-600 font-medium border-l-4 border-orange-500' : 'text-gray-700'
                      }`}
                    >
                      Airtec - Excel Upload
                    </Link>
                    <Link
                      href="/view-airtec"
                      onClick={() => setIsAirtecOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/view-airtec') ? 'bg-orange-50 text-orange-600 font-medium border-l-4 border-orange-500' : 'text-gray-700'
                      }`}
                    >
                      View Airtec - Confirm Items
                    </Link>
                    <Link
                      href="/items-to-pack-airtec"
                      onClick={() => setIsAirtecOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/items-to-pack-airtec') ? 'bg-orange-50 text-orange-600 font-medium border-l-4 border-orange-500' : 'text-gray-700'
                      }`}
                    >
                      Items to Pack Airtec
                    </Link>
                    <Link
                      href="/packed-items-airtec"
                      onClick={() => setIsAirtecOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/packed-items-airtec') ? 'bg-orange-50 text-orange-600 font-medium border-l-4 border-orange-500' : 'text-gray-700'
                      }`}
                    >
                      Packed Items Airtec
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Grote Inpak Link */}
            <Link
              href="/grote-inpak"
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isGroteInpakPage
                  ? 'bg-teal-500 text-white hover:bg-teal-600'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Grote Inpak
            </Link>

            {/* Admin Dropdown - Only show if user is admin */}
            {isAdmin && (
            <div className="relative" ref={adminDropdownRef}>
              <button
                onClick={() => setIsAdminOpen(!isAdminOpen)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                  isAdminPage
                    ? 'bg-purple-500 text-white hover:bg-purple-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Admin
                <svg
                  className={`ml-2 w-4 h-4 transition-transform ${isAdminOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isAdminOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
                  <div className="py-2">
                    <Link
                      href="/admin"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/admin') ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500' : 'text-gray-700'
                      }`}
                    >
                      Admin Dashboard
                    </Link>
                    <Link
                      href="/employees"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/employees') ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500' : 'text-gray-700'
                      }`}
                    >
                      Employees
                    </Link>
                    <Link
                      href="/admin/users"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/admin/users') ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500' : 'text-gray-700'
                      }`}
                    >
                      User Management
                    </Link>
                    <Link
                      href="/admin/airtec-prices"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/admin/airtec-prices') ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500' : 'text-gray-700'
                      }`}
                    >
                      Airtec Prices & ERP Codes
                    </Link>
                  </div>
                </div>
              )}
            </div>
            )}
              </>
            )}

            {/* User Info and Logout */}
            {user && <UserInfo user={user} signOut={signOut} />}
          </div>
        </div>
      </div>
    </nav>
  )
}


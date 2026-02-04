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
      <Link
        href="/account"
        className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
      >
        Account
      </Link>
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
  const [isWoodOpen, setIsWoodOpen] = useState(false)
  const [isVariaOpen, setIsVariaOpen] = useState(false)
  const [isAdminOpen, setIsAdminOpen] = useState(false)
  const [isCNHOpen, setIsCNHOpen] = useState(false)
  const prepackDropdownRef = useRef<HTMLDivElement>(null)
  const airtecDropdownRef = useRef<HTMLDivElement>(null)
  const woodDropdownRef = useRef<HTMLDivElement>(null)
  const variaDropdownRef = useRef<HTMLDivElement>(null)
  const adminDropdownRef = useRef<HTMLDivElement>(null)
  const cnhDropdownRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string) => pathname === path

  const isPrepackPage = 
    pathname.startsWith('/prepack') || 
    pathname.startsWith('/view-prepack') || 
    pathname.startsWith('/prepack-compare') ||
    pathname.startsWith('/bestellingen-algemeen') ||
    pathname.startsWith('/confirmed-items') || 
    pathname.startsWith('/wms-import') || 
    pathname.startsWith('/wms-projecten') ||
    pathname.startsWith('/items-to-pack') || 
    pathname.startsWith('/packed-items') ||
    pathname.startsWith('/returned-items')

  const isAirtecPage = 
    pathname.startsWith('/airtec') ||
    pathname.startsWith('/view-airtec') || 
    pathname.startsWith('/items-to-pack-airtec') || 
    pathname.startsWith('/packed-items-airtec')

  const isAdminPage = 
    pathname.startsWith('/admin') || 
    pathname.startsWith('/employees') ||
    pathname.startsWith('/opslag-verhuur')

  const isGroteInpakPage = pathname.startsWith('/grote-inpak')

  const isWoodPage = 
    pathname.startsWith('/wood/order') ||
    pathname.startsWith('/wood/open-orders') ||
    pathname.startsWith('/openstaande-bestellingen') ||
    pathname.startsWith('/wood/receive') ||
    pathname.startsWith('/wood/picking') ||
    pathname.startsWith('/wood/consumption')

  const isVariaPage =
    pathname.startsWith('/uitvoeren-controle') ||
    pathname.startsWith('/materiaal/heftruck-water') ||
    pathname.startsWith('/production-order-time')

  const isCNHPage = 
    pathname.startsWith('/cnh/workflow') ||
    pathname.startsWith('/cnh/dashboard') ||
    pathname.startsWith('/cnh/admin') ||
    pathname.startsWith('/cnh/verify')

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (prepackDropdownRef.current && !prepackDropdownRef.current.contains(event.target as Node)) {
        setIsPrepackOpen(false)
      }
      if (airtecDropdownRef.current && !airtecDropdownRef.current.contains(event.target as Node)) {
        setIsAirtecOpen(false)
      }
      if (woodDropdownRef.current && !woodDropdownRef.current.contains(event.target as Node)) {
        setIsWoodOpen(false)
      }
      if (variaDropdownRef.current && !variaDropdownRef.current.contains(event.target as Node)) {
        setIsVariaOpen(false)
      }
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setIsAdminOpen(false)
      }
      if (cnhDropdownRef.current && !cnhDropdownRef.current.contains(event.target as Node)) {
        setIsCNHOpen(false)
      }
    }

    if (isPrepackOpen || isAirtecOpen || isWoodOpen || isVariaOpen || isAdminOpen || isCNHOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPrepackOpen, isAirtecOpen, isWoodOpen, isVariaOpen, isAdminOpen, isCNHOpen])

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Home */}
          <Link href="/" className="text-2xl font-bold text-gray-800 hover:text-gray-600 transition-colors">
            Prodwilrijk V2
          </Link>

          {/* Navigation Links */}
          <div className="flex flex-wrap items-center gap-2">
            {user && (
              <>
                <Link
                  href="/bestellingen-algemeen"
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isActive('/bestellingen-algemeen')
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Bestellingen Algemeen
                </Link>
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
                      href="/prepack-lading"
                      onClick={() => setIsPrepackOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/prepack-lading') ? 'bg-blue-50 text-blue-600 font-medium border-l-4 border-blue-500' : 'text-gray-700'
                      }`}
                    >
                      Prepack Lading - Scanner
                    </Link>
                    <Link
                      href="/prepack-compare"
                      onClick={() => setIsPrepackOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/prepack-compare') ? 'bg-blue-50 text-blue-600 font-medium border-l-4 border-blue-500' : 'text-gray-700'
                      }`}
                    >
                      Prepack Vergelijking
                    </Link>
                    <Link
                      href="/bestellingen-algemeen"
                      onClick={() => setIsPrepackOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/bestellingen-algemeen') ? 'bg-blue-50 text-blue-600 font-medium border-l-4 border-blue-500' : 'text-gray-700'
                      }`}
                    >
                      Bestellingen Algemeen
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
                      href="/wms-projecten"
                      onClick={() => setIsPrepackOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/wms-projecten') ? 'bg-blue-50 text-blue-600 font-medium border-l-4 border-blue-500' : 'text-gray-700'
                      }`}
                    >
                      WMS Projecten
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
                    <Link
                      href="/returned-items"
                      onClick={() => setIsPrepackOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/returned-items') ? 'bg-blue-50 text-blue-600 font-medium border-l-4 border-blue-500' : 'text-gray-700'
                      }`}
                    >
                      Returned Items
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

            {/* Wood Inventory Dropdown */}
            <div className="relative" ref={woodDropdownRef}>
              <button
                onClick={() => setIsWoodOpen(!isWoodOpen)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                  isWoodPage
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Wood Inventory
                <svg
                  className={`ml-2 w-4 h-4 transition-transform ${isWoodOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isWoodOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
                  <div className="py-2">
                    <Link
                      href="/wood/order"
                      onClick={() => setIsWoodOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/wood/order') ? 'bg-amber-50 text-amber-600 font-medium border-l-4 border-amber-500' : 'text-gray-700'
                      }`}
                    >
                      Order Wood
                    </Link>
                    <Link
                      href="/wood/open-orders"
                      onClick={() => setIsWoodOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/wood/open-orders') ? 'bg-amber-50 text-amber-600 font-medium border-l-4 border-amber-500' : 'text-gray-700'
                      }`}
                    >
                      Open Orders
                    </Link>
                    <Link
                      href="/openstaande-bestellingen"
                      onClick={() => setIsWoodOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/openstaande-bestellingen') ? 'bg-amber-50 text-amber-600 font-medium border-l-4 border-amber-500' : 'text-gray-700'
                      }`}
                    >
                      Openstaande Bestellingen
                    </Link>
                    <Link
                      href="/wood/receive"
                      onClick={() => setIsWoodOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/wood/receive') ? 'bg-amber-50 text-amber-600 font-medium border-l-4 border-amber-500' : 'text-gray-700'
                      }`}
                    >
                      Receive Wood
                    </Link>
                    <Link
                      href="/wood/picking"
                      onClick={() => setIsWoodOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/wood/picking') ? 'bg-amber-50 text-amber-600 font-medium border-l-4 border-amber-500' : 'text-gray-700'
                      }`}
                    >
                      Wood Picking
                    </Link>
                    <Link
                      href="/wood/consumption"
                      onClick={() => setIsWoodOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/wood/consumption') ? 'bg-amber-50 text-amber-600 font-medium border-l-4 border-amber-500' : 'text-gray-700'
                      }`}
                    >
                      Wood Consumption
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Varia Dropdown */}
            <div className="relative" ref={variaDropdownRef}>
              <button
                onClick={() => setIsVariaOpen(!isVariaOpen)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                  isVariaPage
                    ? 'bg-slate-500 text-white hover:bg-slate-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Varia
                <svg
                  className={`ml-2 w-4 h-4 transition-transform ${isVariaOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isVariaOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
                  <div className="py-2">
                    <Link
                      href="/uitvoeren-controle"
                      onClick={() => setIsVariaOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/uitvoeren-controle')
                          ? 'bg-slate-50 text-slate-700 font-medium border-l-4 border-slate-500'
                          : 'text-gray-700'
                      }`}
                    >
                      Uitvoeren controles
                    </Link>
                    <Link
                      href="/materiaal/heftruck-water"
                      onClick={() => setIsVariaOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/materiaal/heftruck-water')
                          ? 'bg-slate-50 text-slate-700 font-medium border-l-4 border-slate-500'
                          : 'text-gray-700'
                      }`}
                    >
                      Heftruck water
                    </Link>
                    <Link
                      href="/production-order-time"
                      onClick={() => setIsVariaOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/production-order-time')
                          ? 'bg-slate-50 text-slate-700 font-medium border-l-4 border-slate-500'
                          : 'text-gray-700'
                      }`}
                    >
                      Productie order tijd
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

            {/* CNH Dropdown */}
            <div className="relative" ref={cnhDropdownRef}>
              <button
                onClick={() => setIsCNHOpen(!isCNHOpen)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                  isCNHPage
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                CNH
                <svg
                  className={`ml-2 w-4 h-4 transition-transform ${isCNHOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isCNHOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
                  <div className="py-2">
                    <Link
                      href="/cnh/workflow"
                      onClick={() => setIsCNHOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/cnh/workflow') ? 'bg-green-50 text-green-600 font-medium border-l-4 border-green-500' : 'text-gray-700'
                      }`}
                    >
                      CNH Workflow
                    </Link>
                    <Link
                      href="/cnh/dashboard"
                      onClick={() => setIsCNHOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/cnh/dashboard') ? 'bg-green-50 text-green-600 font-medium border-l-4 border-green-500' : 'text-gray-700'
                      }`}
                    >
                      CNH Dashboard
                    </Link>
                    <Link
                      href="/cnh/verify"
                      onClick={() => setIsCNHOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/cnh/verify') ? 'bg-green-50 text-green-600 font-medium border-l-4 border-green-500' : 'text-gray-700'
                      }`}
                    >
                      CNH Verificatie (Tablet)
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/cnh/admin"
                        onClick={() => setIsCNHOpen(false)}
                        className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                          isActive('/cnh/admin') ? 'bg-green-50 text-green-600 font-medium border-l-4 border-green-500' : 'text-gray-700'
                        }`}
                      >
                        CNH Admin
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

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
                      href="/admin/production-order-kpi"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/admin/production-order-kpi')
                          ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500'
                          : 'text-gray-700'
                      }`}
                    >
                      Productie KPI
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
                    <Link
                      href="/admin/prepack-airtec"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/admin/prepack-airtec') ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500' : 'text-gray-700'
                      }`}
                    >
                      Prepack + Airtec overzicht
                    </Link>
                    <Link
                      href="/opslag-verhuur"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/opslag-verhuur') ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500' : 'text-gray-700'
                      }`}
                    >
                      Opslagverhuur
                    </Link>
                    <Link
                      href="/admin/bc-codes"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/admin/bc-codes') ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500' : 'text-gray-700'
                      }`}
                    >
                      BC Codes (Wood)
                    </Link>
                    <Link
                      href="/admin/target-stock"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/admin/target-stock') ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500' : 'text-gray-700'
                      }`}
                    >
                      Target Stock (Wood)
                    </Link>
                    <Link
                      href="/admin/monitor-controles"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/admin/monitor-controles') ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500' : 'text-gray-700'
                      }`}
                    >
                      Monitor controles
                    </Link>
                    <Link
                      href="/admin/wms-projecten-import"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/admin/wms-projecten-import') ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500' : 'text-gray-700'
                      }`}
                    >
                      WMS Project import
                    </Link>
                    <Link
                      href="/admin/production-order-upload"
                      onClick={() => setIsAdminOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 transition-colors ${
                        isActive('/admin/production-order-upload') ? 'bg-purple-50 text-purple-600 font-medium border-l-4 border-purple-500' : 'text-gray-700'
                      }`}
                    >
                      Productieorder upload (tijd)
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


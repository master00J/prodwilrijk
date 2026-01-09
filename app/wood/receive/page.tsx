'use client'

import { useState, useEffect, useRef } from 'react'
import { WoodPackage } from '@/types/database'

export default function ReceiveWoodPage() {
  const [pakketnummer, setPakketnummer] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<WoodPackage | null>(null)
  const [locatie, setLocatie] = useState('')
  const [waitingPackages, setWaitingPackages] = useState<WoodPackage[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const scannerRef = useRef<HTMLDivElement>(null)

  const fetchWaitingPackages = async () => {
    try {
      const response = await fetch('/api/wood/packages?received=false')
      if (!response.ok) throw new Error('Failed to fetch packages')
      const data = await response.json()
      setWaitingPackages(data)
    } catch (error) {
      console.error('Error fetching waiting packages:', error)
    }
  }

  useEffect(() => {
    fetchWaitingPackages()
  }, [])

  const handleSearchPackage = async () => {
    if (!pakketnummer.trim()) {
      alert('Please enter a package number')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/wood/packages?pakketnummer=${encodeURIComponent(pakketnummer)}`)
      if (!response.ok) throw new Error('Failed to search package')
      const data = await response.json()
      
      if (data.length === 0) {
        alert('Package not found')
        setSelectedPackage(null)
        return
      }

      const pkg = data[0]
      if (pkg.ontvangen) {
        alert('Package already received')
        setSelectedPackage(null)
        return
      }

      setSelectedPackage(pkg)
      setPakketnummer('')
    } catch (error) {
      console.error('Error searching package:', error)
      alert('Failed to search package')
    } finally {
      setLoading(false)
    }
  }

  const handleReceive = async () => {
    if (!selectedPackage || !locatie.trim()) {
      alert('Please enter a location')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/wood/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: selectedPackage.id,
          locatie: locatie.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to receive package')
      }

      alert('Package received successfully!')
      setSelectedPackage(null)
      setLocatie('')
      await fetchWaitingPackages()
    } catch (error) {
      console.error('Error receiving package:', error)
      alert(error instanceof Error ? error.message : 'Failed to receive package')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectWaitingPackage = (pkg: WoodPackage) => {
    setSelectedPackage(pkg)
    setPakketnummer(pkg.pakketnummer)
  }

  // QR Scanner would be implemented here with html5-qrcode library
  // For now, we'll use manual input

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Receive Wood by Package</h1>
      </div>

      {/* Search Package Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Search Package</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              value={pakketnummer}
              onChange={(e) => setPakketnummer(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchPackage()}
              placeholder="Enter package number..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSearchPackage}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium disabled:bg-gray-300"
            >
              Search Package
            </button>
            <button
              onClick={() => setShowScanner(!showScanner)}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium"
            >
              📷 Scan QR
            </button>
          </div>
        </div>
        {showScanner && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              QR Scanner functionality will be implemented here. For now, please use manual input.
            </p>
          </div>
        )}
      </div>

      {/* Waiting Packages List */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Packages Ready for Location</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Package #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wood Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dimensions (DxWxL)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Planks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered On</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {waitingPackages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No packages waiting for location
                  </td>
                </tr>
              ) : (
                waitingPackages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {pkg.pakketnummer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {pkg.houtsoort}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {pkg.exacte_dikte} x {pkg.exacte_breedte} x {pkg.exacte_lengte} mm
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {pkg.planken_per_pak}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(pkg.aangemeld_op).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleSelectWaitingPackage(pkg)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Package Details and Location Input */}
      {selectedPackage && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Package Details</h2>
          <div className="mb-4 p-4 bg-green-50 rounded-lg">
            <p><strong>Package Number:</strong> {selectedPackage.pakketnummer}</p>
            <p><strong>Wood Type:</strong> {selectedPackage.houtsoort}</p>
            <p><strong>Exact Dimensions:</strong> {selectedPackage.exacte_dikte} x {selectedPackage.exacte_breedte} x {selectedPackage.exacte_lengte} mm</p>
            {selectedPackage.opmerking && (
              <p><strong>Comment:</strong> {selectedPackage.opmerking}</p>
            )}
          </div>
          <div className="mb-4">
            <label className="block mb-2 font-medium">Enter Location *</label>
            <input
              type="text"
              value={locatie}
              onChange={(e) => setLocatie(e.target.value)}
              placeholder="Location..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>
          <button
            onClick={handleReceive}
            disabled={loading || !locatie.trim()}
            className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding to Stock...' : 'Add to Stock'}
          </button>
        </div>
      )}
    </div>
  )
}


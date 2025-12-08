'use client'

import { useState, useEffect } from 'react'

interface BoxReportModalProps {
  isOpen: boolean
  onClose: () => void
  dateFrom: string
  dateTo: string
}

interface BoxReportItem {
  kistnummer: string
  total_quantity: number
  erp_code: string | null
  item_count: number
}

export default function BoxReportModal({
  isOpen,
  onClose,
  dateFrom,
  dateTo,
}: BoxReportModalProps) {
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<BoxReportItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchReport()
    }
  }, [isOpen, dateFrom, dateTo])

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)

      const response = await fetch(`/api/packed-items-airtec/box-report?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch report')
      }

      const data = await response.json()
      setReportData(data.report || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load report')
      console.error('Error fetching box report:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalQuantity = reportData.reduce((sum, item) => sum + item.total_quantity, 0)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Box Usage Report</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Date Range:</strong> {dateFrom ? new Date(dateFrom).toLocaleDateString() : 'All'} - {dateTo ? new Date(dateTo).toLocaleDateString() : 'All'}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <strong>Total Quantity:</strong> {totalQuantity} items
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Loading report...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-800 p-4 rounded-lg">
            {error}
          </div>
        ) : reportData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No data found for the selected date range
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Box Number (Kistnummer)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    ERP Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Total Quantity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Item Count
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((item) => (
                  <tr key={item.kistnummer}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.kistnummer}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.erp_code || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.total_quantity}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {item.item_count}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900">
                    Total
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">
                    {totalQuantity}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">
                    {reportData.reduce((sum, item) => sum + item.item_count, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}


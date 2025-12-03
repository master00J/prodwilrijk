'use client'

import { useState } from 'react'

interface DailyReportModalProps {
  onClose: () => void
}

export default function DailyReportModal({ onClose }: DailyReportModalProps) {
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)

  const generateReport = async () => {
    if (!reportDate) {
      alert('Please select a date')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `/api/items-to-pack/report?date=${reportDate}`
      )
      if (!response.ok) throw new Error('Failed to generate report')
      const data = await response.json()
      setReportData(data)
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Daily Report</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-4">
            <label className="block mb-2 font-medium">Report Date</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={generateReport}
                disabled={loading}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 font-medium"
              >
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>

          {reportData && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {reportData.totalQuantity || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Quantity</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {reportData.backlogQuantity || 0}
                  </div>
                  <div className="text-sm text-gray-600">Backlog</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {reportData.priorityQuantity || 0}
                  </div>
                  <div className="text-sm text-gray-600">Priority</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {reportData.packedQuantity || 0}
                  </div>
                  <div className="text-sm text-gray-600">Packed</div>
                </div>
              </div>

              {reportData.recommendations && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Recommendations</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {reportData.recommendations.map((rec: string, idx: number) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}



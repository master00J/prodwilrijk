'use client'

import { useMemo } from 'react'
import type { GroteInpakCase } from '@/types/database'

interface BacklogTabProps {
  overview: GroteInpakCase[]
}

export default function BacklogTab({ overview }: BacklogTabProps) {
  const backlog = useMemo(() => {
    return overview
      .filter(item => item.dagen_te_laat > 0)
      .sort((a, b) => b.dagen_te_laat - a.dagen_te_laat)
  }, [overview])

  const kCases = backlog.filter(item => {
    const caseType = item.case_type?.toUpperCase() || ''
    if (caseType.startsWith('K')) {
      const num = parseInt(caseType.substring(1), 10)
      return (num >= 1 && num <= 99) || (num >= 100 && num <= 999)
    }
    return false
  })

  const cCases = backlog.filter(item => {
    const caseType = item.case_type?.toUpperCase() || ''
    if (caseType.startsWith('C')) {
      const num = parseInt(caseType.substring(1), 10)
      return (num >= 100 && num <= 998) || num === 999
    }
    return false
  })

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">⏰ Backlog</h2>
      
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-orange-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Backlog K</p>
          <p className="text-3xl font-bold text-orange-600">{kCases.length}</p>
          <p className="text-xs text-gray-500 mt-1">K1-99 (10d), K100-999 (3d)</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Backlog C</p>
          <p className="text-3xl font-bold text-red-600">{cCases.length}</p>
          <p className="text-xs text-gray-500 mt-1">C100-998 (1d), C999 (10d)</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Total Overdue</p>
          <p className="text-3xl font-bold text-gray-700">{backlog.length}</p>
        </div>
      </div>

      {/* Backlog Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Label</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Arrival Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Deadline</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Dagen Te Laat</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Dagen in WLB</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Locatie</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {backlog.map((item) => (
              <tr key={item.case_label} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.case_label}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{item.case_type || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {item.arrival_date ? new Date(item.arrival_date).toLocaleDateString('nl-NL') : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {item.deadline ? new Date(item.deadline).toLocaleDateString('nl-NL') : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    item.dagen_te_laat > 10 ? 'bg-red-100 text-red-800' :
                    item.dagen_te_laat > 5 ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.dagen_te_laat} dagen
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{item.dagen_in_willebroek || 0}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{item.locatie || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {backlog.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Geen overdue cases gevonden.
        </div>
      )}
    </div>
  )
}


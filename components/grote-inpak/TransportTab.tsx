'use client'

import type { GroteInpakCase } from '@/types/database'

interface TransportTabProps {
  transport: any[]
  overview: GroteInpakCase[]
}

export default function TransportTab({ transport, overview }: TransportTabProps) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">🚚 Transport</h2>
      <p className="text-gray-600 mb-4">
        Cases die transport nodig hebben van productielocatie naar Willebroek.
      </p>
      
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Label</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Case Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Productielocatie</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Item Number</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transport.map((item) => {
              const caseData = overview.find(c => c.case_label === item.case_label)
              return (
                <tr key={item.case_label} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.case_label}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{caseData?.case_type || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{caseData?.productielocatie || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{caseData?.item_number || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
                      Transport Nodig
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {transport.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Geen transport nodig op dit moment.
        </div>
      )}
    </div>
  )
}


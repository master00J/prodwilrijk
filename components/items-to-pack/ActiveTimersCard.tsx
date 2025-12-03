'use client'

import { useEffect, useState } from 'react'

interface ActiveTimeLog {
  id: number
  employee_id: number
  employee_name: string
  start_time: string
  elapsed_seconds: number
}

interface ActiveTimersCardProps {
  timeLogs: ActiveTimeLog[]
  onStop: (logId: number, employeeName?: string) => void
  onStopAll: () => void
}

export default function ActiveTimersCard({
  timeLogs,
  onStop,
  onStopAll,
}: ActiveTimersCardProps) {
  const [elapsedTimes, setElapsedTimes] = useState<Map<number, number>>(new Map())

  useEffect(() => {
    if (timeLogs.length === 0) return

    const interval = setInterval(() => {
      const now = Date.now()
      const newElapsed = new Map<number, number>()

      timeLogs.forEach((log) => {
        const start = new Date(log.start_time).getTime()
        const elapsed = Math.floor((now - start) / 1000)
        newElapsed.set(log.id, elapsed)
      })

      setElapsedTimes(newElapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [timeLogs])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return [h > 0 ? `${h}h` : '', m > 0 ? `${m}m` : '', `${s}s`]
      .filter(Boolean)
      .join(' ')
  }

  if (timeLogs.length === 0) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg border-2 border-blue-200 p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">⏱️ Active Time Registrations</h3>
          <p className="text-sm text-gray-600 mt-1">
            {timeLogs.length} active timer{timeLogs.length !== 1 ? 's' : ''} running
          </p>
        </div>
        {timeLogs.length > 1 && (
          <button
            onClick={onStopAll}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium shadow-md transition-colors"
          >
            ⏹️ Stop All ({timeLogs.length})
          </button>
        )}
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-inner">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                👤 Employee
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                🕐 Start Time
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">
                ⏱️ Elapsed Time
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {timeLogs.map((log) => {
              const elapsed = elapsedTimes.get(log.id) || log.elapsed_seconds || 0
              return (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                      {log.employee_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(log.start_time).toLocaleTimeString('nl-NL', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800">
                      ⏱️ {formatTime(elapsed)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => onStop(log.id, log.employee_name)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium text-sm shadow-sm transition-all hover:shadow-md active:scale-95"
                      title={`Stop timer for ${log.employee_name}`}
                    >
                      ⏹️ Stop
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}



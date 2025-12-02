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
  onStop: (logId: number) => void
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
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Active Time Registrations</h3>
        <button
          onClick={onStopAll}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
        >
          Stop All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Employee
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Start Time
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Elapsed Time
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {timeLogs.map((log) => {
              const elapsed = elapsedTimes.get(log.id) || log.elapsed_seconds || 0
              return (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {log.employee_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(log.start_time).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-blue-600">
                    {formatTime(elapsed)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onStop(log.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 font-medium"
                    >
                      Stop
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


'use client'

interface PackedItemsStatsProps {
  stats: {
    totalPacked: number
    averagePerDay: number
    averageStayDuration: number
  }
}

export default function PackedItemsStats({ stats }: PackedItemsStatsProps) {
  return (
    <div className="bg-gray-100 rounded-lg p-4 mb-6 flex flex-wrap gap-6">
      <div className="text-center">
        <div className="text-2xl font-bold text-blue-600">{stats.totalPacked}</div>
        <div className="text-sm text-gray-600">Total Packed</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-green-600">
          {stats.averagePerDay.toFixed(2)}
        </div>
        <div className="text-sm text-gray-600">Average Per Day</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">
          {stats.averageStayDuration.toFixed(2)}
        </div>
        <div className="text-sm text-gray-600">Avg. Stay Duration (days)</div>
      </div>
    </div>
  )
}




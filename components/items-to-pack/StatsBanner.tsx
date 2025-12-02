'use client'

import { ItemToPack } from '@/types/database'
import { useMemo } from 'react'
import { isOlderThanWorkingDays } from '@/lib/utils/workdays'

interface StatsBannerProps {
  items: ItemToPack[]
}

export default function StatsBanner({ items }: StatsBannerProps) {
  const stats = useMemo(() => {
    const priorityItems = items.filter(item => item.priority).length
    const totalQuantity = items.reduce((sum, item) => sum + (item.amount || 0), 0)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const backlogItems = items.filter(item => {
      const itemDate = new Date(item.date_added)
      itemDate.setHours(0, 0, 0, 0)
      // Backlog = items older than 3 working days
      return isOlderThanWorkingDays(itemDate, today, 3)
    }).length

    return {
      priorityItems,
      totalQuantity,
      backlogItems,
    }
  }, [items])

  return (
    <div className="bg-gray-100 rounded-lg p-4 mb-6 flex flex-wrap justify-between items-center gap-4">
      <div className="flex gap-6 flex-wrap">
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.priorityItems}</div>
          <div className="text-sm text-gray-600">Priority Items</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.totalQuantity}</div>
          <div className="text-sm text-gray-600">Total Quantity</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{stats.backlogItems}</div>
          <div className="text-sm text-gray-600">Backlog (&gt;3 workdays)</div>
        </div>
      </div>
      <div className="text-sm text-gray-500">
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  )
}


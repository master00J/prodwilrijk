'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Filter, Save, Download, Star, StarOff, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import type { GroteInpakCase } from '@/types/database'

interface OverviewTabProps {
  overview: GroteInpakCase[]
}

type SortableColumn = keyof GroteInpakCase | null
type SortDirection = 'asc' | 'desc'

export default function OverviewTab({ overview }: OverviewTabProps) {
  const [filteredData, setFilteredData] = useState<GroteInpakCase[]>(overview)
  const [editedData, setEditedData] = useState<Map<string, Partial<GroteInpakCase>>>(new Map())
  
  // Sorting
  const [sortColumn, setSortColumn] = useState<SortableColumn>('arrival_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  
  // Filters
  const [locationFilter, setLocationFilter] = useState('Alle')
  const [statusFilter, setStatusFilter] = useState('Alle')
  const [willebroekFilter, setWillebroekFilter] = useState('Alle')
  const [priorityFilter, setPriorityFilter] = useState('Alle')
  const [searchQuery, setSearchQuery] = useState('')

  // Get unique values for filters
  const locations = useMemo(() => {
    const locs = new Set(overview.map(item => item.productielocatie).filter((loc): loc is string => Boolean(loc)))
    return ['Alle', ...Array.from(locs).sort()]
  }, [overview])

  const statuses = useMemo(() => {
    const stats = new Set(overview.map(item => item.status).filter((stat): stat is string => Boolean(stat)))
    return ['Alle', ...Array.from(stats).sort()]
  }, [overview])

  // Apply filters
  useEffect(() => {
    let filtered = [...overview]

    if (locationFilter !== 'Alle') {
      filtered = filtered.filter(item => item.productielocatie === locationFilter)
    }

    if (statusFilter !== 'Alle') {
      filtered = filtered.filter(item => item.status === statusFilter)
    }

    if (willebroekFilter === 'Ja') {
      filtered = filtered.filter(item => item.in_willebroek === true)
    } else if (willebroekFilter === 'Nee') {
      filtered = filtered.filter(item => item.in_willebroek === false)
    }

    if (priorityFilter === 'Priority Only') {
      filtered = filtered.filter(item => item.priority === true)
    } else if (priorityFilter === 'Non-Priority') {
      filtered = filtered.filter(item => item.priority === false)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.case_label?.toLowerCase().includes(query) ||
        item.case_type?.toLowerCase().includes(query) ||
        item.item_number?.toLowerCase().includes(query) ||
        item.stock_location?.toLowerCase().includes(query) ||
        item.comment?.toLowerCase().includes(query)
      )
    }

    setFilteredData(filtered)
  }, [overview, locationFilter, statusFilter, willebroekFilter, priorityFilter, searchQuery])

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData

    const sorted = [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn]
      const bValue = b[sortColumn]

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Handle dates
      if (sortColumn === 'arrival_date') {
        const aDate = new Date(aValue as string).getTime()
        const bDate = new Date(bValue as string).getTime()
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate
      }

      // Handle strings
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Handle booleans
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return sortDirection === 'asc' 
          ? (aValue === bValue ? 0 : aValue ? 1 : -1)
          : (aValue === bValue ? 0 : aValue ? -1 : 1)
      }

      return 0
    })

    return sorted
  }, [filteredData, sortColumn, sortDirection])

  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column with ascending as default
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (column: SortableColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 inline-block ml-1 text-gray-400" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 inline-block ml-1 text-blue-600" />
      : <ArrowDown className="w-4 h-4 inline-block ml-1 text-blue-600" />
  }

  const handleFieldChange = (caseLabel: string, field: keyof GroteInpakCase, value: any) => {
    const newEdited = new Map(editedData)
    const existing = newEdited.get(caseLabel) || {}
    newEdited.set(caseLabel, { ...existing, [field]: value })
    setEditedData(newEdited)
  }

  const handleSave = async () => {
    try {
      const updates = Array.from(editedData.entries()).map(([case_label, updates]) => ({
        case_label,
        ...updates,
      }))

      const response = await fetch('/api/grote-inpak/cases', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) {
        throw new Error('Error saving changes')
      }

      // Reload data
      window.location.reload()
    } catch (error) {
      console.error('Error saving:', error)
      alert('Error saving changes. Please try again.')
    }
  }

  const handleExport = () => {
    const csv = [
      ['Case Label', 'Case Type', 'Arrival Date', 'Item Number', 'Productielocatie', 'In Willebroek', 'Status', 'Priority', 'Comment', 'Stock Location'],
      ...filteredData.map(item => [
        item.case_label || '',
        item.case_type || '',
        item.arrival_date || '',
        item.item_number || '',
        item.productielocatie || '',
        item.in_willebroek ? 'Ja' : 'Nee',
        item.status || '',
        item.priority ? 'Ja' : 'Nee',
        item.comment || '',
        item.stock_location || '',
      ]),
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `overview_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const priorityCount = filteredData.filter(item => item.priority).length
  const commentCount = filteredData.filter(item => item.comment).length
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set())

  const handleBulkPriority = async (setPriority: boolean) => {
    if (selectedCases.size === 0) {
      alert('Selecteer eerst cases door op de checkbox te klikken')
      return
    }

    const updates = Array.from(selectedCases).map(case_label => ({
      case_label,
      priority: setPriority,
    }))

    try {
      const response = await fetch('/api/grote-inpak/cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      if (response.ok) {
        // Update local state
        const newEdited = new Map(editedData)
        selectedCases.forEach(case_label => {
          const existing = newEdited.get(case_label) || {}
          newEdited.set(case_label, { ...existing, priority: setPriority })
        })
        setEditedData(newEdited)
        setSelectedCases(new Set())
        alert(`${selectedCases.size} cases ${setPriority ? 'gemarkeerd' : 'gedemarkeerd'} als priority`)
      }
    } catch (error) {
      console.error('Error bulk updating:', error)
      alert('Error updating cases')
    }
  }

  const handleBulkStatus = async (status: string) => {
    if (selectedCases.size === 0) {
      alert('Selecteer eerst cases')
      return
    }

    const updates = Array.from(selectedCases).map(case_label => ({
      case_label,
      status,
    }))

    try {
      const response = await fetch('/api/grote-inpak/cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      if (response.ok) {
        const newEdited = new Map(editedData)
        selectedCases.forEach(case_label => {
          const existing = newEdited.get(case_label) || {}
          newEdited.set(case_label, { ...existing, status })
        })
        setEditedData(newEdited)
        setSelectedCases(new Set())
        alert(`${selectedCases.size} cases bijgewerkt`)
      }
    } catch (error) {
      console.error('Error bulk updating:', error)
      alert('Error updating cases')
    }
  }

  const handleSelectCase = (caseLabel: string) => {
    const newSelected = new Set(selectedCases)
    if (newSelected.has(caseLabel)) {
      newSelected.delete(caseLabel)
    } else {
      newSelected.add(caseLabel)
    }
    setSelectedCases(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedCases.size === sortedData.length) {
      setSelectedCases(new Set())
    } else {
      setSelectedCases(new Set(sortedData.map(item => item.case_label)))
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">📋 Overzicht - PILS Data</h2>
        
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Totaal Cases</p>
            <p className="text-2xl font-bold">{filteredData.length}</p>
            <p className="text-xs text-gray-500">van {overview.length} totaal</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">⭐ Priority Cases</p>
            <p className="text-2xl font-bold">{priorityCount}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">💬 Met Comments</p>
            <p className="text-2xl font-bold">{commentCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Locatie</label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">In Willebroek</label>
              <select
                value={willebroekFilter}
                onChange={(e) => setWillebroekFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Alle">Alle</option>
                <option value="Ja">Ja</option>
                <option value="Nee">Nee</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">⭐ Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Alle">Alle</option>
                <option value="Priority Only">Priority Only</option>
                <option value="Non-Priority">Non-Priority</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">🔍 Zoeken</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Case, type, item..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={handleSave}
            disabled={editedData.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            Opslaan
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          
          {/* Bulk Actions */}
          {selectedCases.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-600">{selectedCases.size} geselecteerd</span>
              <button
                onClick={() => handleBulkPriority(true)}
                className="flex items-center gap-1 px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm"
              >
                <Star className="w-4 h-4" />
                Markeer Priority
              </button>
              <button
                onClick={() => handleBulkPriority(false)}
                className="flex items-center gap-1 px-3 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm"
              >
                <StarOff className="w-4 h-4" />
                Verwijder Priority
              </button>
              <select
                onChange={(e) => e.target.value && handleBulkStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                defaultValue=""
              >
                <option value="">Bulk Status...</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                <input
                  type="checkbox"
                  checked={selectedCases.size === sortedData.length && sortedData.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">⭐</th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('case_label')}
              >
                Case Label{getSortIcon('case_label')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('case_type')}
              >
                Case Type{getSortIcon('case_type')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('arrival_date')}
              >
                Arrival Date{getSortIcon('arrival_date')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('item_number')}
              >
                Item Number{getSortIcon('item_number')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('productielocatie')}
              >
                Productielocatie{getSortIcon('productielocatie')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('in_willebroek')}
              >
                In WB{getSortIcon('in_willebroek')}
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('status')}
              >
                Status{getSortIcon('status')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Comment</th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort('stock_location')}
              >
                Stock Location{getSortIcon('stock_location')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((item) => {
              const edited = editedData.get(item.case_label) || {}
              const displayItem = { ...item, ...edited }
              const isPriority = displayItem.priority
              
              const isSelected = selectedCases.has(item.case_label)
              
              return (
                <tr
                  key={item.case_label}
                  className={`${isPriority ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'} ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectCase(item.case_label)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleFieldChange(item.case_label, 'priority', !displayItem.priority)}
                      className="text-yellow-500 hover:text-yellow-600"
                    >
                      {displayItem.priority ? <Star className="w-5 h-5 fill-current" /> : <StarOff className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{displayItem.case_label}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{displayItem.case_type || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {displayItem.arrival_date ? new Date(displayItem.arrival_date).toLocaleDateString('nl-NL') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{displayItem.item_number || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{displayItem.productielocatie || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${displayItem.in_willebroek ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {displayItem.in_willebroek ? 'Ja' : 'Nee'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={displayItem.status ?? ''}
                      onChange={(e) => handleFieldChange(item.case_label, 'status', e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">-</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="on_hold">On Hold</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={displayItem.comment || ''}
                      onChange={(e) => handleFieldChange(item.case_label, 'comment', e.target.value)}
                      placeholder="Add comment..."
                      className="text-sm w-full border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{displayItem.stock_location || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filteredData.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Geen data gevonden met de huidige filters.
        </div>
      )}
    </div>
  )
}


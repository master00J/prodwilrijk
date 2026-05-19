'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search,
  Save,
  Download,
  Star,
  StarOff,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  LayoutList,
  MapPin,
  Package,
  Truck,
  AlertTriangle,
  XCircle,
  Mic,
  MicOff,
  Bot,
  Send,
} from 'lucide-react'
import type { GroteInpakCase, ProductionTimeActive } from '@/types/database'
import { BcItemCode } from '@/lib/bc-mapping/client'
import { GROTE_INPAK_AUTO_STATUSES, type GroteInpakAutoStatus } from '@/lib/grote-inpak/auto-status'

interface OverviewTabProps {
  overview: GroteInpakCase[]
}

type SortableColumn = keyof GroteInpakCase | null
type SortDirection = 'asc' | 'desc'
type StatusFilter = 'Alle' | GroteInpakAutoStatus

function productionTimeTooltip(p: ProductionTimeActive): string {
  const names = p.employees.join(', ')
  const start = new Date(p.started_at).toLocaleString('nl-BE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  return `Productieorder ${p.production_order_number} · ${names} · gestart ${start}`
}

function forecastDagenVerschil(item: GroteInpakCase): number | null {
  if (!item.forecast_date) return null
  const f = new Date(item.forecast_date).getTime()
  const p = item.arrival_date ? new Date(item.arrival_date).getTime() : NaN
  if (Number.isNaN(p)) return null
  return Math.round((p - f) / 86400000)
}

/** Badge in kolom «In prod.»: zelfde kleuren als WLB / Genk / Wilrijk in de stockkolommen. */
function inProductieQtyBadgeClass(productielocatie: string | null | undefined): string {
  const loc = (productielocatie || '').toLowerCase().trim()
  if (loc.includes('genk')) return 'bg-blue-100 text-blue-900'
  if (loc.includes('wilrijk')) return 'bg-violet-100 text-violet-900'
  if (loc.includes('willebroek') || loc === 'wlb' || loc.startsWith('wb')) {
    return 'bg-emerald-100 text-emerald-900'
  }
  return 'bg-orange-100 text-orange-800'
}

export default function OverviewTab({ overview }: OverviewTabProps) {
  const [filteredData, setFilteredData] = useState<GroteInpakCase[]>(overview)
  const [editedData, setEditedData] = useState<Map<string, Partial<GroteInpakCase>>>(new Map())
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set())

  // Sorting
  const [sortColumn, setSortColumn] = useState<SortableColumn>('arrival_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Filters
  const [locationFilter, setLocationFilter] = useState('Alle')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Alle')
  const [willebroekFilter, setWillebroekFilter] = useState('Alle')
  const [priorityFilter, setPriorityFilter] = useState('Alle')
  const [kistTypeFilter, setKistTypeFilter] = useState<'Alle' | 'C' | 'K'>('Alle')
  const [searchQuery, setSearchQuery] = useState('')
  const [verbergInProductie, setVerbergInProductie] = useState(false)
  const [verbergOpStock, setVerbergOpStock] = useState(false)
  const [verbergInTransfer, setVerbergInTransfer] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceMessage, setVoiceMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const [assistantAnswer, setAssistantAnswer] = useState('')
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantError, setAssistantError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])
  const voiceStreamRef = useRef<MediaStream | null>(null)

  const makeSpeakableText = useCallback((text: string): string => {
    return text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[>#_*~|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }, [])

  const speakVoiceConfirmation = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const speakableText = makeSpeakableText(text)
    if (!speakableText) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(speakableText)
    utterance.lang = 'nl-BE'
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
  }, [makeSpeakableText])

  useEffect(() => {
    setVoiceSupported(
      typeof window !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined'
    )
  }, [])

  // Get unique values for filters
  const locations = useMemo(() => {
    const locs = new Set(overview.map(item => item.productielocatie).filter((loc): loc is string => Boolean(loc)))
    return ['Alle', ...Array.from(locs).sort()]
  }, [overview])

  const statusOptions = useMemo<StatusFilter[]>(
    () => ['Alle', ...GROTE_INPAK_AUTO_STATUSES],
    []
  )

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

    if (kistTypeFilter === 'C') {
      filtered = filtered.filter(item => String(item.case_type || '').toUpperCase().startsWith('C'))
    } else if (kistTypeFilter === 'K') {
      filtered = filtered.filter(item => {
        const ct = String(item.case_type || '').toUpperCase()
        return ct.startsWith('K') || ct.startsWith('V') // V-kisten = K
      })
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.case_label?.toLowerCase().includes(query) ||
        item.case_type?.toLowerCase().includes(query) ||
        item.item_number?.toLowerCase().includes(query) ||
        item.serial_number?.toLowerCase().includes(query) ||
        item.pils_shop_order_key?.toLowerCase().includes(query) ||
        item.atlas_planner_email?.toLowerCase().includes(query) ||
        item.bc_fp_item_no?.toLowerCase().includes(query) ||
        item.bc_shop_order_no?.toLowerCase().includes(query) ||
        item.bc_sales_order_no?.toLowerCase().includes(query) ||
        item.bc_customer_order_no?.toLowerCase().includes(query) ||
        item.production_time_active?.step?.toLowerCase().includes(query) ||
        item.production_time_active?.production_order_number?.toLowerCase().includes(query) ||
        item.production_time_active?.employees?.some((n) => n.toLowerCase().includes(query)) ||
        item.stock_location?.toLowerCase().includes(query) ||
        item.comment?.toLowerCase().includes(query)
      )
    }

    if (verbergInProductie) {
      filtered = filtered.filter(item => !((item.in_productie_qty ?? 0) > 0))
    }

    if (verbergOpStock) {
      filtered = filtered.filter(item => !(
        (item.stock_willebroek ?? 0) > 0 ||
        (item.stock_genk ?? 0) > 0 ||
        (item.stock_wilrijk ?? 0) > 0 ||
        item.in_willebroek === true
      ))
    }

    if (verbergInTransfer) {
      filtered = filtered.filter(item => !((item.in_transfer_qty ?? 0) > 0))
    }

    setFilteredData(filtered)
  }, [overview, locationFilter, statusFilter, willebroekFilter, priorityFilter, kistTypeFilter, searchQuery, verbergInProductie, verbergOpStock, verbergInTransfer])

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData

    const sorted = [...filteredData].sort((a, b) => {
      const aValue = a[sortColumn as keyof GroteInpakCase]
      const bValue = b[sortColumn as keyof GroteInpakCase]

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
      return <ArrowUpDown className="w-3.5 h-3.5 inline-block ml-0.5 text-sky-200/80 align-text-bottom" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 inline-block ml-0.5 text-white align-text-bottom" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 inline-block ml-0.5 text-white align-text-bottom" />
    )
  }

  const getStatusBadgeClass = (status?: string | null) => {
    switch (status) {
      case 'Op stock':
        return 'bg-emerald-100 text-emerald-900 border-emerald-200'
      case 'In transfer':
        return 'bg-cyan-100 text-cyan-900 border-cyan-200'
      case 'In productie':
        return 'bg-orange-100 text-orange-900 border-orange-200'
      case 'Nog te produceren':
        return 'bg-slate-100 text-slate-800 border-slate-200'
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200'
    }
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
      ['Case Label', 'Case Type', 'PILS Datum', 'Forecast Datum', 'Item Number', 'Serial', 'Shop-key (6)', 'Atlas Planner e-mail', 'BC FP', 'BC Shop order', 'BC Customer order', 'BC Verkooporder', 'PO-tijd stap (actief)', 'PO-tijd order', 'PO-tijd team', 'Productielocatie', 'Status', 'Priority', 'Comment', 'WMS Locatie'],
      ...filteredData.map(item => [
        item.case_label || '',
        item.case_type || '',
        item.arrival_date || '',
        item.forecast_date || '',
        item.item_number || '',
        item.serial_number || '',
        item.pils_shop_order_key || '',
        item.atlas_planner_email || '',
        item.bc_fp_item_no || '',
        item.bc_shop_order_no || '',
        item.bc_customer_order_no || '',
        item.bc_sales_order_no || '',
        item.production_time_active?.step || '',
        item.production_time_active?.production_order_number || '',
        item.production_time_active?.employees?.join('; ') || '',
        item.productielocatie || '',
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

  const summary = useMemo(() => {
    let inWb = 0
    let metTransfer = 0
    let metStockPlek = 0
    let forecastKritiek = 0
    for (const item of filteredData) {
      if (item.in_willebroek) inWb++
      if ((item.in_transfer_qty ?? 0) > 0) metTransfer++
      if (
        (item.stock_willebroek ?? 0) > 0 ||
        (item.stock_genk ?? 0) > 0 ||
        (item.stock_wilrijk ?? 0) > 0 ||
        item.in_willebroek
      ) {
        metStockPlek++
      }
      const d = forecastDagenVerschil(item)
      if (d !== null && d < 0) forecastKritiek++
    }
    return { inWb, metTransfer, metStockPlek, forecastKritiek }
  }, [filteredData])

  const hasActiveFilters =
    locationFilter !== 'Alle' ||
    statusFilter !== 'Alle' ||
    willebroekFilter !== 'Alle' ||
    priorityFilter !== 'Alle' ||
    kistTypeFilter !== 'Alle' ||
    searchQuery.trim() !== '' ||
    verbergInProductie ||
    verbergOpStock ||
    verbergInTransfer

  const resetFilters = useCallback(() => {
    setLocationFilter('Alle')
    setStatusFilter('Alle')
    setWillebroekFilter('Alle')
    setPriorityFilter('Alle')
    setKistTypeFilter('Alle')
    setSearchQuery('')
    setVerbergInProductie(false)
    setVerbergOpStock(false)
    setVerbergInTransfer(false)
  }, [])

  const askAssistant = useCallback(async (question: string): Promise<string | null> => {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) return null

    setAssistantLoading(true)
    setAssistantError(null)
    setAssistantQuestion(trimmedQuestion)

    const cases = filteredData.slice(0, 180).map(item => ({
      case_label: item.case_label,
      case_type: item.case_type || null,
      arrival_date: item.arrival_date || null,
      forecast_date: item.forecast_date || null,
      item_number: item.item_number || null,
      productielocatie: item.productielocatie || null,
      status: item.status || null,
      priority: item.priority === true,
      comment: item.comment || null,
      stock_willebroek: item.stock_willebroek ?? 0,
      stock_genk: item.stock_genk ?? 0,
      stock_wilrijk: item.stock_wilrijk ?? 0,
      in_transfer_qty: item.in_transfer_qty ?? 0,
      in_productie_qty: item.in_productie_qty ?? 0,
      dagen_te_laat: item.dagen_te_laat ?? 0,
      status_reason: item.status_reason || null,
      bc_fp_item_no: item.bc_fp_item_no || item.item_number || null,
      bc_shop_order_no: item.bc_shop_order_no || null,
      bc_customer_order_no: item.bc_customer_order_no || null,
    }))

    try {
      const response = await fetch('/api/grote-inpak/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmedQuestion,
          context: {
            filters: {
              productielocatie: locationFilter,
              status: statusFilter,
              willebroek: willebroekFilter,
              priority: priorityFilter,
              kistType: kistTypeFilter,
              search: searchQuery,
              verbergInProductie: String(verbergInProductie),
              verbergOpStock: String(verbergOpStock),
              verbergInTransfer: String(verbergInTransfer),
            },
            summary: {
              filtered: filteredData.length,
              total: overview.length,
              priority: priorityCount,
              comments: commentCount,
              inWillebroek: summary.inWb,
              onderweg: summary.metTransfer,
              stockErgens: summary.metStockPlek,
              forecastKritiek: summary.forecastKritiek,
            },
            cases,
          },
        }),
      })
      const result: { answer?: string; error?: string } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Assistent-aanvraag mislukt')
      const answer = result.answer || 'Geen antwoord ontvangen.'
      setAssistantAnswer(answer)
      return answer
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : 'Assistent-aanvraag mislukt')
      return null
    } finally {
      setAssistantLoading(false)
    }
  }, [
    commentCount,
    filteredData,
    kistTypeFilter,
    locationFilter,
    overview.length,
    priorityCount,
    priorityFilter,
    searchQuery,
    statusFilter,
    summary.forecastKritiek,
    summary.inWb,
    summary.metStockPlek,
    summary.metTransfer,
    verbergInProductie,
    verbergInTransfer,
    verbergOpStock,
    willebroekFilter,
  ])

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

  const submitVoiceAudio = useCallback(async (audioBlob: Blob) => {
    setVoiceBusy(true)
    setVoiceMessage({ type: 'info', text: 'Audio naar AI sturen...' })

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'grote-inpak-voice.webm')

      const response = await fetch('/api/grote-inpak/voice-priority', {
        method: 'POST',
        body: formData,
      })
      const result: {
        error?: string
        transcript?: string
        confirmation?: string
        case?: { case_label: string; priority: boolean; comment: string | null }
      } = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 422 && result.transcript) {
          setVoiceTranscript(result.transcript)
          setVoiceMessage({ type: 'info', text: 'Geen case-actie herkend. Ik behandel dit als vraag aan de assistent.' })
          const answer = await askAssistant(result.transcript)
          if (answer) {
            speakVoiceConfirmation(answer.slice(0, 500))
          }
          return
        }
        throw new Error(result.error || 'Voice actie opslaan mislukt')
      }

      if (result.transcript) setVoiceTranscript(result.transcript)
      if (!result.case?.case_label) throw new Error('Voice actie gaf geen case terug')

      const edited = editedData.get(result.case.case_label) || {}
      const newEdited = new Map(editedData)
      newEdited.set(result.case.case_label, {
        ...edited,
        priority: true,
        comment: result.case.comment || '',
      })
      setEditedData(newEdited)
      setVoiceMessage({
        type: 'success',
        text: result.confirmation || `${result.case.case_label} staat op priority met notitie "${result.case.comment || ''}".`,
      })
      speakVoiceConfirmation(result.confirmation || `${result.case.case_label} staat op priority.`)
    } catch (error) {
      setVoiceMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Voice actie mislukt',
      })
    } finally {
      setVoiceBusy(false)
    }
  }, [askAssistant, editedData, speakVoiceConfirmation])

  const stopVoicePriority = useCallback(() => {
    mediaRecorderRef.current?.stop()
    voiceStreamRef.current?.getTracks().forEach(track => track.stop())
    voiceStreamRef.current = null
    setVoiceListening(false)
  }, [])

  const startVoicePriority = useCallback(async () => {
    if (!voiceSupported) {
      setVoiceMessage({ type: 'error', text: 'Audio-opname wordt niet ondersteund in deze browser.' })
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      voiceChunksRef.current = []
      voiceStreamRef.current = stream
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        voiceChunksRef.current = []
        void submitVoiceAudio(blob)
      }

      setVoiceTranscript('')
      setVoiceMessage({ type: 'info', text: 'Opnemen... zeg bijvoorbeeld: "K12345 prio klant wacht op levering". Klik opnieuw om te stoppen.' })
      setVoiceListening(true)
      recorder.start()
    } catch (error) {
      setVoiceListening(false)
      setVoiceMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Microfoon kon niet gestart worden.',
      })
    }
  }, [submitVoiceAudio, voiceSupported])

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
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-300/80 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">PILS-overzicht</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Alle kisttypes uit de laatste PILS-run, afgestemd op stock, transfer en forecast. Met een actieve{' '}
          <strong className="font-medium text-slate-800">BC FP</strong> en lopende{' '}
          <strong className="font-medium text-slate-800">PO-tijd</strong> zie je onder <strong className="font-medium text-slate-800">Status</strong> de live stap en het
          productieordernummer. Gebruik de filters hieronder; klik kolomtitels om te sorteren.
        </p>
      </header>

      <section className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm" aria-label="Voice acties en vragen">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-indigo-950">Voice actie of vraag</h3>
            <p className="mt-1 text-sm text-indigo-900/80">
              Zeg een caselabel met actie, bijvoorbeeld: “K12345 prio klant wacht op levering”.
              Zonder caselabel behandelt de assistent het als vraag, bijvoorbeeld: “Welke cases hebben we momenteel prio?”.
            </p>
          </div>
          <button
            type="button"
            onClick={voiceListening ? stopVoicePriority : startVoicePriority}
            disabled={!voiceSupported || voiceBusy}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
          >
            {voiceListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {voiceListening ? 'Stop opname' : voiceBusy ? 'AI verwerkt...' : 'Spreek actie in'}
          </button>
        </div>
        {!voiceSupported && (
          <p className="mt-2 text-xs text-indigo-900">
            Audio-opname is niet beschikbaar in deze browser. Gebruik Chrome of Edge op een HTTPS-verbinding.
          </p>
        )}
        {voiceTranscript && (
          <p className="mt-3 rounded bg-white/80 px-3 py-2 text-sm text-slate-700">
            Gehoord: “{voiceTranscript}”
          </p>
        )}
        {voiceMessage && (
          <p
            className={`mt-3 rounded px-3 py-2 text-sm ${
              voiceMessage.type === 'success'
                ? 'bg-emerald-100 text-emerald-900'
                : voiceMessage.type === 'error'
                  ? 'bg-red-100 text-red-900'
                  : 'bg-white/80 text-indigo-900'
            }`}
          >
            {voiceMessage.text}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-300/80 bg-white p-4 shadow-sm" aria-label="Grote Inpak AI assistent">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-slate-700" />
              <h3 className="text-base font-semibold text-slate-900">Grote Inpak AI assistent</h3>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Stelt vragen over de huidige gefilterde tabel en geeft praktische analyse, risico’s en voorgestelde acties.
              De assistent voert hier nog geen bulk-acties automatisch uit.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Wat moet vandaag eerst opgevolgd worden?',
              'Welke priority cases zijn risicovol?',
              'Welke cases hebben forecast-problemen?',
              'Vat de huidige selectie samen voor de ploeg.',
            ].map(prompt => (
              <button
                key={prompt}
                type="button"
                onClick={() => askAssistant(prompt)}
                disabled={assistantLoading}
                className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            void askAssistant(assistantQuestion)
          }}
        >
          <input
            value={assistantQuestion}
            onChange={event => setAssistantQuestion(event.target.value)}
            placeholder="Vraag bv. welke cases eerst moeten, waarom iets rood is, of wat de ploeg moet doen..."
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
          />
          <button
            type="submit"
            disabled={assistantLoading || !assistantQuestion.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
          >
            <Send className="h-4 w-4" />
            {assistantLoading ? 'Denken...' : 'Vraag'}
          </button>
        </form>

        {assistantError && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {assistantError}
          </div>
        )}

        {assistantAnswer && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Antwoord op: {assistantQuestion}
            </div>
            <div className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{assistantAnswer}</div>
          </div>
        )}
      </section>

      <section aria-label="Kerncijfers">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-slate-300/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-wide">
              <LayoutList className="w-4 h-4 shrink-0" />
              Gefilterd
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{filteredData.length}</p>
            <p className="text-xs text-slate-500">van {overview.length} in database</p>
          </div>
          <div className="rounded-lg border border-amber-200/90 bg-amber-50/50 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-medium">
              <Star className="w-4 h-4 shrink-0" />
              Priority
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-900">{priorityCount}</p>
            <p className="text-xs text-amber-800/80">in huidige selectie</p>
          </div>
          <div className="rounded-lg border border-slate-300/80 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <MapPin className="w-4 h-4 shrink-0" />
              Fysiek in WLB
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{summary.inWb}</p>
            <p className="text-xs text-slate-500">fysiek in Willebroek</p>
          </div>
          <div className="rounded-lg border border-emerald-200/90 bg-emerald-50/40 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-medium">
              <Package className="w-4 h-4 shrink-0" />
              Stock ergens
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900">{summary.metStockPlek}</p>
            <p className="text-xs text-emerald-800/80">WLB, Genk of Wilrijk</p>
          </div>
          <div className="rounded-lg border border-cyan-200/90 bg-cyan-50/40 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-cyan-800 text-xs font-medium">
              <Truck className="w-4 h-4 shrink-0" />
              Onderweg
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-cyan-900">{summary.metTransfer}</p>
            <p className="text-xs text-cyan-800/80">in transfer (kolom)</p>
          </div>
          <div
            className={`rounded-lg border p-4 shadow-sm ${
              summary.forecastKritiek > 0
                ? 'border-rose-200/90 bg-rose-50/50'
                : 'border-slate-300/80 bg-white'
            }`}
          >
            <div
              className={`flex items-center gap-2 text-xs font-medium ${
                summary.forecastKritiek > 0 ? 'text-rose-800' : 'text-slate-500'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Forecast &lt; PILS
            </div>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                summary.forecastKritiek > 0 ? 'text-rose-900' : 'text-slate-900'
              }`}
            >
              {summary.forecastKritiek}
            </p>
            <p className="text-xs text-slate-500">negatieve marge t.o.v. datum</p>
          </div>
        </div>
        {commentCount > 0 && (
          <p className="mt-2 text-sm text-slate-600">
            {commentCount} {commentCount === 1 ? 'regel' : 'regels'} met opmerking in de selectie
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-300/80 bg-white p-4 shadow-sm sm:p-5" aria-label="Filters">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Zoek en filter</p>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <XCircle className="w-4 h-4" />
              Alle filters wissen
            </button>
          ) : (
            <span className="text-xs text-slate-500">Tip: combineer filters en snelknoppen hieronder.</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Kistsoort</label>
            <select
              value={kistTypeFilter}
              onChange={e => setKistTypeFilter(e.target.value as 'Alle' | 'C' | 'K')}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
            >
              <option value="Alle">Alle kisten</option>
              <option value="C">C-kist</option>
              <option value="K">K-kist (incl. V)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Productielocatie</label>
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
            >
              {locations.map(loc => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
            >
              {statusOptions.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">In Willebroek</label>
            <select
              value={willebroekFilter}
              onChange={e => setWillebroekFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
            >
              <option value="Alle">Alle</option>
              <option value="Ja">Ja</option>
              <option value="Nee">Nee</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
            >
              <option value="Alle">Alles</option>
              <option value="Priority Only">Alleen priority</option>
              <option value="Non-Priority">Zonder priority</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Zoeken</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Kist, type, artikel, locatie, opmerking"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200/80">
          <p className="text-xs font-medium text-slate-500 mb-2">Verberg regels waarbij (helpt plannen):</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setVerbergInProductie(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                verbergInProductie
                  ? 'bg-orange-100 text-orange-900 border-orange-300'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-orange-300'
              }`}
            >
              {verbergInProductie ? 'Aan' : 'Uit'}: al in productie
            </button>
            <button
              type="button"
              onClick={() => setVerbergOpStock(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                verbergOpStock
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-300'
              }`}
            >
              {verbergOpStock ? 'Aan' : 'Uit'}: reeds op stock
            </button>
            <button
              type="button"
              onClick={() => setVerbergInTransfer(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                verbergInTransfer
                  ? 'bg-cyan-100 text-cyan-900 border-cyan-300'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-cyan-300'
              }`}
            >
              {verbergInTransfer ? 'Aan' : 'Uit'}: in transfer
            </button>
            <button
              type="button"
              onClick={() => {
                setVerbergInProductie(true)
                setVerbergOpStock(true)
                setVerbergInTransfer(true)
              }}
              className="rounded-lg border border-[#153d75] bg-[#1a4b8c] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#153d75]"
            >
              Snel: alleen nog te produceren
            </button>
            {(verbergInProductie || verbergOpStock || verbergInTransfer) && (
              <button
                type="button"
                onClick={() => {
                  setVerbergInProductie(false)
                  setVerbergOpStock(false)
                  setVerbergInTransfer(false)
                }}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 underline-offset-2 hover:underline"
              >
                Wissen verbergen-filters
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={editedData.size === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1a4b8c] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#153d75] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="w-4 h-4" />
          Wijzigingen opslaan
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exporteer CSV
        </button>
        {selectedCases.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-200 w-full sm:w-auto">
            <span className="text-sm text-slate-600">{selectedCases.size} geselecteerd</span>
            <button
              type="button"
              onClick={() => handleBulkPriority(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600"
            >
              <Star className="w-4 h-4" />
              Priority
            </button>
            <button
              type="button"
              onClick={() => handleBulkPriority(false)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              <StarOff className="w-4 h-4" />
              Geen priority
            </button>
          </div>
        )}
      </div>

      <div className="max-h-[min(70vh,900px)] overflow-auto overflow-x-auto rounded-lg border border-slate-400/90 shadow-md">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 border-b border-[#0f2d52] bg-gradient-to-b from-[#1a4b8c] to-[#17487a] text-white shadow-sm">
            <tr>
              <th className="w-10 px-3 py-3 text-left text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={selectedCases.size === sortedData.length && sortedData.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-white/40 bg-white/10 text-[#1a4b8c] focus:ring-white/50"
                />
              </th>
              <th className="px-2 py-3 text-left text-xs font-semibold text-sky-100" aria-label="Priority">
                <Star className="inline h-3.5 w-3.5" />
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => handleSort('case_label')}
              >
                Kist / label{getSortIcon('case_label')}
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => handleSort('case_type')}
              >
                Type{getSortIcon('case_type')}
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => handleSort('arrival_date')}
                title="Datum waarop de unit op locatie PAC3PL (Willebroek) staat — uit PILS-export (kolom pccrdt / aankomst WLB)"
              >
                PILS-datum{getSortIcon('arrival_date')}
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => handleSort('forecast_date')}
              >
                Forecast{getSortIcon('forecast_date')}
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => handleSort('item_number')}
              >
                Artikel{getSortIcon('item_number')}
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => handleSort('serial_number')}
                title="PILS kolom F — Serial Number"
              >
                Serial{getSortIcon('serial_number')}
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => handleSort('pils_shop_order_key')}
                title="Laatste 6 cijfers van PILS serial (F); match met BC-export kolom I / suffix"
              >
                Shop-key{getSortIcon('pils_shop_order_key')}
              </th>
              <th
                className="min-w-[8rem] cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => handleSort('atlas_planner_email')}
                title="Atlas Planner e-mail uit BC-export (kolom H), na upload bc-shop-lines"
              >
                Atlas mail{getSortIcon('atlas_planner_email')}
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-sky-100 hover:bg-white/10"
                onClick={() => handleSort('bc_fp_item_no')}
                title="FP uit BC shop-export (Item No.), na upload bc-shop-lines"
              >
                BC FP{getSortIcon('bc_fp_item_no')}
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-sky-100 hover:bg-white/10"
                onClick={() => handleSort('bc_shop_order_no')}
                title="Shop order uit BC-export"
              >
                BC order{getSortIcon('bc_shop_order_no')}
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-sky-100 hover:bg-white/10"
                onClick={() => handleSort('bc_customer_order_no')}
                title="Customer Order No. uit BC-export (typ. kolom K)"
              >
                Cust. order{getSortIcon('bc_customer_order_no')}
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => handleSort('productielocatie')}
              >
                Productie{getSortIcon('productielocatie')}
              </th>
              <th
                className="whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-sky-100"
                title="Aantal lopende productieorders — kleur volgt productielocatie (WLB / Genk / Wilrijk)"
              >
                In prod.
              </th>
              <th
                className="whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-emerald-200"
                title="Beschikbaar in Willebroek (kanban/stock)"
              >
                WLB
              </th>
              <th
                className="whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-sky-200"
                title="Beschikbaar in Genk"
              >
                Genk
              </th>
              <th
                className="whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-violet-200"
                title="Beschikbaar in Wilrijk"
              >
                Wilrijk
              </th>
              <th
                className="whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-cyan-200"
                title="Aantal in transfer richting Willebroek (transferorders)"
              >
                Transf.
              </th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => handleSort('status')}
                title="Automatische status; bij actieve PO-tijd staat de live stap hieronder"
              >
                Status{getSortIcon('status')}
              </th>
              <th className="min-w-[7rem] px-2 py-3 text-left text-xs font-semibold text-white">Notitie</th>
              <th
                className="cursor-pointer select-none whitespace-nowrap px-2 py-3 text-left text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => handleSort('stock_location')}
                title="Locatie in PILS / WMS (bijv. PAC3PL = interne code voor WLB)"
              >
                WMS{getSortIcon('stock_location')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, idx) => {
              const edited = editedData.get(item.case_label) || {}
              const displayItem = { ...item, ...edited }
              const isPriority = displayItem.priority
              
              const isSelected = selectedCases.has(item.case_label)
              const zebra = idx % 2 === 0 ? 'bg-[#f0f6fc]' : 'bg-white'
              
              return (
                <tr
                  key={item.case_label}
                  className={`border-b border-slate-200/90 transition-colors ${
                    isPriority
                      ? 'bg-amber-50/90 hover:bg-amber-100/80'
                      : isSelected
                        ? 'bg-sky-100/70 hover:bg-sky-100'
                        : `${zebra} hover:bg-sky-50/50`
                  } ${isSelected ? 'outline outline-2 -outline-offset-2 outline-[#1a4b8c]/40' : ''}`}
                >
                  <td className="px-2 py-2 align-middle">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectCase(item.case_label)}
                      className="rounded border-slate-300 text-slate-800"
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <button
                      type="button"
                      onClick={() => handleFieldChange(item.case_label, 'priority', !displayItem.priority)}
                      className="text-amber-500 hover:text-amber-600 p-0.5 rounded"
                    >
                      {displayItem.priority ? <Star className="w-5 h-5 fill-current" /> : <StarOff className="w-5 h-5" />}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-slate-900 font-medium tabular-nums whitespace-nowrap">{displayItem.case_label}</td>
                  <td className="px-2 py-2 text-slate-700 whitespace-nowrap">{displayItem.case_type || '—'}</td>
                  <td className="px-2 py-2 text-slate-700 whitespace-nowrap">
                    {displayItem.arrival_date ? new Date(displayItem.arrival_date).toLocaleDateString('nl-NL') : '—'}
                  </td>
                  <td className="px-2 py-2 text-sm">
                    {(() => {
                      if (!displayItem.forecast_date) return <span className="text-gray-300">—</span>
                      const fDate = new Date(displayItem.forecast_date)
                      const pDate = displayItem.arrival_date ? new Date(displayItem.arrival_date) : null
                      // Positief = forecast vóór PILS = kist op tijd klaar (goed)
                      // Negatief = forecast ná PILS = kist te laat (probleem)
                      const diffDays = pDate ? Math.round((pDate.getTime() - fDate.getTime()) / 86400000) : null
                      const colorClass =
                        diffDays === null                  ? 'text-gray-700' :
                        diffDays < -7                     ? 'text-red-700 font-semibold' :  // >7 dagen te laat
                        diffDays < 0                      ? 'text-orange-600 font-medium' : // 1-7 dagen te laat
                        diffDays < 7                      ? 'text-yellow-600' :              // <7 dagen marge
                        'text-green-700'                                                      // ruim op tijd
                      const badge = diffDays !== null ? (
                        <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                          diffDays < -7   ? 'bg-red-100 text-red-700' :
                          diffDays < 0    ? 'bg-orange-100 text-orange-700' :
                          diffDays < 7    ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {diffDays >= 0 ? `+${diffDays}d` : `${diffDays}d`}
                        </span>
                      ) : null
                      return (
                        <span className={colorClass}>
                          {fDate.toLocaleDateString('nl-NL')}{badge}
                        </span>
                      )
                    })()}
                  </td>
                  <td className="px-2 py-2 text-slate-800">
                    {displayItem.item_number ? <BcItemCode value={displayItem.item_number} /> : '—'}
                  </td>
                  <td className="px-2 py-2 text-slate-700 font-mono text-xs whitespace-nowrap max-w-[9rem] truncate" title={displayItem.serial_number || undefined}>
                    {displayItem.serial_number || '—'}
                  </td>
                  <td className="px-2 py-2 text-slate-700 font-mono text-xs whitespace-nowrap" title={displayItem.pils_shop_order_key ? `Match-sleutel (suffix PILS F ↔ Excel I / substr 11,6): ${displayItem.pils_shop_order_key}` : undefined}>
                    {displayItem.pils_shop_order_key || '—'}
                  </td>
                  <td className="px-2 py-2 text-slate-700 text-xs max-w-[12rem] truncate" title={displayItem.atlas_planner_email || undefined}>
                    {displayItem.atlas_planner_email || '—'}
                  </td>
                  <td className="px-2 py-2 text-slate-800">
                    {displayItem.bc_fp_item_no ? <BcItemCode value={displayItem.bc_fp_item_no} /> : '—'}
                  </td>
                  <td className="px-2 py-2 text-slate-700 font-mono text-xs max-w-[10rem] truncate" title={displayItem.bc_shop_order_no || undefined}>
                    {displayItem.bc_shop_order_no || '—'}
                  </td>
                  <td className="px-2 py-2 text-slate-700 font-mono text-xs max-w-[10rem] truncate" title={displayItem.bc_customer_order_no || undefined}>
                    {displayItem.bc_customer_order_no || '—'}
                  </td>
                  <td className="px-2 py-2 text-slate-700 max-w-[10rem] truncate" title={displayItem.productielocatie || undefined}>
                    {displayItem.productielocatie || '—'}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">
                    {(displayItem.in_productie_qty ?? 0) > 0 ? (
                      <span
                        className={`inline-block font-semibold px-2 py-0.5 rounded-md text-xs ${inProductieQtyBadgeClass(displayItem.productielocatie)}`}
                      >
                        {displayItem.in_productie_qty}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">
                    {(displayItem.stock_willebroek ?? 0) > 0 ? (
                      <span className="inline-block bg-emerald-100 text-emerald-900 font-semibold px-2 py-0.5 rounded-md text-xs">
                        {displayItem.stock_willebroek}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">
                    {(displayItem.stock_genk ?? 0) > 0 ? (
                      <span className="inline-block bg-blue-100 text-blue-900 font-semibold px-2 py-0.5 rounded-md text-xs">
                        {displayItem.stock_genk}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">
                    {(displayItem.stock_wilrijk ?? 0) > 0 ? (
                      <span className="inline-block bg-violet-100 text-violet-900 font-semibold px-2 py-0.5 rounded-md text-xs">
                        {displayItem.stock_wilrijk}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums">
                    {(displayItem.in_transfer_qty ?? 0) > 0 ? (
                      <span className="inline-block bg-cyan-100 text-cyan-900 font-semibold px-2 py-0.5 rounded-md text-xs">
                        {displayItem.in_transfer_qty}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 max-w-[14rem]">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${getStatusBadgeClass(displayItem.status)}`}
                      title={
                        [
                          displayItem.status_reason || 'Automatisch bepaald op basis van stock, transfer en productie',
                          displayItem.production_time_active
                            ? productionTimeTooltip(displayItem.production_time_active)
                            : '',
                        ]
                          .filter(Boolean)
                          .join('\n\n') || undefined
                      }
                    >
                      {displayItem.status || 'Onbekend'}
                    </span>
                    {displayItem.production_time_active && (
                      <p
                        className="mt-1 max-w-[12rem] text-xs text-violet-900 font-semibold truncate"
                        title={productionTimeTooltip(displayItem.production_time_active)}
                      >
                        {displayItem.production_time_active.step}
                      </p>
                    )}
                    {displayItem.production_time_active?.production_order_number && (
                      <p
                        className="mt-0.5 max-w-[12rem] truncate text-[11px] text-slate-600 font-mono"
                        title={productionTimeTooltip(displayItem.production_time_active)}
                      >
                        {displayItem.production_time_active.production_order_number}
                      </p>
                    )}
                    {displayItem.status_reason && (
                      <p className="mt-1 max-w-[12rem] truncate text-xs text-slate-500" title={displayItem.status_reason}>
                        {displayItem.status_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2 min-w-[8rem] max-w-xs">
                    <input
                      type="text"
                      value={displayItem.comment || ''}
                      onChange={e => handleFieldChange(item.case_label, 'comment', e.target.value)}
                      placeholder="Notitie…"
                      className="text-sm w-full rounded-md border border-slate-300 px-2 py-1.5 focus:border-[#1a4b8c] focus:ring-1 focus:ring-[#1a4b8c]"
                    />
                  </td>
                  <td className="px-2 py-2 text-slate-700 text-xs max-w-[8rem] truncate" title={displayItem.stock_location || undefined}>
                    {displayItem.stock_location || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filteredData.length === 0 && (
        <p className="text-center py-10 text-sm text-slate-500">
          Geen regels in deze selectie. Wijzig de filters of klik &quot;Alle filters wissen&quot;.
        </p>
      )}
    </div>
  )
}


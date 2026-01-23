'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createWorker } from 'tesseract.js'

interface CNHMotor {
  id: number
  motor_nr: string
  type?: string
  location?: string
  shipping_note?: string
  state: 'to_check' | 'received' | 'packaged' | 'loaded'
  bodem_low?: number
  bodem_high?: number
  received_at?: string
  packaged_at?: string
  loaded_at?: string
  load_reference?: string
  container_number?: string
  truck_plate?: string
}

interface CNHTemplate {
  id: number
  name: string
  load_location?: string
  load_reference?: string
  container_number?: string
  truck_plate?: string
  booking_ref?: string
  your_ref?: string
  container_tarra?: number
  created_at?: string
}

interface PackOperator {
  id: number
  name: string
  active: boolean
  startTime: number | null
  totalTime: number
  status: 'active' | 'paused' | 'inactive'
}

interface LoadOperator {
  id: number
  name: string
  active: boolean
  startTime: number | null
  totalTime: number
}

export default function CNHWorkflowPage() {
  const [activeTab, setActiveTab] = useState<'incoming' | 'pack' | 'load'>('incoming')
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null)

  // Incoming tab state
  const [incomingShippingNote, setIncomingShippingNote] = useState('')
  const [incomingMotors, setIncomingMotors] = useState<Array<{motorNr: string; location: string}>>([{motorNr: '', location: 'China'}])

  // Pack tab state
  const [packMotors, setPackMotors] = useState<CNHMotor[]>([])
  const [packFilter, setPackFilter] = useState('')
  const [packSessionId, setPackSessionId] = useState<number | null>(null)
  const [packSessionStatus, setPackSessionStatus] = useState<'inactive' | 'active' | 'paused'>('inactive')
  const [packStartTime, setPackStartTime] = useState<number | null>(null)
  const [packTotalPausedTime, setPackTotalPausedTime] = useState(0)
  const [packPausedAt, setPackPausedAt] = useState<number | null>(null)
  const [packTimer, setPackTimer] = useState('00:00')
  const [packOperators, setPackOperators] = useState<PackOperator[]>([])
  const [packOperatorIdCounter, setPackOperatorIdCounter] = useState(1)
  const [packOperatorCount, setPackOperatorCount] = useState(1)
  const [selectedPackMotors, setSelectedPackMotors] = useState<Set<number>>(new Set())
  const [bodemInputs, setBodemInputs] = useState<Record<number, { low: number; high: number }>>({})

  // Load tab state
  const [loadMotors, setLoadMotors] = useState<CNHMotor[]>([])
  const [loadFilter, setLoadFilter] = useState('')
  const [loadSessionId, setLoadSessionId] = useState<number | null>(null)
  const [loadStartTime, setLoadStartTime] = useState<number | null>(null)
  const [loadTimer, setLoadTimer] = useState('00:00')
  const [loadOperators, setLoadOperators] = useState<LoadOperator[]>([])
  const [loadOperatorIdCounter, setLoadOperatorIdCounter] = useState(1)
  const [loadOperatorCount, setLoadOperatorCount] = useState(1)
  const [selectedLoadMotors, setSelectedLoadMotors] = useState<Set<number>>(new Set())
  const [templates, setTemplates] = useState<CNHTemplate[]>([])
  const [loadLocation, setLoadLocation] = useState('')
  const [loadReference, setLoadReference] = useState('')
  const [containerNumber, setContainerNumber] = useState('')
  const [truckPlate, setTruckPlate] = useState('')
  const [bookingRef, setBookingRef] = useState('')
  const [yourRef, setYourRef] = useState('')
  const [containerTarra, setContainerTarra] = useState('')
  const [containerPhotos, setContainerPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [editingMotor, setEditingMotor] = useState<CNHMotor | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [parsingPdf, setParsingPdf] = useState(false)

  const packTimerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const loadTimerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const packOperatorTimerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const showStatus = useCallback((text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setStatusMessage({ text, type })
    setTimeout(() => setStatusMessage(null), 5000)
  }, [])

  // Format duration helper
  const formatDuration = useCallback((ms: number) => {
    if (!ms || isNaN(ms)) ms = 0
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }, [])

  const formatTime = useCallback((ms: number) => {
    if (!ms || isNaN(ms)) ms = 0
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }, [])

  // INCOMING TAB FUNCTIONS
  const addIncomingMotorRow = useCallback(() => {
    setIncomingMotors((prev) => [...prev, {motorNr: '', location: 'China'}])
  }, [])

  const removeIncomingMotorRow = useCallback((index: number) => {
    setIncomingMotors((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateIncomingMotor = useCallback((index: number, motorNr: string, location?: string) => {
    setIncomingMotors((prev) => {
      const newMotors = [...prev]
      newMotors[index] = {
        motorNr: motorNr,
        location: location !== undefined ? location : newMotors[index].location,
      }
      return newMotors
    })
  }, [])

  const parsePdf = useCallback(async () => {
    if (!pdfFile) {
      showStatus('Geen PDF bestand geselecteerd', 'warning')
      return
    }

    setParsingPdf(true)
    try {
      // First, try server-side parsing (for text-based PDFs)
      const formData = new FormData()
      formData.append('file', pdfFile)

      const resp = await fetch('/api/cnh/parse-pdf', {
        method: 'POST',
        body: formData,
      })
      const data = await resp.json()

      // If server indicates it's a scanned PDF, use client-side OCR
      if (!resp.ok && data.isScanned) {
        showStatus('Gescand PDF gedetecteerd. OCR wordt uitgevoerd in de browser...', 'info')
        
        // Dynamic import of pdfjs-dist to avoid SSR issues
        const pdfjsLib = await import('pdfjs-dist')
        
        // Configure PDF.js worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
        
        // Client-side OCR for scanned PDFs
        const arrayBuffer = await pdfFile.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const numPages = pdf.numPages

        // Initialize Tesseract worker
        const worker = await createWorker('nld+eng') // Dutch + English
        
        // Configure worker for better OCR results
        // PSM 6 = Single uniform block of text
        await worker.setParameters({
          tessedit_pageseg_mode: 6, // Single uniform block of text
          tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -:',
        } as any) // Type assertion needed as Tesseract.js types may not be complete

        let allText = ''

        // Process each page
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          showStatus(`OCR bezig: pagina ${pageNum} van ${numPages}...`, 'info')
          
          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: 3.0 }) // Higher scale for better OCR quality

          // Create canvas to render PDF page
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Canvas context niet beschikbaar')

          canvas.height = viewport.height
          canvas.width = viewport.width

          // Render PDF page to canvas with better quality
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise

          // Perform OCR on the canvas image
          const { data: { text } } = await worker.recognize(canvas)
          console.log(`Pagina ${pageNum} OCR tekst (eerste 500 chars):`, text.substring(0, 500))
          allText += text + '\n'
        }

        await worker.terminate()

        // Debug: Log extracted text (first 2000 chars)
        console.log('OCR Extracted Text (first 2000 chars):', allText.substring(0, 2000))

        // Parse the extracted text
        const lines = allText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)

        // Helper function to correct OCR errors: "7" at start often should be "1"
        // Note: We only correct the first digit, as the last digit can legitimately be "7"
        const correctOCRNumber = (num: string): string => {
          // If number starts with "7" and is in range 100000-200000, likely should start with "1"
          if (num.startsWith('7') && num.length === 6) {
            const corrected = '1' + num.substring(1)
            const value = parseInt(corrected)
            if (value >= 100000 && value < 200000) {
              console.log(`OCR correctie: "${num}" -> "${corrected}" (eerste cijfer 7->1)`)
              num = corrected
            }
          }
          // If both start and end are "7", correct both (e.g., "738797" -> "138197")
          // This is a special case where OCR misreads both ends
          if (num.startsWith('7') && num.endsWith('7') && num.length === 6) {
            const corrected = '1' + num.substring(1, num.length - 1) + '1'
            const value = parseInt(corrected)
            if (value >= 100000 && value < 200000) {
              console.log(`OCR correctie: "${num}" -> "${corrected}" (beide uiteinden 7->1)`)
              num = corrected
            }
          }
          return num
        }

        // Extract shipping note - Look for "NR" followed by a number (e.g., "NR 138197")
        // Priority: Find "NR" followed by a 6-digit number starting with "1" (common pattern)
        let shippingNote = ''
        
        // First, try to find "NR" followed by a number (highest priority)
        const nrPattern = /\bNR\s+(\d{5,7})\b/i
        const nrMatch = allText.match(nrPattern)
        if (nrMatch && nrMatch[1]) {
          shippingNote = correctOCRNumber(nrMatch[1].trim())
          console.log('Shipping note gevonden via NR pattern:', shippingNote)
        } else {
          // Try other patterns
          const shippingNotePatterns = [
            /\bNR[:\s]*(\d{5,7})\b/i, // "NR: 138197" or "NR 138197"
            /verzendnota[:\s]+(\d{5,7})/i,
            /shipping\s*note[:\s]+(\d{5,7})/i,
          ]

          for (const pattern of shippingNotePatterns) {
            const match = allText.match(pattern)
            if (match && match[1]) {
              shippingNote = correctOCRNumber(match[1].trim())
              console.log('Shipping note gevonden:', shippingNote, 'via pattern:', pattern)
              break
            }
          }
          
          // Fallback: Look for 6-digit numbers in the top area (to catch OCR errors)
          if (!shippingNote) {
            const topText = allText.substring(0, Math.min(2000, allText.length))
            // Look for 6-digit numbers that could be shipping notes
            const nrNumbers = topText.match(/\b(\d{6})\b/g)
            if (nrNumbers && nrNumbers.length > 0) {
              // Prefer numbers starting with 1, but also check if 7 could be 1 (OCR error)
              for (const num of nrNumbers) {
                const corrected = correctOCRNumber(num)
                // If it starts with 1 (after correction) or is in valid range
                if (corrected.startsWith('1') || (parseInt(corrected) >= 100000 && parseInt(corrected) < 200000)) {
                  shippingNote = corrected
                  console.log('Shipping note gevonden (fallback met OCR correctie):', shippingNote)
                  break
                }
              }
              // If no match found, take the first one and try to correct it
              if (!shippingNote && nrNumbers.length > 0) {
                shippingNote = correctOCRNumber(nrNumbers[0])
                console.log('Shipping note gevonden (fallback eerste match):', shippingNote)
              }
            }
          }
        }

        // Extract motor numbers - Look for 6-digit numbers under "Stuknummer" column
        // These are typically 6-digit codes like 253226, 253365, etc.
        const motorNumbers: string[] = []
        
        // Look for "Stuknummer" section and extract numbers that follow
        const stuknummerIndex = lines.findIndex(line => 
          line.toLowerCase().includes('stuknummer') || 
          line.toLowerCase().includes('stuk nummer') ||
          line.toLowerCase().includes('stuknr')
        )
        
        console.log('Stuknummer index:', stuknummerIndex)
        
        // If we found "Stuknummer" header, look for numbers in nearby lines
        if (stuknummerIndex >= 0) {
          // Check lines after "Stuknummer" header (skip header line)
          for (let i = stuknummerIndex + 1; i < Math.min(stuknummerIndex + 30, lines.length); i++) {
            const line = lines[i]
            
            // Priority: Look for 6-digit numbers (most common motor number format)
            const sixDigitMatches = line.match(/\b(\d{6})\b/g)
            if (sixDigitMatches) {
              for (const num of sixDigitMatches) {
                // Filter out common false positives
                if (
                  parseInt(num) >= 100000 && // Valid 6-digit range
                  parseInt(num) < 999999 &&
                  !motorNumbers.includes(num) // Avoid duplicates
                ) {
                  motorNumbers.push(num)
                  console.log('Motor nummer gevonden (6-cijferig):', num, 'in regel:', line)
                }
              }
            }
            
            // Also check for other common motor number formats (5-7 digits)
            const flexibleMatches = line.match(/\b(\d{5,7})\b/g)
            if (flexibleMatches) {
              for (const num of flexibleMatches) {
                // Skip if already found or if it's likely not a motor number
                if (
                  !motorNumbers.includes(num) &&
                  num.length >= 5 && // At least 5 digits
                  parseInt(num) >= 10000 && // Reasonable minimum
                  parseInt(num) < 9999999 && // Reasonable maximum
                  !/^\d{4}$/.test(num) || parseInt(num) >= 2000 // Not a year
                ) {
                  motorNumbers.push(num)
                  console.log('Motor nummer gevonden (flexibel):', num, 'in regel:', line)
                }
              }
            }
          }
        }
        
        // Also search entire text for 6-digit numbers as fallback (more aggressive)
        if (motorNumbers.length === 0) {
          console.log('Geen motoren gevonden via Stuknummer, zoeken in volledige tekst...')
          // Priority: Look for 6-digit numbers throughout the document
          const sixDigitMatches = allText.match(/\b(\d{6})\b/g)
          if (sixDigitMatches) {
            for (const num of sixDigitMatches) {
              // Filter out common false positives (dates, years, etc.)
              if (
                parseInt(num) >= 100000 && // Valid 6-digit range
                parseInt(num) < 999999 &&
                !motorNumbers.includes(num) && // Avoid duplicates
                !num.includes(shippingNote) // Don't include shipping note
              ) {
                motorNumbers.push(num)
                console.log('Motor nummer gevonden (fallback 6-cijferig):', num)
              }
            }
          }
          
          // Fallback: Look for 5-7 digit numbers
          if (motorNumbers.length === 0) {
            const flexibleMatches = allText.match(/\b(\d{5,7})\b/g)
            if (flexibleMatches) {
              for (const num of flexibleMatches) {
                if (
                  !motorNumbers.includes(num) &&
                  num.length >= 5 &&
                  parseInt(num) >= 10000 &&
                  parseInt(num) < 9999999 &&
                  num !== shippingNote && // Don't include shipping note
                  (!/^\d{4}$/.test(num) || parseInt(num) >= 2000) // Not a year
                ) {
                  motorNumbers.push(num)
                  console.log('Motor nummer gevonden (fallback flexibel):', num)
                }
              }
            }
          }
        }

        // Remove duplicates while preserving original order
        const uniqueMotorNumbers: string[] = []
        const seen = new Set<string>()
        for (const num of motorNumbers) {
          if (!seen.has(num)) {
            seen.add(num)
            uniqueMotorNumbers.push(num)
          }
        }
        console.log('Totaal unieke motornummers gevonden:', uniqueMotorNumbers.length)
        console.log('Motornummers (originele volgorde):', uniqueMotorNumbers)

        // Fill in the extracted data
        if (shippingNote) {
          setIncomingShippingNote(shippingNote)
        }
        if (uniqueMotorNumbers.length > 0) {
          setIncomingMotors(
            uniqueMotorNumbers.map((motorNr: string) => ({
              motorNr: motorNr,
              location: 'China',
            }))
          )
          showStatus(`✅ OCR voltooid! ${uniqueMotorNumbers.length} motornummers gevonden.`, 'success')
        } else {
          console.warn('Geen motornummers gevonden. OCR tekst:', allText.substring(0, 1000))
          showStatus('Geen motornummers gevonden na OCR. Controleer de browser console voor details.', 'warning')
        }
        setPdfFile(null)
        return
      }

      // If server-side parsing succeeded
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Fout bij het lezen van PDF')
      }

      // Fill in the extracted data
      if (data.shippingNote) {
        setIncomingShippingNote(data.shippingNote)
      }
      if (data.motorNumbers && data.motorNumbers.length > 0) {
        setIncomingMotors(
          data.motorNumbers.map((motorNr: string) => ({
            motorNr: motorNr,
            location: 'China',
          }))
        )
        showStatus(`${data.motorNumbers.length} motornummers gevonden in PDF!`, 'success')
      } else {
        showStatus('Geen motornummers gevonden in PDF. Controleer het bestand.', 'warning')
      }
      setPdfFile(null)
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij het lezen van PDF: ' + e.message, 'error')
    } finally {
      setParsingPdf(false)
    }
  }, [pdfFile, showStatus])

  const handlePdfChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPdfFile(file)
    }
  }, [])

  const saveIncomingMotors = useCallback(async () => {
    const motors = incomingMotors.filter((m) => m.motorNr.trim())
    if (!motors.length) {
      showStatus('Gelieve minstens 1 motornummer in te geven', 'warning')
      return
    }
    if (!incomingShippingNote.trim()) {
      showStatus('Verzendnota is verplicht', 'warning')
      return
    }

    // Validate all motors have locations
    const motorsWithoutLocation = motors.filter((m) => !m.location || !m.location.trim())
    if (motorsWithoutLocation.length > 0) {
      showStatus('Alle motoren moeten een locatie hebben', 'warning')
      return
    }

    try {
      const resp = await fetch('/api/cnh/motors/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingNote: incomingShippingNote,
          motors: motors.map((m) => ({
            motorNr: m.motorNr.trim(),
            location: m.location,
          })),
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Fout bij opslaan')

      showStatus(`${motors.length} inkomende motoren succesvol geregistreerd!`, 'success')
      setIncomingShippingNote('')
      setIncomingMotors([{motorNr: '', location: 'China'}])
      fetchPackMotors()
      fetchLoadMotors()
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij inkomend opslaan: ' + e.message, 'error')
    }
  }, [incomingShippingNote, incomingMotors, showStatus])

  // PACK TAB FUNCTIONS
  const fetchPackMotors = useCallback(async () => {
    try {
      const resp = await fetch('/api/cnh/motors?state=received')
      const data = await resp.json()
      if (resp.ok) {
        setPackMotors(data || [])
      }
    } catch (e) {
      console.error('Error fetching pack motors:', e)
    }
  }, [])

  // LOAD TAB FUNCTIONS - fetch functions defined early
  const fetchLoadMotors = useCallback(async () => {
    try {
      const resp = await fetch('/api/cnh/motors?state=packaged')
      const data = await resp.json()
      if (resp.ok) {
        setLoadMotors(data || [])
      }
    } catch (e) {
      console.error('Error fetching load motors:', e)
    }
  }, [])

  // Update motor function
  const updateMotor = useCallback(async (motor: CNHMotor) => {
    try {
      const resp = await fetch(`/api/cnh/motors/${motor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(motor),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Fout bij bijwerken motor')
      }
      showStatus('Motor bijgewerkt', 'success')
      setEditingMotor(null)
      fetchPackMotors()
      fetchLoadMotors()
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij bijwerken motor: ' + e.message, 'error')
    }
  }, [showStatus, fetchPackMotors, fetchLoadMotors])

  const filteredPackMotors = useMemo(() => {
    if (!packFilter.trim()) return packMotors
    const filter = packFilter.toLowerCase()
    return packMotors.filter((m) => m.motor_nr.toLowerCase().includes(filter))
  }, [packMotors, packFilter])

  const startPackSession = useCallback(async () => {
    try {
      const resp = await fetch('/api/cnh/sessions/start-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'N/A',
          packaging_persons: packOperatorCount,
        }),
      })
      if (!resp.ok) throw new Error('Fout bij start sessie')
      const data = await resp.json()
      if (!data.sessionId) throw new Error('Geen sessionId ontvangen')

      const startTime = Date.now()
      setPackSessionId(data.sessionId)
      setPackStartTime(startTime)
      setPackSessionStatus('active')
      setPackTotalPausedTime(0)
      setPackPausedAt(null)

      // Initialize operators
      const newOperators: PackOperator[] = []
      for (let i = 1; i <= packOperatorCount; i++) {
        newOperators.push({
          id: packOperatorIdCounter + i - 1,
          name: `Verpakker ${packOperatorIdCounter + i - 1}`,
          active: true,
          startTime: startTime,
          totalTime: 0,
          status: 'active',
        })
      }
      setPackOperators(newOperators)
      setPackOperatorIdCounter((prev) => prev + packOperatorCount)

      // Start timers
      if (packTimerIntervalRef.current) {
        clearInterval(packTimerIntervalRef.current)
      }
      packTimerIntervalRef.current = setInterval(() => {
        setPackTimer((prev) => {
          const diffMs = Date.now() - startTime - packTotalPausedTime
          return formatTime(diffMs)
        })
      }, 1000)

      if (packOperatorTimerIntervalRef.current) {
        clearInterval(packOperatorTimerIntervalRef.current)
      }
      packOperatorTimerIntervalRef.current = setInterval(() => {
        setPackOperators((prev) =>
          prev.map((op) => {
            if (op.status === 'active' && op.startTime) {
              const currentTime = Date.now()
              const sessionTime = currentTime - op.startTime
              return {
                ...op,
                totalTime: op.totalTime + sessionTime,
                startTime: currentTime,
              }
            }
            return op
          })
        )
      }, 1000)

      showStatus('Verpakken sessie gestart!', 'success')
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij begin verpakken: ' + e.message, 'error')
    }
  }, [packOperatorCount, packOperatorIdCounter, packTotalPausedTime, formatTime, showStatus])

  const pausePackSession = useCallback(() => {
    if (packSessionStatus !== 'active') return
    setPackSessionStatus('paused')
    setPackPausedAt(Date.now())
    setPackOperators((prev) =>
      prev.map((op) => {
        if (op.status === 'active') {
          return {
            ...op,
            status: 'paused',
            totalTime: op.startTime ? op.totalTime + (Date.now() - op.startTime) : op.totalTime,
            startTime: null,
          }
        }
        return op
      })
    )
    showStatus('Verpakken sessie gepauzeerd', 'info')
  }, [packSessionStatus, showStatus])

  const resumePackSession = useCallback(() => {
    if (packSessionStatus !== 'paused') return
    const pauseDuration = packPausedAt ? Date.now() - packPausedAt : 0
    setPackTotalPausedTime((prev) => prev + pauseDuration)
    setPackSessionStatus('active')
    setPackPausedAt(null)
    const resumeTime = Date.now()
    setPackOperators((prev) =>
      prev.map((op) => ({
        ...op,
        status: 'active',
        startTime: resumeTime,
      }))
    )
    showStatus('Verpakken sessie hervat', 'success')
  }, [packSessionStatus, packPausedAt, showStatus])

  const stopPackSession = useCallback(() => {
    if (!packSessionId) {
      showStatus('Geen lopende verpak-sessie', 'warning')
      return
    }
    if (!confirm('Wilt u de verpak-sessie beëindigen zonder motoren te verpakken?')) return

    if (packTimerIntervalRef.current) {
      clearInterval(packTimerIntervalRef.current)
      packTimerIntervalRef.current = null
    }
    if (packOperatorTimerIntervalRef.current) {
      clearInterval(packOperatorTimerIntervalRef.current)
      packOperatorTimerIntervalRef.current = null
    }
    setPackSessionId(null)
    setPackStartTime(null)
    setPackSessionStatus('inactive')
    setPackOperators([])
    setPackTimer('00:00')
    showStatus('Verpakken sessie beëindigd zonder motoren te verpakken', 'info')
  }, [packSessionId, showStatus])

  const finishPackaging = useCallback(async () => {
    if (!packSessionId) {
      showStatus('Geen lopende verpak-sessie', 'warning')
      return
    }
    if (selectedPackMotors.size === 0) {
      showStatus('Geen motoren geselecteerd. Selecteer minstens één motor.', 'warning')
      return
    }

    let diffMs = 0
    if (packSessionStatus === 'active' && packStartTime) {
      diffMs = Date.now() - packStartTime - packTotalPausedTime
    } else if (packSessionStatus === 'paused' && packPausedAt && packStartTime) {
      diffMs = packPausedAt - packStartTime - packTotalPausedTime
    }
    const packaging_minutes = Math.round(diffMs / 60000)

    const selectedMotors = Array.from(selectedPackMotors).map((motorId) => {
      const motor = packMotors.find((m) => m.id === motorId)
      return {
        motorId,
        location: motor?.location || 'N/A',
      }
    })

    const locationSet = new Set(selectedMotors.map((m) => m.location))
    let finalLoc = 'N/A'
    if (locationSet.size === 1) {
      finalLoc = Array.from(locationSet)[0]
    } else if (locationSet.size > 1) {
      finalLoc = 'Mixed'
    }

    const operator_minutes = Math.round(
      packOperators.reduce((sum, op) => sum + op.totalTime, 0) / 60000
    )

    const motorsPayload = Array.from(selectedPackMotors).map((motorId) => {
      const motor = packMotors.find((m) => m.id === motorId)
      const bodems = bodemInputs[motorId] || { low: 0, high: 0 }
      return {
        motorId,
        bodemsLow: motor?.location === 'China' ? bodems.low : 0,
        bodemsHigh: motor?.location === 'China' ? bodems.high : 0,
      }
    })

    try {
      // Update bodems stock
      for (const motor of motorsPayload) {
        if (motor.bodemsLow > 0) {
          await fetch('/api/cnh/bodems-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'laag',
              quantity: motor.bodemsLow,
              operation: 'subtract',
            }),
          }).catch((err) => console.error('Fout bij bijwerken lage bodems voorraad:', err))
        }
        if (motor.bodemsHigh > 0) {
          await fetch('/api/cnh/bodems-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'hoog',
              quantity: motor.bodemsHigh,
              operation: 'subtract',
            }),
          }).catch((err) => console.error('Fout bij bijwerken hoge bodems voorraad:', err))
        }
      }

      // Stop session
      const stopResp = await fetch('/api/cnh/sessions/stop-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: packSessionId,
          packaging_minutes,
          packaging_count: selectedMotors.length,
          packaging_persons: packOperators.length,
          operator_minutes,
          location: finalLoc,
          motors: selectedMotors,
        }),
      })
      const stopData = await stopResp.json()
      if (!stopResp.ok || !stopData.success) {
        throw new Error(stopData.error || 'Fout in stop sessie')
      }

      // Package motors
      if (motorsPayload.length > 0) {
        const packageResp = await fetch('/api/cnh/motors/package', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motors: motorsPayload }),
        })
        const packageData = await packageResp.json()
        if (!packageResp.ok || !packageData.success) {
          throw new Error(packageData.error || 'Fout bij /api/cnh/motors/package')
        }
      }

      // Clear session
      if (packTimerIntervalRef.current) {
        clearInterval(packTimerIntervalRef.current)
        packTimerIntervalRef.current = null
      }
      if (packOperatorTimerIntervalRef.current) {
        clearInterval(packOperatorTimerIntervalRef.current)
        packOperatorTimerIntervalRef.current = null
      }
      setPackSessionId(null)
      setPackStartTime(null)
      setPackSessionStatus('inactive')
      setPackOperators([])
      setPackTimer('00:00')
      setSelectedPackMotors(new Set())
      setBodemInputs({})

      showStatus(
        `Verpakken sessie gestopt + ${selectedMotors.length} motoren gemarkeerd als packaged`,
        'success'
      )
      fetchPackMotors()
      fetchLoadMotors()
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij stop verpakken: ' + e.message, 'error')
    }
  }, [
    packSessionId,
    packSessionStatus,
    packStartTime,
    packTotalPausedTime,
    packPausedAt,
    selectedPackMotors,
    packMotors,
    bodemInputs,
    packOperators,
    showStatus,
    fetchPackMotors,
    fetchLoadMotors,
  ])

  const addPackOperator = useCallback(() => {
    setPackOperators((prev) => [
      ...prev,
      {
        id: packOperatorIdCounter,
        name: `Verpakker ${packOperatorIdCounter}`,
        active: false,
        startTime: null,
        totalTime: 0,
        status: 'inactive',
      },
    ])
    setPackOperatorIdCounter((prev) => prev + 1)
  }, [packOperatorIdCounter])

  // LOAD TAB FUNCTIONS
  const fetchTemplates = useCallback(async () => {
    try {
      const resp = await fetch('/api/cnh/templates')
      const data = await resp.json()
      if (resp.ok) {
        setTemplates(data || [])
      }
    } catch (e) {
      console.error('Error fetching templates:', e)
    }
  }, [])

  const filteredLoadMotors = useMemo(() => {
    if (!loadFilter.trim()) return loadMotors
    const filter = loadFilter.toLowerCase()
    return loadMotors.filter((m) => m.motor_nr.toLowerCase().includes(filter))
  }, [loadMotors, loadFilter])

  const applyTemplate = useCallback(
    (template: CNHTemplate) => {
      if (template.load_location) setLoadLocation(template.load_location)
      if (template.load_reference) setLoadReference(template.load_reference)
      if (template.container_number) setContainerNumber(template.container_number)
      if (template.truck_plate) setTruckPlate(template.truck_plate)
      if (template.booking_ref) setBookingRef(template.booking_ref)
      if (template.your_ref) setYourRef(template.your_ref)
      if (template.container_tarra) setContainerTarra(template.container_tarra.toString())
      showStatus(`Template "${template.name}" toegepast`, 'success')
    },
    [showStatus]
  )

  const saveTemplate = useCallback(async () => {
    if (!templateName.trim()) {
      showStatus('Geef een naam voor de template', 'warning')
      return
    }

    try {
      const resp = await fetch('/api/cnh/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          load_location: loadLocation.trim() || null,
          load_reference: loadReference.trim() || null,
          container_number: containerNumber.trim() || null,
          truck_plate: truckPlate.trim() || null,
          booking_ref: bookingRef.trim() || null,
          your_ref: yourRef.trim() || null,
          container_tarra: containerTarra ? parseFloat(containerTarra) : null,
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Fout bij opslaan template')
      }
      showStatus(`Template "${templateName}" opgeslagen`, 'success')
      setShowSaveTemplateModal(false)
      setTemplateName('')
      fetchTemplates()
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij opslaan template: ' + e.message, 'error')
    }
  }, [
    templateName,
    loadLocation,
    loadReference,
    containerNumber,
    truckPlate,
    bookingRef,
    yourRef,
    containerTarra,
    showStatus,
    fetchTemplates,
  ])

  const deleteTemplate = useCallback(
    async (id: number) => {
      if (!confirm('Weet je zeker dat je deze template wilt verwijderen?')) return
      try {
        const resp = await fetch(`/api/cnh/templates/${id}`, {
          method: 'DELETE',
        })
        const data = await resp.json()
        if (!resp.ok || !data.success) {
          throw new Error(data.error || 'Fout bij verwijderen template')
        }
        showStatus('Template verwijderd', 'success')
        fetchTemplates()
      } catch (e: any) {
        console.error(e)
        showStatus('Fout bij verwijderen template: ' + e.message, 'error')
      }
    },
    [showStatus, fetchTemplates]
  )

  const startLoadSession = useCallback(async () => {
    if (!loadLocation.trim() || !loadReference.trim() || !containerNumber.trim()) {
      showStatus('Vul alle verplichte velden in (Laad-locatie, Laadreferentie, Containernummer)', 'warning')
      return
    }

    try {
      const resp = await fetch('/api/cnh/sessions/start-load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: loadLocation,
          loading_persons: loadOperatorCount,
        }),
      })
      if (!resp.ok) throw new Error('Fout bij start load sessie')
      const data = await resp.json()
      if (!data.sessionId) throw new Error('Geen sessionId ontvangen')

      const startTime = Date.now()
      setLoadSessionId(data.sessionId)
      setLoadStartTime(startTime)

      // Initialize operators
      const newOperators: LoadOperator[] = []
      for (let i = 1; i <= loadOperatorCount; i++) {
        newOperators.push({
          id: loadOperatorIdCounter + i - 1,
          name: `Operator ${loadOperatorIdCounter + i - 1}`,
          active: false,
          startTime: null,
          totalTime: 0,
        })
      }
      setLoadOperators(newOperators)
      setLoadOperatorIdCounter((prev) => prev + loadOperatorCount)

      // Start timer
      if (loadTimerIntervalRef.current) {
        clearInterval(loadTimerIntervalRef.current)
      }
      loadTimerIntervalRef.current = setInterval(() => {
        setLoadTimer((prev) => {
          const diffMs = Date.now() - startTime
          return formatTime(diffMs)
        })
      }, 1000)

      showStatus('Laadsessie gestart!', 'success')
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij begin laden: ' + e.message, 'error')
    }
  }, [loadLocation, loadReference, containerNumber, loadOperatorCount, loadOperatorIdCounter, formatTime, showStatus])

  const stopLoadSession = useCallback(async () => {
    if (!loadSessionId) {
      showStatus('Geen lopende laadsessie?', 'warning')
      return
    }
    if (selectedLoadMotors.size === 0) {
      showStatus('Selecteer minstens 1 motor om te laden.', 'warning')
      return
    }

    const loading_minutes = Math.round(loadOperators.reduce((sum, op) => sum + op.totalTime, 0) / 60000)
    const motorIds = Array.from(selectedLoadMotors)

    try {
      // Load motors
      const respLoad = await fetch('/api/cnh/motors/load', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motorIds,
          loadReference: loadReference.trim(),
          containerNumber: containerNumber.trim(),
          truckPlate: truckPlate.trim(),
        }),
      })
      const dataLoad = await respLoad.json()
      if (!respLoad.ok || !dataLoad.success) {
        throw new Error(dataLoad.error || 'Fout bij cnh_motors/load')
      }

      // Stop session
      const stopResp = await fetch('/api/cnh/sessions/stop-load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: loadSessionId,
          loading_minutes,
          loading_count: motorIds.length,
          loading_persons: loadOperators.length,
          load_reference: loadReference.trim(),
          container_no: containerNumber.trim(),
          truck_plate: truckPlate.trim(),
          motorIds,
          booking_ref: bookingRef.trim(),
          your_ref: yourRef.trim(),
          container_tarra: containerTarra ? parseFloat(containerTarra) : 0,
        }),
      })
      const stopData = await stopResp.json()
      if (!stopResp.ok || !stopData.success) {
        throw new Error(stopData.error || 'Fout in stop_load')
      }

      if (loadTimerIntervalRef.current) {
        clearInterval(loadTimerIntervalRef.current)
        loadTimerIntervalRef.current = null
      }
      setLoadSessionId(null)
      setLoadStartTime(null)
      setLoadOperators([])
      setLoadTimer('00:00')
      setSelectedLoadMotors(new Set())

      showStatus(`Laadsessie gestopt + ${motorIds.length} motoren succesvol geladen!`, 'success')
      fetchLoadMotors()
    } catch (e: any) {
      console.error('stopLoadSession:', e)
      showStatus('Fout bij stopLoadSession: ' + e.message, 'error')
    }
  }, [
    loadSessionId,
    selectedLoadMotors,
    loadOperators,
    loadReference,
    containerNumber,
    truckPlate,
    bookingRef,
    yourRef,
    containerTarra,
    showStatus,
    fetchLoadMotors,
  ])

  const cancelLoadSession = useCallback(async () => {
    if (!loadSessionId) {
      showStatus('Geen lopende laadsessie om te annuleren.', 'warning')
      return
    }
    if (!confirm('Weet je zeker dat je de laadsessie wilt annuleren?')) return

    try {
      const resp = await fetch('/api/cnh/sessions/cancel-load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: loadSessionId }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Fout bij annuleren laadsessie')
      }
      showStatus('Laadsessie geannuleerd!', 'info')
      if (loadTimerIntervalRef.current) {
        clearInterval(loadTimerIntervalRef.current)
        loadTimerIntervalRef.current = null
      }
      setLoadSessionId(null)
      setLoadStartTime(null)
      setLoadOperators([])
      setLoadTimer('00:00')
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij annuleren laadsessie: ' + e.message, 'error')
    }
  }, [loadSessionId, showStatus])

  const uploadContainerPhoto = useCallback(async () => {
    if (!loadSessionId) {
      showStatus('Geen lopende laadsessie (er is geen sessionId opgeslagen).', 'warning')
      return
    }
    if (containerPhotos.length === 0) {
      showStatus('Geen foto geselecteerd', 'warning')
      return
    }

    const formData = new FormData()
    formData.append('sessionId', loadSessionId.toString())
    containerPhotos.forEach((photo) => {
      formData.append('photos', photo)
    })

    try {
      const resp = await fetch('/api/cnh/sessions/upload-container-photo', {
        method: 'POST',
        body: formData,
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Fout bij uploaden foto')
      }
      showStatus('✅ Containerfoto succesvol geüpload en gekoppeld aan laadsessie!', 'success')
      setContainerPhotos([])
      setPhotoPreviews([])
      // Clear file input
      const fileInput = document.getElementById('containerPhotoInput') as HTMLInputElement
      if (fileInput) {
        fileInput.value = ''
      }
    } catch (e: any) {
      console.error(e)
      showStatus('❌ Fout bij uploaden foto: ' + e.message, 'error')
    }
  }, [loadSessionId, containerPhotos, showStatus])

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setContainerPhotos(files)
    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = (event) => resolve((event.target?.result as string) || '')
            reader.readAsDataURL(file)
          })
      )
    ).then((previews) => setPhotoPreviews(previews.filter(Boolean)))
  }, [])

  const sendLoadEmail = useCallback(async () => {
    if (!loadReference.trim() || !containerNumber.trim()) {
      showStatus('Vul Laadreferentie en Containernummer in', 'warning')
      return
    }

    try {
      const resp = await fetch('/api/cnh/send-load-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loadReference: loadReference.trim(),
          containerNumber: containerNumber.trim(),
          truckPlate: truckPlate.trim(),
        }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Fout bij versturen email')
      }
      showStatus('Email verzonden!', 'success')
    } catch (e: any) {
      console.error(e)
      showStatus('Fout bij versturen email: ' + e.message, 'error')
    }
  }, [loadReference, containerNumber, truckPlate, showStatus])

  const addLoadOperator = useCallback(() => {
    setLoadOperators((prev) => [
      ...prev,
      {
        id: loadOperatorIdCounter,
        name: `Operator ${loadOperatorIdCounter}`,
        active: false,
        startTime: null,
        totalTime: 0,
      },
    ])
    setLoadOperatorIdCounter((prev) => prev + 1)
  }, [loadOperatorIdCounter])

  const startLoadOperator = useCallback(
    (operatorId: number) => {
      setLoadOperators((prev) =>
        prev.map((op) => {
          if (op.id === operatorId) {
            return {
              ...op,
              active: true,
              startTime: Date.now(),
            }
          }
          return op
        })
      )
    },
    []
  )

  const stopLoadOperator = useCallback((operatorId: number) => {
    setLoadOperators((prev) =>
      prev.map((op) => {
        if (op.id === operatorId && op.active && op.startTime) {
          return {
            ...op,
            active: false,
            totalTime: op.totalTime + (Date.now() - op.startTime),
            startTime: null,
          }
        }
        return op
      })
    )
  }, [])

  const removeLoadOperator = useCallback((operatorId: number) => {
    setLoadOperators((prev) => {
      const operator = prev.find((op) => op.id === operatorId)
      if (operator?.active) {
        stopLoadOperator(operatorId)
      }
      return prev.filter((op) => op.id !== operatorId)
    })
  }, [stopLoadOperator])

  // Load saved templates on mount
  useEffect(() => {
    fetchTemplates()
    fetchPackMotors()
    fetchLoadMotors()
  }, [fetchTemplates, fetchPackMotors, fetchLoadMotors])

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (packTimerIntervalRef.current) {
        clearInterval(packTimerIntervalRef.current)
      }
      if (loadTimerIntervalRef.current) {
        clearInterval(loadTimerIntervalRef.current)
      }
      if (packOperatorTimerIntervalRef.current) {
        clearInterval(packOperatorTimerIntervalRef.current)
      }
    }
  }, [])

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 md:py-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">CNH Workflow</h1>
        <a
          href="/cnh/verify"
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm flex items-center gap-2"
        >
          📱 Verificatie (Tablet)
        </a>
      </div>

      {/* Status messages */}
      {statusMessage && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            statusMessage.type === 'success'
              ? 'bg-green-100 text-green-800'
              : statusMessage.type === 'error'
              ? 'bg-red-100 text-red-800'
              : statusMessage.type === 'warning'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'incoming'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Inkomend
          </button>
          <button
            onClick={() => setActiveTab('pack')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pack'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Verpakken
          </button>
          <button
            onClick={() => setActiveTab('load')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'load'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Laden
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* INCOMING TAB */}
        {activeTab === 'incoming' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Inkomend</h2>
            
            {/* PDF Upload Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-3">PDF Upload (Automatisch Uitlezen)</h3>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload PDF Bestand
                  </label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {pdfFile && (
                    <p className="mt-1 text-sm text-gray-600">
                      Geselecteerd: {pdfFile.name}
                    </p>
                  )}
                </div>
                <button
                  onClick={parsePdf}
                  disabled={!pdfFile || parsingPdf}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {parsingPdf ? 'Bezig met lezen...' : 'PDF Uitlezen'}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verzendnota <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={incomingShippingNote}
                onChange={(e) => setIncomingShippingNote(e.target.value)}
                placeholder="bv: VerzNote123"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Motornummers (met locatie per motor)</label>
              {incomingMotors.map((motor, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={motor.motorNr}
                    onChange={(e) => updateIncomingMotor(index, e.target.value)}
                    placeholder="Motornummer"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={motor.location}
                    onChange={(e) => updateIncomingMotor(index, motor.motorNr, e.target.value)}
                    className="w-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="China">China</option>
                    <option value="Amerika">Amerika</option>
                    <option value="UZB">UZB</option>
                    <option value="Other">Anders</option>
                  </select>
                  <button
                    onClick={() => removeIncomingMotorRow(index)}
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={addIncomingMotorRow}
                className="mt-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                + Motor Toevoegen
              </button>
            </div>
            <div className="mt-6">
              <button
                onClick={saveIncomingMotors}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                Opslaan (Inkomend)
              </button>
            </div>
          </div>
        )}

        {/* PACK TAB */}
        {activeTab === 'pack' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Verpakken</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Aantal Operators:</label>
              <input
                type="number"
                value={packOperatorCount}
                onChange={(e) => setPackOperatorCount(parseInt(e.target.value) || 1)}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mb-4 flex gap-2">
              {packSessionStatus === 'inactive' && (
                <button
                  onClick={startPackSession}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Begin Verpakken
                </button>
              )}
              {packSessionStatus === 'active' && (
                <>
                  <button
                    onClick={pausePackSession}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                  >
                    Pauzeer Verpakken
                  </button>
                  <button
                    onClick={stopPackSession}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Stop Verpakken
                  </button>
                </>
              )}
              {packSessionStatus === 'paused' && (
                <>
                  <button
                    onClick={resumePackSession}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Hervat Verpakken
                  </button>
                  <button
                    onClick={stopPackSession}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Stop Verpakken
                  </button>
                </>
              )}
            </div>
            {packSessionStatus !== 'inactive' && (
              <div className="mb-4 p-3 bg-gray-100 rounded-md">
                <div className="text-lg font-semibold">
                  Tijd bezig: <span className="text-red-600">{packTimer}</span>
                </div>
              </div>
            )}
            {packSessionStatus !== 'inactive' && packOperators.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Verpakkers</h3>
                {packOperators.map((op) => (
                  <div key={op.id} className="mb-2 p-3 bg-gray-50 rounded-md flex justify-between items-center">
                    <div>
                      <span className={`inline-block w-3 h-3 rounded-full mr-2 ${op.status === 'active' ? 'bg-green-500' : op.status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                      <span className="font-medium">{op.name}</span>
                      <span className="ml-2 text-sm text-gray-600">
                        {formatDuration(op.totalTime + (op.status === 'active' && op.startTime ? Date.now() - op.startTime : 0))}
                      </span>
                    </div>
                  </div>
                ))}
                <button
                  onClick={addPackOperator}
                  className="mt-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  + Operator Toevoegen
                </button>
              </div>
            )}
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={packFilter}
                onChange={(e) => setPackFilter(e.target.value)}
                placeholder="Filter op motornummer..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setPackFilter('')}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                ×
              </button>
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Te Verpakken Motoren{' '}
              <span className="text-sm font-normal text-gray-600">
                ({selectedPackMotors.size}/{filteredPackMotors.length})
              </span>
            </h3>
            <div className="mb-4 max-h-96 overflow-y-auto border border-gray-300 rounded-md">
              <table className="w-full">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left border-b">Select</th>
                    <th className="px-4 py-2 text-left border-b">Motornummer</th>
                    <th className="px-4 py-2 text-left border-b">Locatie</th>
                    <th className="px-4 py-2 text-left border-b">Verzendnota</th>
                    {filteredPackMotors.some((m) => m.location === 'China') && (
                      <>
                        <th className="px-4 py-2 text-left border-b">Bodem Laag</th>
                        <th className="px-4 py-2 text-left border-b">Bodem Hoog</th>
                      </>
                    )}
                    <th className="px-4 py-2 text-left border-b">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPackMotors.map((motor) => (
                    <tr key={motor.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedPackMotors.has(motor.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedPackMotors)
                            if (e.target.checked) {
                              newSelected.add(motor.id)
                            } else {
                              newSelected.delete(motor.id)
                            }
                            setSelectedPackMotors(newSelected)
                          }}
                          className="w-5 h-5"
                        />
                      </td>
                      <td className="px-4 py-2">{motor.motor_nr}</td>
                      <td className="px-4 py-2">{motor.location || 'N/A'}</td>
                      <td className="px-4 py-2">{motor.shipping_note || 'N/A'}</td>
                      {motor.location === 'China' && (
                        <>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="0"
                              value={bodemInputs[motor.id]?.low || 0}
                              onChange={(e) => {
                                setBodemInputs((prev) => ({
                                  ...prev,
                                  [motor.id]: {
                                    ...prev[motor.id],
                                    low: parseInt(e.target.value) || 0,
                                    high: prev[motor.id]?.high || 0,
                                  },
                                }))
                              }}
                              className="w-20 px-2 py-1 border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="0"
                              value={bodemInputs[motor.id]?.high || 0}
                              onChange={(e) => {
                                setBodemInputs((prev) => ({
                                  ...prev,
                                  [motor.id]: {
                                    ...prev[motor.id],
                                    low: prev[motor.id]?.low || 0,
                                    high: parseInt(e.target.value) || 0,
                                  },
                                }))
                              }}
                              className="w-20 px-2 py-1 border border-gray-300 rounded"
                            />
                          </td>
                        </>
                      )}
                      {motor.location !== 'China' && (
                        <>
                          <td className="px-4 py-2">-</td>
                          <td className="px-4 py-2">-</td>
                        </>
                      )}
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setEditingMotor(motor)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                        >
                          Bewerken
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {packSessionStatus !== 'inactive' && (
              <div className="mt-4">
                <button
                  onClick={finishPackaging}
                  className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                >
                  Verpak Geselecteerde Motoren
                </button>
              </div>
            )}
          </div>
        )}

        {/* LOAD TAB */}
        {activeTab === 'load' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Laad Workflow</h2>
            {/* Templates */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Kies een laad-template:</label>
              <div className="flex gap-2 mb-2">
                <select
                  onChange={(e) => {
                    const template = templates.find((t) => t.id === parseInt(e.target.value))
                    if (template) applyTemplate(template)
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecteer template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowSaveTemplateModal(true)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  Opslaan
                </button>
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => {
                    const chinaTemplate = templates.find((t) => t.load_location === 'China')
                    if (chinaTemplate) applyTemplate(chinaTemplate)
                    else setLoadLocation('China')
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  China
                </button>
                <button
                  onClick={() => {
                    const amTemplate = templates.find((t) => t.load_location === 'Amerika')
                    if (amTemplate) applyTemplate(amTemplate)
                    else setLoadLocation('Amerika')
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Amerika
                </button>
                <button
                  onClick={() => {
                    const uzbTemplate = templates.find((t) => t.load_location === 'UZB')
                    if (uzbTemplate) applyTemplate(uzbTemplate)
                    else setLoadLocation('UZB')
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  UZB
                </button>
              </div>
              {templates.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium mb-2">Beschikbare templates:</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {templates.map((t) => (
                      <div key={t.id} className="flex justify-between items-center p-2 bg-white rounded border">
                        <span>{t.name}</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => applyTemplate(t)}
                            className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Toepassen
                          </button>
                          <button
                            onClick={() => deleteTemplate(t.id)}
                            className="px-2 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            Verwijderen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Load Information */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Laad Informatie</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Laad-locatie <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={loadLocation}
                    onChange={(e) => setLoadLocation(e.target.value)}
                    placeholder="vb: China"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Laadreferentie <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={loadReference}
                    onChange={(e) => setLoadReference(e.target.value)}
                    placeholder="vb: LOADREF123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Containernummer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={containerNumber}
                    onChange={(e) => setContainerNumber(e.target.value)}
                    placeholder="vb: CONT999"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Truck nummerplaat</label>
                  <input
                    type="text"
                    value={truckPlate}
                    onChange={(e) => setTruckPlate(e.target.value)}
                    placeholder="vb: 1-ABC-123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Booking Ref</label>
                  <input
                    type="text"
                    value={bookingRef}
                    onChange={(e) => setBookingRef(e.target.value)}
                    placeholder="bv: BK123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Ref</label>
                  <input
                    type="text"
                    value={yourRef}
                    onChange={(e) => setYourRef(e.target.value)}
                    placeholder="bv: YR999"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Container Tarra (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={containerTarra}
                    onChange={(e) => setContainerTarra(e.target.value)}
                    placeholder="bv: 2200.50"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Aantal Operators (laden):</label>
                  <input
                    type="number"
                    value={loadOperatorCount}
                    onChange={(e) => setLoadOperatorCount(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Load Session Controls */}
            <div className="mb-6">
              {!loadSessionId ? (
                <button
                  onClick={startLoadSession}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Begin Laden
                </button>
              ) : (
                <div>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={stopLoadSession}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Stop Laden
                    </button>
                    <button
                      onClick={cancelLoadSession}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                    >
                      Annuleer Laden
                    </button>
                  </div>
                  <div className="mb-2 p-3 bg-gray-100 rounded-md">
                    <div className="text-lg font-semibold">
                      Laadtijd: <span className="text-red-600">{loadTimer}</span>
                    </div>
                  </div>
                  {loadOperators.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold mb-2">Operators</h3>
                      {loadOperators.map((op) => (
                        <div key={op.id} className="mb-2 p-3 bg-gray-50 rounded-md flex justify-between items-center">
                          <div>
                            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${op.active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span className="font-medium">{op.name}</span>
                            <span className="ml-2 text-sm text-gray-600">
                              {formatDuration(op.totalTime + (op.active && op.startTime ? Date.now() - op.startTime : 0))}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            {op.active ? (
                              <button
                                onClick={() => stopLoadOperator(op.id)}
                                className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                Pauze
                              </button>
                            ) : (
                              <button
                                onClick={() => startLoadOperator(op.id)}
                                className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                              >
                                Start
                              </button>
                            )}
                            <button
                              onClick={() => removeLoadOperator(op.id)}
                              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={addLoadOperator}
                        className="mt-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                      >
                        + Operator Toevoegen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Photo Upload */}
            {loadSessionId && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Foto van container</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  id="containerPhotoInput"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {photoPreviews.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {photoPreviews.map((preview, index) => (
                      <img
                        key={`${preview}-${index}`}
                        src={preview}
                        alt={`Preview ${index + 1}`}
                        className="max-h-32 w-auto rounded border"
                      />
                    ))}
                  </div>
                )}
                <button
                  onClick={uploadContainerPhoto}
                  disabled={containerPhotos.length === 0}
                  className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Upload Foto{containerPhotos.length > 1 ? "'s" : ''}
                </button>
              </div>
            )}

            {/* Motor Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Motor Selectie</h3>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={loadFilter}
                  onChange={(e) => setLoadFilter(e.target.value)}
                  placeholder="Filter op motornummer..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setLoadFilter('')}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                >
                  ×
                </button>
                <button
                  onClick={() => {
                    const allSelected = filteredLoadMotors.every((m) => selectedLoadMotors.has(m.id))
                    if (allSelected) {
                      setSelectedLoadMotors(new Set())
                    } else {
                      setSelectedLoadMotors(new Set(filteredLoadMotors.map((m) => m.id)))
                    }
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Selecteer Alles
                </button>
              </div>
              <h4 className="text-md font-semibold mb-2">
                Te Laden Motoren{' '}
                <span className="text-sm font-normal text-gray-600">
                  ({selectedLoadMotors.size}/{filteredLoadMotors.length})
                </span>
              </h4>
              <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-md">
                <table className="w-full">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left border-b">Select</th>
                      <th className="px-4 py-2 text-left border-b">Motornummer</th>
                      <th className="px-4 py-2 text-left border-b">Locatie</th>
                      <th className="px-4 py-2 text-left border-b">Verzendnota</th>
                      <th className="px-4 py-2 text-left border-b">Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLoadMotors.map((motor) => (
                      <tr key={motor.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selectedLoadMotors.has(motor.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedLoadMotors)
                              if (e.target.checked) {
                                newSelected.add(motor.id)
                              } else {
                                newSelected.delete(motor.id)
                              }
                              setSelectedLoadMotors(newSelected)
                            }}
                            className="w-5 h-5"
                          />
                        </td>
                        <td className="px-4 py-2">{motor.motor_nr}</td>
                        <td className="px-4 py-2">{motor.location || 'N/A'}</td>
                        <td className="px-4 py-2">{motor.shipping_note || 'N/A'}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => setEditingMotor(motor)}
                            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                          >
                            Bewerken
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={stopLoadSession}
                disabled={!loadSessionId || selectedLoadMotors.size === 0}
                className="flex-1 px-6 py-3 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Laden
              </button>
              <button
                onClick={sendLoadEmail}
                disabled={!loadReference.trim() || !containerNumber.trim()}
                className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Verstuur Mail
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Motor Modal */}
      {editingMotor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Motor Bewerken</h2>
                <button
                  onClick={() => setEditingMotor(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  updateMotor(editingMotor)
                }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Motornummer</label>
                    <input
                      type="text"
                      value={editingMotor.motor_nr}
                      onChange={(e) => setEditingMotor({ ...editingMotor, motor_nr: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                    <select
                      value={editingMotor.state}
                      onChange={(e) => setEditingMotor({ ...editingMotor, state: e.target.value as 'to_check' | 'received' | 'packaged' | 'loaded' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="to_check">to_check</option>
                      <option value="received">received</option>
                      <option value="packaged">packaged</option>
                      <option value="loaded">loaded</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Locatie</label>
                    <select
                      value={editingMotor.location || ''}
                      onChange={(e) => setEditingMotor({ ...editingMotor, location: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecteer...</option>
                      <option value="China">China</option>
                      <option value="Amerika">Amerika</option>
                      <option value="UZB">UZB</option>
                      <option value="Other">Anders</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Verzendnota</label>
                    <input
                      type="text"
                      value={editingMotor.shipping_note || ''}
                      onChange={(e) => setEditingMotor({ ...editingMotor, shipping_note: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bodem Laag</label>
                    <input
                      type="number"
                      min="0"
                      value={editingMotor.bodem_low || 0}
                      onChange={(e) => setEditingMotor({ ...editingMotor, bodem_low: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bodem Hoog</label>
                    <input
                      type="number"
                      min="0"
                      value={editingMotor.bodem_high || 0}
                      onChange={(e) => setEditingMotor({ ...editingMotor, bodem_high: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Laadreferentie</label>
                    <input
                      type="text"
                      value={editingMotor.load_reference || ''}
                      onChange={(e) => setEditingMotor({ ...editingMotor, load_reference: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Container Nummer</label>
                    <input
                      type="text"
                      value={editingMotor.container_number || ''}
                      onChange={(e) => setEditingMotor({ ...editingMotor, container_number: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Truck Nummerplaat</label>
                    <input
                      type="text"
                      value={editingMotor.truck_plate || ''}
                      onChange={(e) => setEditingMotor({ ...editingMotor, truck_plate: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setEditingMotor(null)}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Opslaan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Template Opslaan</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Template Naam</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="bv: China Standaard"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveTemplate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Opslaan
              </button>
              <button
                onClick={() => {
                  setShowSaveTemplateModal(false)
                  setTemplateName('')
                }}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

interface MappingRow {
  old_code: string
  new_code: string
  description: string | null
}

interface BcMappingContextValue {
  /** Aantal geladen mappings (0 tot de fetch klaar is, of als de tabel leeg is). */
  size: number
  /** true zolang de eerste fetch nog loopt. */
  loading: boolean
  /** Zet een oud BC-nummer om naar het nieuwe. Onbekend → input ongewijzigd terug. */
  toNew: (code: string | null | undefined) => string
  /** Omgekeerde lookup: nieuw → oud. Onbekend → input ongewijzigd terug. */
  toOld: (code: string | null | undefined) => string
  /** Harde refresh (na Excel-upload). */
  refresh: () => Promise<void>
}

const BcMappingContext = createContext<BcMappingContextValue | null>(null)

const SESSION_KEY = 'bc_item_mapping_v1'
const SESSION_TTL_MS = 10 * 60 * 1000 // 10 min

interface CachedPayload {
  ts: number
  mappings: MappingRow[]
}

function readCache(): MappingRow[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedPayload
    if (!parsed?.ts || Date.now() - parsed.ts > SESSION_TTL_MS) return null
    return Array.isArray(parsed.mappings) ? parsed.mappings : null
  } catch {
    return null
  }
}

function writeCache(mappings: MappingRow[]) {
  if (typeof window === 'undefined') return
  try {
    const payload: CachedPayload = { ts: Date.now(), mappings }
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage kan vol zijn bij grote mappings — dan gewoon geen cache.
  }
}

export function BcMappingProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [oldToNew, setOldToNew] = useState<Map<string, string>>(() => new Map())
  const [newToOld, setNewToOld] = useState<Map<string, string>>(() => new Map())

  const applyMappings = useCallback((mappings: MappingRow[]) => {
    const oldMap = new Map<string, string>()
    const newMap = new Map<string, string>()
    for (const m of mappings) {
      if (!m?.old_code || !m?.new_code) continue
      const oldKey = m.old_code.toUpperCase()
      const newKey = m.new_code.toUpperCase()
      oldMap.set(oldKey, m.new_code)
      // Bij dubbele new_codes winnen de eerste; de tabel hoort uniek te zijn op old_code
      // maar new_code kan in theorie meerdere keren voorkomen.
      if (!newMap.has(newKey)) newMap.set(newKey, m.old_code)
    }
    setOldToNew(oldMap)
    setNewToOld(newMap)
  }, [])

  const fetchFresh = useCallback(async () => {
    try {
      const res = await fetch('/api/bc-mappings', { cache: 'no-store' })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const data = (await res.json()) as { mappings?: MappingRow[] }
      const mappings = Array.isArray(data.mappings) ? data.mappings : []
      applyMappings(mappings)
      writeCache(mappings)
    } catch {
      // stil falen: als de API onbereikbaar is, gebruiken we de ongewijzigde codes.
    } finally {
      setLoading(false)
    }
  }, [applyMappings])

  useEffect(() => {
    const cached = readCache()
    if (cached && cached.length > 0) {
      applyMappings(cached)
      setLoading(false)
      // Ongeveer direct daarna toch revalideren in de achtergrond.
      void fetchFresh()
      return
    }
    void fetchFresh()
  }, [applyMappings, fetchFresh])

  const toNew = useCallback(
    (code: string | null | undefined) => {
      if (!code) return ''
      const key = code.toUpperCase()
      return oldToNew.get(key) ?? code
    },
    [oldToNew]
  )

  const toOld = useCallback(
    (code: string | null | undefined) => {
      if (!code) return ''
      const key = code.toUpperCase()
      return newToOld.get(key) ?? code
    },
    [newToOld]
  )

  const value = useMemo<BcMappingContextValue>(
    () => ({
      size: oldToNew.size,
      loading,
      toNew,
      toOld,
      refresh: fetchFresh,
    }),
    [oldToNew.size, loading, toNew, toOld, fetchFresh]
  )

  return <BcMappingContext.Provider value={value}>{children}</BcMappingContext.Provider>
}

export function useBcMapping(): BcMappingContextValue {
  const ctx = useContext(BcMappingContext)
  if (ctx) return ctx
  // Veilige no-op fallback zodat componenten nooit crashen als ze buiten de provider gebruikt worden.
  return {
    size: 0,
    loading: false,
    toNew: (c) => c || '',
    toOld: (c) => c || '',
    refresh: async () => {},
  }
}

/**
 * Leidt het oude én nieuwe BC-nummer af uit een willekeurige ruwe invoer.
 * Werkt ongeacht of `raw` de oude (GP...) of nieuwe (FP...) variant is.
 * - Match in oud→nieuw: returned `{ oldCode: raw, newCode: vertaling }`.
 * - Match in nieuw→oud: returned `{ oldCode: vertaling, newCode: raw }`.
 * - Geen match: beide velden krijgen `raw` (we kennen de tegenhanger niet).
 */
export function resolveBcPair(
  raw: string | null | undefined,
  toNew: (c: string | null | undefined) => string,
  toOld: (c: string | null | undefined) => string
): { oldCode: string; newCode: string; matched: boolean } {
  const trimmed = raw == null ? '' : String(raw).trim()
  if (!trimmed) return { oldCode: '', newCode: '', matched: false }
  const maybeNew = toNew(trimmed)
  if (maybeNew && maybeNew !== trimmed) {
    return { oldCode: trimmed, newCode: maybeNew, matched: true }
  }
  const maybeOld = toOld(trimmed)
  if (maybeOld && maybeOld !== trimmed) {
    return { oldCode: maybeOld, newCode: trimmed, matched: true }
  }
  return { oldCode: trimmed, newCode: trimmed, matched: false }
}

/**
 * Rendert het NIEUWE BC-artikelnummer met het oude als tooltip.
 * - `value` mag het oude of het nieuwe nummer zijn; we proberen eerst oud→nieuw.
 * - Als er geen mapping bekend is, tonen we gewoon de input zonder tooltip.
 */
export function BcItemCode({
  value,
  className,
  prefix,
  fallback = '',
}: {
  value: string | number | null | undefined
  className?: string
  prefix?: string
  fallback?: string
}) {
  const { toNew, toOld } = useBcMapping()
  const raw = value == null ? '' : String(value).trim()
  if (!raw) return <span className={className}>{fallback}</span>

  const newCode = toNew(raw)
  let oldCode: string
  if (newCode === raw) {
    // `raw` is (waarschijnlijk) al het nieuwe nummer — lookup de oude.
    const maybeOld = toOld(raw)
    oldCode = maybeOld !== raw ? maybeOld : ''
  } else {
    oldCode = raw
  }

  const title = oldCode ? `Oud BC-nummer: ${oldCode}` : undefined
  return (
    <span className={className} title={title}>
      {prefix}
      {newCode}
      {oldCode ? <sup className="ml-0.5 text-[0.65em] text-gray-400">ⓘ</sup> : null}
    </span>
  )
}

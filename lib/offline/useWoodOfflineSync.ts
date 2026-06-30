'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { WoodStock } from '@/types/database'
import {
  cacheStock,
  countOutbox,
  getCachedStock,
  getCachedStockMeta,
  getOutbox,
  patchCachedStock,
  removeCachedStock,
  removeOutbox,
  resetAuthErrorOutboxItems,
  updateOutbox,
  type OutboxItem,
} from './woodOfflineDb'
import { supabase } from '@/lib/supabase/client'

interface SyncState {
  online: boolean
  pending: number
  syncing: boolean
  lastSync: string | null
  errors: number
}

const INITIAL_STATE: SyncState = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pending: 0,
  syncing: false,
  lastSync: null,
  errors: 0,
}

const FETCH_INIT: RequestInit = { credentials: 'include' }

function isAuthHttpStatus(status: number): boolean {
  return status === 401 || status === 403
}

async function ensureSessionCookie(): Promise<boolean> {
  try {
    let res = await fetch('/api/auth/me', { ...FETCH_INIT, cache: 'no-store' })
    if (res.ok) return true
    if (res.status !== 401) return false

    const { data } = await supabase.auth.refreshSession()
    const token = data.session?.access_token
    if (!token) return false

    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ access_token: token }),
    })

    res = await fetch('/api/auth/me', { ...FETCH_INIT, cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

async function sendOutboxItem(
  item: OutboxItem
): Promise<{ ok: boolean; error?: string; fatal?: boolean; authError?: boolean }> {
  try {
    if (item.kind === 'pick') {
      const res = await fetch('/api/wood/pick', {
        ...FETCH_INIT,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_id: item.stock_id,
          aantal: item.aantal,
          opmerking: item.opmerking || undefined,
        }),
      })
      if (res.ok) return { ok: true }
      const body = await res.json().catch(() => ({} as any))
      const authError = isAuthHttpStatus(res.status)
      // 404 / 400 zijn "fataal" — dit item gaat nooit alsnog slagen
      const fatal = !authError && (res.status === 404 || res.status === 400)
      return { ok: false, error: body?.error || `HTTP ${res.status}`, fatal, authError }
    }
    if (item.kind === 'count') {
      const res = await fetch('/api/wood/count', {
        ...FETCH_INIT,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_id: item.stock_id,
          nieuw_aantal: item.nieuw_aantal,
          oud_aantal: item.oud_aantal,
          reden: item.reden,
          opmerking: item.opmerking,
          snapshot: item.snapshot,
          client_created_at: item.client_created_at,
        }),
      })
      if (res.ok) return { ok: true }
      const body = await res.json().catch(() => ({} as any))
      const authError = isAuthHttpStatus(res.status)
      const fatal = !authError && res.status === 400
      return { ok: false, error: body?.error || `HTTP ${res.status}`, fatal, authError }
    }
    if (item.kind === 'edit') {
      const res = await fetch('/api/wood/stock', {
        ...FETCH_INIT,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.stock_id, ...(item.patch || {}) }),
      })
      if (res.ok) return { ok: true }
      const body = await res.json().catch(() => ({} as any))
      const authError = isAuthHttpStatus(res.status)
      const fatal = !authError && (res.status === 404 || res.status === 400)
      return { ok: false, error: body?.error || `HTTP ${res.status}`, fatal, authError }
    }
    return { ok: false, error: `Onbekend type ${item.kind}`, fatal: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Netwerkfout' }
  }
}

export interface UseWoodOfflineSyncOptions {
  /** Fetcher voor server-side stock lijst (GET /api/wood/stock). Wordt telkens aangeroepen bij refresh/online-event. */
  fetchStock: () => Promise<WoodStock[]>
  /** Optionele callback bij state change */
  onChange?: (stock: WoodStock[]) => void
}

export function useWoodOfflineSync({ fetchStock, onChange }: UseWoodOfflineSyncOptions) {
  const [state, setState] = useState<SyncState>(INITIAL_STATE)
  const [stock, setStock] = useState<WoodStock[]>([])
  const [loading, setLoading] = useState(true)
  const syncInFlightRef = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const refreshPending = useCallback(async () => {
    const [n, meta] = await Promise.all([countOutbox(), getCachedStockMeta()])
    const ob = await getOutbox()
    const errors = ob.filter((i) => i.status === 'error').length
    setState((s) => ({ ...s, pending: n, errors, lastSync: meta.lastSync }))
  }, [])

  // Laad de lokale cache eerst (werkt ook offline), daarna probeer server ophalen.
  const loadFromCache = useCallback(async () => {
    const cached = await getCachedStock()
    if (cached.length > 0) {
      setStock(cached)
      onChangeRef.current?.(cached)
    }
    await refreshPending()
  }, [refreshPending])

  const refetchFromServer = useCallback(async () => {
    try {
      const fresh = await fetchStock()
      await cacheStock(fresh)
      setStock(fresh)
      onChangeRef.current?.(fresh)
      await refreshPending()
      return true
    } catch {
      return false
    }
  }, [fetchStock, refreshPending])

  const syncOutbox = useCallback(async (options?: { retryAuthErrors?: boolean }) => {
    if (syncInFlightRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    syncInFlightRef.current = true
    setState((s) => ({ ...s, syncing: true }))
    try {
      if (options?.retryAuthErrors) {
        await resetAuthErrorOutboxItems()
      }
      await ensureSessionCookie()

      const ob = await getOutbox()
      for (const item of ob) {
        if (item.status === 'error') continue // wachten op handmatig actie
        await updateOutbox(item.clientId, {
          status: 'syncing',
          attempts: item.attempts + 1,
        })
        const result = await sendOutboxItem(item)
        if (result.ok) {
          await removeOutbox(item.clientId)
        } else if (result.authError) {
          // Sessie verlopen: blijf pending zodat opnieuw inloggen + sync kan helpen
          await updateOutbox(item.clientId, {
            status: 'pending',
            last_error: result.error || 'Niet ingelogd',
          })
        } else if (result.fatal || item.attempts + 1 >= 5) {
          await updateOutbox(item.clientId, {
            status: 'error',
            last_error: result.error || 'Onbekende fout',
          })
        } else {
          await updateOutbox(item.clientId, {
            status: 'pending',
            last_error: result.error || null,
          })
        }
      }
    } finally {
      syncInFlightRef.current = false
      setState((s) => ({ ...s, syncing: false }))
      await refreshPending()
    }
  }, [refreshPending])

  const fullSync = useCallback(async () => {
    await syncOutbox({ retryAuthErrors: true })
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await refetchFromServer()
    }
  }, [refetchFromServer, syncOutbox])

  const retryAuthErrors = useCallback(async () => {
    await resetAuthErrorOutboxItems()
    await syncOutbox({ retryAuthErrors: true })
    await refreshPending()
  }, [refreshPending, syncOutbox])

  // Init
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await loadFromCache()
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await refetchFromServer()
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [loadFromCache, refetchFromServer])

  // online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState((s) => ({ ...s, online: true }))
      void fullSync()
    }
    const handleOffline = () => setState((s) => ({ ...s, online: false }))
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [fullSync])

  // Periodieke achtergrond-sync (10s) wanneer online + pending
  useEffect(() => {
    const id = window.setInterval(async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const ob = await getOutbox()
        const hasWork = ob.some((item) => item.status === 'pending' || item.status === 'syncing')
        if (hasWork) void syncOutbox()
      }
    }, 10_000)
    return () => window.clearInterval(id)
  }, [syncOutbox])

  // Na opnieuw inloggen: auth-fouten opnieuw proberen
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void syncOutbox({ retryAuthErrors: true })
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [syncOutbox])

  // Helpers die de lokale cache bijwerken. Gebruik deze vanuit de UI.
  const applyLocalPick = useCallback(
    async (stockId: number, aantal: number) => {
      const current = stock.find((s) => s.id === stockId)
      if (!current) return
      const newAantal = Math.max(0, current.aantal - aantal)
      if (newAantal === 0) {
        await removeCachedStock(stockId)
        setStock((prev) => prev.filter((s) => s.id !== stockId))
      } else {
        await patchCachedStock(stockId, { aantal: newAantal })
        setStock((prev) => prev.map((s) => (s.id === stockId ? { ...s, aantal: newAantal } : s)))
      }
    },
    [stock]
  )

  const applyLocalCount = useCallback(
    async (stockId: number, nieuwAantal: number) => {
      const nowIso = new Date().toISOString()
      if (nieuwAantal <= 0) {
        await removeCachedStock(stockId)
        setStock((prev) => prev.filter((s) => s.id !== stockId))
      } else {
        await patchCachedStock(stockId, { aantal: nieuwAantal, laatst_geteld_op: nowIso } as any)
        setStock((prev) =>
          prev.map((s) =>
            s.id === stockId ? ({ ...s, aantal: nieuwAantal, laatst_geteld_op: nowIso } as WoodStock) : s
          )
        )
      }
    },
    []
  )

  const applyLocalEdit = useCallback(
    async (stockId: number, patch: Partial<WoodStock>) => {
      await patchCachedStock(stockId, patch)
      setStock((prev) =>
        prev.map((s) => (s.id === stockId ? ({ ...s, ...patch } as WoodStock) : s))
      )
    },
    []
  )

  return {
    state,
    stock,
    loading,
    refetchFromServer,
    syncOutbox,
    fullSync,
    retryAuthErrors,
    applyLocalPick,
    applyLocalCount,
    applyLocalEdit,
    refreshPending,
  }
}

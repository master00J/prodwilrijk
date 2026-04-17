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
  updateOutbox,
  type OutboxItem,
} from './woodOfflineDb'

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

async function sendOutboxItem(item: OutboxItem): Promise<{ ok: boolean; error?: string; fatal?: boolean }> {
  try {
    if (item.kind === 'pick') {
      const res = await fetch('/api/wood/pick', {
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
      // 404 / 400 zijn "fataal" — dit item gaat nooit alsnog slagen
      const fatal = res.status === 404 || res.status === 400
      return { ok: false, error: body?.error || `HTTP ${res.status}`, fatal }
    }
    if (item.kind === 'count') {
      const res = await fetch('/api/wood/count', {
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
      const fatal = res.status === 400
      return { ok: false, error: body?.error || `HTTP ${res.status}`, fatal }
    }
    if (item.kind === 'edit') {
      const res = await fetch('/api/wood/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.stock_id, ...(item.patch || {}) }),
      })
      if (res.ok) return { ok: true }
      const body = await res.json().catch(() => ({} as any))
      const fatal = res.status === 404 || res.status === 400
      return { ok: false, error: body?.error || `HTTP ${res.status}`, fatal }
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

  const syncOutbox = useCallback(async () => {
    if (syncInFlightRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    syncInFlightRef.current = true
    setState((s) => ({ ...s, syncing: true }))
    try {
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
        } else {
          if (result.fatal || item.attempts + 1 >= 5) {
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
      }
    } finally {
      syncInFlightRef.current = false
      setState((s) => ({ ...s, syncing: false }))
      await refreshPending()
    }
  }, [refreshPending])

  const fullSync = useCallback(async () => {
    await syncOutbox()
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await refetchFromServer()
    }
  }, [refetchFromServer, syncOutbox])

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
        const n = await countOutbox()
        if (n > 0) void syncOutbox()
      }
    }, 10_000)
    return () => window.clearInterval(id)
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
    applyLocalPick,
    applyLocalCount,
    applyLocalEdit,
    refreshPending,
  }
}

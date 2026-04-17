// Lichtgewicht IndexedDB-wrapper voor de offline wood-flow.
// Twee stores:
//   - wood_stock_cache : volledige snapshot van wood_stock, keyed by id
//   - wood_outbox      : pending acties (pick/count) die gesynced moeten worden

import type { WoodStock } from '@/types/database'

const DB_NAME = 'prodwilrijk_wood_offline'
const DB_VERSION = 1
const STORE_STOCK = 'wood_stock_cache'
const STORE_OUTBOX = 'wood_outbox'
const STORE_META = 'wood_meta'

export type OutboxKind = 'pick' | 'count' | 'edit'

export interface OutboxItem {
  clientId: string
  kind: OutboxKind
  stock_id: number | null
  // voor picks
  aantal?: number
  // voor counts
  nieuw_aantal?: number
  oud_aantal?: number
  reden?: string | null
  opmerking?: string | null
  // voor edits: partial patch met alle wijzigbare velden
  patch?: {
    houtsoort?: string
    pakketnummer?: string | null
    dikte?: number
    breedte?: number
    lengte?: number
    locatie?: string
    aantal?: number
  }
  // snapshot context (handig voor server-side logging wanneer stock_id ondertussen verdwenen is)
  snapshot?: {
    houtsoort?: string | null
    pakketnummer?: string | null
    locatie?: string | null
    dikte?: number | null
    breedte?: number | null
    lengte?: number | null
  }
  gebruiker_email?: string | null
  gebruiker_id?: string | null
  client_created_at: string
  attempts: number
  last_error?: string | null
  status: 'pending' | 'syncing' | 'error'
}

function hasIdb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIdb()) {
      reject(new Error('IndexedDB niet beschikbaar'))
      return
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_STOCK)) {
        db.createObjectStore(STORE_STOCK, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        db.createObjectStore(STORE_OUTBOX, { keyPath: 'clientId' })
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function runTx<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  work: (stores: Record<string, IDBObjectStore>) => Promise<T> | T
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames]
        const tx = db.transaction(names, mode)
        const stores: Record<string, IDBObjectStore> = {}
        names.forEach((n) => {
          stores[n] = tx.objectStore(n)
        })
        let result: T
        Promise.resolve(work(stores))
          .then((r) => {
            result = r
          })
          .catch((err) => {
            tx.abort()
            reject(err)
          })
        tx.oncomplete = () => resolve(result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      })
  )
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function cacheStock(items: WoodStock[]): Promise<void> {
  if (!hasIdb()) return
  await runTx([STORE_STOCK, STORE_META], 'readwrite', async (s) => {
    await reqToPromise(s[STORE_STOCK].clear())
    for (const it of items) {
      await reqToPromise(s[STORE_STOCK].put(it))
    }
    await reqToPromise(
      s[STORE_META].put({ key: 'wood_stock_last_sync', value: new Date().toISOString() })
    )
  })
}

export async function getCachedStock(): Promise<WoodStock[]> {
  if (!hasIdb()) return []
  return runTx(STORE_STOCK, 'readonly', async (s) => {
    const all = await reqToPromise<WoodStock[]>(s[STORE_STOCK].getAll() as IDBRequest<WoodStock[]>)
    return all
  })
}

export async function getCachedStockMeta(): Promise<{ lastSync: string | null }> {
  if (!hasIdb()) return { lastSync: null }
  return runTx(STORE_META, 'readonly', async (s) => {
    const row = await reqToPromise<{ key: string; value: string } | undefined>(
      s[STORE_META].get('wood_stock_last_sync') as IDBRequest<any>
    )
    return { lastSync: row?.value || null }
  })
}

export async function patchCachedStock(
  id: number,
  patch: Partial<WoodStock>
): Promise<void> {
  if (!hasIdb()) return
  await runTx(STORE_STOCK, 'readwrite', async (s) => {
    const existing = await reqToPromise<WoodStock | undefined>(
      s[STORE_STOCK].get(id) as IDBRequest<any>
    )
    if (!existing) return
    const merged = { ...existing, ...patch }
    await reqToPromise(s[STORE_STOCK].put(merged))
  })
}

export async function removeCachedStock(id: number): Promise<void> {
  if (!hasIdb()) return
  await runTx(STORE_STOCK, 'readwrite', async (s) => {
    await reqToPromise(s[STORE_STOCK].delete(id))
  })
}

export async function enqueueOutbox(item: Omit<OutboxItem, 'clientId' | 'attempts' | 'status'> & { clientId?: string }): Promise<OutboxItem> {
  if (!hasIdb()) throw new Error('IndexedDB niet beschikbaar')
  const full: OutboxItem = {
    clientId: item.clientId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    attempts: 0,
    status: 'pending',
    ...item,
  }
  await runTx(STORE_OUTBOX, 'readwrite', async (s) => {
    await reqToPromise(s[STORE_OUTBOX].put(full))
  })
  return full
}

export async function getOutbox(): Promise<OutboxItem[]> {
  if (!hasIdb()) return []
  return runTx(STORE_OUTBOX, 'readonly', async (s) => {
    const all = await reqToPromise<OutboxItem[]>(s[STORE_OUTBOX].getAll() as IDBRequest<OutboxItem[]>)
    return all
  })
}

export async function countOutbox(): Promise<number> {
  const all = await getOutbox()
  return all.length
}

export async function updateOutbox(clientId: string, patch: Partial<OutboxItem>): Promise<void> {
  if (!hasIdb()) return
  await runTx(STORE_OUTBOX, 'readwrite', async (s) => {
    const existing = await reqToPromise<OutboxItem | undefined>(
      s[STORE_OUTBOX].get(clientId) as IDBRequest<any>
    )
    if (!existing) return
    await reqToPromise(s[STORE_OUTBOX].put({ ...existing, ...patch }))
  })
}

export async function removeOutbox(clientId: string): Promise<void> {
  if (!hasIdb()) return
  await runTx(STORE_OUTBOX, 'readwrite', async (s) => {
    await reqToPromise(s[STORE_OUTBOX].delete(clientId))
  })
}

export async function clearOutbox(): Promise<void> {
  if (!hasIdb()) return
  await runTx(STORE_OUTBOX, 'readwrite', async (s) => {
    await reqToPromise(s[STORE_OUTBOX].clear())
  })
}

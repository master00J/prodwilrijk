import { fetchHourlyPacked } from '@/lib/api'
import { acquireBackgroundKeeper, releaseBackgroundKeeper } from '@/lib/background-keeper'
import { isHandsFreeServiceEnabled } from '@/lib/jarvis-hands-free'
import { speak, stopSpeaking } from '@/lib/speech'

let intervalHandle: ReturnType<typeof setInterval> | null = null
let running = false
let isAnnouncing = false

async function announceOnce(): Promise<void> {
  if (isAnnouncing) return
  isAnnouncing = true
  try {
    const data = await fetchHourlyPacked()
    if (!data.schedule?.enabled) {
      await stopHourlyPackedAnnounce()
      return
    }
    await stopSpeaking()
    await speak(data.text)
  } catch (err) {
    console.warn('[hourly-packed]', err instanceof Error ? err.message : err)
  } finally {
    isAnnouncing = false
  }
}

export async function syncHourlyPackedAnnounceFromServer(): Promise<void> {
  try {
    const data = await fetchHourlyPacked()
    if (data.schedule?.enabled) {
      await startHourlyPackedAnnounce(data.schedule.interval_minutes)
    } else {
      await stopHourlyPackedAnnounce()
    }
  } catch {
    // server niet bereikbaar
  }
}

export async function startHourlyPackedAnnounce(intervalMinutes = 60): Promise<void> {
  const minutes = Math.min(Math.max(intervalMinutes, 15), 240)
  if (running && intervalHandle) return

  await acquireBackgroundKeeper()
  running = true

  if (intervalHandle) clearInterval(intervalHandle)
  const ms = minutes * 60 * 1000
  intervalHandle = setInterval(() => {
    void announceOnce()
  }, ms)
}

export async function stopHourlyPackedAnnounce(): Promise<void> {
  running = false
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
  if (!isHandsFreeServiceEnabled()) {
    await releaseBackgroundKeeper()
  }
}

export function isHourlyPackedAnnounceRunning(): boolean {
  return running
}

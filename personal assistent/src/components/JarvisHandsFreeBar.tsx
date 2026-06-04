import { useEffect, useState } from 'react'
import { Platform, StyleSheet, Switch, Text, View } from 'react-native'
import { prepareOpenWakeWord } from '@/lib/wake-word-openwakeword'
import { getWakeWordEngineHint, getWakeWordEngineLabel } from '@/lib/wake-word'
import {
  loadHandsFreePreference,
  setHandsFreeEnabled,
  subscribeHandsFree,
  type HandsFreeStatus,
} from '@/lib/jarvis-hands-free'

type Props = {
  disabled?: boolean
}

const STATUS_LABELS: Record<HandsFreeStatus, string> = {
  off: 'Uit',
  starting: 'Starten…',
  listening: 'Luistert',
  activating: 'Jarvis gehoord…',
  live_active: 'Live gesprek',
  error: 'Fout',
}

export default function JarvisHandsFreeBar({ disabled }: Props) {
  const [on, setOn] = useState(false)
  const [status, setStatus] = useState<HandsFreeStatus>('off')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [modelsLoading, setModelsLoading] = useState(false)

  useEffect(() => {
    void loadHandsFreePreference().then(pref => setOn(pref))
    return subscribeHandsFree((s, m) => {
      setStatus(s)
      setMessage(m)
    })
  }, [])

  useEffect(() => {
    if (!on) return
    setModelsLoading(true)
    void prepareOpenWakeWord().finally(() => setModelsLoading(false))
  }, [on])

  const toggle = async (value: boolean) => {
    setError(null)
    setOn(value)
    try {
      await setHandsFreeEnabled(value)
    } catch (err) {
      setOn(!value)
      setError(err instanceof Error ? err.message : 'Hands-free mislukt')
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Hey Jarvis</Text>
          <Text style={styles.subtitle}>
            {Platform.OS === 'android'
              ? 'Offline wake word (openWakeWord). Zeg "Hey Jarvis" — geen Picovoice-account nodig.'
              : 'Zeg "Hey Jarvis" met de app actief.'}
          </Text>
        </View>
        <Switch value={on} onValueChange={v => void toggle(v)} disabled={disabled} />
      </View>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {STATUS_LABELS[status]}
          {status === 'listening' ? ` · ${getWakeWordEngineLabel()}` : ''}
        </Text>
        {modelsLoading ? (
          <Text style={styles.messageText}>Modellen downloaden bij eerste gebruik (~3 MB)…</Text>
        ) : null}
        {message ? <Text style={styles.messageText}>{message}</Text> : null}
      </View>

      <Text style={styles.hint}>{getWakeWordEngineHint()}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    backgroundColor: '#f5f3ff',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5b21b6',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: '#6d28d9',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#ede9fe',
    borderRadius: 10,
    padding: 8,
  },
  badgeText: {
    fontWeight: '700',
    color: '#4c1d95',
    fontSize: 13,
  },
  messageText: {
    fontSize: 12,
    color: '#5b21b6',
    marginTop: 4,
  },
  hint: {
    fontSize: 11,
    color: '#7c3aed',
    lineHeight: 15,
  },
  error: {
    color: '#b91c1c',
    fontSize: 12,
  },
})

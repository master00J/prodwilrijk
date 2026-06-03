import { useEffect, useState } from 'react'
import { Platform, StyleSheet, Switch, Text, View } from 'react-native'
import {
  getWakeWordEngine,
  getWakeWordEngineHint,
  getWakeWordEngineLabel,
  isPorcupineConfigured,
} from '@/lib/wake-word'
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
  listening: 'Luistert op "Jarvis"',
  activating: 'Jarvis gehoord…',
  live_active: 'Live gesprek',
  error: 'Fout',
}

export default function JarvisHandsFreeBar({ disabled }: Props) {
  const [on, setOn] = useState(false)
  const [status, setStatus] = useState<HandsFreeStatus>('off')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const engine = getWakeWordEngine()
  const hasPicovoice = isPorcupineConfigured()

  useEffect(() => {
    void loadHandsFreePreference().then(pref => setOn(pref))
    return subscribeHandsFree((s, m) => {
      setStatus(s)
      setMessage(m)
    })
  }, [])

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
    <View style={[styles.panel, !hasPicovoice && styles.panelInterim]}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Hey Jarvis</Text>
          <Text style={styles.subtitle}>
            {Platform.OS === 'android'
              ? 'Zeg "Jarvis" of "Hey Jarvis" — live spraak start automatisch.'
              : 'Zeg "Jarvis" met de app open.'}
          </Text>
        </View>
        <Switch value={on} onValueChange={v => void toggle(v)} disabled={disabled} />
      </View>

      {!hasPicovoice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Picovoice-account nog in afwachting?</Text>
          <Text style={styles.noticeText}>
            Geen probleem: je kunt nu al de tijdelijke modus gebruiken ({getWakeWordEngineLabel()}).
            Na goedkeuring voeg je EXPO_PUBLIC_PICOVOICE_ACCESS_KEY toe en bouw je opnieuw — dan werkt
            achtergrond-luisteren beter en zuiniger.
          </Text>
        </View>
      ) : null}

      <View style={[styles.badge, status === 'listening' && styles.badgeActive]}>
        <Text style={styles.badgeText}>
          {STATUS_LABELS[status]}
          {engine === 'voice_fallback' && status === 'listening' ? ' (tijdelijk)' : ''}
        </Text>
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
  panelInterim: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
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
  notice: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  noticeTitle: {
    fontWeight: '800',
    fontSize: 12,
    color: '#92400e',
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#78350f',
  },
  badge: {
    backgroundColor: '#ede9fe',
    borderRadius: 10,
    padding: 8,
  },
  badgeActive: {
    backgroundColor: '#ddd6fe',
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

import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { getWakeWordEngineHint, getWakeWordEngineLabel } from '@/lib/wake-word'
import { USE_OPENWAKEWORD_ON_ANDROID } from '@/config'
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
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void loadHandsFreePreference().then(pref => setOn(pref))
    return subscribeHandsFree((s, m) => {
      setStatus(s)
      setMessage(m)
      if (s === 'off') void loadHandsFreePreference().then(pref => setOn(pref))
    })
  }, [])

  const toggle = async (value: boolean) => {
    setError(null)
    if (!value) {
      setOn(false)
      setBusy(true)
      try {
        await setHandsFreeEnabled(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Uitzetten mislukt')
      } finally {
        setBusy(false)
      }
      return
    }

    setBusy(true)
    try {
      await setHandsFreeEnabled(true)
      setOn(true)
    } catch (err) {
      setOn(false)
      setError(err instanceof Error ? err.message : 'Hey Jarvis start mislukt')
    } finally {
      setBusy(false)
    }
  }

  const switchDisabled = disabled || busy || status === 'starting'

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.title}>Hey Jarvis</Text>
          <Text style={styles.subtitle}>
            {Platform.OS === 'android' && USE_OPENWAKEWORD_ON_ANDROID
              ? 'Zeg "Hey Jarvis" — ook met scherm uit (melding blijft actief).'
              : Platform.OS === 'android'
                ? 'Alleen met app open. Installeer nieuwste APK voor achtergrond-wake word.'
                : 'Zeg "Hey Jarvis" met de app actief.'}
          </Text>
        </View>
        {busy ? (
          <ActivityIndicator color="#5b21b6" />
        ) : (
          <Switch value={on} onValueChange={v => void toggle(v)} disabled={switchDisabled} />
        )}
      </View>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {STATUS_LABELS[status]}
          {status === 'listening' ? ` · ${getWakeWordEngineLabel()}` : ''}
        </Text>
        {message ? <Text style={styles.messageText}>{message}</Text> : null}
      </View>

      <Text style={styles.hint}>{getWakeWordEngineHint()}</Text>
      {Platform.OS === 'android' && status === 'listening' ? (
        <Text style={styles.limitHint}>
          Werkt niet na &quot;Force stop&quot; in Android-instellingen. Vergelijkbaar met Google Assistant:
          éénmalig Hey Jarvis aanzetten, daarna luistert de app op de achtergrond.
        </Text>
      ) : null}
      {Platform.OS === 'android' && USE_OPENWAKEWORD_ON_ANDROID ? (
        <Pressable onPress={() => void Linking.openSettings()}>
          <Text style={styles.settingsLink}>Batterij &amp; app-instellingen openen</Text>
        </Pressable>
      ) : null}
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
  limitHint: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 15,
  },
  settingsLink: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  error: {
    color: '#b91c1c',
    fontSize: 12,
  },
})

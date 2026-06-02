import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { MediaStream, RTCView } from 'react-native-webrtc'
import { stopSpeaking } from '@/lib/speech'
import { PersonalRealtimeVoice, type RealtimeVoiceStatus } from '@/lib/realtime-voice'

type Props = {
  onUserMessage?: (text: string) => void
  onAssistantMessage?: (text: string) => void
  disabled?: boolean
}

export default function LiveVoicePanel({ onUserMessage, onAssistantMessage, disabled }: Props) {
  const voiceRef = useRef<PersonalRealtimeVoice | null>(null)
  const [status, setStatus] = useState<RealtimeVoiceStatus>('idle')
  const [message, setMessage] = useState('Start live spraak voor direct praten via je oortjes.')
  const [micEnabled, setMicEnabled] = useState(true)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [lastHeard, setLastHeard] = useState('')
  const [lastAnswer, setLastAnswer] = useState('')
  const [toolLog, setToolLog] = useState<string[]>([])

  const onUserMessageRef = useRef(onUserMessage)
  const onAssistantMessageRef = useRef(onAssistantMessage)
  onUserMessageRef.current = onUserMessage
  onAssistantMessageRef.current = onAssistantMessage

  useEffect(() => {
    voiceRef.current = new PersonalRealtimeVoice({
      onStatus: (nextStatus, nextMessage) => {
        setStatus(nextStatus)
        setMessage(nextMessage)
        if (nextStatus === 'connecting' || nextStatus === 'connected') {
          void stopSpeaking()
        }
      },
      onUserTranscript: text => {
        setLastHeard(text)
        onUserMessageRef.current?.(text)
      },
      onAssistantTranscript: text => {
        setLastAnswer(text)
        onAssistantMessageRef.current?.(text)
      },
      onRemoteStream: stream => {
        setRemoteStream(stream)
      },
      onToolUsed: name => {
        setToolLog(prev => [name, ...prev].slice(0, 4))
      },
    })

    return () => {
      voiceRef.current?.disconnect('cleanup')
    }
  }, [])

  const handleConnect = async () => {
    await stopSpeaking()
    try {
      const stream = await voiceRef.current?.connect()
      if (stream) setRemoteStream(stream)
    } catch {
      setRemoteStream(null)
    }
  }

  const handleDisconnect = () => {
    voiceRef.current?.disconnect('user')
    setRemoteStream(null)
    setMicEnabled(true)
  }

  const toggleMic = () => {
    const next = !micEnabled
    voiceRef.current?.setMicEnabled(next)
    setMicEnabled(next)
  }

  const statusStyle =
    status === 'connected'
      ? styles.statusConnected
      : status === 'error'
        ? styles.statusError
        : styles.statusIdle

  return (
    <View style={styles.panel}>
      {remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.hiddenAudio}
          objectFit="cover"
        />
      ) : null}

      <Text style={styles.title}>Live spraak (OpenAI Realtime)</Text>
      <Text style={styles.subtitle}>
        Direct praten zoals in Grote Inpak. Geen knop ingedrukt houden — gewoon conversatie via oortjes.
      </Text>

      <View style={[styles.statusBox, statusStyle]}>
        {status === 'connecting' ? <ActivityIndicator color="#1a4b8c" /> : null}
        <Text style={styles.statusText}>{message}</Text>
      </View>

      <View style={styles.actions}>
        {status === 'connected' ? (
          <>
            <Pressable style={styles.secondaryButton} onPress={toggleMic} disabled={disabled}>
              <Text style={styles.secondaryButtonText}>{micEnabled ? 'Mic aan' : 'Mic uit'}</Text>
            </Pressable>
            <Pressable style={styles.stopButton} onPress={handleDisconnect} disabled={disabled}>
              <Text style={styles.stopButtonText}>Stop live</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[styles.startButton, (disabled || status === 'connecting') && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={disabled || status === 'connecting'}
          >
            <Text style={styles.startButtonText}>
              {status === 'connecting' ? 'Verbinden…' : 'Start live spraak'}
            </Text>
          </Pressable>
        )}
      </View>

      {lastHeard ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptLabel}>Gehoord</Text>
          <Text style={styles.transcriptText}>{lastHeard}</Text>
        </View>
      ) : null}

      {lastAnswer ? (
        <View style={styles.transcriptBox}>
          <Text style={styles.transcriptLabel}>Antwoord</Text>
          <Text style={styles.transcriptText}>{lastAnswer}</Text>
        </View>
      ) : null}

      {toolLog.length > 0 ? (
        <Text style={styles.toolLog}>Tools: {toolLog.join(', ')}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
    gap: 10,
  },
  hiddenAudio: {
    width: 2,
    height: 2,
    opacity: 0.01,
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: -1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14532d',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#166534',
  },
  statusBox: {
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIdle: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statusConnected: {
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
  },
  statusError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  startButton: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  secondaryButtonText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  transcriptBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 20,
  },
  toolLog: {
    fontSize: 12,
    color: '#475569',
  },
})

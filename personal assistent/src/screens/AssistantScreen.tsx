import { Audio } from 'expo-av'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LiveVoicePanelHandle } from '@/components/LiveVoicePanel'
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import JarvisHandsFreeBar from '@/components/JarvisHandsFreeBar'
import MessageBubble from '@/components/MessageBubble'
import LiveVoicePanel from '@/components/LiveVoicePanel'
import {
  syncHourlyPackedAnnounceFromServer,
  stopHourlyPackedAnnounce,
} from '@/lib/hourly-packed-announce'
import {
  attachAppStateHandsFree,
  initHandsFreeOnLogin,
  pauseHandsFreeForLive,
  resumeHandsFreeAfterLive,
  teardownHandsFree,
} from '@/lib/jarvis-hands-free'
import { APP_NAME } from '@/config'
import { sendChat, sendVoice } from '@/lib/api'
import { signOut } from '@/lib/auth'
import { isSpeaking, speak, stopSpeaking } from '@/lib/speech'
import type { ChatMessage } from '@/types'

type Props = {
  onLoggedOut: () => void
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function AssistantScreen({ onLoggedOut }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: 'assistant',
      content:
        'Hoi Jason. Start live spraak voor direct praten via je oortjes, of typ/stuur een vraag. Live modus gebruikt OpenAI Realtime zoals in Grote Inpak.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<FlatList<ChatMessage>>(null)
  const liveVoiceRef = useRef<LiveVoicePanelHandle>(null)

  const historyForApi = useMemo(
    () => messages.filter(message => message.role === 'user' || message.role === 'assistant'),
    [messages]
  )

  useEffect(() => {
    void Audio.requestPermissionsAsync()
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    })
  }, [])

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true })
  }, [messages, loading])

  useEffect(() => {
    attachAppStateHandsFree()
    void initHandsFreeOnLogin(async () => {
      if (liveVoiceRef.current?.isActive()) return
      await pauseHandsFreeForLive()
      await liveVoiceRef.current?.connect()
    })
    void syncHourlyPackedAnnounceFromServer()
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') void syncHourlyPackedAnnounceFromServer()
    })
    return () => {
      appStateSub.remove()
      void stopHourlyPackedAnnounce()
      void teardownHandsFree()
    }
  }, [])

  const appendMessage = useCallback((role: ChatMessage['role'], content: string) => {
    setMessages(prev => [...prev, { id: createId(), role, content }])
  }, [])

  const onLiveUserMessage = useCallback(
    (text: string) => appendMessage('user', text),
    [appendMessage]
  )

  const onLiveAssistantMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || trimmed === '{}' || trimmed === '[]') return
      if (!/[a-zA-ZÀ-ÿ]{2,}/.test(trimmed)) return
      appendMessage('assistant', trimmed)
      // Geen speak(): live modus gebruikt OpenAI Realtime-audio (anders 2 stemmen).
    },
    [appendMessage]
  )

  const handleSendTextWithQuestion = async (question: string) => {
    const trimmed = question.trim()
    if (!trimmed || loading) return

    setInput('')
    setError(null)
    appendMessage('user', trimmed)
    setLoading(true)

    try {
      const response = await sendChat([...historyForApi, { id: 'tmp', role: 'user', content: trimmed }])
      appendMessage('assistant', response.answer)
      if (autoSpeak) {
        await speak(response.answer)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistent mislukt')
    } finally {
      setLoading(false)
    }
  }

  const handleSendText = async () => {
    const question = input.trim()
    if (!question || loading) return
    await handleSendTextWithQuestion(question)
  }

  const startRecording = async () => {
    if (loading || recording) return

    setError(null)
    if (isSpeaking()) {
      await stopSpeaking()
    }

    const permission = await Audio.requestPermissionsAsync()
    if (!permission.granted) {
      setError('Microfoon-toestemming is nodig voor spraak via je telefoon of oortjes.')
      return
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    })

    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    )
    setRecording(newRecording)
  }

  const stopRecording = async () => {
    if (!recording) return

    setLoading(true)
    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      setRecording(null)

      if (!uri) {
        throw new Error('Opname mislukt')
      }

      const response = await sendVoice(uri, historyForApi)
      appendMessage('user', response.transcript)
      appendMessage('assistant', response.answer)

      if (autoSpeak) {
        await speak(response.answer)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Spraakverwerking mislukt')
    } finally {
      setLoading(false)
    }
  }

  const handleLiveDisconnected = useCallback(() => {
    void resumeHandsFreeAfterLive()
  }, [])

  const handleLogout = async () => {
    await teardownHandsFree()
    await stopSpeaking()
    if (recording) {
      await recording.stopAndUnloadAsync()
      setRecording(null)
    }
    await signOut()
    onLoggedOut()
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{APP_NAME}</Text>
          <Text style={styles.headerSubtitle}>Live data uit prodwilrijk.be</Text>
        </View>
        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Uit</Text>
        </Pressable>
      </View>

      <View style={styles.speakRow}>
        <Text style={styles.speakLabel}>Antwoord voorlezen (typ/klassiek)</Text>
        <Switch value={autoSpeak} onValueChange={setAutoSpeak} />
      </View>

      <View style={styles.quickRow}>
        {[
          { label: 'Briefing', question: 'Geef mijn dagelijkse briefing.' },
          { label: 'Status', question: 'Geef een volledig ops snapshot van alles.' },
          { label: 'Prepack', question: 'Hoe staat de prepack wachtrij?' },
          { label: 'Trend', question: 'Is prepack vandaag goed vs onze benchmarks?' },
          { label: 'Personen', question: 'Wie heeft vandaag hoeveel verpakt bij prepack?' },
          { label: "Prio's", question: 'Welke priority cases op grote inpak?' },
          { label: 'Problemen', question: 'Welke prepack regels hebben een problem?' },
          { label: 'Airtec', question: 'Hoe presteert airtec vandaag vs benchmark?' },
        ].map(chip => (
          <Pressable
            key={chip.label}
            style={styles.quickChip}
            disabled={loading}
            onPress={() => void handleSendTextWithQuestion(chip.question)}
          >
            <Text style={styles.quickChipText}>{chip.label}</Text>
          </Pressable>
        ))}
      </View>

      <JarvisHandsFreeBar disabled={loading} />

      <LiveVoicePanel
        ref={liveVoiceRef}
        disabled={loading}
        onUserMessage={onLiveUserMessage}
        onAssistantMessage={onLiveAssistantMessage}
        onWillConnect={pauseHandsFreeForLive}
        onDisconnected={handleLiveDisconnected}
      />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <MessageBubble message={item} />}
        ListFooterComponent={
          loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#1a4b8c" />
              <Text style={styles.loadingText}>Assistent denkt na…</Text>
            </View>
          ) : null
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.composer}>
        <Pressable
          style={[styles.micButton, recording && styles.micButtonActive]}
          onPressIn={startRecording}
          onPressOut={stopRecording}
          disabled={loading && !recording}
        >
          <Text style={styles.micButtonText}>{recording ? 'Loslaten' : 'Houd ingedrukt (klassiek)'}</Text>
        </Pressable>

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Typ je vraag…"
          style={styles.input}
          editable={!loading}
          onSubmitEditing={handleSendText}
          returnKeyType="send"
        />

        <Pressable
          style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
          onPress={handleSendText}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendButtonText}>Stuur</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a4b8c',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  logoutText: {
    fontWeight: '700',
    color: '#334155',
  },
  speakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  speakLabel: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  quickChip: {
    backgroundColor: '#e0ecff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickChipText: {
    color: '#1a4b8c',
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    color: '#64748b',
  },
  error: {
    color: '#b91c1c',
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 14,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 12,
    gap: 10,
    backgroundColor: '#f8fafc',
  },
  micButton: {
    backgroundColor: '#0f766e',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  micButtonActive: {
    backgroundColor: '#dc2626',
  },
  micButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  sendButton: {
    backgroundColor: '#1a4b8c',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
})

import { Audio } from 'expo-av'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
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
import MessageBubble from '@/components/MessageBubble'
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
        'Hoi Jason. Stel een vraag over Prodwilrijk, bijvoorbeeld over Grote Inpak achterstand, een kisttype of een shoporder. Je kan typen of de microfoon gebruiken via je oortjes.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<FlatList<ChatMessage>>(null)

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

  const appendMessage = (role: ChatMessage['role'], content: string) => {
    setMessages(prev => [...prev, { id: createId(), role, content }])
  }

  const handleSendText = async () => {
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setError(null)
    appendMessage('user', question)
    setLoading(true)

    try {
      const response = await sendChat([...historyForApi, { id: 'tmp', role: 'user', content: question }])
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

  const handleLogout = async () => {
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
        <Text style={styles.speakLabel}>Antwoord voorlezen</Text>
        <Switch value={autoSpeak} onValueChange={setAutoSpeak} />
      </View>

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
          <Text style={styles.micButtonText}>{recording ? 'Loslaten' : 'Houd ingedrukt'}</Text>
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

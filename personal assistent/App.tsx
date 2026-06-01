import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native'
import { restoreSession } from '@/lib/auth'
import AssistantScreen from '@/screens/AssistantScreen'
import LoginScreen from '@/screens/LoginScreen'

export default function App() {
  const [booting, setBooting] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const session = await restoreSession()
      if (active) {
        setLoggedIn(Boolean(session))
        setBooting(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#1a4b8c" />
        <StatusBar style="dark" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      {loggedIn ? (
        <AssistantScreen onLoggedOut={() => setLoggedIn(false)} />
      ) : (
        <LoginScreen onLoggedIn={() => setLoggedIn(true)} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
})

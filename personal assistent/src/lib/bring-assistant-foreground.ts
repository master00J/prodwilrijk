import { AppState, Linking, Platform } from 'react-native'

const ASSISTANT_URI = 'prodwilrijk-assistant://assistant'

/** Breng de app naar de voorgrond na wake word (Android achtergrond / ander scherm). */
export async function bringAssistantToForeground(): Promise<void> {
  if (AppState.currentState === 'active') return

  try {
    const supported = await Linking.canOpenURL(ASSISTANT_URI)
    if (supported) {
      await Linking.openURL(ASSISTANT_URI)
      return
    }
  } catch {
    // fallback hieronder
  }

  if (Platform.OS === 'android') {
    try {
      await Linking.openURL(ASSISTANT_URI)
    } catch {
      // app kan al naar voren komen via foreground service-tap
    }
  }
}

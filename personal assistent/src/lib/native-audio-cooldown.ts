/** Korte pauze zodat VoiceProcessor / openWakeWord native klaar is na stop. */
export function nativeAudioCooldown(ms = 500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

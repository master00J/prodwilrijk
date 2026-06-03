declare module 'react-native-live-audio-stream' {
  type LiveAudioOptions = {
    sampleRate?: number
    channels?: number
    bitsPerSample?: number
    audioSource?: number
    bufferSize?: number
    wavFile: string
  }

  const LiveAudioStream: {
    init: (options: LiveAudioOptions) => void
    start: () => void
    stop: () => void
    on: (event: 'data', callback: (data: string) => void) => void
  }

  export default LiveAudioStream
}

declare module 'react-native-background-actions' {
  export type BackgroundTaskOptions = {
    taskName: string
    taskTitle: string
    taskDesc: string
    taskIcon: { name: string; type: string }
    color?: string
    linkingURI?: string
    parameters?: Record<string, unknown>
  }

  const BackgroundJob: {
    start: (task: () => Promise<void>, options: BackgroundTaskOptions) => Promise<void>
    stop: () => Promise<void>
    isRunning: () => boolean
  }

  export default BackgroundJob
}

import { Platform } from 'react-native'
import BackgroundJob from 'react-native-background-actions'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const backgroundTask = async () => {
  while (BackgroundJob.isRunning()) {
    await sleep(2000)
  }
}

const backgroundOptions = {
  taskName: 'JarvisAssistant',
  taskTitle: 'Prodwilrijk Assistent actief',
  taskDesc: 'Jarvis en/of uurlijkse updates',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#1a4b8c',
  linkingURI: 'prodwilrijk-assistant://assistant',
  parameters: {},
}

let keeperRefCount = 0

export async function acquireBackgroundKeeper(): Promise<void> {
  if (Platform.OS !== 'android') return
  keeperRefCount += 1
  if (keeperRefCount === 1 && !BackgroundJob.isRunning()) {
    await BackgroundJob.start(backgroundTask, backgroundOptions)
  }
}

export async function releaseBackgroundKeeper(): Promise<void> {
  if (Platform.OS !== 'android') return
  keeperRefCount = Math.max(0, keeperRefCount - 1)
  if (keeperRefCount === 0 && BackgroundJob.isRunning()) {
    await BackgroundJob.stop()
  }
}

export function isBackgroundKeeperActive(): boolean {
  return Platform.OS === 'android' && BackgroundJob.isRunning()
}

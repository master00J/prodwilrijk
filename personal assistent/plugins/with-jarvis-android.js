const {
  withAndroidManifest,
  withProjectBuildGradle,
  AndroidConfig,
} = require('@expo/config-plugins')

const ANDROIDX_CORE_MARKER = 'androidx.core:core:1.15.0'

/** ServiceCompat.startForeground(4 args) vereist androidx.core >= 1.12 (background-actions 4.1). */
function withAndroidxCoreForBackgroundActions(config) {
  return withProjectBuildGradle(config, cfg => {
    if (cfg.modResults.contents.includes(ANDROIDX_CORE_MARKER)) {
      return cfg
    }
    cfg.modResults.contents += `

// with-jarvis-android: force recent androidx.core for react-native-background-actions
subprojects { subproject ->
  subproject.configurations.configureEach { configuration ->
    configuration.resolutionStrategy.force '${ANDROIDX_CORE_MARKER}'
  }
}
`
    return cfg
  })
}

const BG_SERVICE = 'com.asterinet.react.bgactions.RNBackgroundActionsTask'

/** Foreground service + microfoon voor hands-free "Jarvis" op Android 14+. */
function withJarvisAndroid(config) {
  config = withAndroidxCoreForBackgroundActions(config)
  return withAndroidManifest(config, config => {
    const manifest = config.modResults
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest)

    AndroidConfig.Manifest.ensureToolsAvailable(manifest)

    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = []
    }
    const perms = manifest.manifest['uses-permission']
    const addPerm = name => {
      if (!perms.some(p => p.$?.['android:name'] === name)) {
        perms.push({ $: { 'android:name': name } })
      }
    }
    addPerm('android.permission.FOREGROUND_SERVICE')
    addPerm('android.permission.FOREGROUND_SERVICE_MICROPHONE')
    addPerm('android.permission.POST_NOTIFICATIONS')
    addPerm('android.permission.WAKE_LOCK')

    if (!app.service) {
      app.service = []
    }
    const services = Array.isArray(app.service) ? app.service : [app.service]
    let bg = services.find(s => s.$?.['android:name'] === BG_SERVICE)
    if (!bg) {
      bg = {
        $: {
          'android:name': BG_SERVICE,
          'android:exported': 'false',
          'android:foregroundServiceType': 'microphone',
        },
      }
      services.push(bg)
      app.service = services
    } else {
      bg.$['android:foregroundServiceType'] = 'microphone'
    }

    // @react-native-voice/voice trekt nog com.android.support binnen → manifest merger conflict met AndroidX.
    app.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory'
    const existingReplace = app.$['tools:replace']
    const replaceKeys = new Set(
      (existingReplace ? String(existingReplace).split(',') : [])
        .map(s => s.trim())
        .filter(Boolean)
    )
    replaceKeys.add('android:appComponentFactory')
    app.$['tools:replace'] = [...replaceKeys].join(',')

    return config
  })
}

module.exports = withJarvisAndroid

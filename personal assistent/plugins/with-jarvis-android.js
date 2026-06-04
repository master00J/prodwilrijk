const { withAndroidManifest, withAppBuildGradle, AndroidConfig } = require('@expo/config-plugins')

const BG_SERVICE = 'com.asterinet.react.bgactions.RNBackgroundActionsTask'
const EXCLUDE_SUPPORT_MARKER = '// with-jarvis-android: exclude legacy com.android.support'

/** @react-native-voice/voice + AndroidX → duplicate classes zonder exclude. */
function withExcludeLegacySupportLibs(config) {
  return withAppBuildGradle(config, cfg => {
    if (cfg.modResults.contents.includes(EXCLUDE_SUPPORT_MARKER)) {
      return cfg
    }
    cfg.modResults.contents += `

${EXCLUDE_SUPPORT_MARKER}
configurations.configureEach {
    exclude group: 'com.android.support'
}
`
    return cfg
  })
}

/** Foreground service + microfoon voor hands-free "Jarvis" op Android 14+. */
function withJarvisAndroid(config) {
  config = withExcludeLegacySupportLibs(config)
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

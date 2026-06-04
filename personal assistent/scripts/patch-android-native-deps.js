/**
 * Patches native modules vóór expo prebuild / Gradle (EAS + lokaal).
 */
const fs = require('fs')
const path = require('path')

const NITRO_PATCH_MARKER = '// patched-for-rn-076'

function patchBackgroundActions(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..')
  const bgJava = path.join(
    root,
    'node_modules/react-native-background-actions/android/src/main/java/com/asterinet/react/bgactions/RNBackgroundActionsTask.java'
  )

  if (!fs.existsSync(bgJava)) {
    console.warn('[patch-android] react-native-background-actions niet gevonden, overslaan.')
    return true
  }

  let src = fs.readFileSync(bgJava, 'utf8')

  if (src.includes('ServiceCompat.startForeground')) {
    src = src.replace(/import androidx\.core\.app\.ServiceCompat;\r?\n/, '')
    const replaced = src.replace(
      /ServiceCompat\.startForeground\(\s*this,\s*SERVICE_NOTIFICATION_ID,\s*notification,\s*bgOptions\.getForegroundServiceType\(\)\s*\);/,
      `if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(SERVICE_NOTIFICATION_ID, notification, bgOptions.getForegroundServiceType());
        } else {
            startForeground(SERVICE_NOTIFICATION_ID, notification);
        }`
    )
    if (replaced === src) {
      console.error('[patch-android] ServiceCompat-patroon niet herkend in RNBackgroundActionsTask.java')
      return false
    }
    src = replaced
    fs.writeFileSync(bgJava, src)
    console.log('[patch-android] RNBackgroundActionsTask.java gepatcht (startForeground).')
  } else {
    console.log('[patch-android] RNBackgroundActionsTask.java al gepatcht.')
  }

  return true
}

/** RN 0.76: ReactModuleInfo vereist 7-arg ctor (incl. hasConstants). */
function patchNitroModules(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..')
  const nitroKt = path.join(
    root,
    'node_modules/react-native-nitro-modules/android/src/main/java/com/margelo/nitro/NitroModulesPackage.kt'
  )

  if (!fs.existsSync(nitroKt)) {
    console.warn('[patch-android] react-native-nitro-modules niet gevonden, overslaan.')
    return true
  }

  let src = fs.readFileSync(nitroKt, 'utf8')
  if (src.includes(NITRO_PATCH_MARKER)) {
    console.log('[patch-android] NitroModulesPackage.kt al gepatcht.')
    return true
  }

  const replaced = src.replace(
    /moduleInfos\[NitroModules\.NAME\]\s*=\s*ReactModuleInfo\([\s\S]*?\)\s*(?=\n\s*moduleInfos)/,
    `moduleInfos[NitroModules.NAME] =
        ReactModuleInfo(
          NitroModules.NAME,
          NitroModules.NAME,
          false,
          false,
          false,
          false,
          isTurboModule,
        ) ${NITRO_PATCH_MARKER}`
  )

  if (replaced === src) {
    console.error('[patch-android] NitroModulesPackage.kt ReactModuleInfo-patroon niet herkend')
    return false
  }

  fs.writeFileSync(nitroKt, replaced)
  console.log('[patch-android] NitroModulesPackage.kt gepatcht (ReactModuleInfo RN 0.76).')
  return true
}

function patchAndroidNativeDeps(projectRoot) {
  const bg = patchBackgroundActions(projectRoot)
  const nitro = patchNitroModules(projectRoot)
  return bg && nitro
}

if (require.main === module) {
  console.log('[patch-android] Start native dependency patches...')
  const ok = patchAndroidNativeDeps()
  if (!ok) process.exitCode = 1
  else console.log('[patch-android] Klaar.')
}

module.exports = { patchBackgroundActions, patchNitroModules, patchAndroidNativeDeps }

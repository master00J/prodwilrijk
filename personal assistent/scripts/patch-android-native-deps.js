/**
 * Patches native modules vóór expo prebuild / Gradle (EAS + lokaal).
 * Fixes react-native-background-actions ServiceCompat op RN 0.76 / androidx.core.
 */
const fs = require('fs')
const path = require('path')

const ANDROIDX_CORE = 'androidx.core:core:1.15.0'

function patchBackgroundActions(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..')
  const bgJava = path.join(
    root,
    'node_modules/react-native-background-actions/android/src/main/java/com/asterinet/react/bgactions/RNBackgroundActionsTask.java'
  )
  const bgGradle = path.join(root, 'node_modules/react-native-background-actions/android/build.gradle')

  if (!fs.existsSync(bgJava)) {
    console.warn('[patch-android] react-native-background-actions niet gevonden, overslaan.')
    return false
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

  if (fs.existsSync(bgGradle)) {
    let gradle = fs.readFileSync(bgGradle, 'utf8')
    const dep = `implementation "${ANDROIDX_CORE}"`
    if (!gradle.includes(ANDROIDX_CORE)) {
      gradle = gradle.replace(/dependencies\s*\{/, `dependencies {\n    ${dep}`)
      fs.writeFileSync(bgGradle, gradle)
      console.log('[patch-android] build.gradle: androidx.core toegevoegd.')
    }
  }

  return true
}

if (require.main === module) {
  console.log('[patch-android] Start native dependency patches...')
  const ok = patchBackgroundActions()
  if (!ok) process.exitCode = 1
  else console.log('[patch-android] Klaar.')
}

module.exports = { patchBackgroundActions }

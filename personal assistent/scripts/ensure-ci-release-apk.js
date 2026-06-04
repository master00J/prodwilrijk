/**
 * Zorgt dat assembleRelease op CI kan zonder upload-keystore (debug signing op release).
 */
const fs = require('fs')
const path = require('path')

const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle')
if (!fs.existsSync(gradlePath)) {
  console.error('[ci-apk] android/app/build.gradle ontbreekt — eerst expo prebuild draaien.')
  process.exit(1)
}

let src = fs.readFileSync(gradlePath, 'utf8')
if (src.includes('signingConfig signingConfigs.debug') && /release\s*\{[\s\S]*?signingConfig signingConfigs\.debug/.test(src)) {
  console.log('[ci-apk] Release signing al geconfigureerd.')
  process.exit(0)
}

const releaseBlock = /release\s*\{/
if (!releaseBlock.test(src)) {
  console.error('[ci-apk] Geen release buildType gevonden in build.gradle')
  process.exit(1)
}

src = src.replace(releaseBlock, "release {\n            signingConfig signingConfigs.debug")
fs.writeFileSync(gradlePath, src)
console.log('[ci-apk] Release APK gebruikt debug signing (interne distributie).')

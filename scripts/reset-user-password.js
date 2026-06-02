/**
 * Reset een gebruikerswachtwoord via de Supabase Admin API.
 *
 * Supabase Dashboard biedt enkel "Send password recovery" (e-mail) —
 * geen veld om het wachtwoord direct te wijzigen.
 *
 * Gebruik:
 *   node scripts/reset-user-password.js <email-of-username> <nieuw-wachtwoord>
 *
 * Voorbeeld:
 *   node scripts/reset-user-password.js jasonploegaerts@gmail.com MijnNieuwWachtwoord123
 *   node scripts/reset-user-password.js Jason MijnNieuwWachtwoord123
 *
 * Vereist .env.local met NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const envFile = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) return
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY vereist in .env.local')
  process.exit(1)
}

const identifier = process.argv[2]
const newPassword = process.argv[3]

if (!identifier || !newPassword) {
  console.error('Gebruik: node scripts/reset-user-password.js <email-of-username> <nieuw-wachtwoord>')
  process.exit(1)
}

if (newPassword.length < 8) {
  console.error('❌ Wachtwoord moet minstens 8 tekens zijn.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserId() {
  if (identifier.includes('@')) {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (error) throw error
    const user = data.users.find((u) => u.email?.toLowerCase() === identifier.toLowerCase())
    if (!user) throw new Error(`Geen user gevonden met e-mail: ${identifier}`)
    return { userId: user.id, label: user.email }
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, username')
    .eq('username', identifier)
    .maybeSingle()

  if (error) throw error
  if (!data?.user_id) throw new Error(`Geen user gevonden met username: ${identifier}`)
  return { userId: data.user_id, label: data.username }
}

async function main() {
  const { userId, label } = await findUserId()

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  })
  if (updateError) throw updateError

  await supabase
    .from('user_roles')
    .update({ must_change_password: false })
    .eq('user_id', userId)

  console.log(`✅ Wachtwoord gereset voor: ${label}`)
  console.log('   Log in op prodwilrijk.be met je username + het nieuwe wachtwoord.')
}

main().catch((err) => {
  console.error('❌', err.message || err)
  process.exit(1)
})

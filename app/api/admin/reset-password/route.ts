import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { logAudit } from '@/lib/api/audit'

export const dynamic = 'force-dynamic'

export const POST = withAdmin(async (request, adminUser) => {
  try {
    const body = await request.json()
    const { userId, newPassword } = body

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'User ID en nieuw wachtwoord zijn verplicht' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Wachtwoord moet minimaal 6 tekens zijn' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      console.error('Error resetting password:', error)
      return NextResponse.json(
        { error: 'Wachtwoord resetten mislukt' },
        { status: 500 }
      )
    }

    logAudit({
      user_id: adminUser.id,
      user_email: adminUser.email,
      action: 'password_reset',
      resource_type: 'user',
      resource_id: userId,
      details: { reset_by: adminUser.email },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
})

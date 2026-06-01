import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { logAudit } from '@/lib/api/audit'
import { isErrorResponse, resetPasswordSchema, validateBody } from '@/lib/api/validation'

export const dynamic = 'force-dynamic'

export const POST = withAdmin(async (request, adminUser) => {
  try {
    const body = await validateBody(request, resetPasswordSchema)
    if (isErrorResponse(body)) return body
    const { userId, newPassword } = body

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

    await supabaseAdmin
      .from('user_roles')
      .update({ must_change_password: true })
      .eq('user_id', userId)

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

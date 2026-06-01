import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { logAudit } from '@/lib/api/audit'
import { invalidateCachedStatus } from '@/lib/api/user-status-cache'
import { isErrorResponse, validateBody, verifyUserSchema } from '@/lib/api/validation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const POST = withAdmin(async (request, user) => {
  try {
    const body = await validateBody(request, verifyUserSchema)
    if (isErrorResponse(body)) return body
    const { userId, verified } = body

    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .update({ verified })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating verification status:', error)
      return NextResponse.json(
        { error: 'Verificatie bijwerken mislukt' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Gebruiker niet gevonden' },
        { status: 404 }
      )
    }

    invalidateCachedStatus(userId)

    logAudit({
      user_id: user.id,
      user_email: user.email,
      action: 'user_verified',
      resource_type: 'user_roles',
      resource_id: userId,
      details: { verified: data.verified },
    })

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
})

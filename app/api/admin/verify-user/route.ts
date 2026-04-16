import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { logAudit } from '@/lib/api/audit'
import { invalidateCachedStatus } from '@/lib/api/user-status-cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const POST = withAdmin(async (request, user) => {
  try {
    const body = await request.json()
    const { userId, verified = true } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .update({ verified: verified === true })
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

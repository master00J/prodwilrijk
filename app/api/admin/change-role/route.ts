import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { logAudit } from '@/lib/api/audit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const POST = withAdmin(async (request, user) => {
  try {
    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'User ID and role are required' },
        { status: 400 }
      )
    }

    if (!['user', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .upsert(
        {
          user_id: userId,
          role: role,
          verified: true,
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single()

    if (error) {
      console.error('Error updating role:', error)
      return NextResponse.json(
        { error: 'Rol bijwerken mislukt' },
        { status: 500 }
      )
    }

    logAudit({
      user_id: user.id,
      user_email: user.email,
      action: 'role_changed',
      resource_type: 'user_roles',
      resource_id: userId,
      details: { new_role: role },
    })

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
})

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { withAdmin } from '@/lib/api/with-auth'
import { logAudit } from '@/lib/api/audit'
import { invalidateCachedStatus } from '@/lib/api/user-status-cache'
import { changeRoleSchema, isErrorResponse, validateBody } from '@/lib/api/validation'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const POST = withAdmin(async (request, user) => {
  try {
    const body = await validateBody(request, changeRoleSchema)
    if (isErrorResponse(body)) return body
    const { userId, role } = body

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

    invalidateCachedStatus(userId)

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

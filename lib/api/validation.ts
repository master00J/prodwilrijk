import { z } from 'zod'
import { NextResponse } from 'next/server'

/**
 * Validates request body against a Zod schema.
 * Returns parsed data on success, or a NextResponse 400 on failure.
 */
export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      const errors = result.error.issues.map(i => i.message).join(', ')
      return NextResponse.json(
        { error: `Ongeldige invoer: ${errors}` },
        { status: 400 }
      )
    }

    return result.data
  } catch {
    return NextResponse.json(
      { error: 'Ongeldig JSON formaat' },
      { status: 400 }
    )
  }
}

export function isErrorResponse(result: unknown): result is NextResponse {
  return result instanceof NextResponse
}

// --- Shared schemas ---

export const scanLabelSchema = z.object({
  image: z.string().max(10_000_000, 'Afbeelding te groot (max ~7.5MB)'),
  mediaType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/, 'Ongeldig afbeeldingsformaat'),
  provider: z.enum(['haiku', 'gpt5']).optional().default('haiku'),
})

export const changeRoleSchema = z.object({
  userId: z.string().uuid('Ongeldig user ID'),
  role: z.enum(['user', 'admin'], { message: 'Rol moet "user" of "admin" zijn' }),
})

export const verifyUserSchema = z.object({
  userId: z.string().uuid('Ongeldig user ID'),
  verified: z.boolean().optional().default(true),
})

export const confirmItemsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Selecteer minstens 1 item'),
})

export const sessionTokenSchema = z.object({
  access_token: z.string().min(10, 'Ongeldig token'),
})

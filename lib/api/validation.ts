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

export const labelScanPhotoToIncomingSchema = z.object({
  incomingIds: z.array(z.number().int().positive()).min(1, 'Minstens één incoming ID'),
  image: z.string().max(10_000_000, 'Afbeelding te groot (max ~7.5MB)'),
  mediaType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/, 'Ongeldig afbeeldingsformaat'),
})

export const changeRoleSchema = z.object({
  userId: z.string().uuid('Ongeldig user ID'),
  role: z.enum(['user', 'admin'], { message: 'Rol moet "user" of "admin" zijn' }),
})

export const resetPasswordSchema = z.object({
  userId: z.string().uuid('Ongeldig user ID'),
  newPassword: z.string().min(8, 'Wachtwoord moet minimaal 8 tekens zijn').max(128),
})

export const verifyUserSchema = z.object({
  userId: z.string().uuid('Ongeldig user ID'),
  verified: z.boolean().optional().default(true),
})

export const confirmItemsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Selecteer minstens 1 item'),
})

export const deleteItemsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
})

export const packItemsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  employeeId: z.number().int().positive().optional().nullable(),
  employeeName: z.string().max(120).optional().nullable(),
})

export const searchQuerySchema = z.object({
  q: z.string().max(100).optional(),
})

export const tvSlideTypeSchema = z.enum([
  'werkorders',
  'tekst',
  'afbeelding',
  'productieorders',
  'inpakstatistiek',
  'dagplanning',
  'countdown',
  'weer',
  'priorities',
  'transportplanning',
])

export const tvSlideCreateSchema = z.object({
  type: tvSlideTypeSchema,
  title: z.string().max(200).optional().nullable(),
  content: z.record(z.unknown()).optional(),
  sort_order: z.number().int().min(0).max(10_000).optional(),
  active: z.boolean().optional(),
})

export const tvSlideUpdateSchema = z
  .object({
    id: z.union([z.number().int().positive(), z.string().min(1)]),
    type: tvSlideTypeSchema.optional(),
    title: z.string().max(200).optional().nullable(),
    content: z.record(z.unknown()).optional(),
    sort_order: z.number().int().min(0).max(10_000).optional(),
    active: z.boolean().optional(),
  })
  .refine(data => Object.keys(data).length > 1, {
    message: 'Geen velden om bij te werken',
  })

export const tvSlideDeleteSchema = z.object({
  id: z.union([z.number().int().positive(), z.string().min(1)]),
})

export const productionOrderUploadSchema = z.object({
  order: z.object({
    order_number: z.string().min(1).max(80),
    sales_order_number: z.string().max(80).optional().nullable(),
    creation_date: z.string().max(40).optional().nullable(),
    due_date: z.string().max(40).optional().nullable(),
    starting_date: z.string().max(40).optional().nullable(),
    source_file_name: z.string().max(255).optional().nullable(),
  }),
  lines: z.array(z.record(z.unknown())).min(1).max(5000),
})

export function parseSearchQuery(
  searchParams: URLSearchParams
): { q: string } | NextResponse {
  const parsed = searchQuerySchema.safeParse({
    q: searchParams.get('q') ?? undefined,
  })
  if (!parsed.success) {
    const errors = parsed.error.issues.map(i => i.message).join(', ')
    return NextResponse.json({ error: `Ongeldige zoekopdracht: ${errors}` }, { status: 400 })
  }
  return { q: parsed.data.q?.trim() ?? '' }
}

export const sessionTokenSchema = z.object({
  access_token: z.string().min(10, 'Ongeldig token'),
})

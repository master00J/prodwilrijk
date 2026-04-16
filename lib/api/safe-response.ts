import { NextResponse } from 'next/server'

/**
 * Returns a safe error response that never leaks internal details.
 * Logs the real error server-side for debugging.
 */
export function safeError(
  publicMessage: string,
  status: number = 500,
  internalError?: unknown
): NextResponse {
  if (internalError) {
    console.error(`[API Error] ${publicMessage}:`, internalError)
  }

  return NextResponse.json(
    { error: publicMessage },
    { status }
  )
}

/**
 * Wraps an async handler with a global try/catch that returns safe errors.
 */
export function withSafeErrors<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args)
    } catch (error) {
      console.error('[Unhandled API Error]:', error)
      return NextResponse.json(
        { error: 'Er is een onverwachte fout opgetreden' },
        { status: 500 }
      )
    }
  }) as T
}

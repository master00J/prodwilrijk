type ApiErrorContext = {
  route: string
  method?: string
  userId?: string | null
  details?: Record<string, unknown>
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    message: String(error),
  }
}

export function logApiError(error: unknown, context: ApiErrorContext) {
  const payload = {
    timestamp: new Date().toISOString(),
    ...context,
    error: serializeError(error),
  }

  console.error('[api-error]', JSON.stringify(payload))
}

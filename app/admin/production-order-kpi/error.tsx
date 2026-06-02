'use client'

export default function ProductionOrderKpiError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Pagina kon niet laden</h1>
        <p className="text-gray-600 mb-6 text-sm">
          {error.message || 'Er ging iets mis bij het tonen van de KPI-pagina.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Opnieuw proberen
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
          >
            Pagina herladen
          </button>
        </div>
      </div>
    </div>
  )
}

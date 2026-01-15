'use client'

import Link from 'next/link'
import AdminGuard from '@/components/AdminGuard'

export default function AdminPage() {
  const flows = [
    {
      title: 'Prepack Flow Monitoring',
      description: 'Bekijk statistieken over verpakte kisten, manuren en prestaties per persoon',
      href: '/cnh/admin/prepack',
      icon: '📊',
      color: 'blue',
    },
    // Toekomstige flows kunnen hier worden toegevoegd
    // {
    //   title: 'Andere Flow',
    //   description: 'Beschrijving van de flow',
    //   href: '/admin/andere-flow',
    //   icon: '📈',
    //   color: 'green',
    // },
  ]

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; hover: string; text: string; border: string }> = {
      blue: {
        bg: 'bg-blue-50',
        hover: 'hover:bg-blue-100',
        text: 'text-blue-600',
        border: 'border-blue-200',
      },
      green: {
        bg: 'bg-green-50',
        hover: 'hover:bg-green-100',
        text: 'text-green-600',
        border: 'border-green-200',
      },
      purple: {
        bg: 'bg-purple-50',
        hover: 'hover:bg-purple-100',
        text: 'text-purple-600',
        border: 'border-purple-200',
      },
      orange: {
        bg: 'bg-orange-50',
        hover: 'hover:bg-orange-100',
        text: 'text-orange-600',
        border: 'border-orange-200',
      },
    }
    return colors[color] || colors.blue
  }

  return (
    <AdminGuard>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

        <div className="mb-6">
          <p className="text-gray-600">Selecteer een flow om te monitoren:</p>
        </div>

        {/* Flow Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {flows.map((flow) => {
            const colors = getColorClasses(flow.color)
            return (
              <Link
                key={flow.href}
                href={flow.href}
                className={`block ${colors.bg} ${colors.hover} border-2 ${colors.border} rounded-lg p-6 transition-all transform hover:scale-105 hover:shadow-lg`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl">{flow.icon}</div>
                  <svg
                    className={`w-6 h-6 ${colors.text}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
                <h2 className={`text-xl font-semibold mb-2 ${colors.text}`}>
                  {flow.title}
                </h2>
                <p className="text-gray-600 text-sm">{flow.description}</p>
              </Link>
            )
          })}
        </div>

        {flows.length === 0 && (
          <div className="bg-gray-50 rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Geen flows beschikbaar</p>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}


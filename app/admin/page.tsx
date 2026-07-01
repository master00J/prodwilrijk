'use client'

import Link from 'next/link'
import AdminGuard from '@/components/AdminGuard'

export default function AdminPage() {
  const flows = [
    {
      title: 'Prepack Flow Monitoring',
      description: 'Bekijk statistieken over verpakte kisten, manuren en prestaties per persoon',
      href: '/admin/prepack',
      icon: '📊',
      color: 'blue',
    },
    {
      title: 'Airtec Flow Monitoring',
      description: 'Bekijk statistieken over verpakte kisten, manuren en prestaties per persoon voor Airtec',
      href: '/admin/airtec',
      icon: '📈',
      color: 'green',
    },
    {
      title: 'WMS vs BC status',
      description:
        'Vergelijk WMS-export (kolom A/B) met BC-export (kolom E/P): snel zien wat niet meer in WMS staat maar wel in BC',
      href: '/admin/wms-bc-status',
      icon: '📋',
      color: 'orange',
    },
    {
      title: 'Stock telling',
      description:
        'Scan pallet-labels met de camera, live totaal per telsessie, duplicaatwaarschuwing en Excel-export',
      href: '/stock-telling',
      icon: '📦',
      color: 'green',
    },
    {
      title: 'Stock telling vs BC',
      description:
        'Vergelijk stock-telling Excel met BC-export: zie per item wat nog verstuurd moet worden en wat extra op voorraad ligt',
      href: '/admin/stock-vs-bc',
      icon: '⚖️',
      color: 'orange',
    },
    {
      title: 'Weert Min/Max Voorraad',
      description: 'Beheer min/max voorraad voor locatie Weert, inclusief klanten, huidige stock en besteladvies',
      href: '/admin/weert-stock',
      icon: '🏬',
      color: 'purple',
    },
    {
      title: 'Verkooporders Upload',
      description: 'Upload Excel bestand met verkooporders om prijzen in te laden voor omzet berekening',
      href: '/admin/sales-orders',
      icon: '💰',
      color: 'purple',
    },
    {
      title: 'Prijscalculator',
      description: 'Sales prijssimulaties voor pallet, kisten en meer — server-side regels, geen AI-prijzen',
      href: '/admin/pricing-calculator',
      icon: '🧮',
      color: 'blue',
    },
    {
      title: 'Prijs simulaties',
      description: 'Historiek van opgeslagen prijscalculaties en simulaties',
      href: '/admin/pricing-simulations',
      icon: '📋',
      color: 'purple',
    },
    {
      title: 'Opmetingen Overzicht',
      description: 'Bekijk alle ingevulde opmetingen voor items die nog niet bekend waren in het systeem',
      href: '/admin/measurements',
      icon: '📏',
      color: 'orange',
    },
    {
      title: 'Airtec Legacy Import',
      description: 'Importeer oude SQL dumps voor Airtec KPI’s',
      href: '/admin/airtec-legacy-import',
      icon: '⬆️',
      color: 'green',
    },
    {
      title: 'Prepack Legacy Import',
      description: 'Importeer oude SQL dumps voor Prepack KPI’s',
      href: '/admin/prepack-legacy-import',
      icon: '⬆️',
      color: 'blue',
    },
    {
      title: 'Opslagverhuur',
      description: 'Beheer klanten en gehuurde opslagruimte',
      href: '/opslag-verhuur',
      icon: '🏭',
      color: 'orange',
    },
    {
      title: 'Groeiplan KPI-overzicht',
      description:
        'Managementdashboard: maandelijkse KPI-evolutie vanaf jan 2026, gekoppeld aan ProdWilrijk-data en groeiplan-categorieën',
      href: '/admin/groeiplan-kpi',
      icon: '🎯',
      color: 'purple',
    },
    {
      title: 'Competentie Matrix',
      description: 'Beheer competenties van medewerkers per machine/werkplek en plan de dagelijkse bezetting',
      href: '/admin/competentie-matrix',
      icon: '🎯',
      color: 'green',
    },
    {
      title: 'BC artikelnummer mapping',
      description:
        'Vertaaltabel tussen oude en nieuwe Business Central nummers. Upload de Excel om alle flows automatisch naar de nieuwe nummers te laten tonen.',
      href: '/admin/bc-mappings',
      icon: '🔄',
      color: 'purple',
    },
    {
      title: 'BC Forecast Converter',
      description:
        'Download FP-matrixbestanden voor Business Central vanuit de websiteforecast, opgesplitst per locatie en alleen nog te starten.',
      href: '/admin/bc-forecast-converter',
      icon: '📅',
      color: 'blue',
    },
    {
      title: 'Lumipaper import',
      description:
        'Verwerk Lumipaper bestelbon-mails naar Business Central configurator-Excels per DC-template.',
      href: '/admin/lumipaper-import',
      icon: '🧾',
      color: 'purple',
    },
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

        <div className="mb-6">
          <div className="border-2 border-indigo-200 bg-indigo-50 rounded-lg p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="text-3xl">🧩</div>
              <div className="text-indigo-600 font-semibold">Beide flows</div>
            </div>
            <h2 className="text-xl font-semibold text-indigo-700 mb-1">Prepack + Airtec</h2>
            <p className="text-gray-600 text-sm mb-4">
              Snelle links naar beide monitoring flows.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/prepack"
                className="px-4 py-2 rounded-md bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition"
              >
                Prepack
              </Link>
              <Link
                href="/admin/airtec"
                className="px-4 py-2 rounded-md bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition"
              >
                Airtec
              </Link>
              <Link
                href="/admin/prepack-airtec"
                className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                Gecombineerd overzicht
              </Link>
            </div>
          </div>
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


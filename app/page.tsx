import Link from 'next/link'
import { 
  Package, 
  Upload, 
  CheckCircle, 
  FileSpreadsheet, 
  Box, 
  Send,
  Warehouse,
  BarChart3,
  Users,
  Settings,
  ArrowRight
} from 'lucide-react'

type FeatureLink = {
  href: string
  label: string
  step?: string
}

export default function Home() {
  const features = [
    {
      title: 'Prepack Management',
      description: 'Upload and manage prepack items with Excel integration',
      icon: Upload,
      color: 'green',
      links: [
        { href: '/prepack', label: 'Excel Upload (Status 10)', step: '1' },
        { href: '/view-prepack', label: 'View & Confirm Items', step: '2' },
        { href: '/confirmed-items', label: 'Confirmed Items (WMS)', step: '2a' },
        { href: '/wms-import', label: 'WMS Import (Status 30)', step: '2b' },
      ] as FeatureLink[]
    },
    {
      title: 'Packing Workflow',
      description: 'Track items through the complete packing process',
      icon: Box,
      color: 'blue',
      links: [
        { href: '/items-to-pack', label: 'Items to Pack', step: '3' },
        { href: '/packed-items', label: 'Packed Items', step: '4' },
      ] as FeatureLink[]
    },
    {
      title: 'Airtec Management',
      description: 'Specialized workflow for Airtec product handling',
      icon: Package,
      color: 'orange',
      links: [
        { href: '/airtec', label: 'Airtec Upload' },
        { href: '/view-airtec', label: 'View Airtec' },
        { href: '/items-to-pack-airtec', label: 'Items to Pack Airtec' },
        { href: '/packed-items-airtec', label: 'Packed Items Airtec' },
      ] as FeatureLink[]
    },
    {
      title: 'Grote Inpak',
      description: 'Atlas Copco overview and transport management',
      icon: Warehouse,
      color: 'teal',
      links: [
        { href: '/grote-inpak', label: 'Grote Inpak Dashboard' },
      ] as FeatureLink[]
    },
  ]

  const quickActions = [
    {
      href: '/prepack',
      icon: Upload,
      label: 'Upload Prepack',
      color: 'from-green-500 to-green-600'
    },
    {
      href: '/items-to-pack',
      icon: Box,
      label: 'Items to Pack',
      color: 'from-blue-500 to-blue-600'
    },
    {
      href: '/packed-items',
      icon: Send,
      label: 'Packed Items',
      color: 'from-purple-500 to-purple-600'
    },
    {
      href: '/airtec',
      icon: Package,
      label: 'Airtec',
      color: 'from-orange-500 to-orange-600'
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-orange-600/10"></div>
        <div className="container mx-auto px-2 sm:px-4 py-12 sm:py-16 md:py-20 lg:py-28 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mb-4 sm:mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
              <Warehouse className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight px-2">
              Prodwilrijk <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">V2</span>
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-600 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-2">
              Modern warehouse management system designed for efficiency and productivity
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 px-2">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`group relative px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r ${action.color} text-white rounded-xl font-semibold shadow-lg shadow-gray-900/10 hover:shadow-xl hover:shadow-gray-900/20 transition-all duration-300 hover:scale-105 flex items-center gap-2 text-sm sm:text-base min-h-[44px] touch-manipulation`}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>{action.label}</span>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300" />
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-2 sm:px-4 py-12 sm:py-16 md:py-24">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
            Complete Workflow Management
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-2">
            Streamline your warehouse operations with our integrated modules
          </p>
        </div>

        <div className="grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 max-w-7xl mx-auto">
          {features.map((feature) => {
            const Icon = feature.icon
            const colorClasses = {
              green: 'from-green-500 to-emerald-600',
              blue: 'from-blue-500 to-cyan-600',
              orange: 'from-orange-500 to-amber-600',
            }
            
            return (
              <div
                key={feature.title}
                className="group bg-white rounded-2xl shadow-lg shadow-gray-900/5 hover:shadow-xl hover:shadow-gray-900/10 transition-all duration-300 overflow-hidden border border-gray-100 hover:border-gray-200"
              >
                <div className={`h-2 bg-gradient-to-r ${colorClasses[feature.color as keyof typeof colorClasses]}`}></div>
                <div className="p-4 sm:p-6 md:p-8">
                  <div className={`inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${colorClasses[feature.color as keyof typeof colorClasses]} mb-4 sm:mb-6 shadow-lg`}>
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="space-y-2">
                    {feature.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="group/link flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 min-h-[44px] touch-manipulation"
                      >
                        <div className="flex items-center gap-3">
                          {link.step && (
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold group-hover/link:bg-gray-300 transition-colors">
                              {link.step}
                            </span>
                          )}
                          <span className="text-gray-700 font-medium group-hover/link:text-gray-900">
                            {link.label}
                          </span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover/link:text-gray-600 group-hover/link:translate-x-1 transition-all" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Stats/Info Section */}
      <section className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-12 sm:py-16">
        <div className="container mx-auto px-2 sm:px-4">
          <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto text-center">
            <div>
              <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Streamlined
              </div>
              <p className="text-gray-300">Complete workflow from upload to shipment</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Efficient
              </div>
              <p className="text-gray-300">Real-time tracking and management</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                Reliable
              </div>
              <p className="text-gray-300">Built for modern warehouse operations</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}


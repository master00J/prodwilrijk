const webpack = require('webpack')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let supabaseHostname = 'localhost'
if (supabaseUrl) {
  try {
    supabaseHostname = new URL(supabaseUrl).hostname
  } catch {
    // ongeldige URL — fallback blijft localhost
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas', '@kenjiuno/msgreader'],
  // BC-template (xlsx met XML-map) meeleveren in de standalone build
  outputFileTracingIncludes: {
    '/api/bc-forecast-converter': ['./lib/grote-inpak/templates/*.xlsx'],
  },
  experimental: {
    // Grote Excel-bestanden (bv. Stock Willebroek 10000+ rijen) toelaten
    proxyClientMaxBodySize: '50mb',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
      },
      ...(supabaseHostname !== 'localhost'
        ? [
            { protocol: 'https', hostname: supabaseHostname },
            { protocol: 'http', hostname: supabaseHostname },
          ]
        : []),
    ],
  },
  turbopack: {
    root: __dirname,
  },
  webpack: (config, { isServer }) => {
    // Exclude canvas from bundle (pdfjs-dist tries to import it but we use dynamic import)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
    }
    
    // Ignore canvas module completely during build
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^canvas$/,
      })
    )
    
    return config
  },
}

module.exports = nextConfig






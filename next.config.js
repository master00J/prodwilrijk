const webpack = require('webpack')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
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






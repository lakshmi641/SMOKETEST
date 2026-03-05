const path = require('path')
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig = {
  transpilePackages: [
    '@upstash/redis',
    '@julley/shared-services',
    '@julley/shared-types',
    '@julley/shared-stores',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'ui-avatars.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: '*.googleapis.com', port: '', pathname: '/**' },
    ],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  webpack(config, { isServer, dev }) {
    const rootNodeModules = path.resolve(__dirname, '../../node_modules')
    config.resolve.modules = [rootNodeModules, ...(config.resolve.modules || [])]

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
        util: require.resolve('util'),
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        os: false,
        fs: false,
        net: false,
        tls: false,
      }
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:os': false,
        'node:fs': false,
        'node:net': false,
        'node:tls': false,
        'node:crypto': require.resolve('crypto-browserify'),
        'node:stream': require.resolve('stream-browserify'),
        'node:util': require.resolve('util'),
        'node:buffer': require.resolve('buffer'),
      }
      const webpack = require('webpack')
      config.plugins.push(
        new webpack.ProvidePlugin({ process: 'process/browser', Buffer: ['buffer', 'Buffer'] }),
        new webpack.IgnorePlugin({ resourceRegExp: /^@clickhouse\/client$/ })
      )
    }

    if (dev) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
      }
    }

    return config
  },
}

module.exports = withBundleAnalyzer(nextConfig)

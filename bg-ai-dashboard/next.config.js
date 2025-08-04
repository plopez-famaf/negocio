/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    CUSTOM_KEY: 'bg-ai-dashboard',
  },
  async rewrites() {
    return [
      {
        source: '/api/identity/:path*',
        destination: `${process.env.IDENTITY_AI_SERVICE_URL || 'http://localhost:3001'}/api/:path*`,
      },
      {
        source: '/api/threat/:path*',
        destination: `${process.env.THREAT_AI_SERVICE_URL || 'http://localhost:3002'}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
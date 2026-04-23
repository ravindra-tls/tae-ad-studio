/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'cdn.shopify.com' },
    ],
  },
  // sharp is a native module (libvips bindings). Let Next load it as a CJS
  // require from node_modules rather than trying to bundle it through webpack,
  // which breaks on the .node binary and manifests as a 500 at route
  // module-load time (no stage ever starts, you just see /_error compile).
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
};

module.exports = nextConfig;

import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  ...(process.env.NEXT_DIRECT_DEV === '1' && {
    experimental: {
      // Restricted local preview only: Node 24 may crash on worker teardown; normal dev keeps defaults.
      turbopackPluginRuntimeStrategy: 'forceWorkerThreads' as const,
      workerThreads: true,
    },
  }),
};
export default config;

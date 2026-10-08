// ponytail: direct Next.js startup for environments that prohibit child processes; use npm run dev elsewhere.
process.env.NODE_ENV = 'development';
process.env.__NEXT_DEV_SERVER = '1';
process.env.NEXT_DIRECT_DEV = '1';
process.env.TURBOPACK = '1';
require('next/dist/server/lib/start-server')
  .startServer({ dir: process.cwd(), port: 3000, isDev: true, hostname: 'localhost' })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

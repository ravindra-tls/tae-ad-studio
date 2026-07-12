// Dev-server wrapper for tooling that cannot set a working directory:
// chdir into the app root (so Tailwind content globs, .env.local, and
// next.config.js all resolve correctly), then hand over to `next dev`.
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
process.chdir(appRoot);

const port = process.env.PORT || '5021';
process.argv = [process.argv[0], require.resolve('next/dist/bin/next'), 'dev', '-p', String(port)];
require('next/dist/bin/next');

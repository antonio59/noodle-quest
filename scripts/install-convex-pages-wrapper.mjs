/**
 * Point `npx convex` at scripts/pages-convex-deploy.mjs.
 * pnpm links the real CLI into node_modules/.bin before postinstall runs.
 */
import { chmodSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'node_modules/.bin/convex');
const wrapper = path.join(root, 'scripts/pages-convex-deploy.mjs');

if (!existsSync(path.join(root, 'node_modules/convex/bin/main.js'))) {
  process.exit(0);
}

const shim = `#!/bin/sh
exec node ${JSON.stringify(wrapper)} "$@"
`;
writeFileSync(bin, shim);
chmodSync(bin, 0o755);

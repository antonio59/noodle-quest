/**
 * Cloudflare Pages runs `npx convex deploy --cmd 'npm run build'` for every
 * deployment. Convex 1.38 refuses that command when CF_PAGES_BRANCH is not
 * `main` and CONVEX_DEPLOY_KEY is a production key:
 *
 *   Detected a non-production build environment and "CONVEX_DEPLOY_KEY"
 *   for a production Convex deployment.
 *
 * Production builds (branch main) are unchanged. Preview builds compile the
 * frontend only, so a pull request cannot push Convex functions to production.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REAL_CONVEX_BIN = path.join(ROOT, 'node_modules/convex/bin/main.js');

export function previewShouldSkipConvexPush(env, args) {
  if (args[0] !== 'deploy') return false;
  if (checkBuildEnvironment(args) === 'disable') return false;
  if (!env.CF_PAGES && !env.WORKERS_CI) return false;
  const branch = env.CF_PAGES_BRANCH ?? env.WORKERS_CI_BRANCH;
  if (branch === 'main') return false;
  const key = env.CONVEX_DEPLOY_KEY ?? '';
  // Preview and dev keys are meant to deploy from a non-main branch.
  if (key.startsWith('preview:') || key.startsWith('dev:')) return false;
  return true;
}

export function frontendBuildCommand(args) {
  const inline = args.find((arg) => arg.startsWith('--cmd='));
  if (inline) return inline.slice('--cmd='.length);
  const index = args.indexOf('--cmd');
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return 'npm run build';
}

function checkBuildEnvironment(args) {
  const inline = args.find((arg) => arg.startsWith('--check-build-environment='));
  if (inline) return inline.slice(inline.indexOf('=') + 1);
  const index = args.indexOf('--check-build-environment');
  return index >= 0 ? args[index + 1] : undefined;
}

function exitWith(result) {
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

function main() {
  const args = process.argv.slice(2);
  if (previewShouldSkipConvexPush(process.env, args)) {
    const branch = process.env.CF_PAGES_BRANCH ?? process.env.WORKERS_CI_BRANCH ?? '(unset)';
    const cmd = frontendBuildCommand(args);
    console.error(
      `Pages preview branch "${branch}": skipping Convex production deploy. ` +
        'Convex rejects a production CONVEX_DEPLOY_KEY when the branch is not main. ' +
        `Running \`${cmd}\` only.`,
    );
    exitWith(spawnSync(cmd, {
      shell: true,
      stdio: 'inherit',
      env: process.env,
    }));
  }
  exitWith(spawnSync(process.execPath, [REAL_CONVEX_BIN, ...args], {
    stdio: 'inherit',
    env: process.env,
  }));
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main();

import { describe, expect, it } from 'vitest';
import {
  frontendBuildCommand,
  previewShouldSkipConvexPush,
} from '../scripts/pages-convex-deploy.mjs';

const prodKey = 'prod:incredible-lobster-12|secret';
const previewEnv = {
  CF_PAGES: '1',
  CF_PAGES_BRANCH: 'cursor/audit-security-fixes-ac22',
  CONVEX_DEPLOY_KEY: prodKey,
};

describe('previewShouldSkipConvexPush', () => {
  it('skips a production deploy key on a Pages preview branch', () => {
    expect(previewShouldSkipConvexPush(previewEnv, ['deploy', '--cmd', 'npm run build'])).toBe(true);
  });

  it('still deploys production from the main branch', () => {
    expect(previewShouldSkipConvexPush(
      { ...previewEnv, CF_PAGES_BRANCH: 'main' },
      ['deploy', '--cmd', 'npm run build'],
    )).toBe(false);
  });

  it('leaves local and CI deploys alone', () => {
    expect(previewShouldSkipConvexPush(
      { CONVEX_DEPLOY_KEY: prodKey },
      ['deploy'],
    )).toBe(false);
  });

  it('lets a preview deploy key through', () => {
    expect(previewShouldSkipConvexPush(
      { ...previewEnv, CONVEX_DEPLOY_KEY: 'preview:team:project|secret' },
      ['deploy', '--cmd', 'npm run build'],
    )).toBe(false);
  });

  it('lets a dev deploy key through', () => {
    expect(previewShouldSkipConvexPush(
      { ...previewEnv, CONVEX_DEPLOY_KEY: 'dev:happy-animal-1|secret' },
      ['deploy'],
    )).toBe(false);
  });

  it('does not wrap other convex commands', () => {
    expect(previewShouldSkipConvexPush(previewEnv, ['dev'])).toBe(false);
    expect(previewShouldSkipConvexPush(previewEnv, ['codegen'])).toBe(false);
  });

  it('honours an explicit disable of the build-environment check', () => {
    expect(previewShouldSkipConvexPush(
      previewEnv,
      ['deploy', '--check-build-environment', 'disable', '--cmd', 'npm run build'],
    )).toBe(false);
  });

  it('treats a missing Pages branch as non-production, matching the Convex CLI', () => {
    const { CF_PAGES_BRANCH: _branch, ...env } = previewEnv;
    expect(previewShouldSkipConvexPush(env, ['deploy', '--cmd', 'npm run build'])).toBe(true);
  });
});

describe('frontendBuildCommand', () => {
  it('reads the Pages --cmd value', () => {
    expect(frontendBuildCommand(['deploy', '--cmd', 'npm run build'])).toBe('npm run build');
    expect(frontendBuildCommand(['deploy', '--cmd=pnpm run build'])).toBe('pnpm run build');
  });

  it('defaults to the dashboard build', () => {
    expect(frontendBuildCommand(['deploy'])).toBe('npm run build');
  });
});

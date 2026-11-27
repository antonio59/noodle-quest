import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { APP_VERSION } from '@/lib/version';

const ROOT = path.resolve(__dirname, '../../..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  version: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('versioning and release notes', () => {
  test('package.json version is plain semver and matches injected APP_VERSION', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(APP_VERSION).toBe(pkg.version);
  });

  test('CHANGELOG.md has a section for the current package.json version', () => {
    const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
    const heading = new RegExp(`^## \\[${escapeRegExp(pkg.version)}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm');
    expect(changelog).toMatch(heading);
  });

  test('RELEASE_NOTES.md has a heading for the current major.minor version', () => {
    const [major, minor] = pkg.version.split('.');
    const releaseNotes = fs.readFileSync(path.join(ROOT, 'RELEASE_NOTES.md'), 'utf8');
    const heading = new RegExp(`^## ${major}\\.${minor}(?:\\.\\d+)?\\s+—\\s+.+$`, 'm');
    expect(releaseNotes).toMatch(heading);
  });
});

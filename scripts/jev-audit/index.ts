/**
 * Jev content audit — validates Noodle Quest's hand-authored game data with
 * TypeSafe System One (jev-latest). Read-only: no game files are changed.
 *
 *   TYPESAFE_API_KEY=... pnpm audit:content                  # full audit
 *   pnpm audit:content -- --sections=words,feelings          # subset
 *   pnpm audit:content -- --limit=8                          # sample each section
 *   pnpm audit:content -- --dry                              # plan only, no API calls
 *
 * The key can live in .env.local as TYPESAFE_API_KEY=...
 * Writes audit-report.json + audit-report.md to the repo root.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { SECTIONS, codeChecks, type Finding, type Unit } from './sections.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

// ---------- env ----------

function loadEnv(): void {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
      }
    }
  }
}

// ---------- args ----------

const args = process.argv.slice(2);
const opt = (name: string): string | undefined =>
  args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const has = (name: string) => args.includes(`--${name}`);

const DRY = has('dry');
const LIST = has('list');
const LIMIT = opt('limit') ? Number(opt('limit')) : undefined;
const CONCURRENCY = Number(opt('concurrency') ?? 4);
const OUT = opt('out') ?? 'audit-report';
const SELECTED = opt('sections')?.split(',').map(s => s.trim()).filter(Boolean);

// ---------- plan ----------

const sections = SELECTED
  ? SECTIONS.filter(s => SELECTED.includes(s.id))
  : SECTIONS;

if (LIST || has('help')) {
  console.log('Sections (use with --sections=a,b):\n');
  for (const s of SECTIONS) console.log(`  ${s.id.padEnd(18)} ${s.blurb}`);
  process.exit(0);
}
const missing = (SELECTED ?? []).filter(id => !SECTIONS.some(s => s.id === id));
if (missing.length) {
  console.error(`Unknown section(s): ${missing.join(', ')}. Run -- --list for valid ids.`);
  process.exit(1);
}

// ---------- run ----------

interface UnitResult {
  section: string;
  label: string;
  findings?: Finding[];
  error?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

async function runUnit(client: TypeSafeClient, section: string, unit: Unit): Promise<UnitResult> {
  try {
    const res = await client.systemOne(
      { state: unit.state, questions: unit.questions },
      { timeout: 120_000 },
    );
    return {
      section, label: unit.label,
      findings: unit.interpret(res.answers as Record<string, any>),
      usage: res.usage,
    };
  } catch (e) {
    return { section, label: unit.label, error: e instanceof Error ? e.message : String(e) };
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

function writeReports(results: UnitResult[], checks: Finding[], started: number): void {
  const findings = results.flatMap(r => r.findings ?? []);
  const errors = results.filter(r => r.error).map(r => ({ section: r.section, unit: r.label, error: r.error! }));
  const usage = results.reduce((a, r) => ({
    input: a.input + (r.usage?.input_tokens ?? 0),
    output: a.output + (r.usage?.output_tokens ?? 0),
  }), { input: 0, output: 0 });
  const bySection = new Map<string, Finding[]>();
  for (const f of [...checks, ...findings]) {
    const arr = bySection.get(f.section) ?? [];
    arr.push(f);
    bySection.set(f.section, arr);
  }

  const json = {
    generated: new Date().toISOString(), model: 'jev-latest',
    calls: results.length, usage,
    elapsedSec: Math.round((Date.now() - started) / 1000),
    checks, findings, errors,
  };
  fs.writeFileSync(path.join(ROOT, `${OUT}.json`), JSON.stringify(json, null, 2));

  const flag = (f: Finding) => `${f.severity === 'flag' ? '🔴' : '🔵'} **${f.item}** — ${f.issue}${f.detail ? ` _(${f.detail})_` : ''}`;
  const md = [
    `# Jev content audit — Noodle Quest`,
    ``,
    `Model: \`jev-latest\` · ${json.generated.slice(0, 19)}Z · ${results.length} API calls · ${usage.input.toLocaleString()}+${usage.output.toLocaleString()} tokens · ${json.elapsedSec}s`,
    ``,
    `| Section | Findings | Flags |`,
    `|---|---|---|`,
    ...[...bySection.entries()].map(([s, fs]) =>
      `| ${s} | ${fs.length} | ${fs.filter(f => f.severity === 'flag').length} |`),
    ``,
    ...[...bySection.entries()].flatMap(([s, fs]) => [`## ${s}`, ``, ...fs.map(flag), ``]),
    errors.length ? `## API errors\n\n${errors.map(e => `- ${e.section} / ${e.unit}: ${e.error}`).join('\n')}\n` : '',
    `_Findings are advisory — review before changing game data. Jev flags candidates for human judgement, not ground truth._`,
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, `${OUT}.md`), md);
}

async function main(): Promise<void> {
  loadEnv();

  const checks = codeChecks();

  const work: { section: string; unit: Unit }[] = [];
  for (const s of sections) {
    for (const unit of s.units(LIMIT)) work.push({ section: s.id, unit });
  }

  console.log(`Sections: ${sections.map(s => s.id).join(', ')}`);
  console.log(`Planned API calls: ${work.length} (concurrency ${CONCURRENCY})`);
  console.log(`Deterministic code checks: ${checks.length} finding(s)`);
  if (DRY) return;

  if (!process.env.TYPESAFE_API_KEY) {
    console.error('\nTYPESAFE_API_KEY is not set. Add it to .env.local or export it, then re-run.');
    process.exit(1);
  }

  const client = new TypeSafeClient({ timeout: 120_000 });
  const started = Date.now();
  let done = 0;
  const results = await pool(work, CONCURRENCY, ({ section, unit }) =>
    runUnit(client, section, unit).then(r => {
      done++;
      if (done % 10 === 0 || done === work.length) process.stdout.write(`\r${done}/${work.length} calls`);
      return r;
    }));
  process.stdout.write('\n');

  writeReports(results, checks, started);

  const findings = results.flatMap(r => r.findings ?? []);
  const errors = results.filter(r => r.error);
  console.log(`\nFindings: ${findings.length} (${findings.filter(f => f.severity === 'flag').length} flags) + ${checks.length} code-check flag(s)`);
  if (errors.length) console.log(`API errors: ${errors.length} unit(s) — see report`);
  console.log(`Wrote ${OUT}.md and ${OUT}.json`);
}

main().catch(e => { console.error(e); process.exit(1); });

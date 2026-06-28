#!/usr/bin/env node
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const SOURCES_FILE = resolve(PROJECT_ROOT, 'scripts/portrait-sources.json');
const HEROES_FILE  = resolve(PROJECT_ROOT, 'src/data/heroes.json');
const OUTPUT_DIR   = resolve(PROJECT_ROOT, 'public/assets/heroes');

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function main() {
  const heroes = JSON.parse(await readFile(HEROES_FILE, 'utf-8')).heroes;
  const sources = JSON.parse(await readFile(SOURCES_FILE, 'utf-8'));
  const overrides = sources._overrides || {};

  await mkdir(OUTPUT_DIR, { recursive: true });

  const results = { fetched: [], skipped: [], existing: [], failed: [] };

  for (const hero of heroes) {
    const url = overrides[hero.id];
    const outFile = resolve(OUTPUT_DIR, hero.portrait_file);

    if (!url) {
      if (await exists(outFile)) results.existing.push(hero.id);
      else results.skipped.push(hero.id);
      continue;
    }

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'CounterWatch portrait fetch script' },
      });
      if (!response.ok) {
        results.failed.push({ id: hero.id, status: response.status, url });
        continue;
      }
      const buf = Buffer.from(await response.arrayBuffer());
      await writeFile(outFile, buf);
      results.fetched.push({ id: hero.id, bytes: buf.length, url });
      console.log(`  fetched  ${hero.id.padEnd(16)} ${buf.length} bytes`);
    } catch (err) {
      results.failed.push({ id: hero.id, error: err.message, url });
      console.error(`  FAILED   ${hero.id.padEnd(16)} ${err.message}`);
    }
  }

  console.log('\nSummary:');
  console.log(`  fetched: ${results.fetched.length}`);
  console.log(`  already on disk: ${results.existing.length}`);
  console.log(`  skipped (no URL configured): ${results.skipped.length}`);
  console.log(`  failed: ${results.failed.length}`);

  if (results.skipped.length > 0) {
    const checklistFile = resolve(PROJECT_ROOT, 'scripts/missing-portraits.txt');
    const lines = [
      '# Heroes needing portraits',
      `# generated ${new Date().toISOString()}`,
      '#',
      '# Either:',
      '#   1) Edit scripts/portrait-sources.json to add a direct image URL, then re-run "npm run fetch-portraits"',
      '#   2) Drop a square PNG/WebP file into public/assets/heroes/{id}.png',
      '#   3) Use the in-app Admin tab to upload (saves to IndexedDB; persists across reloads)',
      '',
      ...results.skipped.map((id) => id),
    ];
    await writeFile(checklistFile, lines.join('\n'));
    console.log(`\nWrote checklist: scripts/missing-portraits.txt`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

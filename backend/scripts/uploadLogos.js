import { readFile, readdir, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseEnv } from '../config/env.js';
import { createSupabaseAdmin } from '../config/supabase.js';
import { inspectLogo } from '../utils/logoFile.js';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--apply')) {
  console.error('Usage: node scripts/uploadLogos.js [--apply]');
  process.exit(1);
}
const apply = args.includes('--apply');
const directory = fileURLToPath(new URL('../assets/logos/', import.meta.url));
const manifest = JSON.parse(await readFile(new URL('../data/directory-seed.json', import.meta.url), 'utf8'));
const files = await readdir(directory);
const supported = /\.(png|jpe?g|webp|gif|avif)$/i;
const known = new Set(manifest.entries.map(entry => entry.slug));
const candidates = files.filter(file => supported.test(file));
const unknown = candidates.filter(file => !known.has(path.parse(file).name));
if (unknown.length) {
  console.error(`Unknown logo slugs: ${unknown.join(', ')}`);
  process.exit(1);
}
// Validate ALL supplied files before making any remote changes.
const jobs = [];
for (const entry of manifest.entries) {
  const matches = candidates.filter(file => path.parse(file).name === entry.slug);
  if (matches.length > 1) throw new Error(`Multiple logos supplied for ${entry.slug}; keep one file`);
  if (!matches.length) continue;
  const resolved = await realpath(path.join(directory,matches[0]));
  if (path.dirname(resolved) !== await realpath(directory)) throw new Error('Logo symlinks must stay inside assets/logos');
  const bytes = await readFile(resolved);
  const metadata = inspectLogo(bytes);
  const prefix = entry.table === 'clubs' ? 'clubs' : 'projects';
  const key = `${prefix}/${entry.id}/${metadata.hash}.${metadata.extension}`;
  jobs.push({ entry, bytes, metadata, key });
}
if (!jobs.length) {
  console.log('No logos supplied. See assets/logos/README.md; existing icon_path values are unchanged.');
  process.exit(0);
}
console.log(`${apply ? 'Uploading' : 'Dry run'}: ${jobs.length} logos; ${manifest.entries.length - jobs.length} entries without local logos.`);
if (!apply) {
  for (const job of jobs) console.log(`${job.entry.slug} -> assets/${job.key}`);
  console.log('Run npm run seed:logos -- --apply to upload and update icon_path.');
  process.exit(0);
}
const config = parseEnv(process.env);
if (config.SUPABASE_STORAGE_BUCKET !== 'assets') throw new Error('This seed expects SUPABASE_STORAGE_BUCKET=assets');
const db = createSupabaseAdmin(config);
// Check every entity exists BEFORE uploading anything; IDs must match the SQL seed.
for (const job of jobs) {
  const { data, error } = await db.from(job.entry.table).select('id').eq('id', job.entry.id).maybeSingle();
  if (error || !data) throw new Error(`Cannot find ${job.entry.slug}; run supabase/seed_directory.sql first`);
}
let failed = 0;
for (const job of jobs) {
  const { error: uploadError } = await db.storage.from('assets').upload(job.key, job.bytes, {
    contentType: job.metadata.contentType, cacheControl: '31536000', upsert: true,
  });
  if (uploadError) {
    console.error(`Upload failed: ${job.entry.slug} (code ${uploadError.statusCode || 'unknown'})`);
    failed++; continue;
  }
  const { data, error } = await db.from(job.entry.table).update({ icon_path: job.key })
    .eq('id', job.entry.id).select('id').maybeSingle();
  if (error || !data) {
    // Keep uploaded bytes for a safe retry; no SQL deletion of Storage metadata.
    console.error(`DB link failed: ${job.entry.slug}; uploaded object retained, rerun to retry.`);
    failed++; continue;
  }
  console.log(`Linked ${job.entry.slug}`);
}
if (failed) process.exitCode = 1;

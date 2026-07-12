/**
 * Backs up generated images from all but the 5 most-recently-created sessions
 * (globally, across all users) to a local folder, then removes them from
 * Supabase (storage object + generated_images row) to free the storage quota.
 *
 * Usage:
 *   ./node_modules/.bin/tsx scripts/backup-and-prune-old-images.ts            # dry run — lists what would happen
 *   ./node_modules/.bin/tsx scripts/backup-and-prune-old-images.ts --execute  # actually downloads + deletes
 *
 * Backup destination: <repo>/../tae ad studio backup images/<session-name>--<session-id>/<filename>
 */
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(__dirname, '../.env.local');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const EXECUTE = process.argv.includes('--execute');
const KEEP_COUNT = 5;
const BACKUP_ROOT = path.resolve(__dirname, '../../tae ad studio backup images');

function sanitize(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim().slice(0, 80) || 'untitled';
}

// Extracts { bucket, objectPath } from a Supabase public storage URL.
function parseStorageUrl(url: string): { bucket: string; objectPath: string } | null {
  const m = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: m[1], objectPath: decodeURIComponent(m[2]) };
}

async function main() {
  const { createServiceClient } = await import('../lib/supabase/server');
  const supabase = await createServiceClient();

  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });
  if (sErr) throw sErr;
  if (!sessions?.length) {
    console.log('No sessions found.');
    return;
  }

  const keepIds = new Set(sessions.slice(0, KEEP_COUNT).map((s) => s.id));
  const pruneSessions = sessions.filter((s) => !keepIds.has(s.id));

  console.log(`Total sessions: ${sessions.length}`);
  console.log(`Keeping (5 most recent, global): ${[...keepIds].join(', ')}`);
  console.log(`Pruning images from ${pruneSessions.length} older sessions.\n`);

  if (!pruneSessions.length) {
    console.log('Nothing to prune.');
    return;
  }

  const { data: images, error: iErr } = await supabase
    .from('generated_images')
    .select('id, session_id, image_url, created_at')
    .in('session_id', pruneSessions.map((s) => s.id))
    .not('image_url', 'is', null);
  if (iErr) throw iErr;

  console.log(`Images to back up${EXECUTE ? ' + delete' : ' (dry run, nothing will be deleted)'}: ${images?.length ?? 0}\n`);

  const sessionById = new Map(pruneSessions.map((s) => [s.id, s]));
  let backedUp = 0;
  let deleted = 0;
  let bytesTotal = 0;
  const skipped: string[] = [];

  for (const img of images ?? []) {
    const parsed = parseStorageUrl(img.image_url as string);
    if (!parsed) {
      skipped.push(`${img.id}: unrecognized URL format (${img.image_url})`);
      continue;
    }

    const session = sessionById.get(img.session_id);
    const sessionFolder = sanitize(`${session?.name ?? 'session'}--${img.session_id.slice(0, 8)}`);
    const destDir = path.join(BACKUP_ROOT, sessionFolder);
    const filename = path.basename(parsed.objectPath) || `${img.id}.png`;
    const destPath = path.join(destDir, filename);

    if (EXECUTE) {
      const { data: blob, error: dlErr } = await supabase.storage.from(parsed.bucket).download(parsed.objectPath);
      if (dlErr || !blob) {
        skipped.push(`${img.id}: download failed (${dlErr?.message})`);
        continue;
      }
      fs.mkdirSync(destDir, { recursive: true });
      const buf = Buffer.from(await blob.arrayBuffer());
      fs.writeFileSync(destPath, buf);
      bytesTotal += buf.length;
      backedUp++;

      const { error: rmErr } = await supabase.storage.from(parsed.bucket).remove([parsed.objectPath]);
      if (rmErr) {
        skipped.push(`${img.id}: backed up but storage delete failed (${rmErr.message})`);
        continue;
      }
      const { error: rowErr } = await supabase.from('generated_images').delete().eq('id', img.id);
      if (rowErr) {
        skipped.push(`${img.id}: storage deleted but row delete failed (${rowErr.message})`);
        continue;
      }
      deleted++;
    } else {
      console.log(`  would back up: ${parsed.bucket}/${parsed.objectPath} -> ${destPath}`);
    }
  }

  if (EXECUTE) {
    console.log(`\nBacked up ${backedUp} images (${(bytesTotal / 1024 / 1024).toFixed(1)} MB) to ${BACKUP_ROOT}`);
    console.log(`Deleted ${deleted} images from Supabase (storage + row).`);
  } else {
    console.log(`\nDry run only — pass --execute to actually download and delete.`);
  }
  if (skipped.length) {
    console.log(`\n${skipped.length} skipped/failed:`);
    skipped.forEach((s) => console.log(`  - ${s}`));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

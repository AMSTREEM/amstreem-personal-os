import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const lock = JSON.parse(readFileSync('FROZEN.lock.json', 'utf8'));
const sha = (buffer) => createHash('sha256').update(buffer).digest('hex');
let failures = 0;

for (const [path, expected] of Object.entries(lock.files ?? {})) {
  if (!existsSync(path)) { console.error('MISSING ', path); failures += 1; continue; }
  const actual = sha(readFileSync(path));
  if (actual !== expected) {
    console.error('CHANGED ', path, '\n  expected:', expected, '\n  actual:  ', actual);
    failures += 1;
  } else console.log('ok      ', path);
}

const regions = [lock.serverRegion, ...(lock.serverRegions ?? [])].filter(Boolean);
for (const region of regions) {
  const { file, startMarker, endMarker, sha256, name } = region;
  if (!existsSync(file)) { console.error('MISSING SERVER FILE', file, name ?? ''); failures += 1; continue; }
  const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) { console.error('INVALID SERVER REGION', name ?? file); failures += 1; continue; }
  const actual = sha(source.slice(start, end));
  if (actual !== sha256) {
    console.error('CHANGED SERVER REGION', name ?? file, '\n  expected:', sha256, '\n  actual:  ', actual);
    failures += 1;
  } else console.log('ok      ', name ?? file);
}

if (failures) {
  console.error('Frozen-zone check failed:', failures, 'mismatch(es). Do not edit the lock to hide a change.');
  process.exit(1);
}
console.log('Frozen-zone check passed.');

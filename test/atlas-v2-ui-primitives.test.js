import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const componentPath = new URL('../client/src/components/ui/atlas-ui.tsx', import.meta.url);
const stylePath = new URL('../client/src/design/components.css', import.meta.url);
const entryPath = new URL('../client/src/main.tsx', import.meta.url);

test('Atlas v2 component kit exports the shared primitives', async () => {
  const source = await readFile(componentPath, 'utf8');
  for (const name of [
    'AtlasButton', 'AtlasCard', 'AtlasCardHeader', 'AtlasCardTitle',
    'AtlasCardDescription', 'AtlasCardContent', 'AtlasCardFooter',
    'AtlasBadge', 'AtlasInput', 'AtlasProgress', 'AtlasDivider',
    'AtlasEmptyState', 'AtlasSkeleton', 'AtlasSectionHeading'
  ]) assert.match(source, new RegExp('export (?:const|function) ' + name + '\\b'), name);
});

test('Atlas v2 component styles are scoped and loaded by the app entry', async () => {
  const [styles, entry] = await Promise.all([
    readFile(stylePath, 'utf8'),
    readFile(entryPath, 'utf8')
  ]);
  assert.match(styles, /\.atlas-v2 \.a-btn/);
  assert.match(styles, /\.atlas-v2 \.a-card/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(entry, /\.\/design\/components\.css/);
  assert.doesNotMatch(styles, /(^|\\n)button\\s*\\{/);
});

test('Atlas inputs and progress expose accessible state', async () => {
  const source = await readFile(componentPath, 'utf8');
  assert.match(source, /aria-invalid=/);
  assert.match(source, /role="alert"/);
  assert.match(source, /role="progressbar"/);
  assert.match(source, /aria-valuenow=/);
});

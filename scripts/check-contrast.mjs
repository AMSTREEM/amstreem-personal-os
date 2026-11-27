import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(root, 'client/src/design/themes.css'), 'utf8');

function parseTheme(name) {
  const selector = new RegExp(`html\\[data-a-theme=['"]${name}['"]\\]\\s*\\{([^}]+)\\}`);
  const block = css.match(selector)?.[1];
  if (!block) throw new Error(`Missing theme block: ${name}`);
  const values = {};
  for (const token of ['bg', 'surface-1', 'surface-2', 'surface-3', 'text', 'text-muted', 'text-faint']) {
    const match = block.match(new RegExp(`--a-${token}:\\s*oklch\\(([^)]+)\\)`));
    if (!match) throw new Error(`Missing --a-${token} in ${name}`);
    const parts = match[1].split(/\s+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some(value => !Number.isFinite(value))) {
      throw new Error(`Invalid OKLCH token --a-${token} in ${name}`);
    }
    values[token] = parts;
  }
  return values;
}

function oklchToRgb([L, C, H]) {
  const h = H * Math.PI / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
  return linear.map(value => {
    const channel = Math.max(0, Math.min(1, value));
    return channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
  });
}

function luminance(rgb) {
  const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

let failures = 0;
for (const name of ['obsidian', 'dusk', 'ivory', 'sahara']) {
  const theme = parseTheme(name);
  for (const backgroundToken of ['bg', 'surface-1', 'surface-2', 'surface-3']) {
    const background = oklchToRgb(theme[backgroundToken]);
    for (const textToken of ['text', 'text-muted', 'text-faint']) {
      const ratio = contrast(background, oklchToRgb(theme[textToken]));
      const pass = ratio >= 4.5;
      console.log(`${pass ? 'PASS' : 'FAIL'} ${name} --a-${textToken} on --a-${backgroundToken}: ${ratio.toFixed(2)}:1`);
      if (!pass) failures++;
    }
  }
}
if (failures) {
  console.error(`Contrast gate failed: ${failures} token pair(s) below WCAG AA 4.5:1.`);
  process.exitCode = 1;
} else {
  console.log('Contrast gate passed: all text/surface combinations meet WCAG AA 4.5:1.');
}

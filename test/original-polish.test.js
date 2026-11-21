const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/style.css'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const index = html;

test('original Focus Room supports custom hours, minutes and seconds', () => {
  for (const id of ['timerHours', 'timerMinutes', 'timerSeconds', 'applyCustomTimer']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(app, /function setCustomTimer\(\)/);
  assert.match(app, /h\*3600\+m\*60\+s/);
  assert.match(app, /function formatTimer\(seconds\)/);
  assert.match(app, /timer\.duration\/60/);
});

test('custom timer validates duration and keeps reset bound to the selected duration', () => {
  assert.match(app, /if\(total<1\)/);
  assert.match(app, /timer\.left=timer\.duration;drawTimer\(\)/);
  assert.match(app, /pauseTimer\(\);timer\.left=timer\.duration;drawTimer\(\)/);
});

test('original visual system receives restrained compact spacing and reduced-motion support', () => {
  assert.match(css, /Atlas original polish/);
  assert.match(css, /\.nav-item\{[^}]*border-radius:10px/s);
  assert.match(css, /@keyframes atlasPageEnter/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('original sidebar exposes the guided walkthrough after first-run onboarding', () => {
  assert.match(html, /id="atlasGuideNav"/);
  assert.match(app, /atlasGuideNav.*openOnboardingTour/);
});

test('Residence motion respects reduced-motion preferences', () => {
  assert.match(css, /Residence ambient motion/);
  assert.match(css, /atlasOrbitA/);
  assert.match(css, /prefers-reduced-motion:reduce[^}]*\.residence-art/s);
});

test('reviews are persisted in each private workspace snapshot',()=>{assert.match(server,/CREATE TABLE IF NOT EXISTS reviews/);assert.match(server,/app.get\('\/api\/reviews'/);assert.match(server,/app.post\('\/api\/reviews'/);assert.match(server,/'reviews'/);});
test('Reviews and Insights are reachable from the original navigation',()=>{assert.match(index,/data-page="reviews"/);assert.match(index,/data-page="insights"/);assert.match(index,/id="page-reviews"/);assert.match(index,/id="page-insights"/);assert.match(app,/function renderReviews/);assert.match(app,/function renderInsights/);});

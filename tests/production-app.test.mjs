import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');

const requiredFiles = [
  'package.json',
  '.openai/hosting.json',
  'public/index.html',
  'public/styles.css',
  'public/app.js',
  'server/index.js',
  'scripts/build.mjs',
  'scripts/validate-artifact.mjs',
  'README.md',
];

for (const file of requiredFiles) {
  assert.ok(existsSync(file), `Expected ${file} to exist`);
}

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.type, 'module', 'package.json must use ESM');
assert.equal(pkg.scripts.build, 'node scripts/build.mjs');
assert.equal(pkg.scripts.test, 'node --test tests/*.test.mjs');
assert.equal(pkg.scripts.validate, 'node scripts/validate-artifact.mjs');

const html = read('public/index.html');
for (const snippet of [
  'SystemDesign Studio',
  '<main id="app"',
  'public/styles.css',
  'public/app.js',
]) {
  assert.ok(html.includes(snippet), `Expected public/index.html to include ${snippet}`);
}

const app = read('public/app.js');
for (const snippet of [
  'class SystemDesignStudio',
  'renderDashboard',
  'renderWorkspace',
  'renderInspector',
  'renderDiagnostics',
  'renderReview',
  'injectScenario',
  'Architecture health',
  'Create interview',
  'Finish & review',
]) {
  assert.ok(app.includes(snippet), `Expected public/app.js to include ${snippet}`);
}

assert.doesNotMatch(app, /\bTODO\b|TBD|mock only|placeholder/i, 'App source must not contain placeholder markers');

const worker = read('server/index.js');
assert.ok(worker.includes('export default'), 'Worker must be an ESM default export');
assert.ok(worker.includes('async fetch'), 'Worker must expose async fetch');

execFileSync('node', ['scripts/build.mjs'], { stdio: 'pipe' });
execFileSync('node', ['scripts/validate-artifact.mjs'], { stdio: 'pipe' });

const distWorker = await import('../dist/server/index.js?test=' + Date.now());
assert.equal(typeof distWorker.default.fetch, 'function', 'Built Worker must expose default.fetch');

const response = await distWorker.default.fetch(new Request('https://example.test/'));
assert.equal(response.status, 200);
const body = await response.text();
assert.ok(body.includes('SystemDesign Studio'), 'Worker root route must serve the app HTML');

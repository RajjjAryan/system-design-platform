import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const required = [
  'dist/server/index.js',
  'dist/.openai/hosting.json',
  'dist/client/index.html',
  'dist/client/runtime-config.js',
  'dist/client/styles.css',
  'dist/client/app.js',
  'dist/client/sds-data.js',
  'dist/client/sds-knowledge.js',
];

for (const path of required) {
  assert.ok(existsSync(path), `Missing required artifact: ${path}`);
}

JSON.parse(readFileSync('dist/.openai/hosting.json', 'utf8'));

const mod = await import('../dist/server/index.js?validate=' + Date.now());
assert.equal(typeof mod.default, 'object', 'Worker module must export a default object');
assert.equal(typeof mod.default.fetch, 'function', 'Worker default export must expose fetch');

const rootResponse = await mod.default.fetch(new Request('https://example.test/'));
assert.equal(rootResponse.status, 200, 'Root route must return 200');
assert.match(await rootResponse.text(), /SystemDesign Studio/, 'Root route must serve the app');

const jsResponse = await mod.default.fetch(new Request('https://example.test/app.js'));
assert.equal(jsResponse.status, 200, 'Static JS route must return 200');
assert.match(jsResponse.headers.get('content-type') || '', /javascript/, 'JS route must set JavaScript content type');

console.log('Artifact valid');

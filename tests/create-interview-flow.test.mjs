import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('public/app.js', 'utf8');

const requiredSnippets = [
  "screen === 'setup'",
  "screen === 'link'",
  'data-action="setup"',
  'data-action="generateLink"',
  'Candidate link',
  'Interviewer controls',
  'Permissions',
  'Start workspace',
];

for (const snippet of requiredSnippets) {
  assert.ok(
    source.includes(snippet),
    `Expected prototype source to include ${JSON.stringify(snippet)}`,
  );
}

assert.ok(
  /data-action="setup"[\s\S]{0,500}Create interview/.test(source),
  'Expected dashboard Create interview button to open the setup flow',
);

assert.ok(
  /data-action="generateLink"[\s\S]{0,500}Generate candidate link/.test(source),
  'Expected setup flow to expose candidate link generation',
);

assert.ok(
  /data-action="workspace"[\s\S]{0,500}Start workspace/.test(source),
  'Expected setup flow to start the workspace',
);
